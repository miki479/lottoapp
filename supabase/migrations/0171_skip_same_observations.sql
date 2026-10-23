-- Every ingest rewrites the whole forecast window (about 4 days) of weather and metric observations: millions of updates that change nothing,
-- each one a new row version and WAL on a small disk. An unchanged row is now left alone, except for the one refresh the resolver needs:
-- the first one stamped after the hour is over (shared/resolve.ts only trusts an observation fetched after hour_start + 1 hour).
create or replace function public.skip_same_metric() returns trigger language plpgsql as $$
begin
  if new.value is not distinct from old.value
     and new.feed_id = old.feed_id and new.metric = old.metric and new.hour_start = old.hour_start
     and not (old.fetched_at < old.hour_start + interval '1 hour' and new.fetched_at >= old.hour_start + interval '1 hour') then
    return null;
  end if;
  return new;
end $$;
drop trigger if exists skip_same on public.metric_observations;
create trigger skip_same before update on public.metric_observations for each row execute function public.skip_same_metric();

create or replace function public.skip_same_weather() returns trigger language plpgsql as $$
begin
  if new.precipitation_mm is not distinct from old.precipitation_mm
     and new.city_id is not distinct from old.city_id and new.feed_id = old.feed_id and new.hour_start = old.hour_start
     and not (old.fetched_at < old.hour_start + interval '1 hour' and new.fetched_at >= old.hour_start + interval '1 hour') then
    return null;
  end if;
  return new;
end $$;
drop trigger if exists skip_same on public.weather_observations;
create trigger skip_same before update on public.weather_observations for each row execute function public.skip_same_weather();
