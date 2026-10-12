-- Recent history behind the global "number" questions (coin prices, Kp index, daily page views) for the charts in the app.
create table if not exists public.tick_history (
  series text not null,
  at timestamptz not null,
  value numeric(14,2) not null,
  primary key (series, at)
);
alter table public.tick_history enable row level security;
revoke all on public.tick_history from anon, authenticated;

create or replace function public.tick_history(p_series text, p_limit integer default 72)
returns table (at timestamptz, value numeric) language sql stable security definer set search_path = public as $$
  select h.at, h.value from (
    select at, value from public.tick_history where series = p_series order by at desc limit least(greatest(p_limit, 1), 200)
  ) h order by h.at;
$$;
grant execute on function public.tick_history(text, integer) to anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'prune';
select cron.schedule('prune', '17 3 * * *', $$
  delete from public.delay_observations where observed_at < now() - interval '2 days';
  delete from public.weather_observations where hour_start < now() - interval '3 days';
  delete from public.metric_observations where hour_start < now() - interval '3 days';
  delete from public.traffic_observations where hour_start < now() - interval '3 days';
  delete from public.tick_observations where at < now() - interval '3 days';
  delete from public.tick_history where at < now() - interval '30 days';
  delete from public.trip_schedule where service_date < current_date - 1;
$$);
