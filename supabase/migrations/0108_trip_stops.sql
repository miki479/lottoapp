-- "Show stops": the stops of the trip behind a bus / train delay question, with the scheduled time of each, what has been measured so far
-- and where the vehicle is. Read by the app when the player opens the stops board (bet slip, market detail, "My bets").
--
-- Where the data comes from (nothing new is collected for it):
--   trip_schedule      every scheduled stop of the trips that have a market (written by scripts/generate-markets.mjs, kept for two days).
--                      Feeds without a timetable in the database (kind "trip_updates" with explicit delays: Dutch trains, SNCF, Keisei...) have no
--                      rows here, so for them the function returns nothing and the app hides the control.
--   delay_observations the readings of the ingest job: the whole trip for position feeds (Toei) and for ViaggiaTreno trains, only the question's
--                      stop (a forecast, until the vehicle gets there) for the TripUpdates feeds.
--   gtfs_stops         names of the stops for the feeds the "near me" loader covers; trip_schedule.stop_name for the others.
-- Nothing personal is read or returned: stops, times, delays.

-- the name of the stop, written next to the timetable by the market generator (feeds that gtfs_stops does not cover have no other source)
alter table public.trip_schedule add column if not exists stop_name text;

drop function if exists public.trip_stops(uuid);
create function public.trip_stops(p_market uuid)
returns table(
  seq integer,                 -- stop_sequence in the trip, ascending
  stop_id text,
  name text,                   -- null when no name is known for this stop
  sched_at timestamptz,        -- scheduled time (an instant: the app writes it in the city's time zone)
  delay_sec integer,           -- measured here (a fact: the first reading after the vehicle got to the stop) or, when there is none, the feed's latest forecast; null = nothing known
  seen_at timestamptz,         -- when that reading was taken
  is_forecast boolean,         -- true when delay_sec is still a forecast, null when there is no reading
  is_current boolean,          -- the last stop the vehicle is known to have reached (a measured reading)
  is_market boolean,           -- the stop the question is about
  is_cancelled boolean,        -- the operator says this stop (or the whole trip) is not served
  now_delay_sec integer,       -- the trip's latest delay within the last 30 minutes (same on every row), null when there is none
  now_at timestamptz,
  now_forecast boolean,
  prev_delay_sec integer       -- the delay read about 12 minutes before now_at (between 6 and 25), for the trend; null when there is none
)
language sql stable security definer set search_path = public as $$
  with m as (
    select k.feed_id, k.target_at, k.params->>'tripId' as trip, nullif(k.params->>'stopSequence', '')::int as mseq,
           k.params->>'stopId' as mstop, k.params->>'stopName' as mname
    from public.markets k
    where k.id = p_market and k.kind in ('bus_delay_gt', 'train_delay_gt') and k.params->>'tripId' is not null
  ), sch as (
    -- GTFS "HH:MM:SS", the hour may pass 24 (a trip that goes on after midnight)
    select s.stop_sequence as seq, s.stop_id, s.stop_name,
           case when s.scheduled_time ~ '^[0-9]{1,3}:[0-9]{2}:[0-9]{2}$'
                then split_part(s.scheduled_time, ':', 1)::int * 3600 + split_part(s.scheduled_time, ':', 2)::int * 60 + split_part(s.scheduled_time, ':', 3)::int end as secs
    from m join public.trip_schedule s on s.feed_id = m.feed_id and s.trip_id = m.trip
  ), anchor as (
    -- the question's own stop pins the timetable to real time: its scheduled time is the market's target instant, so no time zone is needed here
    select s.seq, s.secs from sch s, m
    where s.secs is not null and (s.seq = m.mseq or s.stop_id = m.mstop)
    order by (s.seq = m.mseq) desc, s.seq limit 1
  ), obs as (
    select o.stop_id, o.stop_sequence, o.delay_sec, o.observed_at,
           -- a TripUpdate is a forecast until it is refreshed close to the predicted passage (same rule as the resolver)
           (o.predicted_at is null or o.observed_at >= o.predicted_at - interval '120 seconds') as fact
    from m join public.delay_observations o on o.feed_id = m.feed_id and o.trip_id = m.trip
    where o.observed_at > now() - interval '6 hours'
  ), per as (
    select distinct on (s.seq) s.seq, o.delay_sec, o.observed_at, o.fact
    from sch s join obs o on case when o.stop_sequence is not null then o.stop_sequence = s.seq else o.stop_id = s.stop_id end
    -- facts before forecasts; of the facts the earliest (a position feed repeats the last passed stop until the next one), of the forecasts the latest
    order by s.seq, o.fact desc, case when o.fact then o.observed_at end asc, o.observed_at desc
  ), cur as (
    select max(p.seq) as seq from per p where p.fact
  ), nowr as (
    select o.delay_sec, o.observed_at, o.fact from obs o where o.observed_at > now() - interval '30 minutes' order by o.observed_at desc limit 1
  ), prev as (
    select o.delay_sec from obs o, nowr n
    where o.observed_at between n.observed_at - interval '25 minutes' and n.observed_at - interval '6 minutes'
    order by abs(extract(epoch from (n.observed_at - o.observed_at)) - 750), o.observed_at desc limit 1
  ), board as (
    select s.seq, s.stop_id, coalesce(s.stop_name, g.name, case when s.seq = a.seq then m.mname end) as name,
           m.target_at + (s.secs - a.secs) * interval '1 second' as sched_at,
           p.delay_sec, p.observed_at as seen_at, case when p.fact is null then null else not p.fact end as is_forecast,
           coalesce(s.seq = c.seq, false) as is_current, s.seq = a.seq as is_market,
           exists (select 1 from public.trip_cancellations x where x.feed_id = m.feed_id and x.trip_id = m.trip and x.stop_id in (s.stop_id, '')) as is_cancelled,
           n.delay_sec as now_delay_sec, n.observed_at as now_at, case when n.fact is null then null else not n.fact end as now_forecast, pv.delay_sec as prev_delay_sec
    from sch s
    cross join m
    cross join anchor a
    left join per p on p.seq = s.seq
    left join cur c on true
    left join nowr n on true
    left join prev pv on true
    left join public.gtfs_stops g on g.feed_id = m.feed_id and g.stop_id = s.stop_id
    where s.secs is not null
  ), counted as (
    select b.*, count(*) over () as n_all, count(b.name) over () as n_named from board b
  )
  -- a board with fewer than two stops, or mostly nameless, says nothing: return nothing and the app hides the control
  select c.seq, c.stop_id, c.name, c.sched_at, c.delay_sec, c.seen_at, c.is_forecast, c.is_current, c.is_market, c.is_cancelled,
         c.now_delay_sec, c.now_at, c.now_forecast, c.prev_delay_sec
  from counted c
  where c.n_all >= 2 and c.n_named * 2 >= c.n_all
  order by c.seq;
$$;
revoke all on function public.trip_stops(uuid) from public;
grant execute on function public.trip_stops(uuid) to anon, authenticated;
