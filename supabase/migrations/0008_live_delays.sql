-- Public, read-only: the latest measured delay of the trips behind open markets (shown as LIVE in the app).
-- Position feeds give facts; trip-update feeds give forecasts until the predicted passage, flagged as such.
create or replace function public.live_delays(p_markets uuid[])
returns table(market_id uuid, delay_sec integer, observed_at timestamptz, is_forecast boolean)
language sql security definer stable set search_path = public as $$
  select distinct on (m.id) m.id, o.delay_sec, o.observed_at,
         (o.predicted_at is not null and o.observed_at < o.predicted_at - interval '120 seconds')
  from public.markets m
  join public.delay_observations o on o.feed_id = m.feed_id and o.trip_id = m.params->>'tripId'
  where m.id = any(p_markets) and m.status = 'open' and o.observed_at > now() - interval '30 minutes'
    and (m.params->>'stopSequence' is null or o.stop_sequence is null or o.stop_sequence <= (m.params->>'stopSequence')::int + 2)
  order by m.id, o.observed_at desc;
$$;
grant execute on function public.live_delays(uuid[]) to anon, authenticated;
