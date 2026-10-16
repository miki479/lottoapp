-- Open markets my friends have bet on (how many of them), for the "friends are on it" badge and the featured list.
create or replace function public.friend_bets()
returns table(market_id uuid, friends bigint)
language sql security definer stable set search_path = public as $$
  select b.market_id, count(distinct b.user_id)
  from public.bets b
  join public.markets m on m.id = b.market_id and m.status = 'open' and m.closes_at > now()
  where auth.uid() is not null and b.user_id in (select friend_id from public.friendships where user_id = auth.uid())
  group by b.market_id order by 2 desc limit 50;
$$;
grant execute on function public.friend_bets() to authenticated;
