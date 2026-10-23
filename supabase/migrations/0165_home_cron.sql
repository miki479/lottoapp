-- Optional external runner ("home cron"): a computer at home runs the Edge Functions (ingest, resolve, live, snapshot) itself and reports each run here.
-- While its last report for a job is recent, the pg_cron job of the same name stays quiet; if the computer stops, the cron job takes over again within minutes.
create or replace function public.home_cron_beat(p_job text) returns void
language sql security definer set search_path = public as $$
  insert into public.app_settings (key, value) values ('home_cron:' || p_job, extract(epoch from now())::bigint::text)
  on conflict (key) do update set value = excluded.value;
$$;
revoke all on function public.home_cron_beat(text) from public, anon, authenticated;
grant execute on function public.home_cron_beat(text) to service_role;

create or replace function public.home_cron_active(p_job text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select value::bigint > extract(epoch from now())::bigint - 150 from public.app_settings where key = 'home_cron:' || p_job), false);
$$;
revoke all on function public.home_cron_active(text) from public, anon, authenticated;

-- wrap the five HTTP cron jobs: run only when the home computer has not reported for 150 s (the command text, secret included, is kept as it is)
do $$
declare j record;
begin
  for j in select jobid, jobname, command from cron.job where jobname in ('ingest', 'ingest-heavy', 'resolve', 'live', 'snapshot') and command not like '%home_cron_active%' loop
    perform cron.alter_job(j.jobid, command := 'select case when public.home_cron_active(' || quote_literal(j.jobname) || ') then null else (' || regexp_replace(regexp_replace(j.command, '^\s*select\s+', '', 'i'), ';\s*$', '') || ') end');
  end loop;
end $$;
