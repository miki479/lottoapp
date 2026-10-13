-- Parlay stake limit, coherent with single bets: at most the lowest stake_cap() among the legs (a leg under 1.10 caps the slip at 20), at most 20000 of profit, at most 5000.
create or replace function public.place_parlay(p_legs jsonb, p_stake integer, p_boost boolean default false)
returns public.parlays
language plpgsql security definer set search_path = public as $$
declare
  prof public.profiles;
  par public.parlays;
  leg jsonb; m public.markets;
  n integer; total numeric := 1; o numeric; seen_trips text[] := '{}'; trip text; cats text[] := '{}'; capv integer := 5000; fin numeric;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if public.registration_required() and not public.is_registered() then raise exception 'registration_required'; end if;
  if p_legs is null or jsonb_typeof(p_legs) <> 'array' then raise exception 'bad_legs'; end if;
  n := jsonb_array_length(p_legs);
  if n < 2 or n > 5 then raise exception 'bad_legs'; end if;
  if p_stake is null or p_stake < 10 or p_stake > 5000 then raise exception 'bad_stake'; end if;
  -- lock order: the questions first (in a fixed order), then the profile, like place_bet and settle_market. Taking the profile first could deadlock with a
  -- settlement that holds a question and waits for this player's row.
  perform 1 from public.markets where id in (select (x->>'market')::uuid from jsonb_array_elements(p_legs) x where x->>'market' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') order by id for share;
  select * into prof from public.profiles where id = auth.uid() for update;
  if not found then raise exception 'no_profile'; end if;
  if (select count(*) from public.bets where user_id = prof.id and placed_at > now() - interval '1 minute')
   + (select count(*) from public.parlays where user_id = prof.id and placed_at > now() - interval '1 minute') >= 8 then
    raise exception 'rate_limited';
  end if;
  if prof.credits < p_stake then raise exception 'insufficient_credits'; end if;

  if p_boost and prof.boosts < 1 then raise exception 'no_boost'; end if;
  insert into public.parlays (user_id, stake, odds, boosted) values (prof.id, p_stake, 1, p_boost) returning * into par;
  for leg in select * from jsonb_array_elements(p_legs) loop
    if (leg->>'pick') not in ('yes','no') then raise exception 'bad_pick'; end if;
    select * into m from public.markets where id = (leg->>'market')::uuid for share;
    if not found or m.status <> 'open' or now() >= m.closes_at then raise exception 'market_closed'; end if;
    -- two legs on the same trip would be correlated: not allowed
    trip := case
      when m.params ? 'tripId' then m.feed_id || ':' || (m.params->>'tripId')
      when m.kind = 'quake_m' then 'quake:' || extract(epoch from m.target_at)::bigint        -- magnitude 6 implies magnitude 5
      when m.category = 'weather' then 'wx:' || m.city_id || ':' || extract(epoch from date_trunc('hour', m.target_at))::bigint  -- snow implies precipitation, etc.
      else m.id::text end;
    if trip = any(seen_trips) then raise exception 'duplicate_leg'; end if;
    seen_trips := seen_trips || trip;
    o := case when leg->>'pick' = 'yes' then m.odds_yes else m.odds_no end;
    total := total * o;
    capv := least(capv, public.stake_cap(o));  -- a near-certain leg limits the whole slip, like a single bet on it
    insert into public.parlay_legs (parlay_id, market_id, pick, odds) values (par.id, m.id, leg->>'pick', o);
    cats := cats || m.category;
  end loop;
  fin := least(100, round(total, 2));
  -- the same limits as single bets: the safest leg's cap, and no more than 20000 of profit on one slip (floor 20)
  if fin > 1 then capv := least(capv, greatest(20, floor(20000 / (fin - 1))::int)); end if;
  if p_stake > capv then raise exception 'stake_too_high'; end if;
  update public.parlays set odds = fin where id = par.id returning * into par;
  update public.profiles set credits = credits - p_stake, boosts = boosts - (case when p_boost then 1 else 0 end) where id = prof.id;
  perform public.register_play(prof.id, c) from unnest(cats) c;
  perform public.pay_referral(prof.id);
  return par;
end $$;

