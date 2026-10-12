-- Fixes from the review of the SQL: boosts never go over their cap, the referral cap survives account deletion, drop odds are drawn once,
-- trophy checks are throttled, levels are stored, and a few counts and privileges are tightened.

-- 1. the boost cap (20) is a table check: the chest and the flash mission must not push past it
create or replace function public.claim_chest() returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); prof public.profiles; today date; m record; got text;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  select * into prof from public.profiles where id = uid for update;
  today := (now() at time zone prof.timezone)::date;
  for m in select * from public.mission_pick(uid, today) loop
    if public.mission_progress(uid, m.id, today, prof.timezone) < m.target then raise exception 'mission_not_done'; end if;
  end loop;
  insert into public.quest_claims (user_id, quest_id, period) values (uid, 'dm_chest', today) on conflict do nothing;
  if not found then return jsonb_build_object('credits', 0, 'boosts', 0); end if;
  update public.profiles set credits = credits + 150, boosts = least(20, boosts + 1) where id = uid;
  got := public.roll_drop(uid, 0.12);
  return jsonb_build_object('credits', 150, 'boosts', 1, 'decoration', got);
end $$;
grant execute on function public.claim_chest() to authenticated;
create or replace function public.claim_flash() returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); prof public.profiles; today date; w record; got text;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  select * into prof from public.profiles where id = uid for update;
  today := (now() at time zone prof.timezone)::date;
  select * into w from public.flash_window(uid, today, prof.timezone);
  if now() < w.ends and public.flash_progress(uid, w.counter, w.starts, w.ends) < w.target then raise exception 'mission_not_done'; end if;
  if public.flash_progress(uid, w.counter, w.starts, w.ends) < w.target then raise exception 'mission_not_done'; end if;
  insert into public.quest_claims (user_id, quest_id, period) values (uid, 'dm_flash', today) on conflict do nothing;
  if not found then return jsonb_build_object('credits', 0, 'boosts', 0); end if;
  update public.profiles set credits = credits + w.reward, boosts = least(20, boosts + w.boosts) where id = uid;
  got := public.roll_drop(uid, 0.2);
  return jsonb_build_object('credits', w.reward, 'boosts', w.boosts, 'decoration', got);
end $$;
grant execute on function public.claim_flash() to authenticated;

-- 2. a permanent record of paid referrals, so deleting the invited account cannot reopen the cap of 10
create table if not exists public.referral_payouts (
  invitee uuid primary key,
  inviter uuid not null,
  paid_at timestamptz not null default now()
);
create index if not exists referral_payouts_inviter on public.referral_payouts (inviter);
alter table public.referral_payouts enable row level security;
revoke all on public.referral_payouts from anon, authenticated;
insert into public.referral_payouts (invitee, inviter) select id, referred_by from public.profiles where referred_by is not null and referral_paid on conflict do nothing;
create or replace function public.pay_referral(p_uid uuid) returns void
language plpgsql security definer set search_path = public as $$
declare inv uuid;
begin
  select referred_by into inv from public.profiles where id = p_uid and not referral_paid;
  if inv is null then return; end if;
  update public.profiles set referral_paid = true where id = p_uid;
  insert into public.referral_payouts (invitee, inviter) values (p_uid, inv) on conflict do nothing;
  if found and (select count(*) from public.referral_payouts where inviter = inv) <= 10 then
    update public.profiles set credits = credits + 1500 where id = inv;
  end if;
end $$;
revoke execute on function public.pay_referral(uuid) from public, anon, authenticated;

-- 4. a helper that takes a whole row must not be callable by players
revoke execute on function public.challenge_view(public.friend_challenges) from public, anon, authenticated;

-- 5. the random pick of a dropped ring: one draw, then the first slice that covers it
create or replace function public.roll_drop(u uuid, chance numeric) returns text
language plpgsql security definer set search_path = public as $$
declare pick text; total integer; r numeric;
begin
  if random() >= chance then return null; end if;
  select sum(drop_weight) into total from public.decorations d
   where d.drop_weight > 0 and not exists (select 1 from public.user_decorations x where x.user_id = u and x.decoration_id = d.id);
  if coalesce(total, 0) = 0 then return null; end if;
  r := random() * total;
  select id into pick from (
    select d.id, sum(d.drop_weight) over (order by d.id) as run from public.decorations d
     where d.drop_weight > 0 and not exists (select 1 from public.user_decorations x where x.user_id = u and x.decoration_id = d.id)
  ) t where run > r order by run limit 1;
  insert into public.user_decorations (user_id, decoration_id) values (u, pick) on conflict do nothing;
  return pick;
end $$;
revoke execute on function public.roll_drop(uuid, numeric) from public, anon, authenticated;

-- 6 and 7. trophies are checked at most every 2 minutes per player; the level is kept on the profile so lists need no recount
create table if not exists public.trophy_checks (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  checked_at timestamptz not null default now()
);
alter table public.trophy_checks enable row level security;
revoke all on public.trophy_checks from anon, authenticated;
alter table public.profiles add column if not exists level integer not null default 1;
update public.profiles set level = public.level_of_xp(public.xp_of(id));

create or replace function public.my_progress() returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); x integer; lv integer; p public.profiles; got text[] := '{}';
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if not exists (select 1 from public.trophy_checks where user_id = uid and checked_at > now() - interval '2 minutes') then
    got := public.evaluate_trophies(uid);
    insert into public.trophy_checks (user_id) values (uid) on conflict (user_id) do update set checked_at = now();
  end if;
  select * into p from public.profiles where id = uid;
  x := public.xp_of(uid); lv := public.level_of_xp(x);
  if p.level <> lv then update public.profiles set level = lv where id = uid; end if;
  return jsonb_build_object('xp', x, 'level', lv, 'avatar', p.avatar, 'decoration', p.decoration, 'granted', to_jsonb(got),
    'owned', coalesce((select jsonb_agg(decoration_id) from public.user_decorations where user_id = uid), '[]'::jsonb));
end $$;
grant execute on function public.my_progress() to authenticated;

create or replace function public.looks(ids uuid[]) returns table(user_id uuid, avatar text, decoration text, level integer)
language sql security definer stable set search_path = public as $$
  select p.id, p.avatar, p.decoration, p.level from public.profiles p where p.id = any(ids[1:100]) and auth.uid() is not null
$$;
grant execute on function public.looks(uuid[]) to authenticated;

-- 8. the monthly rankings filter on the settlement time
create index if not exists bets_settled_at on public.bets (settled_at) where status <> 'open';
create index if not exists parlays_settled_at on public.parlays (settled_at) where status <> 'open';

-- 9. only registered players can report a public challenge (two throwaway guests could hide any of them)
create or replace function public.report_challenge(p_code text) returns void
language plpgsql security definer set search_path = public as $$
declare id uuid;
begin
  if auth.uid() is null or not public.is_registered() then return; end if;
  if (select count(*) from public.challenge_reports where user_id = auth.uid() and at > now() - interval '1 day') >= 10 then return; end if;
  select c.id into id from public.friend_challenges c where c.code = lower(trim(p_code));
  if id is null then return; end if;
  insert into public.challenge_reports (challenge_id, user_id) values (id, auth.uid()) on conflict do nothing;
end $$;
grant execute on function public.report_challenge(text) to authenticated;

-- 12. only bets that were won or lost count as bets in the history figures
create or replace function public.my_category_stats() returns table(category text, bets bigint, won bigint, lost bigint, net bigint)
language sql stable security definer set search_path = public as $$
  select m.category, count(*), count(*) filter (where b.status = 'won'), count(*) filter (where b.status = 'lost'),
         coalesce(sum(case b.status when 'won' then b.payout - b.stake when 'lost' then -b.stake else 0 end), 0)::bigint
  from public.bets b join public.markets m on m.id = b.market_id
  where b.user_id = auth.uid() and b.status in ('won', 'lost') group by m.category order by 5 desc;
$$;
grant execute on function public.my_category_stats() to authenticated;

create or replace function public.my_balance_series(p_days integer default 30) returns table(day date, net bigint, bets bigint)
language plpgsql stable security definer set search_path = public as $$
declare tz text; since date;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select timezone into tz from public.profiles where id = auth.uid();
  since := (now() at time zone tz)::date - (least(greatest(p_days, 7), 120) - 1);
  return query
    select s.d, sum(s.n)::bigint, count(*)::bigint from (
      select (b.settled_at at time zone tz)::date d, case b.status when 'won' then b.payout - b.stake when 'lost' then -b.stake else 0 end n
        from public.bets b where b.user_id = auth.uid() and b.status in ('won', 'lost') and b.settled_at is not null
      union all
      select (x.settled_at at time zone tz)::date, case x.status when 'won' then x.payout - x.stake when 'lost' then -x.stake else 0 end
        from public.parlays x where x.user_id = auth.uid() and x.status in ('won', 'lost') and x.settled_at is not null
    ) s where s.d >= since group by s.d order by s.d;
end $$;
grant execute on function public.my_balance_series(integer) to authenticated;
