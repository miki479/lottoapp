-- How full a bus is (GTFS-RT occupancy_status, 0 empty ... 5 full), as reported by the vehicle. Written by the ingest job
-- for the trips that have an open bus question; read by `resolve` for "will it be full?" questions and shown live on bus cards.
create table if not exists public.occupancy_observations (
  feed_id text not null,
  trip_id text not null,
  at timestamptz not null,
  level smallint not null check (level between 0 and 5),
  primary key (feed_id, trip_id, at)
);
alter table public.occupancy_observations enable row level security;
revoke all on public.occupancy_observations from anon, authenticated;

-- The latest report (last 10 minutes) of the bus behind each given question.
create or replace function public.live_occupancy(p_markets uuid[])
returns table(market_id uuid, level smallint, at timestamptz)
language sql stable security definer set search_path = public as $$
  select distinct on (m.id) m.id, o.level, o.at
  from public.markets m
  join public.occupancy_observations o on o.feed_id = m.feed_id and o.trip_id = m.params->>'tripId'
  where m.id = any(p_markets) and m.status = 'open' and o.at > now() - interval '10 minutes'
  order by m.id, o.at desc;
$$;
grant execute on function public.live_occupancy(uuid[]) to anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'prune-occupancy';
select cron.schedule('prune-occupancy', '23 3 * * *', $$ delete from public.occupancy_observations where at < now() - interval '2 days' $$);
