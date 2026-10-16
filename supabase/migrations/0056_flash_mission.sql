-- One timed "flash" mission a day: a 90-minute window at a different time each day, a mega reward if the goal is reached inside it.
-- Only bets placed inside the window count. Claimed once, any time later the same day.
create or replace function public.flash_pool() returns table(id text, target integer, reward integer, boosts integer, counter text)
language sql immutable as $$
  select * from (values
    ('f_bets2', 2, 300, 1, 'bets'), ('f_bets3', 3, 420, 1, 'bets'), ('f_cats2', 2, 320, 1, 'cats'),
    ('f_odds3', 1, 380, 1, 'odds3'), ('f_stake50', 1, 300, 1, 'stake50'), ('f_yes2', 2, 320, 1, 'yes')
  ) as t(id, target, reward, boosts, counter)
$$;

create or replace function public.flash_window(p_uid uuid, p_day date, p_tz text) returns table(id text, target integer, reward integer, boosts integer, counter text, starts timestamptz, ends timestamptz)
language sql stable set search_path = public as $$
  with h as (select ('x' || substr(md5(p_uid::text || p_day::text || 'flash'), 1, 6))::bit(24)::int n)
  select f.id, f.target, f.reward, f.boosts, f.counter,
         ((p_day::timestamp + make_interval(hours => 10 + (h.n % 10), mins => ((h.n / 10) % 2) * 30)) at time zone p_tz) as starts,
         ((p_day::timestamp + make_interval(hours => 10 + (h.n % 10), mins => ((h.n / 10) % 2) * 30 + 90)) at time zone p_tz) as ends
  from h, (select * from public.flash_pool() p order by md5(p_uid::text || p_day::text || p.id || 'f') limit 1) f;
$$;
revoke execute on function public.flash_window(uuid, date, text) from public, anon, authenticated;

create or replace function public.flash_progress(p_uid uuid, p_counter text, p_from timestamptz, p_to timestamptz) returns integer
language sql security definer stable set search_path = public as $$
  select case p_counter
    when 'bets' then count(*) when 'yes' then count(*) filter (where b.pick = 'yes') when 'odds3' then count(*) filter (where b.odds >= 3)
    when 'stake50' then count(*) filter (where b.stake >= 50) when 'cats' then count(distinct m.category) else 0 end::int
  from public.bets b join public.markets m on m.id = b.market_id
  where b.user_id = p_uid and b.placed_at >= p_from and b.placed_at < p_to;
$$;
revoke execute on function public.flash_progress(uuid, text, timestamptz, timestamptz) from public, anon, authenticated;

create or replace function public.daily_flash() returns jsonb
language plpgsql security definer stable set search_path = public as $$
declare uid uuid := auth.uid(); tz text; today date; w record;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  select timezone into tz from public.profiles where id = uid;
  today := (now() at time zone tz)::date;
  select * into w from public.flash_window(uid, today, tz);
  return jsonb_build_object('id', w.id, 'target', w.target, 'reward', w.reward, 'boosts', w.boosts, 'start', w.starts, 'end', w.ends,
    'progress', least(public.flash_progress(uid, w.counter, w.starts, w.ends), w.target),
    'claimed', exists (select 1 from public.quest_claims c where c.user_id = uid and c.quest_id = 'dm_flash' and c.period = today));
end $$;
grant execute on function public.daily_flash() to authenticated;

create or replace function public.claim_flash() returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); prof public.profiles; today date; w record;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  select * into prof from public.profiles where id = uid for update;
  today := (now() at time zone prof.timezone)::date;
  select * into w from public.flash_window(uid, today, prof.timezone);
  if now() < w.ends and public.flash_progress(uid, w.counter, w.starts, w.ends) < w.target then raise exception 'mission_not_done'; end if;
  if public.flash_progress(uid, w.counter, w.starts, w.ends) < w.target then raise exception 'mission_not_done'; end if;
  insert into public.quest_claims (user_id, quest_id, period) values (uid, 'dm_flash', today) on conflict do nothing;
  if not found then return jsonb_build_object('credits', 0, 'boosts', 0); end if;
  update public.profiles set credits = credits + w.reward, boosts = boosts + w.boosts where id = uid;
  return jsonb_build_object('credits', w.reward, 'boosts', w.boosts);
end $$;
grant execute on function public.claim_flash() to authenticated;
