-- Global "number at a given instant" questions: crypto prices, geomagnetic Kp index (aurora), Wikipedia page views.
alter table public.markets drop constraint if exists markets_category_check;
alter table public.markets add constraint markets_category_check check (category in ('bus','train','weather','traffic','nature','strike','finance','culture','sport'));

create table if not exists public.tick_observations (
  series text not null,
  at timestamptz not null,            -- the instant (or end of the period) the question is about
  value numeric(14,2) not null,
  fetched_at timestamptz not null default now(),
  primary key (series, at)
);
alter table public.tick_observations enable row level security;
revoke all on public.tick_observations from anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'prune';
select cron.schedule('prune', '17 3 * * *', $$
  delete from public.delay_observations where observed_at < now() - interval '2 days';
  delete from public.weather_observations where hour_start < now() - interval '3 days';
  delete from public.metric_observations where hour_start < now() - interval '3 days';
  delete from public.traffic_observations where hour_start < now() - interval '3 days';
  delete from public.tick_observations where at < now() - interval '3 days';
  delete from public.trip_schedule where service_date < current_date - 1;
$$);
