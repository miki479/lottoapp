-- The home snapshot is a public file the phones read: a new one every two minutes is enough (the CDN copy lives 30 s and the phones accept one up to four minutes old).
select cron.unschedule('snapshot') where exists (select 1 from cron.job where jobname = 'snapshot');
select cron.schedule('snapshot', '*/2 * * * *', replace(command, '/functions/v1/live', '/functions/v1/snapshot')) from cron.job where jobname = 'live';
