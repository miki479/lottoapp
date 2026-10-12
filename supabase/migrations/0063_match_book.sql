-- What bookmakers think of a football match (average of the quotes, vig removed), read once from API-Football a day or less before kick-off.
-- Used as the starting chances of our own questions: it is better informed than a model that only knows the league table.
create table if not exists public.match_book (
  event_id text primary key,
  priors jsonb not null,
  books integer not null default 0,
  fetched_at timestamptz not null default now()
);
alter table public.match_book enable row level security;
revoke all on public.match_book from anon, authenticated;
select cron.unschedule(jobid) from cron.job where jobname = 'prune-match-book';
select cron.schedule('prune-match-book', '31 3 * * *', $$ delete from public.match_book where fetched_at < now() - interval '4 days' $$);
