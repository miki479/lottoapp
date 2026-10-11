-- Earthquake questions with real rates (USGS catalogue, last 12 months) and regional ones in local time.
-- world: M5.0+ 1980/yr, M6.0+ 133/yr, M7.0+ 14/yr. Regions (bbox min lat, max lat, min lon, max lon):
--   Japan M4.5+ 625/yr, M5.0+ 155/yr; Italy M4.0+ 44/yr; California M4.0+ 40/yr; Turkey M4.5+ 35/yr.
create or replace function public.quake_odds(p_rate_per_day numeric, p_hours numeric, out o_yes numeric, out o_no numeric)
language plpgsql immutable as $$
declare p numeric := 1 - exp(-p_rate_per_day * p_hours / 24);
begin
  o_yes := round(greatest(1.10, least(30, 0.92 / p))::numeric, 2);
  o_no := round(greatest(1.10, least(30, 0.92 / (1 - p)))::numeric, 2);
end $$;

create or replace function public.make_quake_regions() returns integer
language plpgsql security definer set search_path = public as $$
declare r record; w timestamptz; k integer; n integer := 0; ins integer; o record; steps integer; day0 timestamptz;
begin
  for r in select * from (values
    ('jp', 'Asia/Tokyo', 3, 4.5, 625.0/365, array[24,46,122,146]),
    ('jp', 'Asia/Tokyo', 3, 5.0, 155.0/365, array[24,46,122,146]),
    ('it', 'Europe/Rome', 12, 4.0, 44.0/365, array[35.5,47.2,6.5,18.8]),
    ('ca', 'America/Los_Angeles', 12, 4.0, 40.0/365, array[32,42.1,-125,-114]),
    ('tr', 'Europe/Istanbul', 12, 4.5, 35.0/365, array[36,42.2,26,45])
  ) as t(region, tz, hrs, mag, rate, bbox)
  loop
    day0 := date_trunc('day', now() at time zone r.tz) at time zone r.tz;
    steps := (24 / r.hrs) * 2;                       -- today and tomorrow, local time
    for k in 0..steps - 1 loop
      w := (((now() at time zone r.tz)::date + (k * r.hrs / 24)) + make_interval(hours => (k * r.hrs) % 24)) at time zone r.tz;
      if w <= now() + interval '5 minutes' then continue; end if;
      select * into o from public.quake_odds(r.rate, r.hrs);
      insert into public.markets (city_id, category, kind, feed_id, params, closes_at, target_at, deadline_at, odds_yes, odds_no, dedupe_key)
      values ('world', 'nature', 'quake_m', 'usgs',
              jsonb_build_object('minMag', r.mag, 'region', r.region, 'tz', r.tz, 'bbox', to_jsonb(r.bbox)),
              w, w + make_interval(hours => r.hrs), w + make_interval(hours => r.hrs + 12), o.o_yes, o.o_no,
              'quake|' || r.region || '|' || r.mag || '|' || extract(epoch from w)::bigint)
      on conflict (dedupe_key) do nothing;
      get diagnostics ins = row_count; n := n + ins;
    end loop;
  end loop;
  return n;
end $$;
revoke execute on function public.make_quake_regions() from public, anon, authenticated;
revoke execute on function public.quake_odds(numeric, numeric) from public, anon, authenticated;

create or replace function public.make_quake_markets() returns integer
language plpgsql security definer set search_path = public as $$
declare w timestamptz; mag numeric; rate numeric; o record; n integer := 0; ins integer; k integer;
begin
  for k in 0..3 loop
    w := date_trunc('day', now() at time zone 'UTC') at time zone 'UTC' + make_interval(hours => 6 * (extract(hour from now() at time zone 'UTC')::int / 6 + k));
    if w <= now() + interval '5 minutes' then continue; end if;
    foreach mag in array array[5.0, 6.0] loop
      rate := case when mag = 5.0 then 1980.0 / 365 else 133.0 / 365 end;
      select * into o from public.quake_odds(rate, 6);
      insert into public.markets (city_id, category, kind, feed_id, params, closes_at, target_at, deadline_at, odds_yes, odds_no, dedupe_key)
      values ('world', 'nature', 'quake_m', 'usgs', jsonb_build_object('minMag', mag),
              w, w + interval '6 hours', w + interval '12 hours', o.o_yes, o.o_no,
              'world|quake_m|' || mag || '|' || extract(epoch from w)::bigint)
      on conflict (dedupe_key) do nothing;
      get diagnostics ins = row_count; n := n + ins;
    end loop;
  end loop;
  for k in 0..1 loop
    w := date_trunc('day', now() at time zone 'UTC') at time zone 'UTC' + make_interval(days => k);
    if w <= now() + interval '5 minutes' then continue; end if;
    select * into o from public.quake_odds(14.0 / 365, 24);
    insert into public.markets (city_id, category, kind, feed_id, params, closes_at, target_at, deadline_at, odds_yes, odds_no, dedupe_key)
    values ('world', 'nature', 'quake_m', 'usgs', jsonb_build_object('minMag', 7.0),
            w, w + interval '24 hours', w + interval '36 hours', o.o_yes, o.o_no,
            'world|quake_m|7.0|' || extract(epoch from w)::bigint)
    on conflict (dedupe_key) do nothing;
    get diagnostics ins = row_count; n := n + ins;
  end loop;
  n := n + public.make_quake_regions();
  return n;
end $$;
revoke execute on function public.make_quake_markets() from public, anon, authenticated;
select public.make_quake_markets();
