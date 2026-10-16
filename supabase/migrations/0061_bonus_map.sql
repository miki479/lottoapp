-- (1) "How full will it be?" bonus on delay bets: +15% on the winnings when the guess is right, nothing lost when it is wrong.
alter table public.bets add column if not exists bonus text check (bonus in ('free', 'few', 'standing'));
alter table public.bets add column if not exists bonus_hit boolean;

drop function if exists public.place_bet(uuid, text, integer, boolean);
create or replace function public.place_bet(p_market uuid, p_pick text, p_stake integer, p_boost boolean default false, p_bonus text default null)
returns bets
language plpgsql security definer set search_path to 'public' as $function$
declare
  m public.markets;
  prof public.profiles;
  b public.bets;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if public.registration_required() and not public.is_registered() then raise exception 'registration_required'; end if;
  if p_pick not in ('yes','no') then raise exception 'bad_pick'; end if;
  select * into m from public.markets where id = p_market for share;
  if not found or m.status <> 'open' or now() >= m.closes_at then raise exception 'market_closed'; end if;
  if p_bonus is not null and (p_bonus not in ('free','few','standing') or m.kind <> 'bus_delay_gt' or coalesce(m.params->>'occBonus', '') <> 'true') then raise exception 'bad_bonus'; end if;
  select * into prof from public.profiles where id = auth.uid() for update;
  if not found then raise exception 'no_profile'; end if;
  if (select count(*) from public.bets where user_id = prof.id and placed_at > now() - interval '1 minute')
   + (select count(*) from public.parlays where user_id = prof.id and placed_at > now() - interval '1 minute') >= 8 then
    raise exception 'rate_limited';
  end if;
  if p_stake < 10 or p_stake > 500 then raise exception 'bad_stake'; end if;
  if prof.credits < p_stake then raise exception 'insufficient_credits'; end if;
  if p_boost and prof.boosts < 1 then raise exception 'no_boost'; end if;
  update public.profiles set credits = credits - p_stake, boosts = boosts - (case when p_boost then 1 else 0 end) where id = prof.id;
  insert into public.bets (user_id, market_id, pick, stake, odds, boosted, bonus)
  values (prof.id, m.id, p_pick, p_stake, case when p_pick = 'yes' then m.odds_yes else m.odds_no end, p_boost, p_bonus)
  returning * into b;
  perform public.register_play(prof.id, m.category);
  perform public.pay_referral(prof.id);
  return b;
end $function$;
grant execute on function public.place_bet(uuid, text, integer, boolean, text) to authenticated;

-- Settlement: a winning bet with a bonus gets +15% of its winnings if the bus really was in the guessed state (evidence.occ = level 0..5 at the stop).
-- No reading of the occupancy means no bonus and no loss.
create or replace function public.settle_market(p_market uuid, p_result text, p_evidence jsonb default null, p_void_reason text default null)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  m public.markets;
  n integer := 0;
  occ integer := case when p_evidence ? 'occ' then (p_evidence->>'occ')::int else null end;
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

  with calc as (
    select b.id,
      case when b.bonus is null or occ is null then null
           when b.bonus = 'free' then occ <= 1 when b.bonus = 'few' then occ = 2 else occ >= 3 end as hit
    from public.bets b where b.market_id = m.id and b.status = 'open'
  ), settled as (
    update public.bets b set
      status = case when p_result = 'void' then 'void' when b.pick = p_result then 'won' else 'lost' end,
      bonus_hit = c.hit,
      payout = case when p_result = 'void' then b.stake when b.pick = p_result then floor(b.stake * b.odds)::int + case when b.boosted then least(1000, floor(b.stake * b.odds)::int - b.stake) else 0 end + case when c.hit then floor((floor(b.stake * b.odds)::int - b.stake) * 0.15)::int else 0 end else 0 end,
      settled_at = now()
    from calc c
    where b.id = c.id
    returning b.user_id, b.payout, b.status, b.odds, b.stake, b.pick, b.boosted
  ), credit as (
    update public.profiles p set credits = p.credits + s.total, boosts = least(20, p.boosts + s.back)
    from (select user_id, sum(payout) as total, count(*) filter (where status = 'void' and boosted) as back from settled group by user_id) s
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
  perform public.settle_legs(m.id, p_result);
  return n;
end $$;
revoke execute on function public.settle_market(uuid, text, jsonb, text) from public, anon, authenticated;

-- (2) Where is the vehicle: the latest position of each trip that has an open question (written by the ingest job).
create table if not exists public.vehicle_positions (
  feed_id text not null,
  trip_id text not null,
  at timestamptz not null,
  lat double precision not null,
  lon double precision not null,
  bearing real,
  primary key (feed_id, trip_id)
);
alter table public.vehicle_positions enable row level security;
revoke all on public.vehicle_positions from anon, authenticated;

create or replace function public.vehicle_position(p_markets uuid[])
returns table(market_id uuid, lat double precision, lon double precision, bearing real, at timestamptz)
language sql stable security definer set search_path = public as $$
  select m.id, v.lat, v.lon, v.bearing, v.at
  from public.markets m
  join public.vehicle_positions v on v.feed_id = m.feed_id and v.trip_id = m.params->>'tripId'
  where m.id = any(p_markets) and v.at > now() - interval '15 minutes';
$$;
grant execute on function public.vehicle_position(uuid[]) to authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'prune-vehicles';
select cron.schedule('prune-vehicles', '29 3 * * *', $$ delete from public.vehicle_positions where at < now() - interval '1 day' $$);
