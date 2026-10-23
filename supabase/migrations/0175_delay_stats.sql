-- The public numbers on /ritardi: how often the Italian trains checked in the last 7 days passed each delay threshold. Aggregates only, nothing about players.
-- Computed at most once every 30 minutes (one writer at a time) and kept in app_settings, so a busy page never costs more than a read.
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
    'hours', (select coalesce(jsonb_agg(jsonb_build_object('hour', h, 'n', n, 'pct', p) order by h), '[]'::jsonb) from (
        select extract(hour from (target_at at time zone 'Europe/Rome'))::int h, count(*) n, round(100.0 * count(*) filter (where outcome = 'yes') / count(*)) p
        from r where (params->>'thresholdSec')::int = 300 group by 1 having count(*) >= 100) y)
  ) into res;
  insert into public.app_settings (key, value) values ('delay_stats_cache', res::text) on conflict (key) do update set value = excluded.value;
  return res;
end $$;
grant execute on function public.delay_stats() to anon, authenticated;
notify pgrst, 'reload schema';
