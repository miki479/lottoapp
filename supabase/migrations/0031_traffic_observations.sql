-- Road traffic: one row per station direction and hour (the hourly average speed read just before the hour ended).
create table if not exists public.traffic_observations (
  feed_id text not null,
  site_id text not null,
  direction smallint not null check (direction in (1, 2)),
  hour_start timestamptz not null,
  avg_kmh numeric(6,1) not null,
  vehicles integer not null default 0,
  measured_at timestamptz not null,
  primary key (feed_id, site_id, direction, hour_start)
);
alter table public.traffic_observations enable row level security;
revoke all on public.traffic_observations from anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'prune';
select cron.schedule('prune', '17 3 * * *', $$
  delete from public.delay_observations where observed_at < now() - interval '2 days';
  delete from public.weather_observations where hour_start < now() - interval '3 days';
  delete from public.metric_observations where hour_start < now() - interval '3 days';
  delete from public.traffic_observations where hour_start < now() - interval '3 days';
  delete from public.trip_schedule where service_date < current_date - 1;
$$);
