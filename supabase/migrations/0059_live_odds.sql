-- Live repricing of delay markets: while a bus or train is already running, the quote follows its real delay
-- (computed in the ingest function with shared/odds.ts). Bets keep the odds they were placed at.
create or replace function public.live_pricing_inputs()
returns table(market_id uuid, kind text, threshold_sec integer, target_seq integer, obs_seq integer, delay_sec integer,
              odds_yes numeric, odds_no numeric, flash_multiplier numeric, p_prior numeric)
language sql stable security definer set search_path = public as $$
  select m.id, m.kind, (m.params->>'thresholdSec')::int, (m.params->>'stopSequence')::int, o.stop_sequence, o.delay_sec,
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

-- p: [{id, prior, yes, no}] (new base odds). A flash multiplier stays applied on top of the new "yes" quote.
create or replace function public.apply_live_odds(p jsonb) returns integer
language plpgsql security definer set search_path = public as $$
declare r jsonb; n integer := 0;
begin
  for r in select * from jsonb_array_elements(p) loop
    update public.markets set
      params = params || jsonb_build_object('pPrior', (r->>'prior')::numeric),
      odds_no = (r->>'no')::numeric,
      base_odds_yes = case when flash_multiplier > 1 then (r->>'yes')::numeric else base_odds_yes end,
      odds_yes = case when flash_multiplier > 1 then least(15, round((r->>'yes')::numeric * flash_multiplier, 2)) else (r->>'yes')::numeric end
    where id = (r->>'id')::uuid and status = 'open' and closes_at > now();
    n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function public.apply_live_odds(jsonb) from public, anon, authenticated;
