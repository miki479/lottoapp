-- Lighter on a small instance: the flash lookup gets an index, and the per-minute jobs run every two minutes (ladder every ten).
create index if not exists markets_flash_pending on public.markets (flash_until) where flash_notified = false and flash_multiplier > 1;
select cron.alter_job(1, schedule := '*/2 * * * *');    -- ingest (was every minute)
select cron.alter_job(2, schedule := '*/2 * * * *');    -- resolve (was every minute)
select cron.alter_job(6, schedule := '*/10 * * * *');   -- ladder (was every 5 minutes)
