-- Smart notifications: throttle log, ranking overtakes, vote reminders, bet tips, per-player best hour.

-- One row per (player, kind, day): a kind is sent at most once a day.
create table if not exists public.push_log (
  user_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null,
  day date not null,
  primary key (user_id, kind, day)
);
alter table public.push_log enable row level security;
revoke all on public.push_log from anon, authenticated;

-- Hour (local time) at which a player usually bets: the daily nudge lands there.
alter table public.profiles add column if not exists nudge_hour smallint check (nudge_hour between 0 and 23);

create or replace function public.refresh_nudge_hours() returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  with h as (
    select b.user_id, (extract(hour from b.placed_at at time zone coalesce(nullif(p.timezone, ''), 'UTC')))::int as hr, count(*) as c
    from public.bets b join public.profiles p on p.id = b.user_id
    where b.placed_at > now() - interval '30 days' group by 1, 2
  ), tot as (select user_id, sum(c) as t from h group by 1 having sum(c) >= 3),
  -- best hour inside the two windows people read their phone: lunch (11-14) or the evening (19-23)
  pick as (
    select distinct on (h.user_id) h.user_id,
      case when h.hr between 11 and 14 then h.hr when h.hr between 19 and 23 then h.hr
           when h.hr between 6 and 10 then 11 when h.hr between 15 and 18 then 19 else 21 end as hr
    from h join tot using (user_id) order by h.user_id, h.c desc, h.hr
  )
  update public.profiles p set nudge_hour = pick.hr from pick where p.id = pick.user_id and p.nudge_hour is distinct from pick.hr;
  get diagnostics n = row_count;
  delete from public.push_log where day < current_date - 14;
  return n;
end $$;
revoke all on function public.refresh_nudge_hours() from anon, authenticated;

-- Open bets per player: total and the ones deciding in the next 24 hours.
create or replace function public.open_bet_counts(p_ids uuid[]) returns table(user_id uuid, open_n integer, soon_n integer)
language sql security definer stable set search_path = public as $$
  select b.user_id, count(*)::int, count(*) filter (where m.closes_at < now() + interval '24 hours')::int
  from public.bets b join public.markets m on m.id = b.market_id
  where b.status = 'open' and b.user_id = any(p_ids) group by 1;
$$;
revoke all on function public.open_bet_counts(uuid[]) from anon, authenticated;

-- Ranking: monthly board snapshot, every change that pushes a player down becomes an event (with the name of who now stands just above).
create table if not exists public.rank_snapshot (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  month text not null,
  rank integer not null,
  display_name text
);
create table if not exists public.rank_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete cascade,
  by_name text not null,
  new_rank integer not null,
  created_at timestamptz not null default now(),
  sent boolean not null default false
);
alter table public.rank_snapshot enable row level security;
alter table public.rank_events enable row level security;
revoke all on public.rank_snapshot, public.rank_events from anon, authenticated;
create index if not exists rank_events_pending on public.rank_events (id) where not sent;

create or replace function public.rank_watch() returns integer
language plpgsql security definer set search_path = public as $$
declare mon text := to_char(now(), 'YYYY-MM'); n integer := 0;
begin
  create temp table if not exists _lb (rank bigint, user_id uuid, display_name text) on commit drop;
  delete from _lb;
  insert into _lb select l.rank, l.user_id, l.display_name from public.leaderboard('global', null, 100) l;
  -- only players who were already ranked this month, and only a real drop
  insert into public.rank_events (user_id, by_name, new_rank)
  select c.user_id, coalesce(a.display_name, ''), c.rank
  from _lb c
  join public.rank_snapshot s on s.user_id = c.user_id and s.month = mon
  join lateral (select x.display_name from _lb x where x.rank < c.rank order by x.rank desc, x.display_name limit 1) a on true
  where c.rank > s.rank and a.display_name is not null;
  get diagnostics n = row_count;
  insert into public.rank_snapshot (user_id, month, rank, display_name)
  select user_id, mon, rank, display_name from _lb
  on conflict (user_id) do update set month = excluded.month, rank = excluded.rank, display_name = excluded.display_name;
  delete from public.rank_events where created_at < now() - interval '3 days';
  return n;
end $$;
revoke all on function public.rank_watch() from anon, authenticated;

-- Vote reminders: private "vote" challenges that closed, are not resolved yet, and players who bet but did not vote.
create or replace function public.vote_pending() returns table(user_id uuid, code text, title text, voted integer, total integer)
language sql security definer stable set search_path = public as $$
  select pk.user_id, ch.code, ch.title,
         (select count(*) from public.friend_votes v where v.challenge_id = ch.id)::int,
         (select count(*) from public.friend_picks q where q.challenge_id = ch.id)::int
  from public.friend_challenges ch
  join public.friend_picks pk on pk.challenge_id = ch.id
  where ch.judge_mode = 'vote' and ch.status = 'open' and ch.visibility = 'private'
    and ch.closes_at < now() and ch.closes_at > now() - interval '14 days'
    and not exists (select 1 from public.friend_votes v where v.challenge_id = ch.id and v.user_id = pk.user_id)
  limit 500;
$$;
revoke all on function public.vote_pending() from anon, authenticated;

-- Bet tips: "X suggests you bet on this".
create table if not exists public.bet_tips (
  id uuid primary key default gen_random_uuid(),
  from_user uuid not null references public.profiles(id) on delete cascade,
  to_user uuid not null references public.profiles(id) on delete cascade,
  market_id uuid not null references public.markets(id) on delete cascade,
  pick text not null check (pick in ('yes','no')),
  created_at timestamptz not null default now(),
  pushed boolean not null default false,
  seen boolean not null default false,
  unique (from_user, to_user, market_id)
);
alter table public.bet_tips enable row level security;
revoke all on public.bet_tips from anon, authenticated;
create index if not exists bet_tips_pending on public.bet_tips (created_at) where not pushed;

create or replace function public.tip_bet(p_to uuid[], p_market uuid, p_pick text) returns integer
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); f uuid; n integer := 0; today integer;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if not public.is_registered() then raise exception 'registration_required'; end if;
  if p_pick not in ('yes','no') then raise exception 'bad_pick'; end if;
  if p_to is null or array_length(p_to, 1) is null then return 0; end if;
  if array_length(p_to, 1) > 10 then raise exception 'too_many_invites'; end if;
  if not exists (select 1 from public.markets where id = p_market and status = 'open' and closes_at > now()) then raise exception 'market_closed'; end if;
  select count(*) into today from public.bet_tips where from_user = uid and created_at > now() - interval '1 day';
  if today + array_length(p_to, 1) > 30 then raise exception 'invite_limit'; end if;
  foreach f in array p_to loop
    continue when f = uid;
    continue when not exists (select 1 from public.friendships where user_id = uid and friend_id = f);
    insert into public.bet_tips (from_user, to_user, market_id, pick) values (uid, f, p_market, p_pick)
      on conflict (from_user, to_user, market_id) do nothing;
    if found then n := n + 1; end if;
  end loop;
  return n;
end $$;
grant execute on function public.tip_bet(uuid[], uuid, text) to authenticated;

create or replace function public.tip_info(p_id uuid) returns table(market_id uuid, pick text, from_name text)
language plpgsql security definer set search_path = public as $$
begin
  update public.bet_tips set seen = true where id = p_id and to_user = auth.uid();
  return query select t.market_id, t.pick, coalesce(nullif(p.display_name, ''), '')
    from public.bet_tips t join public.profiles p on p.id = t.from_user where t.id = p_id and t.to_user = auth.uid();
end $$;
grant execute on function public.tip_info(uuid) to authenticated;

-- hourly: ranking watch; daily: best hours
select cron.unschedule(jobid) from cron.job where jobname in ('rank-watch', 'nudge-hours');
select cron.schedule('rank-watch', '7 * * * *', $$select public.rank_watch()$$);
select cron.schedule('nudge-hours', '40 3 * * *', $$select public.refresh_nudge_hours()$$);
