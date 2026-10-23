-- Lighter on the database: (1) the live-delay hold in place_bet pins a connection and a row lock, so it is cut from 2.5 s to 1.2 s;
-- (2) the learned "late" chances were recomputed by every cold edge function (28 queries each, 138k calls so far): one cached call now.
create index if not exists markets_resolved_kind_target on public.markets (kind, target_at desc) where status = 'resolved';

create table if not exists public.learned_prior_cache (country text not null, kind text not null, yes integer not null, n integer not null, updated_at timestamptz not null default now(), primary key (country, kind));
alter table public.learned_prior_cache enable row level security;   -- service role only

create or replace function public.learned_prior_counts(p_max_age_s integer default 1800) returns table(country text, kind text, yes integer, n integer)
language plpgsql security definer set search_path = public as $$
#variable_conflict use_column
begin
  if not exists (select 1 from public.learned_prior_cache where updated_at > now() - make_interval(secs => p_max_age_s)) then
    -- one writer at a time; the others read the old rows
    if pg_try_advisory_xact_lock(7160001) then
      delete from public.learned_prior_cache;
      insert into public.learned_prior_cache (country, kind, yes, n)
      select c.country, k.kind, count(*) filter (where r.outcome = 'yes')::int, count(*)::int
      from (select distinct country from public.cities) c
      cross join (values ('bus_delay_gt'), ('train_delay_gt')) k(kind)
      cross join lateral (
        select m.outcome from public.markets m
        where m.kind = k.kind and m.status = 'resolved' and m.params->>'ladderOf' is null
          and m.city_id in (select id from public.cities where country = c.country)
        order by m.target_at desc limit 1000) r
      group by c.country, k.kind;
    end if;
  end if;
  return query select l.country, l.kind, l.yes, l.n from public.learned_prior_cache l;
end $$;
revoke all on function public.learned_prior_counts(integer) from public, anon, authenticated;
grant execute on function public.learned_prior_counts(integer) to service_role;

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
  lb boolean;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if public.registration_required() and not public.is_registered() then raise exception 'registration_required'; end if;
  if p_pick not in ('yes','no') then raise exception 'bad_pick'; end if;
  select * into m from public.markets where id = p_market for share;
  if not found or m.status <> 'open' or now() >= m.closes_at then raise exception 'market_closed'; end if;
  -- live delay questions: the bet is held for a moment and the market read again, so a quote that moved in between is the one that counts
  if m.kind in ('bus_delay_gt', 'train_delay_gt', 'bus_full') then
    perform pg_sleep(1.2);
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
    -- the Limit Breaker (24 h after it is bought): the delay limits (2000 stake, 4999 profit) and the 10000 profit limit are lifted to a single ceiling of 50000 profit;
    -- the "too certain" guard, the stake factor and the balance limit below still apply
    lb := coalesce(prof.limit_break_until, '-infinity'::timestamptz) > now();
    if lb then
      if base > 1 then sc := greatest(20, least(sc, floor(50000 / (base - 1))::int)); end if;
    else
    if m.kind in ('bus_delay_gt', 'train_delay_gt', 'bus_full') and sc > 2000 then sc := 2000; end if;
    if m.kind in ('bus_delay_gt', 'train_delay_gt', 'bus_full') and base > 1 then sc := greatest(20, least(sc, floor(4999 / (base - 1))::int)); end if;
    if m.kind not in ('bus_delay_gt', 'train_delay_gt', 'bus_full') and base > 1 then sc := greatest(20, least(sc, floor(10000 / (base - 1))::int)); end if;
    end if;
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
