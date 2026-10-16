-- TheSportsDB team ids by the name the ESPN scoreboard uses, found once (the free tier lists only 3 matches a day, so European fixtures are found through each club's next match).
create table if not exists public.team_ids (
  team text primary key,
  sportsdb_id text,
  tried_at timestamptz not null default now()
);
alter table public.team_ids enable row level security;
revoke all on public.team_ids from anon, authenticated;
