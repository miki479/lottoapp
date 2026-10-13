-- "What is about to pass near me": the stops and routes of the real-time feeds, the timetable of the stops for feeds whose TripUpdates only
-- number their stops, and a small counter that limits how often a player may ask. Loaded by scripts/load-stops.mjs (daily), read by the
-- Edge Functions `nearby` and `stop-offer` with the service role. Nothing here is reachable by anon or authenticated, and no position is stored.

create table if not exists public.gtfs_stops (
  feed_id text not null,
  stop_id text not null,
  name text not null,
  lat double precision not null check (lat between -90 and 90),
  lon double precision not null check (lon between -180 and 180),
  city_id text not null,
  loaded_at timestamptz not null default now(),
  primary key (feed_id, stop_id)
);
-- the lookup filters on a lat/lon rectangle first, then on the exact distance
create index if not exists gtfs_stops_geo on public.gtfs_stops (lat, lon);
alter table public.gtfs_stops enable row level security;
revoke all on public.gtfs_stops from anon, authenticated;

create table if not exists public.gtfs_routes (
  feed_id text not null,
  route_id text not null,
  short_name text not null default '',
  long_name text not null default '',
  route_type smallint,
  loaded_at timestamptz not null default now(),
  primary key (feed_id, route_id)
);
alter table public.gtfs_routes enable row level security;
revoke all on public.gtfs_routes from anon, authenticated;

-- One row per stop and service day: every scheduled stop of a trip at that stop, as [tripId, stopSequence, seconds after the service day start, routeId, headsign].
-- Only for feeds marked "nearbyTimetable" in cities/*.json; the loader keeps today and the next two days.
create table if not exists public.gtfs_departures (
  feed_id text not null,
  stop_id text not null,
  service_date date not null,
  trips jsonb not null,
  loaded_at timestamptz not null default now(),
  primary key (feed_id, stop_id, service_date)
);
alter table public.gtfs_departures enable row level security;
revoke all on public.gtfs_departures from anon, authenticated;

-- The stops closest to a point, nearest first. The point is already rounded by the caller; nothing about it is kept.
create or replace function public.nearby_stops(p_lat double precision, p_lon double precision, p_radius_m integer default 250, p_limit integer default 3)
returns table (feed_id text, stop_id text, name text, lat double precision, lon double precision, city_id text, distance_m integer)
language sql stable security definer set search_path = public as $$
  with p as (
    select least(greatest(coalesce(p_radius_m, 250), 20), 500)::double precision as r,
           greatest(cos(radians(least(abs(p_lat), 89.9))), 0.01) as c
  ), hits as (
    select s.feed_id, s.stop_id, s.name, s.lat, s.lon, s.city_id,
           6371000 * 2 * asin(least(1, sqrt(power(sin(radians(s.lat - p_lat) / 2), 2) + cos(radians(p_lat)) * cos(radians(s.lat)) * power(sin(radians(s.lon - p_lon) / 2), 2)))) as d
    from public.gtfs_stops s, p
    where s.lat between p_lat - p.r / 111320.0 and p_lat + p.r / 111320.0
      and s.lon between p_lon - p.r / (111320.0 * p.c) and p_lon + p.r / (111320.0 * p.c)
  )
  select f.feed_id, f.stop_id, f.name, f.lat, f.lon, f.city_id, round(f.d)::integer
  from hits f, p where f.d <= p.r
  order by f.d limit least(greatest(coalesce(p_limit, 3), 1), 10);
$$;
revoke all on function public.nearby_stops(double precision, double precision, integer, integer) from public, anon, authenticated;
grant execute on function public.nearby_stops(double precision, double precision, integer, integer) to service_role;

-- How often a player may ask (the functions also keep a counter in memory; this one is shared by all instances).
-- Only the user and the time are kept, for an hour, never a position.
create table if not exists public.nearby_hits (
  user_id uuid not null,
  at timestamptz not null default now()
);
create index if not exists nearby_hits_user on public.nearby_hits (user_id, at desc);
alter table public.nearby_hits enable row level security;
revoke all on public.nearby_hits from anon, authenticated;

-- True when the call is allowed (and counted), false when the player already asked p_max times in the last p_window_sec seconds.
create or replace function public.nearby_hit(p_user uuid, p_max integer default 12, p_window_sec integer default 600) returns boolean
language plpgsql security definer set search_path = public as $$
begin
  delete from public.nearby_hits where user_id = p_user and at < now() - make_interval(secs => p_window_sec);
  if (select count(*) from public.nearby_hits where user_id = p_user) >= p_max then return false; end if;
  insert into public.nearby_hits (user_id) values (p_user);
  return true;
end $$;
revoke all on function public.nearby_hit(uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.nearby_hit(uuid, integer, integer) to service_role;

select cron.unschedule(jobid) from cron.job where jobname = 'prune-nearby';
select cron.schedule('prune-nearby', '31 * * * *', $$
  delete from public.nearby_hits where at < now() - interval '1 hour';
  delete from public.gtfs_departures where service_date < current_date - 2;
$$);
