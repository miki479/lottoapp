-- (2) bets on live delay questions are held 2.5 s and the quote re-read; the client sends the quote it showed and a drop of more than 3% is refused ('odds_changed').
-- (3) a stake factor per player: whoever bets mostly on near-certain picks (odds under 1.30), nearly always wins them and has made a lot from them gets a smaller limit on such picks.
alter table public.profiles add column if not exists stake_factor numeric not null default 1 check (stake_factor between 0.1 and 1);
drop function if exists public.place_bet(uuid, text, integer, boolean, text, boolean, uuid);
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
  if (select count(*) from public.bets where user_id = prof.id and placed_at > now() - interval '1 minute')
   + (select count(*) from public.parlays where user_id = prof.id and placed_at > now() - interval '1 minute') >= 8 then
    raise exception 'rate_limited';
  end if;
  if p_stake < 10 or p_stake > 100000 then raise exception 'bad_stake'; end if;
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
    -- players who keep cashing in on near-certain picks get a smaller limit on them (see refresh_stake_factors)
    if sc > 20 and prof.stake_factor < 1 then sc := greatest(20, floor(sc * prof.stake_factor)::int); end if;
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
grant execute on function public.place_bet(uuid, text, integer, boolean, text, boolean, uuid, numeric) to authenticated;

create or replace function public.refresh_stake_factors() returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  with s as (
    select user_id,
      count(*) as cnt,
      coalesce(sum(stake) filter (where odds < 1.3), 0) as low_stake,
      sum(stake) as stk,
      coalesce(avg((status = 'won')::int) filter (where odds < 1.3), 0) as low_win,
      coalesce(sum(payout - stake) filter (where odds < 1.3), 0) as low_profit
    from public.bets where status in ('won', 'lost') and settled_at > now() - interval '14 days' group by user_id
  ), f as (
    select user_id, case
      when cnt >= 10 and low_stake >= 0.6 * stk and low_win >= 0.9 and low_profit > 5000 then 0.25
      when cnt >= 10 and low_stake >= 0.6 * stk and low_win >= 0.9 and low_profit > 1500 then 0.5
      else 1 end as factor from s
  )
  update public.profiles p set stake_factor = f.factor from f where p.id = f.user_id and p.stake_factor <> f.factor;
  get diagnostics n = row_count;
  -- nobody with a reduced factor and no recent settled bets stays reduced
  update public.profiles set stake_factor = 1 where stake_factor <> 1 and id not in (select user_id from public.bets where status in ('won', 'lost') and settled_at > now() - interval '14 days');
  return n;
end $$;
revoke execute on function public.refresh_stake_factors() from public, anon, authenticated;
select cron.unschedule('stake-factors') where exists (select 1 from cron.job where jobname = 'stake-factors');
select cron.schedule('stake-factors', '41 * * * *', $$ select public.refresh_stake_factors() $$);
