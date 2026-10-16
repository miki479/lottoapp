-- The table checks still held the old 500 limit: the functions already allow more (stake_cap), so the checks follow.
alter table public.bets drop constraint if exists bets_stake_check;
alter table public.bets add constraint bets_stake_check check (stake >= 10 and stake <= 100000);
alter table public.parlays drop constraint if exists parlays_stake_check;
alter table public.parlays add constraint parlays_stake_check check (stake >= 10 and stake <= 5000);
