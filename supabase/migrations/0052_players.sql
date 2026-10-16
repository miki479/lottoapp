-- Player bets (goal, assist, substituted): the starting lineups are fetched once per match and kept; the facts after the match go with the match details.
create table if not exists public.match_lineups (
  event_id text primary key,
  api_id text not null,
  kickoff timestamptz not null,
  players jsonb not null default '[]'::jsonb,   -- [{id, name, pos, side}] starters only
  attempted_at timestamptz not null default now(),
  fetched_at timestamptz
);
alter table public.match_lineups enable row level security;
revoke all on public.match_lineups from anon, authenticated;
alter table public.match_details add column if not exists players jsonb;   -- {goals:[ids], assists:[ids], subs:[ids]}
