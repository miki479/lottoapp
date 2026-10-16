-- Rewards: daily missions and one-time quests that pay a few credits, claimed with a button; invites now pay 1500.
-- Every condition is checked here on the server; the app only shows the state and presses "claim".

create table if not exists public.quest_claims (
  user_id uuid not null references public.profiles(id) on delete cascade,
  quest_id text not null,
  period date not null default date '1970-01-01',     -- the local day for daily quests, the epoch for one-time ones
  claimed_at timestamptz not null default now(),
  primary key (user_id, quest_id, period)
);
alter table public.quest_claims enable row level security;
drop policy if exists "own claims" on public.quest_claims;
create policy "own claims" on public.quest_claims for select using (user_id = auth.uid());
grant select on public.quest_claims to authenticated;

alter table public.profiles add column if not exists push_ok boolean not null default false;
create or replace function public.set_push_ok() returns void
language sql security definer set search_path = public as $$ update public.profiles set push_ok = true where id = auth.uid() $$;
grant execute on function public.set_push_ok() to authenticated;
revoke execute on function public.set_push_ok() from public, anon;

create or replace function public.quest_defs() returns table(id text, kind text, reward integer)
language sql immutable as $$
  select * from (values
    ('d_bet', 'daily', 25), ('d_parlay', 'daily', 50), ('d_win', 'daily', 75),
    ('o_nick', 'once', 100), ('o_push', 'once', 100), ('o_parlay', 'once', 150), ('o_win', 'once', 150), ('o_streak7', 'once', 200)
  ) as t(id, kind, reward)
$$;

create or replace function public.quest_done(p_uid uuid, p_id text) returns boolean
language plpgsql security definer set search_path = public as $$
declare prof public.profiles; today date;
begin
  select * into prof from public.profiles where id = p_uid;
  if not found then return false; end if;
  today := (now() at time zone prof.timezone)::date;
  return case p_id
    when 'd_bet' then exists (select 1 from public.daily_progress d where d.user_id = p_uid and d.day = today and d.bus + d.train + d.weather + d.traffic > 0)
    when 'd_parlay' then exists (select 1 from public.parlays x where x.user_id = p_uid and (x.placed_at at time zone prof.timezone)::date = today)
    when 'd_win' then exists (select 1 from public.bets b where b.user_id = p_uid and b.status = 'won' and (b.settled_at at time zone prof.timezone)::date = today)
                   or exists (select 1 from public.parlays x where x.user_id = p_uid and x.status = 'won' and (x.settled_at at time zone prof.timezone)::date = today)
    when 'o_nick' then prof.display_name is not null
    when 'o_push' then prof.push_ok
    when 'o_parlay' then exists (select 1 from public.parlays x where x.user_id = p_uid)
    when 'o_win' then exists (select 1 from public.trophies t where t.user_id = p_uid and t.trophy_id = 'first_win')
    when 'o_streak7' then prof.best_streak >= 7
    else false end;
end $$;
revoke execute on function public.quest_done(uuid, text) from public, anon, authenticated;

create or replace function public.my_quests() returns table(id text, kind text, reward integer, done boolean, claimed boolean)
language plpgsql security definer stable set search_path = public as $$
declare today date;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select (now() at time zone p.timezone)::date into today from public.profiles p where p.id = auth.uid();
  return query
    select q.id, q.kind, q.reward, public.quest_done(auth.uid(), q.id),
           exists (select 1 from public.quest_claims c where c.user_id = auth.uid() and c.quest_id = q.id
                   and c.period = case when q.kind = 'daily' then today else date '1970-01-01' end)
    from public.quest_defs() q order by q.kind, q.reward;
end $$;
grant execute on function public.my_quests() to authenticated;
revoke execute on function public.my_quests() from public, anon;

create or replace function public.claim_quest(p_id text) returns integer
language plpgsql security definer set search_path = public as $$
declare q record; today date; prof public.profiles;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select * into q from public.quest_defs() d where d.id = p_id;
  if not found then raise exception 'unknown_quest'; end if;
  select * into prof from public.profiles where id = auth.uid() for update;
  today := (now() at time zone prof.timezone)::date;
  if not public.quest_done(prof.id, q.id) then raise exception 'quest_not_done'; end if;
  insert into public.quest_claims (user_id, quest_id, period)
  values (prof.id, q.id, case when q.kind = 'daily' then today else date '1970-01-01' end) on conflict do nothing;
  if not found then return 0; end if;
  update public.profiles set credits = credits + q.reward where id = prof.id;
  return q.reward;
end $$;
grant execute on function public.claim_quest(text) to authenticated;
revoke execute on function public.claim_quest(text) from public, anon;

-- Inviting pays 1500 per friend (at most 10 paid invites), when the friend places their first bet.
create or replace function public.pay_referral(p_uid uuid) returns void
language plpgsql security definer set search_path = public as $$
declare inviter uuid;
begin
  select referred_by into inviter from public.profiles where id = p_uid and not referral_paid;
  if inviter is null then return; end if;
  update public.profiles set referral_paid = true where id = p_uid;
  if (select count(*) from public.profiles where referred_by = inviter and referral_paid) <= 10 then
    update public.profiles set credits = credits + 1500 where id = inviter;
  end if;
end $$;
revoke execute on function public.pay_referral(uuid) from public, anon, authenticated;
