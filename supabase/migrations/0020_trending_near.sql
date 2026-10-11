-- Public aggregates (no personal data): the cities people bet on most, and what people bet on in one city.
create or replace function public.trending_places(p_limit integer default 8)
returns table(city_id text, bets bigint, name text, country text, lat numeric, lon numeric, timezone text)
language sql security definer stable set search_path = public as $$
  select m.city_id, count(*)::bigint, max(p.name), max(p.country), max(p.lat), max(p.lon), max(p.timezone)
  from public.bets b
  join public.markets m on m.id = b.market_id
  left join public.places p on p.id = m.city_id
  where b.placed_at > now() - interval '3 days'
  group by m.city_id order by count(*) desc limit least(p_limit, 20);
$$;
grant execute on function public.trending_places(integer) to anon, authenticated;

create or replace function public.popular_in_city(p_city text, p_limit integer default 5)
returns table(market_id uuid, bets bigint, staked bigint)
language sql security definer stable set search_path = public as $$
  select b.market_id, count(*)::bigint, sum(b.stake)::bigint
  from public.bets b join public.markets m on m.id = b.market_id
  where m.city_id = p_city and m.status = 'open' and m.closes_at > now() and b.placed_at > now() - interval '1 day'
  group by b.market_id order by count(*) desc, sum(b.stake) desc limit least(p_limit, 10);
$$;
grant execute on function public.popular_in_city(text, integer) to anon, authenticated;
