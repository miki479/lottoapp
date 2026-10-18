-- The ticker says what was bet on in full (the market's own question), not just a bare label such as a bus line "4".
drop function if exists public.activity_feed(integer);
create or replace function public.activity_feed(p_limit integer default 20)
returns table(kind text, who text, amount integer, market_kind text, label text, city_id text, at timestamptz, category text, params jsonb, closes_at timestamptz, target_at timestamptz, pick text)
language sql security definer stable set search_path = public as $$
  select * from (
    select case when b.status = 'open' then 'placed' else b.status end as kind,
           p.display_name as who, case when b.status = 'won' then b.payout - b.stake else b.stake end as amount,
           m.kind as market_kind,
           coalesce(nullif(m.params->>'routeName', ''), nullif(m.params->>'label', ''), case when m.params ? 'home' then (m.params->>'home') || ' – ' || (m.params->>'away') end, '') as label,
           m.city_id, coalesce(b.settled_at, b.placed_at) as at,
           m.category::text, m.params, m.closes_at, m.target_at, b.pick::text
    from public.bets b
    join public.markets m on m.id = b.market_id
    join public.profiles p on p.id = b.user_id
    where b.status in ('open','won','lost') and coalesce(b.settled_at, b.placed_at) > now() - interval '6 hours'
      and coalesce(m.params->>'testOnly', '') <> 'true'
  ) t order by at desc limit least(greatest(p_limit, 1), 40);
$$;
grant execute on function public.activity_feed(integer) to anon, authenticated;
