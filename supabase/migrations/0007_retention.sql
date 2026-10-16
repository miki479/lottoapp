-- Retention: daily rings, streak with freezes, trophies, monthly season ranking, friend groups.
-- Everything that changes credits, streaks or trophies runs server-side; clients can only read.

alter table public.profiles
  add column if not exists streak integer not null default 0,
  add column if not exists best_streak integer not null default 0,
  add column if not exists freezes integer not null default 1 check (freezes between 0 and 2),
  add column if not exists last_play_date date;
alter table public.profiles drop constraint if exists display_name_len;
alter table public.profiles add constraint display_name_len check (display_name is null or char_length(display_name) between 2 and 24);

-- One row per player per local day. A ring is closed when its counter is >= 1.
create table if not exists public.daily_progress (
  user_id uuid not null references public.profiles(id) on delete cascade,
  day date not null,
  bus integer not null default 0,
  train integer not null default 0,
  weather integer not null default 0,
  traffic integer not null default 0,
  bonus_claimed boolean not null default false,
  primary key (user_id, day)
);
alter table public.daily_progress enable row level security;
create policy "own progress" on public.daily_progress for select using (auth.uid() = user_id);
grant select on public.daily_progress to authenticated;

create table if not exists public.trophies (
  user_id uuid not null references public.profiles(id) on delete cascade,
  trophy_id text not null,
  earned_at timestamptz not null default now(),
  primary key (user_id, trophy_id)
);
alter table public.trophies enable row level security;
create policy "trophies are public" on public.trophies for select using (true);
grant select on public.trophies to authenticated;

create table if not exists public.groups (
  code text primary key,
  name text not null check (char_length(name) between 2 and 30),
  owner uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
create table if not exists public.group_members (
  group_code text not null references public.groups(code) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_code, user_id)
);
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
create policy "members see their groups" on public.groups for select
  using (exists (select 1 from public.group_members m where m.group_code = code and m.user_id = auth.uid()));
create policy "members see own memberships" on public.group_members for select using (user_id = auth.uid());
grant select on public.groups, public.group_members to authenticated;

-- ---- internal helpers (not callable by clients) ----
create or replace function public.grant_trophy(p_uid uuid, p_trophy text) returns void
language sql security definer set search_path = public as $$
  insert into public.trophies (user_id, trophy_id) values (p_uid, p_trophy) on conflict do nothing;
$$;

-- Called inside place_bet, with the profile row already locked.
create or replace function public.register_play(p_uid uuid, p_category text) returns void
language plpgsql security definer set search_path = public as $$
declare
  prof public.profiles;
  today date;
  new_streak integer;
  new_freezes integer;
  dp public.daily_progress;
begin
  select * into prof from public.profiles where id = p_uid;
  today := (now() at time zone prof.timezone)::date;
  new_streak := prof.streak;
  new_freezes := prof.freezes;

  if prof.last_play_date is distinct from today then
    if prof.last_play_date = today - 1 then
      new_streak := prof.streak + 1;
    elsif prof.last_play_date = today - 2 and prof.freezes > 0 then
      new_streak := prof.streak + 1;          -- one missed day, bridged by a freeze
      new_freezes := prof.freezes - 1;
    else
      new_streak := 1;
    end if;
    if new_streak > prof.streak and new_streak % 7 = 0 then new_freezes := least(new_freezes + 1, 2); end if;
    update public.profiles set streak = new_streak, best_streak = greatest(best_streak, new_streak),
      freezes = new_freezes, last_play_date = today where id = p_uid;
    if new_streak >= 7 then perform public.grant_trophy(p_uid, 'streak_7'); end if;
    if new_streak >= 30 then perform public.grant_trophy(p_uid, 'streak_30'); end if;
  end if;

  insert into public.daily_progress (user_id, day) values (p_uid, today) on conflict do nothing;
  update public.daily_progress set
    bus = bus + (p_category = 'bus')::int, train = train + (p_category = 'train')::int,
    weather = weather + (p_category = 'weather')::int, traffic = traffic + (p_category = 'traffic')::int
  where user_id = p_uid and day = today
  returning * into dp;

  -- All three rings closed: one bonus per day.
  if dp.bus > 0 and dp.train > 0 and dp.weather > 0 and not dp.bonus_claimed then
    update public.daily_progress set bonus_claimed = true where user_id = p_uid and day = today;
    update public.profiles set credits = credits + 100 where id = p_uid;
    perform public.grant_trophy(p_uid, 'all_rings');
  end if;
end $$;
revoke execute on function public.grant_trophy(uuid, text), public.register_play(uuid, text) from public, anon, authenticated;

-- place_bet now also feeds rings and streak.
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
  perform public.register_play(prof.id, m.category);
  return b;
end $$;

-- settle_market now also awards trophies (ironic and rare on purpose).
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
  if m.status <> 'open' then return 0; end if;

  update public.markets set
    status = case when p_result = 'void' then 'void' else 'resolved' end,
    outcome = case when p_result = 'void' then null else p_result end,
    void_reason = p_void_reason, evidence = p_evidence
  where id = m.id;

  with settled as (
    update public.bets b set
      status = case when p_result = 'void' then 'void' when b.pick = p_result then 'won' else 'lost' end,
      payout = case when p_result = 'void' then b.stake when b.pick = p_result then floor(b.stake * b.odds)::int else 0 end,
      settled_at = now()
    where b.market_id = m.id and b.status = 'open'
    returning b.user_id, b.payout, b.status, b.odds, b.stake, b.pick
  ), credit as (
    update public.profiles p set credits = p.credits + s.total
    from (select user_id, sum(payout) as total from settled group by user_id) s
    where p.id = s.user_id
    returning 1
  ), awards as (
    insert into public.trophies (user_id, trophy_id)
    select user_id, t from settled, lateral (values
      (case when status = 'won' then 'first_win' end),
      (case when status = 'won' and odds >= 5 then 'long_shot' end),
      (case when status = 'won' and m.kind = 'rain_at' and pick = 'yes' then 'rain_man' end),
      (case when status = 'won' and m.category = 'train' and pick = 'yes' then 'train_whisperer' end),
      (case when status = 'void' then 'ghost_feed' end),
      (case when status = 'won' and stake >= 500 then 'high_roller' end)
    ) as x(t) where t is not null
    on conflict do nothing
    returning 1
  )
  select count(*) into n from settled;
  return n;
end $$;

-- ---- player-facing functions ----
create or replace function public.set_country(p_country text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if p_country !~ '^[A-Za-z]{2}$' then raise exception 'bad_country'; end if;
  update public.profiles set country = upper(p_country) where id = auth.uid();
end $$;

create or replace function public.is_registered() returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from auth.users where id = auth.uid() and not is_anonymous and email is not null);
$$;

-- Monthly season ranking: net credits won or lost on bets settled this calendar month (UTC).
-- Only registered players with a display name appear. Trophies are forever, rankings reset monthly.
create or replace function public.leaderboard(p_scope text, p_key text default null, p_limit integer default 50)
returns table(rank bigint, user_id uuid, display_name text, score bigint, bets bigint, streak integer, is_me boolean)
language sql security definer stable set search_path = public as $$
  with scores as (
    select p.id, p.display_name, p.streak,
           coalesce(sum(case b.status when 'won' then b.payout - b.stake when 'lost' then -b.stake else 0 end), 0)::bigint as score,
           count(b.id) filter (where b.status in ('won','lost')) as bets
    from public.profiles p
    join auth.users u on u.id = p.id and not u.is_anonymous and u.email is not null
    join public.bets b on b.user_id = p.id and b.status <> 'open' and b.settled_at >= date_trunc('month', now())
    where p.display_name is not null and (
      p_scope = 'global'
      or (p_scope = 'country' and p.country = upper(p_key))
      or (p_scope = 'city' and p.city_id = p_key)
      or (p_scope = 'group'
          and exists (select 1 from public.group_members g where g.group_code = upper(p_key) and g.user_id = p.id)
          and exists (select 1 from public.group_members g2 where g2.group_code = upper(p_key) and g2.user_id = auth.uid()))
    )
    group by p.id
  )
  select rank() over (order by score desc, bets desc), id, display_name, score, bets, streak, id = auth.uid()
  from scores order by 1, display_name limit least(p_limit, 100);
$$;

create or replace function public.create_group(p_name text) returns text
language plpgsql security definer set search_path = public as $$
declare
  c text;
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
begin
  if not public.is_registered() then raise exception 'registration_required'; end if;
  loop
    c := (select string_agg(substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1), '') from generate_series(1, 6));
    exit when not exists (select 1 from public.groups where code = c);
  end loop;
  insert into public.groups (code, name, owner) values (c, trim(p_name), auth.uid());
  insert into public.group_members (group_code, user_id) values (c, auth.uid());
  return c;
end $$;

create or replace function public.join_group(p_code text) returns text
language plpgsql security definer set search_path = public as $$
declare g public.groups;
begin
  if not public.is_registered() then raise exception 'registration_required'; end if;
  select * into g from public.groups where code = upper(trim(p_code));
  if not found then raise exception 'unknown_group'; end if;
  insert into public.group_members (group_code, user_id) values (g.code, auth.uid()) on conflict do nothing;
  return g.code;
end $$;

grant execute on function public.set_country(text), public.is_registered(), public.leaderboard(text, text, integer),
  public.create_group(text), public.join_group(text) to authenticated;
grant execute on function public.place_bet(uuid, text, integer) to authenticated;
