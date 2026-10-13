-- The limit of open bets (closed ones still waiting for their result count too) goes from 25 to 40: an active player reaches 25 in one evening.
create or replace function public.place_bet(p_market uuid, p_pick text, p_stake integer, p_boost boolean default false, p_bonus text default null, p_vice boolean default false, p_offer uuid default null, p_odds numeric default null)
returns bets
language plpgsql security definer set search_path to 'public' as $function$
declare
  m public.markets;
  prof public.profiles;
  b public.bets;
  o public.personal_offers;
  vp integer := 0;
  sc integer;
  base numeric;
  bet_odds numeric;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if public.registration_required() and not public.is_registered() then raise exception 'registration_required'; end if;
  if p_pick not in ('yes','no') then raise exception 'bad_pick'; end if;
  select * into m from public.markets where id = p_market for share;
  if not found or m.status <> 'open' or now() >= m.closes_at then raise exception 'market_closed'; end if;
  -- live delay questions: the bet is held for a moment and the market read again, so a quote that moved in between is the one that counts
  if m.kind in ('bus_delay_gt', 'train_delay_gt', 'bus_full') then
    perform pg_sleep(2.5);
    select * into m from public.markets where id = p_market for share;
    if not found or m.status <> 'open' or now() >= m.closes_at then raise exception 'market_closed'; end if;
  end if;
  if p_bonus is not null and (p_bonus not in ('free','few','standing') or m.kind <> 'bus_delay_gt' or coalesce(m.params->>'occBonus', '') <> 'true') then raise exception 'bad_bonus'; end if;
  -- the "Bonus Vice" of the GTA VI question: only on Yes, only where the question carries it, once per player
  if p_vice then
    if p_pick <> 'yes' or coalesce(m.params->>'viceBonus', '') = '' then raise exception 'bad_bonus'; end if;
    vp := least(25, greatest(0, (m.params->>'viceBonus')::int));
    if exists (select 1 from public.bets where user_id = auth.uid() and market_id = m.id and vice_pct > 0) then raise exception 'bonus_used'; end if;
  end if;
  select * into prof from public.profiles where id = auth.uid() for update;
  if not found then raise exception 'no_profile'; end if;
  -- one bet per question and at most 40 open at a time: the answer is chosen once, and the list stays something a person can follow
  if exists (select 1 from public.bets where user_id = prof.id and market_id = m.id) then raise exception 'already_bet'; end if;
  if (select count(*) from public.bets where user_id = prof.id and status = 'open') >= 40 then raise exception 'too_many_bets'; end if;
  if (select count(*) from public.bets where user_id = prof.id and placed_at > now() - interval '1 minute')
   + (select count(*) from public.parlays where user_id = prof.id and placed_at > now() - interval '1 minute') >= 8 then
    raise exception 'rate_limited';
  end if;
  if p_stake is null or p_stake < 10 or p_stake > 100000 then raise exception 'bad_stake'; end if;
  if prof.credits < p_stake then raise exception 'insufficient_credits'; end if;
  base := case when p_pick = 'yes' then m.odds_yes else m.odds_no end;
  bet_odds := base;
  -- the quote the player saw must still hold (a drop of more than 3% means the question was repriced meanwhile)
  if p_odds is not null and p_offer is null and base < p_odds * 0.97 then raise exception 'odds_changed'; end if;
  if p_offer is not null then
    -- a personal offer: the player's own, unused, unexpired, for this question, within its small stake; no boost or bonus on top
    select * into o from public.personal_offers where id = p_offer for update;
    if not found or o.user_id <> prof.id or o.market_id <> m.id then raise exception 'bad_offer'; end if;
    if o.used_at is not null then raise exception 'offer_used'; end if;
    if o.expires_at <= now() then raise exception 'offer_expired'; end if;
    if p_boost or p_bonus is not null or p_vice then raise exception 'bad_offer'; end if;
    if p_stake > o.max_stake then raise exception 'stake_too_high'; end if;
    if base < 1.30 then raise exception 'odds_too_low'; end if;   -- the quote moved: never multiply an all-but-certain pick
    bet_odds := least(100, round(base * o.multiplier, 2));
    update public.personal_offers set used_at = now() where id = o.id;
  else
    -- an outcome that is already (nearly) decided cannot be played, and the safer the pick the lower the stake that is allowed
    sc := public.stake_cap(base);
    -- delay questions are read live, so the stake is also limited whatever the quote
    if m.kind in ('bus_delay_gt', 'train_delay_gt', 'bus_full') and sc > 1000 then sc := 1000; end if;
    -- and a delay question never pays more than 2000 profit on one bet: a long-shot quote on a train whose delay is already visible cannot be milked
    if m.kind in ('bus_delay_gt', 'train_delay_gt', 'bus_full') and base > 1 then sc := greatest(20, least(sc, floor(2000 / (base - 1))::int)); end if;
    -- players who keep cashing in on near-certain picks get a smaller limit on them (see refresh_stake_factors)
    if sc > 20 and prof.stake_factor < 1 then sc := greatest(20, floor(sc * prof.stake_factor)::int); end if;
    -- a big balance cannot be thrown at a single question: up to 5000, or a quarter of the balance if that is more (all-in is for small balances)
    sc := least(sc, greatest(5000, floor(prof.credits * 0.25)::int));
    if sc = 0 then raise exception 'odds_too_low'; end if;
    if p_stake > sc then raise exception 'stake_too_high'; end if;
  end if;
  if p_boost and prof.boosts < 1 then raise exception 'no_boost'; end if;
  update public.profiles set credits = credits - p_stake, boosts = boosts - (case when p_boost then 1 else 0 end) where id = prof.id;
  insert into public.bets (user_id, market_id, pick, stake, odds, boosted, bonus, vice_pct)
  values (prof.id, m.id, p_pick, p_stake, bet_odds, p_boost, p_bonus, vp)
  returning * into b;
  perform public.register_play(prof.id, m.category);
  perform public.pay_referral(prof.id);
  return b;
end $function$;

