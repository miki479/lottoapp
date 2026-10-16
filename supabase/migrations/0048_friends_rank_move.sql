-- The friends ranking also says how each place moved in the last 24 hours (rank now vs. rank without the results of the last day).
drop function if exists public.friends_board();
create or replace function public.friends_board()
returns table(rank bigint, user_id uuid, display_name text, score bigint, bets bigint, streak integer, is_me boolean, prev_rank bigint)
language sql security definer stable set search_path = public as $$
  with ids as (
    select auth.uid() as id union all select friend_id from public.friendships where user_id = auth.uid()
  ), ev as (
    select user_id, status, stake, payout, settled_at from public.bets where status <> 'open'
    union all select user_id, status, stake, payout, settled_at from public.parlays where status <> 'open'
  ), s as (
    select p.id, nullif(p.display_name, '') as display_name, p.streak,
           coalesce(sum(case b.status when 'won' then b.payout - b.stake when 'lost' then -b.stake else 0 end), 0)::bigint as score,
           coalesce(sum(case when b.settled_at < now() - interval '1 day' then case b.status when 'won' then b.payout - b.stake when 'lost' then -b.stake else 0 end else 0 end), 0)::bigint as before,
           count(b.status) filter (where b.status in ('won','lost')) as bets
    from ids join public.profiles p on p.id = ids.id
    left join ev b on b.user_id = p.id and b.settled_at >= date_trunc('month', now())
    where auth.uid() is not null
    group by p.id, p.display_name, p.streak
  )
  select rank() over (order by score desc, bets desc), id, display_name, score, bets, streak, id = auth.uid(),
         rank() over (order by before desc)
  from s order by 1, display_name nulls last, id;
$$;
grant execute on function public.friends_board() to authenticated;
