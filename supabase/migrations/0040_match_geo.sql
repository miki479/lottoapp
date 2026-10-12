-- Where clubs play (town centre, from geocoding), so local matches show up in the "nearby" list.
create table if not exists public.team_geo (
  team text primary key,
  lat numeric(8,5),
  lon numeric(8,5),
  tried_at timestamptz not null default now()
);
alter table public.team_geo enable row level security;
revoke all on public.team_geo from anon, authenticated;

create or replace function public.nearby_markets(p_lat numeric, p_lon numeric, p_km integer default 30, p_limit integer default 12)
returns table (market_id uuid, km numeric, bettors bigint)
language sql stable security definer set search_path = public as $$
  select m.id, round(public.km_between(p_lat, p_lon, m.lat, m.lon), 1), coalesce(b.n, 0)
  from public.markets m
  left join lateral (select count(distinct user_id) n from public.bets where market_id = m.id and user_id is distinct from m.created_by) b on true
  where m.status = 'open' and m.closes_at > now() and (m.params->>'custom' = 'true' or m.params->>'local' = 'true') and m.lat is not null
    and coalesce(m.params->>'testOnly', '') <> 'true'
    and public.km_between(p_lat, p_lon, m.lat, m.lon) <= least(greatest(p_km, 5), 200)
    and not exists (select 1 from public.reports r where r.market_id = m.id and r.status = 'open' having count(*) >= 2)
  order by (1 + coalesce(b.n, 0)) / (1 + public.km_between(p_lat, p_lon, m.lat, m.lon) / 15.0) desc, m.closes_at
  limit least(greatest(p_limit, 1), 30);
$$;
grant execute on function public.nearby_markets(numeric, numeric, integer, integer) to anon, authenticated;

-- Hail (weather code 96/99) joins the stored weather measurements.
alter table public.metric_observations drop constraint if exists metric_observations_metric_check;
alter table public.metric_observations add constraint metric_observations_metric_check check (metric in ('temp','wind','snow','uv','aqi','hail'));
