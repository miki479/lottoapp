-- Audit fixes (algorithms review).
--  * close_league_season / settle_legs: profiles.boosts has CHECK (boosts between 0 and 20); promotion (+1) and the refund of a void boosted parlay (+1)
--    did not cap, so a player already at 20 made the whole season close (or the settlement of that market) fail with a constraint violation. Both now cap at 20.
--  * settle_legs: a parlay paid floor(stake * raw float product of the legs) while the odds shown and stored are round(product, 2); it now pays on the stored
--    odds (as place_bet does with its two-decimal odds, and shared/wallet.ts payout/parlayOdds), which also removes exp(sum(ln())) float noise (3.9999999 -> floor 3).
--  * place_parlay: a null p_legs created an empty parlay and took the stake; null/invalid legs and stakes are rejected. The leg questions are locked
--    (for share, in id order) before the profile row, the same order as place_bet and settle_market, so a settlement cannot deadlock with a parlay.
--  * place_bet: null stake is rejected explicitly; the no_profile check now follows the profile lock directly (it sat after unrelated statements).
-- Nothing here changes odds, margins, caps, bank, league or offer numbers.

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
  -- one bet per question and at most 25 open at a time: the answer is chosen once, and the list stays something a person can follow
  if exists (select 1 from public.bets where user_id = prof.id and market_id = m.id) then raise exception 'already_bet'; end if;
  if (select count(*) from public.bets where user_id = prof.id and status = 'open') >= 25 then raise exception 'too_many_bets'; end if;
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
    insert into public.parlay_legs (parlay_id, market_id, pick, odds) values (par.id, m.id, leg->>'pick', o);
    cats := cats || m.category;
  end loop;
  update public.parlays set odds = least(100, round(total, 2)) where id = par.id returning * into par;
  update public.profiles set credits = credits - p_stake, boosts = boosts - (case when p_boost then 1 else 0 end) where id = prof.id;
  perform public.register_play(prof.id, c) from unnest(cats) c;
  perform public.pay_referral(prof.id);
  return par;
end $$;

create or replace function public.settle_legs(p_market uuid, p_result text) returns void
language plpgsql security definer set search_path = public as $$
declare pid uuid; par public.parlays; prod numeric; won_legs integer; pay integer;
begin
  update public.parlay_legs set status = case when p_result = 'void' then 'void' when pick = p_result then 'won' else 'lost' end
  where market_id = p_market and status = 'open';
  for pid in select distinct l.parlay_id from public.parlay_legs l join public.parlays p on p.id = l.parlay_id
             where l.market_id = p_market and p.status = 'open' loop
    select * into par from public.parlays where id = pid for update;
    if par.status <> 'open' then continue; end if;
    if exists (select 1 from public.parlay_legs where parlay_id = pid and status = 'lost') then
      update public.parlays set status = 'lost', payout = 0, settled_at = now() where id = pid;
    elsif not exists (select 1 from public.parlay_legs where parlay_id = pid and status = 'open') then
      select coalesce(exp(sum(ln(odds))), 1), count(*) into prod, won_legs from public.parlay_legs where parlay_id = pid and status = 'won';
      if won_legs = 0 then
        update public.parlays set status = 'void', payout = par.stake, settled_at = now() where id = pid;  -- every leg refunded
        pay := par.stake;
        if par.boosted then update public.profiles set boosts = least(20, boosts + 1) where id = par.user_id; end if;
      else
        prod := least(100, round(prod, 2));      -- the odds the player saw (two decimals), not the raw float product
        pay := floor(par.stake * prod)::int;
        if par.boosted then pay := pay + least(1000, pay - par.stake); end if;
        update public.parlays set status = 'won', odds = prod, payout = pay, settled_at = now() where id = pid;
        perform public.grant_trophy(par.user_id, 'first_win');
        if prod >= 5 then perform public.grant_trophy(par.user_id, 'long_shot'); end if;
        if par.stake >= 500 then perform public.grant_trophy(par.user_id, 'high_roller'); end if;
      end if;
      update public.profiles set credits = credits + pay where id = par.user_id;
      if pay > par.stake then perform public.bank_withhold(par.user_id, pay - par.stake); end if;  -- the Bank (0097)
    end if;
  end loop;
end $$;

create or replace function public.close_league_season(p_month date default null) returns integer
language plpgsql security definer set search_path = public as $$
declare m date := coalesce(date_trunc('month', p_month)::date, date_trunc('month', now() at time zone 'utc' - interval '1 day')::date);
        r record; n integer := 0; ring text; got text; loc text; nl smallint; h text; b text;
begin
  if coalesce((select value from public.app_settings where key = 'leagues_on'), 'false') <> 'true' then return 0; end if;
  if exists (select 1 from public.league_seasons where month = m) then return 0; end if; -- already closed: safe to run twice

  -- the ranking is read once, before any balance changes
  create temp table _lg on commit drop as
    select a.user_id, a.league, a.credits, rank() over (partition by a.league order by a.credits desc)::integer as rnk, count(*) over (partition by a.league)::integer as cnt from public.league_active(m) a;

  for r in select * from _lg loop
    nl := case when r.league < 4 and (r.rnk <= least(10, r.cnt / 4) or r.credits >= 1000000) then r.league + 1 else r.league end;
    insert into public.league_seasons (month, user_id, league_before, league_after, final_credits, rank)
    values (m, r.user_id, r.league, nl, r.credits, r.rnk) on conflict do nothing;
    update public.profiles set league = nl, credits = 1000 + 150 * nl where id = r.user_id;
    n := n + 1;
    if nl > r.league then
      ring := (array['silver','gold','platinum','diamond'])[nl];
      got := null;
      if exists (select 1 from public.decorations where id = ring) then
        insert into public.user_decorations (user_id, decoration_id) values (r.user_id, ring) on conflict do nothing;
        if found then got := ring; end if;
      end if;
      update public.profiles set boosts = least(20, boosts + 1) where id = r.user_id returning locale into loc;
      if loc = 'it' then
        h := 'Sei salito in lega ' || (array['Bronzo','Argento','Oro','Platino','Diamante'])[nl + 1];
        b := 'Hai chiuso il mese tra i migliori della tua lega. Nuovo mese, nuovo inizio: i crediti ripartono da ' || (1000 + 150 * nl) || '.';
      elsif loc = 'ja' then
        h := (array['ブロンズ','シルバー','ゴールド','プラチナ','ダイヤモンド'])[nl + 1] || 'リーグに昇格しました';
        b := '先月はリーグの上位でした。新しい月が始まり、クレジットは' || (1000 + 150 * nl) || 'からスタートです。';
      else
        h := 'You moved up to the ' || (array['Bronze','Silver','Gold','Platinum','Diamond'])[nl + 1] || ' league';
        b := 'You finished the month among the best of your league. A new month, a fresh start: your credits restart from ' || (1000 + 150 * nl) || '.';
      end if;
      -- the resolve job turns this queue row into the in-app message (with its gifts) and the push, then removes it
      insert into public.app_settings (key, value) values ('direct:league:' || to_char(m, 'YYYYMM') || ':' || r.user_id,
        jsonb_build_object('user', r.user_id, 'heading', h, 'body', b, 'url', 'https://latelotto.web.app/?open=ranking',
          'gifts', jsonb_strip_nulls(jsonb_build_object('boosts', 1, 'decoration', got)))::text) on conflict do nothing;
    end if;
  end loop;

  -- a month without a single bet moves you down one league (bronze stays bronze): the player keeps the credits, lifted to the base of the new league if lower
  for r in select p.id, p.league, p.credits, p.locale from public.profiles p
           where p.league > 0 and p.id not in (select user_id from _lg)
             and not exists (select 1 from public.bets b where b.user_id = p.id and b.placed_at >= m and b.placed_at < m + interval '1 month')
             and not exists (select 1 from public.parlays q where q.user_id = p.id and q.placed_at >= m and q.placed_at < m + interval '1 month') loop
    nl := r.league - 1;
    update public.profiles set league = nl, credits = greatest(credits, 1000 + 150 * nl) where id = r.id;
    if r.locale = 'it' then
      h := 'Sei sceso in lega ' || (array['Bronzo','Argento','Oro','Platino','Diamante'])[nl + 1];
      b := 'Un mese senza puntate: la lega si perde se non si gioca. Torna a giocare e ti riprendi il posto.';
    elsif r.locale = 'ja' then
      h := (array['ブロンズ','シルバー','ゴールド','プラチナ','ダイヤモンド'])[nl + 1] || 'リーグに降格しました';
      b := '1か月予想がなかったため降格しました。また遊べば戻れます。';
    else
      h := 'You dropped to the ' || (array['Bronze','Silver','Gold','Platinum','Diamond'])[nl + 1] || ' league';
      b := 'A month without a single bet: a league has to be kept by playing. Play again and you can climb back.';
    end if;
    insert into public.app_settings (key, value) values ('direct:league:' || to_char(m, 'YYYYMM') || ':' || r.id,
      jsonb_build_object('user', r.id, 'heading', h, 'body', b, 'url', 'https://latelotto.web.app/?open=ranking')::text) on conflict do nothing;
    n := n + 1;
  end loop;
  -- everyone else keeps their league; credits are only lifted to the base, never taken away
  update public.profiles set credits = 1000 where credits < 1000 and id not in (select user_id from _lg);
  return n;
end $$;

grant execute on function public.place_bet(uuid, text, integer, boolean, text, boolean, uuid, numeric) to authenticated;
grant execute on function public.place_parlay(jsonb, integer, boolean) to authenticated;
revoke execute on function public.settle_legs(uuid, text) from public, anon, authenticated;
revoke execute on function public.close_league_season(date) from public, anon, authenticated;
