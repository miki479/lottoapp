-- Live scores of the matches people bet on (filled every minute by the `live` function from the ESPN public scoreboards).
create table if not exists public.live_scores (
  event_id text primary key,
  league text not null,
  home_score integer not null default 0,
  away_score integer not null default 0,
  state text not null check (state in ('in', 'post')),
  period integer,
  clock text not null default '',
  updated_at timestamptz not null default now()
);
alter table public.live_scores enable row level security;
drop policy if exists "live scores are public" on public.live_scores;
create policy "live scores are public" on public.live_scores for select using (true);
grant select on public.live_scores to anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'live';
select cron.schedule('live', '* * * * *', replace(command, '/functions/v1/ingest', '/functions/v1/live')) from cron.job where jobname = 'ingest';
select cron.unschedule(jobid) from cron.job where jobname = 'prune-live';
select cron.schedule('prune-live', '43 3 * * *', $$ delete from public.live_scores where updated_at < now() - interval '2 days' $$);
