-- Live repricing also needs the city (to learn the starting chance per country), and a way to find open delay questions that still carry an old starting price.
drop function if exists public.live_pricing_inputs();
create or replace function public.live_pricing_inputs()
returns table(market_id uuid, city_id text, kind text, threshold_sec integer, target_seq integer, obs_seq integer, delay_sec integer,
              odds_yes numeric, odds_no numeric, flash_multiplier numeric, p_prior numeric)
language sql stable security definer set search_path = public as $$
  select m.id, m.city_id, m.kind, (m.params->>'thresholdSec')::int, (m.params->>'stopSequence')::int, o.stop_sequence, o.delay_sec,
         m.odds_yes, m.odds_no, m.flash_multiplier, nullif(m.params->>'pPrior', '')::numeric
  from public.markets m
  join lateral (
    select x.stop_sequence, x.delay_sec from public.delay_observations x
    where x.feed_id = m.feed_id and x.trip_id = m.params->>'tripId' and x.observed_at > now() - interval '10 minutes'
      and (x.predicted_at is null or x.observed_at >= x.predicted_at - interval '120 seconds')
      and x.stop_sequence is not null and x.stop_sequence <= (m.params->>'stopSequence')::int
    order by x.observed_at desc limit 1) o on true
  where m.status = 'open' and m.closes_at > now() and m.kind in ('bus_delay_gt', 'train_delay_gt')
    and m.params->>'stopSequence' is not null and m.params->>'thresholdSec' is not null;
$$;
revoke execute on function public.live_pricing_inputs() from public, anon, authenticated;

-- Open delay questions never priced with the learned starting chance (made by an older generator): oldest first.
create or replace function public.stale_prior_markets()
returns table(market_id uuid, city_id text, kind text, threshold_sec integer, odds_yes numeric, flash_multiplier numeric)
language sql stable security definer set search_path = public as $$
  select m.id, m.city_id, m.kind, (m.params->>'thresholdSec')::int, m.odds_yes, m.flash_multiplier
  from public.markets m
  where m.status = 'open' and m.closes_at > now() and m.kind in ('bus_delay_gt', 'train_delay_gt')
    and m.params->>'ladderOf' is null and m.params->>'pPrior' is null and m.flash_multiplier = 1
  order by m.created_at limit 300;
$$;
revoke execute on function public.stale_prior_markets() from public, anon, authenticated;
