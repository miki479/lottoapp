-- The Bank: a small savings vault. On every winning payout 3% of the PROFIT is set aside (only while app_settings.bank_on = 'true'),
-- locked for 3 days, then claimable with a multiplier growing from 1.00x (day 3) to 1.50x (day 14). Principal in the vault is capped at 3000.
-- Mirrors shared/bank.ts. Fake credits only. Idempotent. settle_market is the 0076 version and settle_legs the 0015 version, plus the withholding call.
create table if not exists public.bank_deposits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount integer not null check (amount > 0),
  created_at timestamptz not null default now(),
  claimed_at timestamptz
);
create index if not exists bank_deposits_open_idx on public.bank_deposits (user_id) where claimed_at is null;
alter table public.bank_deposits enable row level security;
revoke all on public.bank_deposits from public, anon, authenticated;
insert into public.app_settings (key, value) values ('bank_on', 'false') on conflict do nothing;

create or replace function public.bank_mult_bps(p_age_sec numeric) returns integer
language sql immutable as $$
  select 10000 + floor(5000 * least(950400, greatest(0, p_age_sec - 259200)) / 950400)::int
$$;

-- Sets aside 3% of a profit (rounded down) within the cap; returns the amount withheld. Internal: called by the settlement functions.
create or replace function public.bank_withhold(p_user uuid, p_profit integer) returns integer
language plpgsql security definer set search_path = public as $$
declare w integer; vault integer;
begin
  if p_profit is null or p_profit <= 0 then return 0; end if;
  if coalesce((select value from public.app_settings where key = 'bank_on'), 'false') <> 'true' then return 0; end if;
  perform 1 from public.profiles where id = p_user for update;
  if not found then return 0; end if;
  select coalesce(sum(amount), 0) into vault from public.bank_deposits where user_id = p_user and claimed_at is null;
  w := least(floor(p_profit * 3 / 100.0)::int, greatest(0, 3000 - vault));
  if w <= 0 then return 0; end if;
  update public.profiles set credits = credits - w where id = p_user and credits >= w;
  if not found then return 0; end if;
  insert into public.bank_deposits (user_id, amount) values (p_user, w);
  return w;
end $$;
revoke execute on function public.bank_withhold(uuid, integer) from public, anon, authenticated;

create or replace function public.my_bank() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare res jsonb;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  with d as (
    select id, amount, created_at, created_at + interval '3 days' as matures_at,
           extract(epoch from now() - created_at) as age
    from public.bank_deposits where user_id = auth.uid() and claimed_at is null
  ), e as (
    select *, age >= 259200 as matured, public.bank_mult_bps(age) as mult_bps,
           case when age >= 259200 then floor(amount * public.bank_mult_bps(age) / 10000.0)::int else 0 end as value
    from d
  )
  select jsonb_build_object(
    'on', coalesce((select value from public.app_settings where key = 'bank_on'), 'false') = 'true',
    'cap', 3000,
    'locked', coalesce(sum(amount) filter (where not matured), 0),
    'matured', coalesce(sum(amount) filter (where matured), 0),
    'claimable', coalesce(sum(value), 0),
    'next_maturity', min(matures_at) filter (where not matured),
    'deposits', coalesce(jsonb_agg(jsonb_build_object('id', id, 'amount', amount, 'created_at', created_at, 'matures_at', matures_at,
                 'matured', matured, 'mult_bps', mult_bps, 'value', value) order by created_at), '[]'::jsonb)
  ) into res from e;
  return res;
end $$;
grant execute on function public.my_bank() to authenticated;
revoke execute on function public.my_bank() from public, anon;

-- Pays every matured deposit of the caller (principal times the multiplier of today) and returns the credits paid.
create or replace function public.claim_bank() returns integer
language plpgsql security definer set search_path = public as $$
declare total integer;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  perform 1 from public.profiles where id = auth.uid() for update;
  if not found then raise exception 'no_profile'; end if;
  with c as (
    select id, floor(amount * public.bank_mult_bps(extract(epoch from now() - created_at)) / 10000.0)::int as value
    from public.bank_deposits
    where user_id = auth.uid() and claimed_at is null and created_at <= now() - interval '3 days'
    for update
  ), u as (
    update public.bank_deposits b set claimed_at = now() from c where b.id = c.id returning c.value
  )
  select coalesce(sum(value), 0)::int into total from u;
  if total > 0 then update public.profiles set credits = credits + total where id = auth.uid(); end if;
  return total;
end $$;
grant execute on function public.claim_bank() to authenticated;
revoke execute on function public.claim_bank() from public, anon;

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
      if pay > par.stake then perform public.bank_withhold(par.user_id, pay - par.stake); end if;  -- the Bank (0097)
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
  r record;
  occ integer := case when p_evidence ? 'occ' then (p_evidence->>'occ')::int else null end;
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

  with calc as (
    select b.id,
      case when b.bonus is null or occ is null then null
           when b.bonus = 'free' then occ <= 1 when b.bonus = 'few' then occ = 2 else occ >= 3 end as hit
    from public.bets b where b.market_id = m.id and b.status = 'open'
  ), settled as (
    update public.bets b set
      status = case when p_result = 'void' then 'void' when b.pick = p_result then 'won' else 'lost' end,
      bonus_hit = c.hit,
      payout = case when p_result = 'void' then b.stake when b.pick = p_result then floor(b.stake * b.odds)::int + case when b.boosted then least(1000, floor(b.stake * b.odds)::int - b.stake) else 0 end + case when c.hit then floor((floor(b.stake * b.odds)::int - b.stake) * 0.15)::int else 0 end + floor(floor(b.stake * b.odds) * b.vice_pct / 100.0)::int else 0 end,
      settled_at = now()
    from calc c
    where b.id = c.id
    returning b.user_id, b.payout, b.status, b.odds, b.stake, b.pick, b.boosted
  ), credit as (
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
  -- the Bank (0097): a small share of each player's profit on this market goes to the vault (no-op while bank_on is not 'true')
  for r in select user_id, sum(payout - stake)::int as profit from public.bets
           where market_id = m.id and status = 'won' and settled_at is not null group by user_id having sum(payout - stake) > 0 loop
    perform public.bank_withhold(r.user_id, r.profit);
  end loop;
  return n;
end $$;
revoke execute on function public.settle_market(uuid, text, jsonb, text) from public, anon, authenticated;
