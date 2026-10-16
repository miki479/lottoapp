-- House markets: questions we write ourselves ("will it come out on that day?"), settled by an admin from a public fact (a tick of the series "house:<name>"),
-- and refunded automatically if nobody settles them before the deadline. Players can ask to be reminded the day before one closes.
create table if not exists public.market_reminders (
  user_id uuid not null references public.profiles(id) on delete cascade,
  market_id uuid not null references public.markets(id) on delete cascade,
  created_at timestamptz not null default now(),
  sent boolean not null default false,
  primary key (user_id, market_id)
);
alter table public.market_reminders enable row level security;
create policy "own reminders" on public.market_reminders for select using (auth.uid() = user_id);
grant select on public.market_reminders to authenticated;

-- Turns the reminder of a market on or off; true when it is on afterwards.
create or replace function public.toggle_reminder(p_market uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if exists (select 1 from public.market_reminders where user_id = uid and market_id = p_market) then
    delete from public.market_reminders where user_id = uid and market_id = p_market;
    return false;
  end if;
  if not exists (select 1 from public.markets where id = p_market and status = 'open' and closes_at > now()) then raise exception 'market_closed'; end if;
  if (select count(*) from public.market_reminders where user_id = uid and not sent) >= 20 then raise exception 'too_many_reminders'; end if;
  insert into public.market_reminders (user_id, market_id) values (uid, p_market);
  return true;
end $$;
grant execute on function public.toggle_reminder(uuid) to authenticated;

create or replace function public.my_reminders() returns setof uuid
language sql security definer stable set search_path = public as $$
  select market_id from public.market_reminders where user_id = auth.uid()
$$;
grant execute on function public.my_reminders() to authenticated;

-- Admin: the house markets and how to settle them.
create or replace function public.admin_house_markets() returns table(id uuid, label text, status text, outcome text, target_at timestamptz, deadline_at timestamptz, bets bigint)
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  return query select m.id, coalesce(m.params->>'label', m.params->>'series'), m.status, m.outcome, m.target_at, m.deadline_at, (select count(*) from public.bets b where b.market_id = m.id)
    from public.markets m where m.kind = 'tick_gt' and m.params->>'series' like 'house:%' order by m.target_at desc limit 20;
end $$;
grant execute on function public.admin_house_markets() to authenticated;

-- Admin: records the fact (1 = it happened, 0 = it did not) once the instant of the question has passed; the resolver settles the bets on its next run.
create or replace function public.admin_house_settle(p_market uuid, p_yes boolean) returns void
language plpgsql security definer set search_path = public as $$
declare m public.markets;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  select * into m from public.markets where id = p_market and kind = 'tick_gt' and params->>'series' like 'house:%';
  if not found then raise exception 'not_a_house_market'; end if;
  if m.status <> 'open' then raise exception 'already_settled'; end if;
  if m.target_at > now() then raise exception 'too_early'; end if;
  insert into public.tick_observations (series, at, value, fetched_at) values (m.params->>'series', m.target_at, case when p_yes then 1 else 0 end, now())
  on conflict (series, at) do update set value = excluded.value, fetched_at = excluded.fetched_at;
end $$;
grant execute on function public.admin_house_settle(uuid, boolean) to authenticated;
