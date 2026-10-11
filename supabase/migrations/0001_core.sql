-- Core game schema. Play-money only: credits have no cash value and cannot be bought or sold.
-- Cities live in /cities/*.json, not in the database: city_id is just a text key.

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  locale text not null default 'en-US',
  country text,
  city_id text not null default 'tokyo',
  timezone text not null default 'Asia/Tokyo',
  credits integer not null default 1000 check (credits >= 0),
  last_refill_date date,
  created_at timestamptz not null default now()
);

create table public.markets (
  id uuid primary key default gen_random_uuid(),
  city_id text not null,
  category text not null check (category in ('bus','weather','traffic')),
  kind text not null,
  feed_id text not null,
  params jsonb not null,                 -- routeId, tripId, stopId, thresholdSec / minMm ...
  label jsonb not null default '{}',     -- ready-made text per locale, written by the generator
  closes_at timestamptz not null,
  target_at timestamptz not null,
  deadline_at timestamptz not null,
  odds_yes numeric(6,2) not null check (odds_yes >= 1),
  odds_no  numeric(6,2) not null check (odds_no  >= 1),
  flash_multiplier numeric(4,2) not null default 1 check (flash_multiplier between 1 and 3),
  status text not null default 'open' check (status in ('open','resolved','void')),
  outcome text check (outcome in ('yes','no')),
  void_reason text,
  evidence jsonb,
  created_at timestamptz not null default now(),
  check (closes_at <= target_at and target_at <= deadline_at)
);
create index markets_open_idx on public.markets (status, closes_at);

create table public.bets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  market_id uuid not null references public.markets(id),
  pick text not null check (pick in ('yes','no')),
  stake integer not null check (stake between 10 and 500),
  odds numeric(6,2) not null,             -- odds locked at placement time
  status text not null default 'open' check (status in ('open','won','lost','void')),
  payout integer not null default 0,
  placed_at timestamptz not null default now(),
  settled_at timestamptz,
  unique (user_id, market_id)
);
create index bets_market_idx on public.bets (market_id) where status = 'open';

-- Observations feed both the resolver and the odds.
create table public.delay_observations (
  id bigint generated always as identity primary key,
  city_id text not null,
  feed_id text not null,
  route_id text not null default '',
  trip_id text not null,
  stop_id text not null,
  observed_at timestamptz not null,
  delay_sec integer not null,
  unique (feed_id, trip_id, stop_id, observed_at)
);
create index delay_obs_lookup on public.delay_observations (feed_id, trip_id, stop_id, observed_at);
create index delay_obs_route_time on public.delay_observations (route_id, observed_at);

create table public.weather_observations (
  city_id text not null,
  feed_id text not null,
  hour_start timestamptz not null,
  precipitation_mm numeric(6,2) not null check (precipitation_mm >= 0),
  primary key (feed_id, hour_start)
);

create table public.feed_health (
  feed_id text primary key,
  last_ok_at timestamptz,
  last_error text,
  last_error_at timestamptz
);

-- Compact history for odds: raw rows are pruned, these counters are kept.
create table public.odds_history (
  city_id text not null,
  kind text not null,
  route_id text not null default '',
  hour_of_day smallint not null check (hour_of_day between 0 and 23),
  threshold integer not null default 0,
  n integer not null default 0,
  yes integer not null default 0,
  primary key (city_id, kind, route_id, hour_of_day, threshold)
);

-- Row level security: users read markets and their own data; only server code writes the rest.
alter table public.profiles enable row level security;
alter table public.markets enable row level security;
alter table public.bets enable row level security;
alter table public.delay_observations enable row level security;
alter table public.weather_observations enable row level security;
alter table public.feed_health enable row level security;
alter table public.odds_history enable row level security;

create policy "own profile read" on public.profiles for select using (auth.uid() = id);
create policy "own profile update" on public.profiles for update using (auth.uid() = id)
  with check (auth.uid() = id);
create policy "markets are public" on public.markets for select using (true);
create policy "own bets read" on public.bets for select using (auth.uid() = user_id);
create policy "feed health is public" on public.feed_health for select using (true);
-- No insert/update policies on bets, markets or credits: all writes go through the functions below.
revoke update (credits, last_refill_date, timezone, city_id) on public.profiles from authenticated, anon;

-- Place a bet atomically: checks the market is open, locks the odds, debits the stake.
create or replace function public.place_bet(p_market uuid, p_pick text, p_stake integer)
returns public.bets
language plpgsql security definer set search_path = public as $$
declare
  m public.markets;
  prof public.profiles;
  b public.bets;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if p_pick not in ('yes','no') then raise exception 'bad_pick'; end if;
  select * into m from public.markets where id = p_market for share;
  if not found or m.status <> 'open' or now() >= m.closes_at then raise exception 'market_closed'; end if;
  select * into prof from public.profiles where id = auth.uid() for update;
  if not found then raise exception 'no_profile'; end if;
  if p_stake < 10 or p_stake > 500 then raise exception 'bad_stake'; end if;
  if prof.credits < p_stake then raise exception 'insufficient_credits'; end if;
  update public.profiles set credits = credits - p_stake where id = prof.id;
  insert into public.bets (user_id, market_id, pick, stake, odds)
  values (prof.id, m.id, p_pick, p_stake, case when p_pick = 'yes' then m.odds_yes else m.odds_no end)
  returning * into b;
  return b;
end $$;
grant execute on function public.place_bet(uuid, text, integer) to authenticated;

-- Settle every open bet of a market. Server-side only (service role).
-- p_result: 'yes' | 'no' | 'void'. Void refunds the stake: a feed outage never costs credits.
create or replace function public.settle_market(p_market uuid, p_result text, p_evidence jsonb default null, p_void_reason text default null)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  m public.markets;
  n integer := 0;
begin
  if p_result not in ('yes','no','void') then raise exception 'bad_result'; end if;
  select * into m from public.markets where id = p_market for update;
  if not found then raise exception 'unknown_market'; end if;
  if m.status <> 'open' then return 0; end if;  -- idempotent

  update public.markets set
    status = case when p_result = 'void' then 'void' else 'resolved' end,
    outcome = case when p_result = 'void' then null else p_result end,
    void_reason = p_void_reason,
    evidence = p_evidence
  where id = m.id;

  with settled as (
    update public.bets b set
      status = case when p_result = 'void' then 'void' when b.pick = p_result then 'won' else 'lost' end,
      payout = case when p_result = 'void' then b.stake when b.pick = p_result then floor(b.stake * b.odds)::int else 0 end,
      settled_at = now()
    where b.market_id = m.id and b.status = 'open'
    returning b.user_id, b.payout
  ), credit as (
    update public.profiles p set credits = p.credits + s.total
    from (select user_id, sum(payout) as total from settled group by user_id) s
    where p.id = s.user_id
    returning 1
  )
  select count(*) into n from settled;
  return n;
end $$;
revoke execute on function public.settle_market(uuid, text, jsonb, text) from public, anon, authenticated;

-- Daily top-up, once per local day of the player's timezone, computed server-side (never trust the client's date).
-- Constants mirror shared/wallet.ts (REFILL_THRESHOLD=100, REFILL_TO=250, stakes 10..500).
create or replace function public.claim_daily_refill()
returns integer
language plpgsql security definer set search_path = public as $$
declare
  prof public.profiles;
  today date;
begin
  select * into prof from public.profiles where id = auth.uid() for update;
  if not found then return 0; end if;
  today := (now() at time zone prof.timezone)::date;
  if prof.last_refill_date = today or prof.credits >= 100 then return prof.credits; end if;
  update public.profiles set credits = 250, last_refill_date = today where id = prof.id;
  return 250;
end $$;
grant execute on function public.claim_daily_refill() to authenticated;
