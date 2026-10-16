-- Public, read-only: the forecast/measured precipitation (mm) of the hour a rain market is about, so the card can show the sky.
create or replace function public.weather_outlook(p_markets uuid[])
returns table(market_id uuid, mm numeric)
language sql security definer stable set search_path = public as $$
  select m.id, w.precipitation_mm
  from public.markets m
  join public.weather_observations w on w.feed_id = m.feed_id and w.hour_start = date_trunc('hour', m.target_at)
  where m.id = any(p_markets) and m.kind = 'rain_at' and m.status = 'open'
$$;
grant execute on function public.weather_outlook(uuid[]) to anon, authenticated;
