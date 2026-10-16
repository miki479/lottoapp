-- Personal super-odds: now and then a player is gifted ONE boosted quote (x20 or x40) on a question picked for them.
-- Who: away for 5+ days, or lost 6 of the last 8 settled bets (treated kindly: a gift, never a nudge), or ~2% at random on some days.
-- Everything is dormant until app_settings.personal_offers_on = 'true' (set by hand, never by a migration).
create table if not exists public.personal_offers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  market_id uuid not null references public.markets(id) on delete cascade,
  multiplier smallint not null check (multiplier in (20, 40)),
  max_stake integer not null default 20 check (max_stake between 10 and 100),
  reason text not null default 'random' check (reason in ('absent', 'losses', 'random')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz,
  messaged boolean not null default false,   -- the in-app message was written
  notified boolean not null default false,   -- the push was sent (or the player has no push to send)
  unique (user_id, market_id)
);
create index if not exists personal_offers_user on public.personal_offers (user_id, created_at desc);
create index if not exists personal_offers_todo on public.personal_offers (expires_at) where notified = false and used_at is null;
alter table public.personal_offers enable row level security;
revoke all on public.personal_offers from anon, authenticated;

insert into public.app_settings (key, value) values ('personal_offers_on', 'false') on conflict do nothing;

-- Hourly picker. Returns how many offers it made. Plain SQL in one statement; does nothing unless the flag is 'true'.
create or replace function public.make_personal_offers() returns integer
language plpgsql security definer set search_path = public as $$
declare n integer := 0;
begin
  if coalesce((select value from public.app_settings where key = 'personal_offers_on'), '') <> 'true' then return 0; end if;
  with cand as (
    select p.id, p.city_id,
      case
        when p.last_play_date <= current_date - 5 and p.last_play_date >= current_date - 90 then 'absent'
        when (select count(*) filter (where r.status = 'lost') from (
                select b.status, b.settled_at from public.bets b where b.user_id = p.id and b.status in ('won', 'lost') order by b.settled_at desc limit 8) r) >= 6
             and exists (select 1 from public.bets b where b.user_id = p.id and b.status in ('won', 'lost') and b.settled_at > now() - interval '30 days') then 'losses'
        -- once a day per player (at 10:00 local time), so 2% means "some days", not "most days"
        when p.last_play_date >= current_date - 14 and extract(hour from now() at time zone p.timezone) = 10 and random() < 0.02 then 'random'
      end as reason
    from public.profiles p
    where p.credits >= 10
      and not exists (select 1 from public.personal_offers o where o.user_id = p.id and o.created_at > now() - interval '10 days')
      and (not public.registration_required() or exists (select 1 from auth.users u where u.id = p.id and not u.is_anonymous and u.email is not null))
  ), cand2 as (
    select * from cand where reason is not null order by case reason when 'absent' then 0 when 'losses' then 1 else 2 end, random() limit 200
  ), picked as (
    select c.id as user_id, c.reason, m.id as market_id, m.closes_at
    from cand2 c
    cross join lateral (
      select m.id, m.closes_at from public.markets m
      where m.status = 'open'
        and m.closes_at between now() + interval '6 hours' and now() + interval '48 hours'
        and m.odds_yes between 1.5 and 4 and m.odds_no between 1.5 and 4        -- a genuinely open question on both sides
        and coalesce(m.flash_multiplier, 1) = 1 and m.flash_kind is null
        and m.kind not in ('bus_delay_gt', 'train_delay_gt', 'bus_full')          -- delay questions are priced near-certain too often
        and not (m.params ? 'ladderOf') and not (m.params ? 'viceBonus') and coalesce(m.params->>'occBonus', '') <> 'true' and coalesce(m.params->>'testOnly', '') <> 'true'
        and (m.city_id = c.city_id or m.city_id = 'world' or m.category not in ('bus', 'train', 'weather', 'traffic'))
        and not exists (select 1 from public.bets b where b.user_id = c.id and b.market_id = m.id)
      order by (m.city_id = c.city_id) desc, md5(m.id::text || c.id::text) limit 1
    ) m
    order by case c.reason when 'absent' then 0 when 'losses' then 1 else 2 end, random() limit 50
  ), ins as (
    insert into public.personal_offers (user_id, market_id, multiplier, max_stake, reason, expires_at)
    select user_id, market_id, case when reason = 'random' then 20 else 40 end, 20, reason, closes_at from picked
    on conflict (user_id, market_id) do nothing
    returning 1
  )
  select count(*) into n from ins;
  return n;
end $$;
revoke execute on function public.make_personal_offers() from public, anon, authenticated;

-- The caller's live offers, with the whole question row so the app can render it.
create or replace function public.my_offers() returns table(id uuid, market_id uuid, multiplier smallint, max_stake integer, expires_at timestamptz, market jsonb)
language sql stable security definer set search_path = public as $$
  select o.id, o.market_id, o.multiplier, o.max_stake, o.expires_at, to_jsonb(m) - 'evidence'
  from public.personal_offers o join public.markets m on m.id = o.market_id
  where o.user_id = auth.uid() and o.used_at is null and o.expires_at > now() and m.status = 'open' and now() < m.closes_at
    and not exists (select 1 from public.bets b where b.user_id = o.user_id and b.market_id = o.market_id)
  order by o.expires_at limit 3;
$$;
revoke execute on function public.my_offers() from public, anon;
grant execute on function public.my_offers() to authenticated;

select cron.schedule('personal-offers', '17 * * * *', $$ select public.make_personal_offers(); $$);

-- place_bet (as in 0092_stake_caps) with an optional personal offer. A new parameter would add an overload, so the old signature goes.
drop function if exists public.place_bet(uuid, text, integer, boolean, text, boolean);
create or replace function public.place_bet(p_market uuid, p_pick text, p_stake integer, p_boost boolean default false, p_bonus text default null, p_vice boolean default false, p_offer uuid default null)
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
grant execute on function public.place_bet(uuid, text, integer, boolean, text, boolean, uuid) to authenticated;
