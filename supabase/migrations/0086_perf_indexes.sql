-- Speed: indexes for the hot queries (open markets by city / category / house series / stop, finished results), one duplicate index less,
-- and the cron run history kept for two days only.
create index if not exists markets_open_city on public.markets (city_id, closes_at) where status = 'open';
create index if not exists markets_open_cat on public.markets (category, closes_at) where status = 'open';
create index if not exists markets_house_series on public.markets ((params->>'series'), closes_at) where status = 'open' and kind = 'tick_gt';
create index if not exists markets_stop_open on public.markets (feed_id, (params->>'stopId')) where status = 'open';
create index if not exists markets_closed_target on public.markets (target_at desc) where status <> 'open';
create index if not exists markets_open_target on public.markets (target_at, deadline_at) where status = 'open';
-- the unique index on the same columns already serves these lookups
drop index if exists public.delay_obs_lookup;

select cron.unschedule(jobid) from cron.job where jobname = 'prune-cron';
select cron.schedule('prune-cron', '37 3 * * *', $$ delete from cron.job_run_details where end_time < now() - interval '2 days'; delete from net._http_response where created < now() - interval '2 days'; $$);
