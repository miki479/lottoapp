-- The Italian provincial capitals are seeded as permanent places (scripts/seed-capitals.mjs: last_used_at far in the future). Their weather questions are lighter
-- than a town a player added: two slots a day (12:30 and 18:30), today and tomorrow, so ~100 towns do not flood the lists.
create or replace function public.make_place_markets(p_place text) returns integer
language plpgsql security definer set search_path = public as $$
declare pl public.places; d integer; h integer; tgt timestamptz; n integer := 0; ins integer; hours integer[];
begin
  select * into pl from public.places where id = p_place;
  if not found then return 0; end if;
  hours := case when pl.last_used_at > now() + interval '1 year' then array[12, 18] else array[8, 12, 15, 18, 21] end;
  for d in 0..1 loop
    foreach h in array hours loop
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
