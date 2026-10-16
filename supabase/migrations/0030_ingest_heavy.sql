-- Big feeds (Berlin, ~6 MB) are polled in their own scheduled call every 2 minutes, so they cannot slow the others down.
-- The call is a copy of the normal ingest job (same URL and secret) with ?group=heavy.
select cron.unschedule(jobid) from cron.job where jobname = 'ingest-heavy';
select cron.schedule('ingest-heavy', '*/2 * * * *', replace(command, '/functions/v1/ingest', '/functions/v1/ingest?group=heavy'))
from cron.job where jobname = 'ingest';
