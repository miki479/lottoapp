-- Parlays ("multipla"), invite-a-friend bonus, a switchable "registration required to bet" rule and a nickname pre-check.

-- ---------- settings (public read, written only by migrations/admin) ----------
create table if not exists public.app_settings (key text primary key, value text not null);
alter table public.app_settings enable row level security;
drop policy if exists "settings are public" on public.app_settings;
create policy "settings are public" on public.app_settings for select using (true);
grant select on public.app_settings to anon, authenticated;
insert into public.app_settings (key, value) values ('registration_required', 'false') on conflict do nothing;

create or replace function public.registration_required() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select value = 'true' from public.app_settings where key = 'registration_required'), false);
$$;
grant execute on function public.registration_required() to anon, authenticated;

-- ---------- referral ----------
alter table public.profiles
  add column if not exists referral_code text unique,
  add column if not exists referred_by uuid references public.profiles(id) on delete set null,
  add column if not exists referral_paid boolean not null default false;

create or replace function public.my_referral() returns table(code text, invited bigint, paid bigint)
language plpgsql security definer set search_path = public as $$
declare c text; alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select referral_code into c from public.profiles where id = auth.uid();
  if c is null then
    loop
      c := (select string_agg(substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1), '') from generate_series(1, 6));
      exit when not exists (select 1 from public.profiles where referral_code = c);
    end loop;
    update public.profiles set referral_code = c where id = auth.uid();
  end if;
  return query select c, count(*), count(*) filter (where referral_paid) from public.profiles where referred_by = auth.uid();
end $$;
grant execute on function public.my_referral() to authenticated;

-- A registered player can accept one invite code, once, never their own.
create or replace function public.redeem_referral(p_code text) returns boolean
language plpgsql security definer set search_path = public as $$
declare inviter uuid;
begin
  if not public.is_registered() then raise exception 'registration_required'; end if;
  select id into inviter from public.profiles where referral_code = upper(trim(p_code));
  if inviter is null or inviter = auth.uid() then return false; end if;
  update public.profiles set referred_by = inviter where id = auth.uid() and referred_by is null;
  return found;
end $$;
grant execute on function public.redeem_referral(text) to authenticated;

-- The inviter earns 1000 when the invited friend places their first bet (at most 10 paid invites per inviter).
create or replace function public.pay_referral(p_uid uuid) returns void
language plpgsql security definer set search_path = public as $$
declare inviter uuid;
begin
  select referred_by into inviter from public.profiles where id = p_uid and not referral_paid;
  if inviter is null then return; end if;
  update public.profiles set referral_paid = true where id = p_uid;
  if (select count(*) from public.profiles where referred_by = inviter and referral_paid) <= 10 then
    update public.profiles set credits = credits + 1000 where id = inviter;
  end if;
end $$;
revoke execute on function public.pay_referral(uuid) from public, anon, authenticated;

-- ---------- nickname pre-check (no side effects; lets the sign-up form say "taken" before creating anything) ----------
create or replace function public.nickname_check(p_name text) returns text
language plpgsql stable security definer set search_path = public as $$
declare
  n text := trim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
  norm text;
  banned constant text[] := array[
    'fuck','shit','bitch','cunt','dick','cock','pussy','asshole','nigg','fag','whore','slut','rape','nazi','hitler','retard',
    'cazzo','merd','stronz','puttan','troia','vaffa','minchia','frocio','ricchion','negro','sborr','pompin','coglion','mussolini','bastard',
    'admin','latelotto','support','moderator'];
begin
  if char_length(n) < 2 or char_length(n) > 24 or n !~ '^[[:alnum:]_ .-]+$' then return 'bad_nickname'; end if;
  norm := regexp_replace(translate(lower(n), '013457$@', 'oieastsa'), '[^a-z]', '', 'g');
  if exists (select 1 from unnest(banned) w where norm like '%' || w || '%') then return 'nickname_not_allowed'; end if;
  if exists (select 1 from public.profiles where lower(display_name) = lower(n)) then return 'nickname_taken'; end if;
  return 'ok';
end $$;
grant execute on function public.nickname_check(text) to anon, authenticated;

-- ---------- parlays ----------
create table if not exists public.parlays (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  stake integer not null check (stake between 10 and 500),
  odds numeric(8,2) not null,                       -- product of the legs' locked odds, capped at 100
  status text not null default 'open' check (status in ('open','won','lost','void')),
  payout integer not null default 0,
  placed_at timestamptz not null default now(),
  settled_at timestamptz
);
create table if not exists public.parlay_legs (
  parlay_id uuid not null references public.parlays(id) on delete cascade,
  market_id uuid not null references public.markets(id),
  pick text not null check (pick in ('yes','no')),
  odds numeric(6,2) not null,
  status text not null default 'open' check (status in ('open','won','lost','void')),
  primary key (parlay_id, market_id)
);
create index if not exists parlay_legs_market on public.parlay_legs (market_id) where status = 'open';
alter table public.parlays enable row level security;
alter table public.parlay_legs enable row level security;
drop policy if exists "own parlays" on public.parlays; create policy "own parlays" on public.parlays for select using (user_id = auth.uid());
drop policy if exists "own legs" on public.parlay_legs;
create policy "own legs" on public.parlay_legs for select using (exists (select 1 from public.parlays p where p.id = parlay_id and p.user_id = auth.uid()));
grant select on public.parlays, public.parlay_legs to authenticated;

create or replace function public.place_parlay(p_legs jsonb, p_stake integer)
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

  insert into public.parlays (user_id, stake, odds) values (prof.id, p_stake, 1) returning * into par;
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
  update public.profiles set credits = credits - p_stake where id = prof.id;
  perform public.register_play(prof.id, c) from unnest(cats) c;
  perform public.pay_referral(prof.id);
  return par;
end $$;
grant execute on function public.place_parlay(jsonb, integer) to authenticated;

-- Called by settle_market for every resolved market: updates the legs and, when decided, the parlay.
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
      else
        pay := floor(par.stake * least(100, prod))::int;
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

-- settle_market (from 0007) now also settles parlay legs.
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
      payout = case when p_result = 'void' then b.stake when b.pick = p_result then floor(b.stake * b.odds)::int else 0 end,
      settled_at = now()
    where b.market_id = m.id and b.status = 'open'
    returning b.user_id, b.payout, b.status, b.odds, b.stake, b.pick
  ), credit as (
    update public.profiles p set credits = p.credits + s.total
    from (select user_id, sum(payout) as total from settled group by user_id) s
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

-- place_bet: registration rule + referral payout.
create or replace function public.place_bet(p_market uuid, p_pick text, p_stake integer)
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
  update public.profiles set credits = credits - p_stake where id = prof.id;
  insert into public.bets (user_id, market_id, pick, stake, odds)
  values (prof.id, m.id, p_pick, p_stake, case when p_pick = 'yes' then m.odds_yes else m.odds_no end)
  returning * into b;
  perform public.register_play(prof.id, m.category);
  perform public.pay_referral(prof.id);
  return b;
end $$;

-- Stats and the monthly ranking count parlays too.
create or replace function public.my_stats()
returns table(total bigint, won bigint, lost bigint, voided bigint, best_win bigint, net bigint, staked bigint)
language sql security definer stable set search_path = public as $$
  with ev as (
    select status, stake, payout from public.bets where user_id = auth.uid()
    union all select status, stake, payout from public.parlays where user_id = auth.uid()
  )
  select count(*) filter (where status <> 'open'),
         count(*) filter (where status = 'won'),
         count(*) filter (where status = 'lost'),
         count(*) filter (where status = 'void'),
         coalesce(max(payout - stake) filter (where status = 'won'), 0)::bigint,
         coalesce(sum(case status when 'won' then payout - stake when 'lost' then -stake else 0 end), 0)::bigint,
         coalesce(sum(stake) filter (where status <> 'void'), 0)::bigint
  from ev;
$$;

create or replace function public.leaderboard(p_scope text, p_key text default null, p_limit integer default 50)
returns table(rank bigint, user_id uuid, display_name text, score bigint, bets bigint, streak integer, is_me boolean)
language sql security definer stable set search_path = public as $$
  with ev as (
    select user_id, id, status, stake, payout, settled_at from public.bets where status <> 'open'
    union all select user_id, id, status, stake, payout, settled_at from public.parlays where status <> 'open'
  ), scores as (
    select p.id, p.display_name, p.streak,
           coalesce(sum(case b.status when 'won' then b.payout - b.stake when 'lost' then -b.stake else 0 end), 0)::bigint as score,
           count(b.id) filter (where b.status in ('won','lost')) as bets
    from public.profiles p
    join auth.users u on u.id = p.id and not u.is_anonymous and u.email is not null
    join ev b on b.user_id = p.id and b.settled_at >= date_trunc('month', now())
    where p.display_name is not null and (
      p_scope = 'global'
      or (p_scope = 'country' and p.country = upper(p_key))
      or (p_scope = 'city' and p.city_id = p_key)
      or (p_scope = 'group'
          and exists (select 1 from public.group_members g where g.group_code = upper(p_key) and g.user_id = p.id)
          and exists (select 1 from public.group_members g2 where g2.group_code = upper(p_key) and g2.user_id = auth.uid()))
    )
    group by p.id
  )
  select rank() over (order by score desc, bets desc), id, display_name, score, bets, streak, id = auth.uid()
  from scores order by 1, display_name limit least(p_limit, 100);
$$;

revoke execute on function public.place_parlay(jsonb, integer), public.my_referral(), public.redeem_referral(text) from public, anon;
