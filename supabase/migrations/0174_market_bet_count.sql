-- How many bets one question has taken: a public count, nothing about who (the featured GTA VI card and its banner show it).
create or replace function public.market_bet_count(p_market uuid) returns integer
language sql stable security definer set search_path = public as $$
  select count(*)::int from public.bets where market_id = p_market and status <> 'void';
$$;
grant execute on function public.market_bet_count(uuid) to anon, authenticated;
