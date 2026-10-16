-- Higher stakes (up to the whole balance, in steps by odds), no bets on all-but-certain outcomes, parlays up to 2000.
-- How much can be staked on a pick at these odds: nothing below 1.10 (the result is all but known), then growing with the odds.
create or replace function public.stake_cap(o numeric) returns integer language sql immutable as $$
  select case when o < 1.10 then 0 when o < 1.30 then 100 when o < 1.60 then 500 when o < 2.20 then 5000 else 100000 end;
$$;
grant execute on function public.stake_cap(numeric) to authenticated, anon;

create or replace function public.place_bet(p_market uuid, p_pick text, p_stake integer, p_boost boolean default false, p_bonus text default null, p_vice boolean default false)
returns bets
language plpgsql security definer set search_path to 'public' as $function$
declare
  m public.markets;
  prof public.profiles;
  b public.bets;
  vp integer := 0;
  sc integer;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if public.registration_required() and not public.is_registered() then raise exception 'registration_required'; end if;
  if p_pick not in ('yes','no') then raise exception 'bad_pick'; end if;
  select * into m from public.markets where id = p_market for share;
  if not found or m.status <> 'open' or now() >= m.closes_at then raise exception 'market_closed'; end if;
  if p_bonus is not null and (p_bonus not in ('free','few','standing') or m.kind <> 'bus_delay_gt' or coalesce(m.params->>'occBonus', '') <> 'true') then raise exception 'bad_bonus'; end if;
  -- the "Bonus Vice" of the GTA VI question: only on Yes, only where the question carries it, once per player
  if p_vice then
    if p_pick <> 'yes' or coalesce(m.params->>'viceBonus', '') = '' then raise exception 'bad_bonus'; end if;
    vp := least(25, greatest(0, (m.params->>'viceBonus')::int));
    if exists (select 1 from public.bets where user_id = auth.uid() and market_id = m.id and vice_pct > 0) then raise exception 'bonus_used'; end if;
  end if;
  select * into prof from public.profiles where id = auth.uid() for update;
  if not found then raise exception 'no_profile'; end if;
  if (select count(*) from public.bets where user_id = prof.id and placed_at > now() - interval '1 minute')
   + (select count(*) from public.parlays where user_id = prof.id and placed_at > now() - interval '1 minute') >= 8 then
    raise exception 'rate_limited';
  end if;
  if p_stake < 10 or p_stake > 100000 then raise exception 'bad_stake'; end if;
  if prof.credits < p_stake then raise exception 'insufficient_credits'; end if;
  -- an outcome that is already (nearly) decided cannot be played, and the safer the pick the lower the stake that is allowed
  sc := public.stake_cap(case when p_pick = 'yes' then m.odds_yes else m.odds_no end);
  if sc = 0 then raise exception 'odds_too_low'; end if;
  if p_stake > sc then raise exception 'stake_too_high'; end if;
  if p_boost and prof.boosts < 1 then raise exception 'no_boost'; end if;
  update public.profiles set credits = credits - p_stake, boosts = boosts - (case when p_boost then 1 else 0 end) where id = prof.id;
  insert into public.bets (user_id, market_id, pick, stake, odds, boosted, bonus, vice_pct)
  values (prof.id, m.id, p_pick, p_stake, case when p_pick = 'yes' then m.odds_yes else m.odds_no end, p_boost, p_bonus, vp)
  returning * into b;
  perform public.register_play(prof.id, m.category);
  perform public.pay_referral(prof.id);
  return b;
end $function$;
grant execute on function public.place_bet(uuid, text, integer, boolean, text, boolean) to authenticated;

create or replace function public.place_parlay(p_legs jsonb, p_stake integer, p_boost boolean default false)
returns public.parlays
language plpgsql security definer set search_path = public as $$
declare
  prof public.profiles;
  par public.parlays;
  leg jsonb; m public.markets;
  n integer; total numeric := 1; o numeric; seen_trips text[] := '{}'; trip text; cats text[] := '{}';
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if public.registration_required() and not public.is_registered() then raise exception 'registration_required'; end if;
  if jsonb_typeof(p_legs) <> 'array' then raise exception 'bad_legs'; end if;
  n := jsonb_array_length(p_legs);
  if n < 2 or n > 5 then raise exception 'bad_legs'; end if;
  if p_stake < 10 or p_stake > 2000 then raise exception 'bad_stake'; end if;
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
    insert into public.parlay_legs (parlay_id, market_id, pick, odds) values (par.id, m.id, leg->>'pick', o);
    cats := cats || m.category;
  end loop;
  update public.parlays set odds = least(100, round(total, 2)) where id = par.id returning * into par;
  update public.profiles set credits = credits - p_stake, boosts = boosts - (case when p_boost then 1 else 0 end) where id = prof.id;
  perform public.register_play(prof.id, c) from unnest(cats) c;
  perform public.pay_referral(prof.id);
  return par;
end $$;

grant execute on function public.place_parlay(jsonb, integer, boolean) to authenticated;
