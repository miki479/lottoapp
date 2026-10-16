-- The pricing of delay questions also needs the name of the line ("REG 2028"): each train gets the rate of its own settled questions (see ingest, repriceDelays).
drop function if exists public.live_pricing_inputs();
create function public.live_pricing_inputs()
returns table(market_id uuid, city_id text, kind text, threshold_sec integer, target_seq integer, obs_seq integer, delay_sec integer,
              odds_yes numeric, odds_no numeric, flash_multiplier numeric, p_prior numeric, route text)
language sql stable security definer set search_path = public as $$
  select m.id, m.city_id, m.kind, (m.params->>'thresholdSec')::int, (m.params->>'stopSequence')::int, o.stop_sequence, o.delay_sec,
         m.odds_yes, m.odds_no, m.flash_multiplier, nullif(m.params->>'pPrior', '')::numeric, m.params->>'routeName'
  from public.markets m
  join lateral (
    select x.stop_sequence, x.delay_sec from public.delay_observations x
    where x.feed_id = m.feed_id and x.trip_id = m.params->>'tripId' and x.observed_at > now() - interval '45 minutes'
      and (x.predicted_at is null or x.observed_at >= x.predicted_at - interval '120 seconds')
      and x.stop_sequence is not null and x.stop_sequence <= (m.params->>'stopSequence')::int
    order by x.observed_at desc limit 1) o on true
  where m.status = 'open' and m.closes_at > now() and m.kind in ('bus_delay_gt', 'train_delay_gt')
    and m.params->>'stopSequence' is not null and m.params->>'thresholdSec' is not null;
$$;
revoke execute on function public.live_pricing_inputs() from public, anon, authenticated;

drop function if exists public.stale_prior_markets();
create function public.stale_prior_markets()
returns table(market_id uuid, city_id text, kind text, threshold_sec integer, odds_yes numeric, flash_multiplier numeric, route text)
language sql stable security definer set search_path = public as $$
  select m.id, m.city_id, m.kind, (m.params->>'thresholdSec')::int, m.odds_yes, m.flash_multiplier, m.params->>'routeName'
  from public.markets m
  where m.status = 'open' and m.closes_at > now() and m.kind in ('bus_delay_gt', 'train_delay_gt')
    and m.params->>'ladderOf' is null and m.params->>'pPrior' is null and m.flash_multiplier = 1
  order by m.created_at limit 300;
$$;
revoke execute on function public.stale_prior_markets() from public, anon, authenticated;

-- settled results per line, for the per-train rate (last 45 days, questions on the main line only)
create or replace function public.route_results()
returns table(city_id text, route text, n bigint, yes bigint)
language sql stable security definer set search_path = public as $$
  select m.city_id, m.params->>'routeName', count(*), count(*) filter (where m.outcome = 'yes')
  from public.markets m
  where m.status = 'resolved' and m.kind in ('bus_delay_gt', 'train_delay_gt') and m.params->>'ladderOf' is null
    and m.outcome in ('yes', 'no') and m.target_at > now() - interval '45 days' and m.params->>'routeName' is not null
  group by 1, 2;
$$;
revoke execute on function public.route_results() from public, anon, authenticated;
