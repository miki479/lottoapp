-- Retention promised in the privacy page: contact messages and invitation traces are kept 12 months at most.
select cron.unschedule('prune-contact') where exists (select 1 from cron.job where jobname = 'prune-contact');
select cron.schedule('prune-contact', '53 3 * * *', $$ delete from public.contact_messages where at < now() - interval '12 months'; delete from public.referral_log where at < now() - interval '12 months' $$);
