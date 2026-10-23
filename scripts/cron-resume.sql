-- Paused on 2026-10-23 (21:05 UTC) when the Disk IO budget ran out and the database stopped answering.
-- Put them back in this order, a few minutes apart, watching the Disk IO graph: first the settling of bets, then the data feeds, last the extras.
-- Schedules were slowed on the same day (resolve/ingest/snapshot/live every 5 min, ingest-heavy every 15, flash/ladder/odds-history every 30); they stay slow when switched back on.
select cron.alter_job(2,  active := true);   -- resolve        every 5 min, settles bets
select cron.alter_job(1,  active := true);   -- ingest         every 5 min
select cron.alter_job(35, active := true);   -- snapshot       every 5 min, home page picture (only when the PC is not doing it)
select cron.alter_job(25, active := true);   -- live           every 5 min (only when the PC is not doing it)
select cron.alter_job(11, active := true);   -- ingest-heavy   every 15 min
select cron.alter_job(5,  active := true);   -- flash          */10
select cron.alter_job(6,  active := true);   -- ladder         */10
select cron.alter_job(31, active := true);   -- odds-history   */10
