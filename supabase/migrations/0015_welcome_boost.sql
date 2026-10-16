-- Welcome gift (1 freeze + 1 boost) and boosts. A boost is attached to one bet or parlay: if it wins, the net win is doubled
-- (the extra is capped at 1000 credits). It is used up when the bet settles, and given back if the bet is void.

alter table public.profiles add column if not exists boosts integer not null default 0 check (boosts between 0 and 20),
  add column if not exists welcome_gift boolean not null default false;
alter table public.bets add column if not exists boosted boolean not null default false;
alter table public.parlays add column if not exists boosted boolean not null default false;

drop function if exists public.place_bet(uuid, text, integer);
drop function if exists public.place_parlay(jsonb, integer);

create or replace function public.place_bet(p_market uuid, p_pick text, p_stake integer, p_boost boolean default false)
returns public.bets
language plpgsql security definer set search_path = public as $$
declare
  m public.markets;
  prof public.profiles;
  b public.bets;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if public.registration_required() and not public.is_registered() then raise exception 'registration_required'; end if;
  if p_pick not in ('yes','no') then raise exception 'bad_pick'; end if;
  select * into m from public.markets where id = p_market for share;
  if not found or m.status <> 'open' or now() >= m.closes_at then raise exception 'market_closed'; end if;
  select * into prof from public.profiles where id = auth.uid() for update;
  if not found then raise exception 'no_profile'; end if;
  if (select count(*) from public.bets where user_id = prof.id and placed_at > now() - interval '1 minute')
   + (select count(*) from public.parlays where user_id = prof.id and placed_at > now() - interval '1 minute') >= 8 then
    raise exception 'rate_limited';
  end if;
  if p_stake < 10 or p_stake > 500 then raise exception 'bad_stake'; end if;
  if prof.credits < p_stake then raise exception 'insufficient_credits'; end if;
  if p_boost and prof.boosts < 1 then raise exception 'no_boost'; end if;
  update public.profiles set credits = credits - p_stake, boosts = boosts - (case when p_boost then 1 else 0 end) where id = prof.id;
  insert into public.bets (user_id, market_id, pick, stake, odds, boosted)
  values (prof.id, m.id, p_pick, p_stake, case when p_pick = 'yes' then m.odds_yes else m.odds_no end, p_boost)
  returning * into b;
  perform public.register_play(prof.id, m.category);
  perform public.pay_referral(prof.id);
  return b;
end $$;
grant execute on function public.place_bet(uuid, text, integer, boolean) to authenticated;

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
  if p_stake < 10 or p_stake > 500 then raise exception 'bad_stake'; end if;
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
    trip := coalesce(m.feed_id || ':' || (m.params->>'tripId'), m.id::text);
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
revoke execute on function public.place_parlay(jsonb, integer, boolean) from public, anon;

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
        if par.boosted then update public.profiles set boosts = boosts + 1 where id = par.user_id; end if;
      else
        pay := floor(par.stake * least(100, prod))::int;
        if par.boosted then pay := pay + least(1000, pay - par.stake); end if;
        update public.parlays set status = 'won', odds = least(100, round(prod, 2)), payout = pay, settled_at = now() where id = pid;
        perform public.grant_trophy(par.user_id, 'first_win');
        if prod >= 5 then perform public.grant_trophy(par.user_id, 'long_shot'); end if;
        if par.stake >= 500 then perform public.grant_trophy(par.user_id, 'high_roller'); end if;
      end if;
      update public.profiles set credits = credits + pay where id = par.user_id;
    end if;
  end loop;
end $$;
revoke execute on function public.settle_legs(uuid, text) from public, anon, authenticated;

create or replace function public.settle_market(p_market uuid, p_result text, p_evidence jsonb default null, p_void_reason text default null)
returns integer
language plpgsql security definer set search_path = public as $$
declare
  m public.markets;
  n integer := 0;
begin
  if p_result not in ('yes','no','void') then raise exception 'bad_result'; end if;
  select * into m from public.markets where id = p_market for update;
  if not found then raise exception 'unknown_market'; end if;
  if m.status <> 'open' then return 0; end if;

  update public.markets set
    status = case when p_result = 'void' then 'void' else 'resolved' end,
    outcome = case when p_result = 'void' then null else p_result end,
    void_reason = p_void_reason, evidence = p_evidence
  where id = m.id;

  with settled as (
    update public.bets b set
      status = case when p_result = 'void' then 'void' when b.pick = p_result then 'won' else 'lost' end,
      payout = case when p_result = 'void' then b.stake when b.pick = p_result then floor(b.stake * b.odds)::int + case when b.boosted then least(1000, floor(b.stake * b.odds)::int - b.stake) else 0 end else 0 end,
      settled_at = now()
    where b.market_id = m.id and b.status = 'open'
    returning b.user_id, b.payout, b.status, b.odds, b.stake, b.pick, b.boosted
  ), credit as (
    -- one UPDATE per player (a row cannot be changed twice in one statement): credits and the boost given back on void
    update public.profiles p set credits = p.credits + s.total, boosts = least(20, p.boosts + s.back)
    from (select user_id, sum(payout) as total, count(*) filter (where status = 'void' and boosted) as back from settled group by user_id) s
    where p.id = s.user_id
    returning 1
  ), awards as (
    insert into public.trophies (user_id, trophy_id)
    select user_id, t from settled, lateral (values
      (case when status = 'won' then 'first_win' end),
      (case when status = 'won' and odds >= 5 then 'long_shot' end),
      (case when status = 'won' and m.kind = 'rain_at' and pick = 'yes' then 'rain_man' end),
      (case when status = 'won' and m.category = 'train' and pick = 'yes' then 'train_whisperer' end),
      (case when status = 'void' then 'ghost_feed' end),
      (case when status = 'won' and stake >= 500 then 'high_roller' end)
    ) as x(t) where t is not null
    on conflict do nothing
    returning 1
  )
  select count(*) into n from settled;
  perform public.settle_legs(m.id, p_result);
  return n;
end $$;

-- One-time gift for a registered player: +1 freeze (at most 2 in stock) and 1 boost.
create or replace function public.claim_welcome_gift() returns boolean
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_registered() then raise exception 'registration_required'; end if;
  update public.profiles set welcome_gift = true, freezes = least(freezes + 1, 2), boosts = least(boosts + 1, 20)
  where id = auth.uid() and not welcome_gift;
  return found;
end $$;
revoke execute on function public.claim_welcome_gift() from public, anon;
grant execute on function public.claim_welcome_gift() to authenticated;
