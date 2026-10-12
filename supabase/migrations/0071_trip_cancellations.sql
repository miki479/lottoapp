-- Trips (or single stops) that the operator's feed reports as cancelled. A bet on a cancelled trip is refunded at once, with its own reason.
drop table if exists public.trip_cancellations;
create table public.trip_cancellations (
  feed_id text not null,
  trip_id text not null,
  stop_id text not null default '',   -- '' = the whole trip
  detected_at timestamptz not null default now(),
  primary key (feed_id, trip_id, stop_id)
);
create index trip_cancellations_recent on public.trip_cancellations (detected_at);
alter table public.trip_cancellations enable row level security;
revoke all on public.trip_cancellations from anon, authenticated;
