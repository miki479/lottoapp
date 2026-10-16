-- "Ci scusiamo per il disagio": when a bus/train is already running late, offer extra rungs
-- ("it will end up at least 5 / 10 / 20 / 40 minutes later than it is now") as ordinary markets on the same trip and stop.
-- They resolve like any delay market (same trip, same stop, a higher threshold). Odds are an estimate, not history-based:
-- the app says so. Rungs are created once per base market, at the delay measured at that moment.

create or replace function public.spawn_ladders() returns integer
language plpgsql security definer set search_path = public as $$
declare
  b record; d integer; x integer; p numeric; thr integer; made integer := 0; ins integer;
  steps constant integer[] := array[5, 10, 20, 40];
  probs constant numeric[] := array[0.45, 0.25, 0.10, 0.03];
begin
  for b in
    select * from public.markets
    where status = 'open' and kind in ('bus_delay_gt', 'train_delay_gt') and (params->>'ladderOf') is null
      and closes_at > now() + interval '3 minutes' and target_at < now() + interval '3 hours'
  loop
    select o.delay_sec into d from public.delay_observations o
    where o.feed_id = b.feed_id and o.trip_id = b.params->>'tripId' and o.observed_at > now() - interval '10 minutes'
      and (o.predicted_at is null or o.observed_at >= o.predicted_at - interval '120 seconds')
    order by o.observed_at desc limit 1;
    if d is null or d < 300 then continue; end if;
    for x in 1..4 loop
      thr := (ceil(d / 60.0)::int + steps[x]) * 60;
      p := probs[x];
      insert into public.markets (city_id, category, kind, feed_id, params, closes_at, target_at, deadline_at, odds_yes, odds_no, dedupe_key)
      values (b.city_id, b.category, b.kind, b.feed_id,
              b.params || jsonb_build_object('thresholdSec', thr, 'ladderOf', b.id, 'baseDelaySec', d, 'extraMin', steps[x]),
              b.closes_at, b.target_at, b.deadline_at,
              least(15, greatest(1.10, round(0.92 / p, 2))), least(15, greatest(1.10, round(0.92 / (1 - p), 2))),
              'ladder:' || b.id || ':' || steps[x])
      on conflict (dedupe_key) do nothing;
      get diagnostics ins = row_count; made := made + ins;
    end loop;
  end loop;
  return made;
end $$;
revoke execute on function public.spawn_ladders() from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'ladder';
select cron.schedule('ladder', '*/2 * * * *', $$ select public.spawn_ladders(); $$);
