-- Position feeds are sampled every ~30 s: keep the stop's position in the trip so the resolver
-- can accept a reading taken a stop or two after the event's stop.
alter table public.delay_observations add column if not exists stop_sequence integer;

-- Backfill readings stored before this column existed.
update public.delay_observations o set stop_sequence = t.stop_sequence
from public.trip_schedule t
where o.stop_sequence is null and t.feed_id = o.feed_id and t.trip_id = o.trip_id and t.stop_id = o.stop_id;
