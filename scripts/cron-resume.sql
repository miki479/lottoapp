-- Paused on 2026-10-23 (21:05 UTC) when the Disk IO budget ran out and the database stopped answering.
-- Put them back in this order, a few minutes apart, watching the Disk IO graph: first the settling of bets, then the data feeds, last the extras.
-- (schedules in the comments are the ones in force when they were paused)
select cron.alter_job(2,  active := true);   -- resolve        */3  settles bets
select cron.alter_job(1,  active := true);   -- ingest         */2
select cron.alter_job(35, active := true);   -- snapshot       */2  home page picture (only when the PC is not doing it)
select cron.alter_job(25, active := true);   -- live           */3  (only when the PC is not doing it)
select cron.alter_job(11, active := true);   -- ingest-heavy   */10
select cron.alter_job(5,  active := true);   -- flash          */10
select cron.alter_job(6,  active := true);   -- ladder         */10
select cron.alter_job(31, active := true);   -- odds-history   */10
