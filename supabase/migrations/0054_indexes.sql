-- Indexes for the queries added lately (missions, rankings, friends, football lookups).
create index if not exists bets_user_placed on public.bets (user_id, placed_at desc);
create index if not exists bets_user_settled on public.bets (user_id, settled_at) where status <> 'open';
create index if not exists parlays_user_placed on public.parlays (user_id, placed_at desc);
create index if not exists friend_challenges_creator on public.friend_challenges (creator, created_at desc);
create index if not exists challenge_invites_by on public.challenge_invites (invited_by, created_at desc);
create index if not exists markets_match_event on public.markets ((params->>'eventId')) where kind = 'match_bet';
create index if not exists markets_kind_open on public.markets (kind, closes_at) where status = 'open';
analyze public.bets; analyze public.markets;
