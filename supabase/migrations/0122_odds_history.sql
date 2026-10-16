-- How the chance of "yes" moves over time, for the live chart on the featured cards.
-- Only the markets someone is looking at (or looked at in the last hours) are followed: the app says which ones (track_markets), a job takes a snapshot of each every few minutes.
create table if not exists public.market_odds_history (
  market_id uuid not null references public.markets(id) on delete cascade,
  at timestamptz not null default now(),
  p_yes real not null,
  primary key (market_id, at)
);
create table if not exists public.market_track (
  market_id uuid primary key references public.markets(id) on delete cascade,
  seen_at timestamptz not null default now()
);
alter table public.market_odds_history enable row level security;
alter table public.market_track enable row level security;
drop policy if exists "odds history is public" on public.market_odds_history;
create policy "odds history is public" on public.market_odds_history for select using (true);
grant select on public.market_odds_history to anon, authenticated;

-- The chance behind the two odds, margin taken out.
create or replace function public.snapshot_market(p_id uuid) returns void language sql security definer set search_path = public as $$
  insert into public.market_odds_history (market_id, p_yes)
  select m.id, ((1 / m.odds_yes) / ((1 / m.odds_yes) + (1 / m.odds_no)))::real
    from public.markets m
   where m.id = p_id and m.status = 'open' and m.odds_yes > 1 and m.odds_no > 1
     and not exists (select 1 from public.market_odds_history h where h.market_id = m.id and h.at > now() - interval '150 seconds');
$$;

-- Called by the app with the few markets on screen: they are followed from now on, and a first snapshot is taken at once.
create or replace function public.track_markets(p_ids uuid[]) returns void language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  foreach v in array coalesce(p_ids[1:12], '{}') loop
    insert into public.market_track (market_id) select m.id from public.markets m where m.id = v and m.status = 'open'
      on conflict (market_id) do update set seen_at = now();
    perform public.snapshot_market(v);
  end loop;
end $$;
revoke all on function public.track_markets(uuid[]) from public;
grant execute on function public.track_markets(uuid[]) to anon, authenticated;
revoke all on function public.snapshot_market(uuid) from public;

create or replace function public.snapshot_tracked() returns void language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  for v in select market_id from public.market_track where seen_at > now() - interval '6 hours' loop
    perform public.snapshot_market(v);
  end loop;
  delete from public.market_track where seen_at < now() - interval '1 day';
  delete from public.market_odds_history where at < now() - interval '3 days';
end $$;
revoke all on function public.snapshot_tracked() from public;

select cron.unschedule('odds-history') where exists (select 1 from cron.job where jobname = 'odds-history');
select cron.schedule('odds-history', '*/3 * * * *', $$ select public.snapshot_tracked() $$);
