-- Higher stake tiers: nothing below 1.10, 200 below 1.30, 2000 below 1.60, 10000 below 2.20, then up to 100000. Parlays up to 5000.
create or replace function public.stake_cap(o numeric) returns integer language sql immutable as $$
  select case when o < 1.10 then 0 when o < 1.30 then 200 when o < 1.60 then 2000 when o < 2.20 then 10000 else 100000 end;
$$;

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
  if p_stake < 10 or p_stake > 5000 then raise exception 'bad_stake'; end if;
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
