-- Rain markets for ANY place: a player searches a town (the app geocodes it), the server registers it as a "place"
-- and opens rain questions for the next hours. Places stay active for 3 days after their last use; the hourly weather job
-- polls Open-Meteo for all active places in one batched request. No bus/train data here: weather only.

create table if not exists public.places (
  id text primary key,                                   -- 'p-<lat>_<lon>' rounded to 2 decimals (~1 km): the same town is one place
  name text not null check (char_length(name) between 1 and 80 and name !~ '[<>]'),
  admin text check (admin is null or char_length(admin) <= 80),
  country text not null check (char_length(country) = 2),
  lat numeric(8,5) not null check (lat between -90 and 90),
  lon numeric(8,5) not null check (lon between -180 and 180),
  timezone text not null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  last_used_at timestamptz not null default now()
);
alter table public.places enable row level security;
drop policy if exists "places are public" on public.places;
create policy "places are public" on public.places for select using (true);
grant select on public.places to anon, authenticated;

-- Opens today's and tomorrow's remaining rain questions for a place (8, 12, 15, 18, 21 local, as for the fixed cities).
create or replace function public.make_place_markets(p_place text) returns integer
language plpgsql security definer set search_path = public as $$
declare pl public.places; d integer; h integer; tgt timestamptz; n integer := 0; ins integer;
begin
  select * into pl from public.places where id = p_place;
  if not found then return 0; end if;
  for d in 0..1 loop
    foreach h in array array[8, 12, 15, 18, 21] loop
      tgt := (((now() at time zone pl.timezone)::date + d) + make_interval(hours => h, mins => 30)) at time zone pl.timezone;
      if tgt - interval '10 minutes' <= now() + interval '5 minutes' then continue; end if;
      insert into public.markets (city_id, category, kind, feed_id, params, closes_at, target_at, deadline_at, odds_yes, odds_no, dedupe_key)
      values (pl.id, 'weather', 'rain_at', 'om-' || pl.id, jsonb_build_object('minMm', 0.1, 'localHour', h),
              tgt - interval '10 minutes', tgt, date_trunc('hour', tgt) + interval '5 hours', 3.68, 1.23,
              pl.id || '|rain_at|' || extract(epoch from tgt)::bigint)
      on conflict (dedupe_key) do nothing;
      get diagnostics ins = row_count; n := n + ins;
    end loop;
  end loop;
  return n;
end $$;
revoke execute on function public.make_place_markets(text) from public, anon, authenticated;

create or replace function public.ensure_place(p_name text, p_admin text, p_country text, p_lat numeric, p_lon numeric, p_tz text)
returns text
language plpgsql security definer set search_path = public as $$
declare pid text; ex public.places; nm text := trim(coalesce(p_name, ''));
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if char_length(nm) < 1 or char_length(nm) > 80 or nm ~ '[<>]' then raise exception 'bad_place'; end if;
  if p_lat is null or p_lon is null or p_lat not between -90 and 90 or p_lon not between -180 and 180 then raise exception 'bad_place'; end if;
  if p_country is null or p_country !~ '^[A-Za-z]{2}$' then raise exception 'bad_place'; end if;
  if not exists (select 1 from pg_timezone_names where name = p_tz) then raise exception 'bad_place'; end if;
  pid := 'p-' || round(p_lat, 2)::text || '_' || round(p_lon, 2)::text;
  select * into ex from public.places where id = pid;
  if not found then
    if (select count(*) from public.places where created_by = auth.uid() and created_at > now() - interval '1 day') >= 5 then raise exception 'places_limit'; end if;
    if (select count(*) from public.places where last_used_at > now() - interval '3 days') >= 300 then raise exception 'places_full'; end if;
    insert into public.places (id, name, admin, country, lat, lon, timezone, created_by)
    values (pid, left(nm, 80), left(nullif(trim(p_admin), ''), 80), upper(p_country), round(p_lat, 5), round(p_lon, 5), p_tz, auth.uid());
  elsif ex.last_used_at < now() - interval '30 minutes' then
    update public.places set last_used_at = now() where id = pid;
  end if;
  perform public.make_place_markets(pid);
  return pid;
end $$;
revoke execute on function public.ensure_place(text, text, text, numeric, numeric, text) from public, anon;
grant execute on function public.ensure_place(text, text, text, numeric, numeric, text) to authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'places';
select cron.schedule('places', '7 */3 * * *', $$ select public.make_place_markets(id) from public.places where last_used_at > now() - interval '3 days' $$);
