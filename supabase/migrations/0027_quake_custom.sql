-- Player-made earthquake questions ("a quake of M5+ within 300 km of Tokyo between 20:00 and 23:00"):
-- the Edge Function `quake-offer` creates them; this table only exists to rate-limit by user.
create table if not exists public.quake_custom (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete cascade,
  market_id uuid references public.markets(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists quake_custom_user_day on public.quake_custom (user_id, created_at);
alter table public.quake_custom enable row level security;
revoke all on public.quake_custom from anon, authenticated;
