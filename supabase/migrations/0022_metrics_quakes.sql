-- More weather metrics (temperature, gusts, snow, UV, air quality) and earthquakes (USGS).
alter table public.markets drop constraint if exists markets_category_check;
alter table public.markets add constraint markets_category_check check (category in ('bus','train','weather','traffic','nature'));

create table if not exists public.metric_observations (
  feed_id text not null,
  metric text not null check (metric in ('temp','wind','snow','uv','aqi')),
  hour_start timestamptz not null,
  value numeric(8,2) not null,
  fetched_at timestamptz not null default now(),
  primary key (feed_id, metric, hour_start)
);
alter table public.metric_observations enable row level security;
revoke all on public.metric_observations from anon, authenticated;

-- A reading only counts as a fact if it was fetched after its hour ended.
alter table public.weather_observations add column if not exists fetched_at timestamptz not null default now();

select cron.unschedule(jobid) from cron.job where jobname = 'prune';
select cron.schedule('prune', '17 3 * * *', $$
  delete from public.delay_observations where observed_at < now() - interval '2 days';
  delete from public.weather_observations where hour_start < now() - interval '3 days';
  delete from public.metric_observations where hour_start < now() - interval '3 days';
  delete from public.trip_schedule where service_date < current_date - 1;
$$);

-- Earthquakes: "will a quake of magnitude >= M strike anywhere on Earth between two instants?"
-- Probabilities come from long-run USGS rates (events per day), as a Poisson process, with the usual 8% margin.
create or replace function public.make_quake_markets() returns integer
language plpgsql security definer set search_path = public as $$
declare w timestamptz; mag numeric; rate numeric; p numeric; n integer := 0; ins integer; k integer;
begin
  for k in 0..3 loop
    w := date_trunc('day', now() at time zone 'UTC') at time zone 'UTC' + make_interval(hours => 6 * (extract(hour from now() at time zone 'UTC')::int / 6 + k));
    if w <= now() + interval '5 minutes' then continue; end if;
    foreach mag in array array[5.0, 6.0] loop
      rate := case when mag = 5.0 then 4.0 else 0.42 end;             -- events per day, worldwide (USGS long-run average)
      p := 1 - exp(-rate * 0.25);
      insert into public.markets (city_id, category, kind, feed_id, params, closes_at, target_at, deadline_at, odds_yes, odds_no, dedupe_key)
      values ('world', 'nature', 'quake_m', 'usgs', jsonb_build_object('minMag', mag),
              w, w + interval '6 hours', w + interval '12 hours',
              round(greatest(1.10, least(15, 0.92 / p))::numeric, 2), round(greatest(1.10, least(15, 0.92 / (1 - p)))::numeric, 2),
              'world|quake_m|' || mag || '|' || extract(epoch from w)::bigint)
      on conflict (dedupe_key) do nothing;
      get diagnostics ins = row_count; n := n + ins;
    end loop;
  end loop;
  return n;
end $$;
revoke execute on function public.make_quake_markets() from public, anon, authenticated;
select cron.unschedule(jobid) from cron.job where jobname = 'quakes';
select cron.schedule('quakes', '3 */3 * * *', $$ select public.make_quake_markets() $$);
select public.make_quake_markets();
