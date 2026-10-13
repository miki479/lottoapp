-- More pushes (all inside the existing caps: 2 optional a day, never 22:00-08:00 local):
-- level up / new trophy, a train you bet on is running late, the Sunday recap, and a gentle "come back" after 7 and 21 days.
alter table public.profiles add column if not exists level_pushed integer;
alter table public.profiles add column if not exists rewards_pushed_at timestamptz;
alter table public.profiles add column if not exists comeback_stage smallint not null default 0;
alter table public.profiles add column if not exists recap_week text;
update public.profiles set level_pushed = coalesce(level, 1), rewards_pushed_at = now() where level_pushed is null;
alter table public.bets add column if not exists live_alerted boolean not null default false;

-- Open bets on a delay question whose vehicle is, right now, past the line of the question (real readings of the last 10 minutes, not forecasts).
create or replace function public.live_bet_alerts() returns table(bet_id uuid, user_id uuid, route text, delay_min integer, line_min integer, pick text)
language sql stable security definer set search_path = public as $$
  select b.id, b.user_id, coalesce(m.params->>'routeName', ''), (l.delay_sec / 60)::integer, ((m.params->>'thresholdSec')::integer / 60), b.pick
  from public.bets b
  join public.markets m on m.id = b.market_id and m.kind in ('bus_delay_gt', 'train_delay_gt') and m.status = 'open'
  join lateral (
    select o.delay_sec from public.delay_observations o
    where o.feed_id = m.feed_id and o.trip_id = m.params->>'tripId' and o.observed_at > now() - interval '10 minutes' and o.predicted_at is null
    order by o.observed_at desc limit 1
  ) l on true
  where b.status = 'open' and not b.live_alerted and m.params ? 'thresholdSec' and l.delay_sec > (m.params->>'thresholdSec')::integer
  limit 200;
$$;
revoke execute on function public.live_bet_alerts() from public, anon, authenticated;
grant execute on function public.live_bet_alerts() to service_role;

-- What a player did in the last seven days, for the Sunday recap.
create or replace function public.week_recap(p_user uuid) returns table(n integer, won integer)
language sql stable security definer set search_path = public as $$
  select count(*)::integer, (count(*) filter (where status = 'won'))::integer from public.bets where user_id = p_user and status in ('won', 'lost') and settled_at > now() - interval '7 days';
$$;
revoke execute on function public.week_recap(uuid) from public, anon, authenticated;
grant execute on function public.week_recap(uuid) to service_role;
