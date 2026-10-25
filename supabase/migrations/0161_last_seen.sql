-- Last online of friends: a heartbeat stamps profiles.last_seen_at (at most once a minute); each player can hide theirs.
alter table public.profiles add column if not exists last_seen_at timestamptz;
alter table public.profiles add column if not exists show_last_seen boolean not null default true;

create or replace function public.touch_seen() returns void
language sql security definer set search_path = public as $$
  update public.profiles set last_seen_at = now() where id = auth.uid() and (last_seen_at is null or last_seen_at < now() - interval '60 seconds');
$$;
revoke all on function public.touch_seen() from public, anon; grant execute on function public.touch_seen() to authenticated;

create or replace function public.set_show_last_seen(p_on boolean) returns void
language sql security definer set search_path = public as $$
  update public.profiles set show_last_seen = p_on where id = auth.uid();
$$;
revoke all on function public.set_show_last_seen(boolean) from public, anon; grant execute on function public.set_show_last_seen(boolean) to authenticated;

create or replace function public.show_last_seen() returns boolean
language sql security definer stable set search_path = public as $$
  select coalesce((select show_last_seen from public.profiles where id = auth.uid()), true);
$$;
revoke all on function public.show_last_seen() from public, anon; grant execute on function public.show_last_seen() to authenticated;

-- friends_board (0110 body) + last_seen
drop function if exists public.friends_board();
create or replace function public.friends_board()
returns table(rank bigint, user_id uuid, display_name text, score bigint, bets bigint, streak integer, is_me boolean, prev_rank bigint, title text, last_seen timestamptz)
language sql security definer stable set search_path = public as $$
  with ids as (
    select auth.uid() as id union all select friend_id from public.friendships where user_id = auth.uid()
  ), ev as (
    select user_id, status, stake, payout, settled_at from public.bets where status <> 'open'
    union all select user_id, status, stake, payout, settled_at from public.parlays where status <> 'open'
  ), s as (
    select p.id, nullif(p.display_name, '') as display_name, p.streak, p.title, case when p.id = auth.uid() or p.show_last_seen then p.last_seen_at end as last_seen,
           coalesce(sum(case b.status when 'won' then b.payout - b.stake when 'lost' then -b.stake else 0 end), 0)::bigint as score,
           coalesce(sum(case when b.settled_at < now() - interval '1 day' then case b.status when 'won' then b.payout - b.stake when 'lost' then -b.stake else 0 end else 0 end), 0)::bigint as before,
           count(b.status) filter (where b.status in ('won','lost')) as bets
    from ids join public.profiles p on p.id = ids.id
    left join ev b on b.user_id = p.id and b.settled_at >= date_trunc('month', now())
    where auth.uid() is not null
    group by p.id, p.display_name, p.streak, p.title, p.last_seen_at, p.show_last_seen
  )
  select rank() over (order by score desc, bets desc), id, display_name, score, bets, streak, id = auth.uid(),
         rank() over (order by before desc), title, last_seen
  from s order by 1, display_name nulls last, id;
$$;
grant execute on function public.friends_board() to authenticated;

