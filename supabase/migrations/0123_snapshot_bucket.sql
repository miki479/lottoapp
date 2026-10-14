-- The public file with the picture of the home screen (see supabase/functions/snapshot): anyone may read it, only the service role writes it.
insert into storage.buckets (id, name, public) values ('snap', 'snap', true) on conflict (id) do update set public = true;
-- every minute, like the other jobs: the call is the same as the one of the `live` job, aimed at the snapshot function
select cron.unschedule('snapshot') where exists (select 1 from cron.job where jobname = 'snapshot');
select cron.schedule('snapshot', '* * * * *', replace(command, '/functions/v1/live', '/functions/v1/snapshot')) from cron.job where jobname = 'live';
