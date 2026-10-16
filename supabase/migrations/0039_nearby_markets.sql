-- "Nearby bets": questions made by players for a place, shown to people within some km of it. An optional home town
-- (town level only) unlocks them without sharing the phone's position; per-area statistics never show groups under 3 people.
alter table public.profiles add column if not exists home_place text references public.places(id) on delete set null;
alter table public.markets add column if not exists lat numeric(8,5);
alter table public.markets add column if not exists lon numeric(8,5);
create index if not exists markets_geo on public.markets (lat, lon) where lat is not null;
update public.markets m set lat = pl.lat, lon = pl.lon from public.places pl where m.city_id = pl.id and m.lat is null;

-- null name clears the home town. The town is stored as a normal place but never polled for weather (last use set far back).
create or replace function public.set_home_place(p_name text, p_admin text, p_country text, p_lat numeric, p_lon numeric, p_tz text) returns text
language plpgsql security definer set search_path = public as $$
declare pid text; nm text := trim(coalesce(p_name, ''));
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if p_name is null then update public.profiles set home_place = null where id = auth.uid(); return null; end if;
  if char_length(nm) < 1 or char_length(nm) > 80 or nm ~ '[<>]' or p_country !~ '^[A-Za-z]{2}$' or p_lat not between -90 and 90 or p_lon not between -180 and 180 then raise exception 'bad_place'; end if;
  if not exists (select 1 from pg_timezone_names where name = p_tz) then raise exception 'bad_place'; end if;
  pid := 'p-' || round(p_lat, 2)::text || '_' || round(p_lon, 2)::text;
  if not exists (select 1 from public.places where id = pid) then
    if (select count(*) from public.places where created_by = auth.uid() and created_at > now() - interval '1 day') >= 5 then raise exception 'places_limit'; end if;
    insert into public.places (id, name, admin, country, lat, lon, timezone, created_by, last_used_at)
    values (pid, left(nm, 80), left(nullif(trim(p_admin), ''), 80), upper(p_country), round(p_lat, 5), round(p_lon, 5), p_tz, auth.uid(), now() - interval '10 days');
  end if;
  update public.profiles set home_place = pid where id = auth.uid();
  return pid;
end $$;
grant execute on function public.set_home_place(text, text, text, numeric, numeric, text) to authenticated;

create or replace function public.km_between(a_lat numeric, a_lon numeric, b_lat numeric, b_lon numeric) returns numeric
language sql immutable as $$
  select 2 * 6371 * asin(least(1, sqrt(power(sin(radians(b_lat - a_lat) / 2), 2) + cos(radians(a_lat)) * cos(radians(b_lat)) * power(sin(radians(b_lon - a_lon) / 2), 2))))::numeric;
$$;

-- Player-made open questions within p_km of a point, the most played and closest first.
create or replace function public.nearby_markets(p_lat numeric, p_lon numeric, p_km integer default 30, p_limit integer default 12)
returns table (market_id uuid, km numeric, bettors bigint)
language sql stable security definer set search_path = public as $$
  select m.id, round(public.km_between(p_lat, p_lon, m.lat, m.lon), 1), coalesce(b.n, 0)
  from public.markets m
  left join lateral (select count(distinct user_id) n from public.bets where market_id = m.id and user_id is distinct from m.created_by) b on true
  where m.status = 'open' and m.closes_at > now() and m.params->>'custom' = 'true' and m.lat is not null
    and coalesce(m.params->>'testOnly', '') <> 'true'
    and public.km_between(p_lat, p_lon, m.lat, m.lon) <= least(greatest(p_km, 5), 200)
    and not exists (select 1 from public.reports r where r.market_id = m.id and r.status = 'open' having count(*) >= 2)
  order by (1 + coalesce(b.n, 0)) / (1 + public.km_between(p_lat, p_lon, m.lat, m.lon) / 15.0) desc
  limit least(greatest(p_limit, 1), 30);
$$;
grant execute on function public.nearby_markets(numeric, numeric, integer, integer) to anon, authenticated;

-- Who bet what, by home town and distance band. Groups under 3 people are never shown.
create or replace function public.market_area_stats(p_market uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare m public.markets; res jsonb;
begin
  select * into m from public.markets where id = p_market;
  if not found or m.lat is null then return null; end if;
  with b as (
    select distinct on (bt.user_id) bt.user_id, bt.pick, pl.name, public.km_between(m.lat, m.lon, pl.lat, pl.lon) km
    from public.bets bt left join public.profiles pr on pr.id = bt.user_id left join public.places pl on pl.id = pr.home_place
    where bt.market_id = m.id and bt.user_id is distinct from m.created_by order by bt.user_id, bt.placed_at
  ), towns as (
    select name, count(*) n, round(100.0 * count(*) filter (where pick = 'yes') / count(*)) yes_pct, round(min(km)) km
    from b where name is not null group by name having count(*) >= 3
  ), bands as (
    select lbl, count(*) n, round(100.0 * count(*) filter (where pick = 'yes') / count(*)) yes_pct from (
      select pick, case when km <= 10 then '0-10' when km <= 30 then '10-30' when km <= 100 then '30-100' else '100+' end lbl from b where km is not null) x
    group by lbl having count(*) >= 3
  )
  select jsonb_build_object(
    'total', (select count(*) from b),
    'located', (select count(*) from b where km is not null),
    'yes_pct', (select case when count(*) >= 3 then round(100.0 * count(*) filter (where pick = 'yes') / count(*)) end from b),
    'towns', coalesce((select jsonb_agg(jsonb_build_object('name', name, 'n', n, 'yes_pct', yes_pct, 'km', km) order by n desc) from towns), '[]'::jsonb),
    'bands', coalesce((select jsonb_agg(jsonb_build_object('label', lbl, 'n', n, 'yes_pct', yes_pct) order by case lbl when '0-10' then 1 when '10-30' then 2 when '30-100' then 3 else 4 end) from bands), '[]'::jsonb)) into res;
  return res;
end $$;
grant execute on function public.market_area_stats(uuid) to anon, authenticated;
