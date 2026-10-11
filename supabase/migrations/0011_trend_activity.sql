-- 1) live_delays also returns the delay of the same trip 5-20 minutes earlier, so the app can show a trend.
drop function if exists public.live_delays(uuid[]);
create function public.live_delays(p_markets uuid[])
returns table(market_id uuid, delay_sec integer, observed_at timestamptz, is_forecast boolean, prev_delay_sec integer)
language sql security definer stable set search_path = public as $$
  with latest as (
    select distinct on (m.id) m.id as mid, m.feed_id, m.params->>'tripId' as trip, o.delay_sec, o.observed_at,
           (o.predicted_at is not null and o.observed_at < o.predicted_at - interval '120 seconds') as fc
    from public.markets m
    join public.delay_observations o on o.feed_id = m.feed_id and o.trip_id = m.params->>'tripId'
    where m.id = any(p_markets) and m.status = 'open' and o.observed_at > now() - interval '30 minutes'
      and (m.params->>'stopSequence' is null or o.stop_sequence is null or o.stop_sequence <= (m.params->>'stopSequence')::int + 2)
    order by m.id, o.observed_at desc
  )
  select l.mid, l.delay_sec, l.observed_at, l.fc,
    (select p.delay_sec from public.delay_observations p
      where p.feed_id = l.feed_id and p.trip_id = l.trip and p.predicted_at is null
        and p.observed_at between l.observed_at - interval '20 minutes' and l.observed_at - interval '5 minutes'
      order by p.observed_at desc limit 1)
  from latest l;
$$;
grant execute on function public.live_delays(uuid[]) to anon, authenticated;

-- 2) Public activity feed for the ticker: real bets only. Guests have no nickname (the app shows "a player").
create or replace function public.activity_feed(p_limit integer default 20)
returns table(kind text, who text, amount integer, market_kind text, label text, city_id text, at timestamptz)
language sql security definer stable set search_path = public as $$
  select * from (
    select case when b.status = 'open' then 'placed' else b.status end as kind,
           p.display_name as who, case when b.status = 'won' then b.payout - b.stake else b.stake end as amount,
           m.kind as market_kind, coalesce(m.params->>'routeName', '') as label, m.city_id, coalesce(b.settled_at, b.placed_at) as at
    from public.bets b
    join public.markets m on m.id = b.market_id
    join public.profiles p on p.id = b.user_id
    where b.status in ('open','won','lost') and coalesce(b.settled_at, b.placed_at) > now() - interval '6 hours'
  ) t order by at desc limit least(greatest(p_limit, 1), 40);
$$;
grant execute on function public.activity_feed(integer) to anon, authenticated;
