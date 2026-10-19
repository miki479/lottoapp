-- /ritardi, second round: the ten trains that were late most often this week (named, at least 3 checks each and late at least twice), and the trains that are late right now.
-- Both are kept in app_settings for a while (30 minutes / one minute, one writer at a time), so a busy page stays at about one read per visitor.
delete from public.app_settings where key = 'delay_stats_cache';
create or replace function public.delay_stats() returns jsonb
language plpgsql security definer set search_path = public as $$
declare cur jsonb; res jsonb;
begin
  select value::jsonb into cur from public.app_settings where key = 'delay_stats_cache';
  if cur is not null and (cur->>'t')::timestamptz > now() - interval '30 minutes' then return cur; end if;
  if not pg_try_advisory_xact_lock(7160002) then return coalesce(cur, '{}'::jsonb); end if;
  with r as (
    select params, outcome, target_at from public.markets
    where kind = 'train_delay_gt' and feed_id = 'it-train-viaggiatreno' and status = 'resolved' and outcome in ('yes', 'no')
      and target_at > now() - interval '7 days')
  select jsonb_build_object(
    't', now(), 'days', 7,
    'total', (select count(*) from r),
    'late_pct', (select round(100.0 * count(*) filter (where outcome = 'yes') / nullif(count(*), 0)) from r),
    'rows', (select coalesce(jsonb_agg(jsonb_build_object('kind', k, 'mins', m, 'n', n, 'pct', p) order by k, m), '[]'::jsonb) from (
        select split_part(params->>'routeName', ' ', 1) k, (params->>'thresholdSec')::int / 60 m, count(*) n, round(100.0 * count(*) filter (where outcome = 'yes') / count(*)) p
        from r group by 1, 2 having count(*) >= 100) x),
    'worst', (select coalesce(jsonb_agg(jsonb_build_object('name', nm, 'to', hs, 'n', n, 'late', late) order by late desc, n asc, nm), '[]'::jsonb) from (
        select params->>'routeName' nm, params->>'headsign' hs, count(*) n, count(*) filter (where outcome = 'yes') late
        from r where (params->>'thresholdSec')::int = 300 and params->>'routeName' is not null group by 1, 2
        having count(*) >= 3 and count(*) filter (where outcome = 'yes') >= 2 order by 4 desc, 3 asc, 1 limit 10) w),
    'hours', (select coalesce(jsonb_agg(jsonb_build_object('hour', h, 'n', n, 'pct', p) order by h), '[]'::jsonb) from (
        select extract(hour from (target_at at time zone 'Europe/Rome'))::int h, count(*) n, round(100.0 * count(*) filter (where outcome = 'yes') / count(*)) p
        from r where (params->>'thresholdSec')::int = 300 group by 1 having count(*) >= 100) y)
  ) into res;
  insert into public.app_settings (key, value) values ('delay_stats_cache', res::text) on conflict (key) do update set value = excluded.value;
  return res;
end $$;
grant execute on function public.delay_stats() to anon, authenticated;

create or replace function public.late_trains_now() returns jsonb
language plpgsql security definer set search_path = public as $$
declare cur jsonb; res jsonb;
begin
  select value::jsonb into cur from public.app_settings where key = 'late_now_cache';
  if cur is not null and (cur->>'t')::timestamptz > now() - interval '60 seconds' then return cur; end if;
  if not pg_try_advisory_xact_lock(7160003) then return coalesce(cur, '{}'::jsonb); end if;
  with last_obs as (
    select distinct on (o.trip_id) o.trip_id, o.route_id, o.stop_id, o.delay_sec, o.observed_at
    from public.delay_observations o
    where o.feed_id = 'it-train-viaggiatreno' and o.observed_at > now() - interval '20 minutes'
      and (o.predicted_at is null or o.observed_at >= o.predicted_at - interval '120 seconds')
    order by o.trip_id, o.observed_at desc),
  late as (select * from last_obs where delay_sec >= 300 order by delay_sec desc limit 12)
  select jsonb_build_object('t', now(), 'trains', coalesce(jsonb_agg(jsonb_build_object(
      'name', coalesce(m.params->>'routeName', coalesce(l.route_id, '') || ' ' || split_part(l.trip_id, '/', 2)),
      'to', m.params->>'headsign', 'at', m.params->>'stopName', 'mins', round(l.delay_sec / 60.0), 'seen', l.observed_at) order by l.delay_sec desc), '[]'::jsonb))
  into res
  from late l left join lateral (
    select params from public.markets m where m.feed_id = 'it-train-viaggiatreno' and m.params->>'stopId' = l.stop_id and m.params->>'tripId' = l.trip_id limit 1) m on true;
  insert into public.app_settings (key, value) values ('late_now_cache', res::text) on conflict (key) do update set value = excluded.value;
  return res;
end $$;
grant execute on function public.late_trains_now() to anon, authenticated;
notify pgrst, 'reload schema';
