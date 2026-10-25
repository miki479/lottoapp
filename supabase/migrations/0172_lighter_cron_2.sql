-- Second round on the small instance: resolve every three minutes, the heavy ingest every ten, live (failover only) every three.
select cron.alter_job(2, schedule := '*/3 * * * *');    -- resolve (was every 2 minutes)
select cron.alter_job(11, schedule := '*/10 * * * *');  -- ingest-heavy (was every 6 minutes)
select cron.alter_job(25, schedule := '*/3 * * * *');   -- live, only when the PC is down (was every 2 minutes)
