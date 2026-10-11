-- Rarer earthquakes pay more: magnitude 7.0+ in 24-hour windows (about 15 a year worldwide), quote cap 30x for quakes.
create or replace function public.make_quake_markets() returns integer
language plpgsql security definer set search_path = public as $$
declare w timestamptz; mag numeric; rate numeric; hrs integer; p numeric; cap numeric; n integer := 0; ins integer; k integer;
begin
  for k in 0..3 loop
    w := date_trunc('day', now() at time zone 'UTC') at time zone 'UTC' + make_interval(hours => 6 * (extract(hour from now() at time zone 'UTC')::int / 6 + k));
    if w <= now() + interval '5 minutes' then continue; end if;
    foreach mag in array array[5.0, 6.0] loop
      rate := case when mag = 5.0 then 4.0 else 0.42 end;
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
  -- magnitude 7+: today's and tomorrow's UTC day
  for k in 0..1 loop
    w := date_trunc('day', now() at time zone 'UTC') at time zone 'UTC' + make_interval(days => k);
    if w <= now() + interval '5 minutes' then continue; end if;
    p := 1 - exp(-0.041);
    insert into public.markets (city_id, category, kind, feed_id, params, closes_at, target_at, deadline_at, odds_yes, odds_no, dedupe_key)
    values ('world', 'nature', 'quake_m', 'usgs', jsonb_build_object('minMag', 7.0),
            w, w + interval '24 hours', w + interval '36 hours',
            round(greatest(1.10, least(30, 0.92 / p))::numeric, 2), round(greatest(1.10, least(30, 0.92 / (1 - p)))::numeric, 2),
            'world|quake_m|7.0|' || extract(epoch from w)::bigint)
    on conflict (dedupe_key) do nothing;
    get diagnostics ins = row_count; n := n + ins;
  end loop;
  return n;
end $$;
revoke execute on function public.make_quake_markets() from public, anon, authenticated;
select public.make_quake_markets();
