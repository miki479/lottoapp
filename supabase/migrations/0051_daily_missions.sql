-- Daily missions: three a day (one easy, one medium, one hard) drawn from a pool, with progress bars, a reward each and a chest when all three are done.
-- Everything is counted on the server from the player's own bets; the app only shows it and presses "claim".
create or replace function public.mission_pool() returns table(id text, tier integer, target integer, reward integer)
language sql immutable as $$
  select * from (values
    ('m_bets3', 1, 3, 40), ('m_cats2', 1, 2, 40), ('m_sport', 1, 1, 30), ('m_nature', 1, 1, 30), ('m_stake50', 1, 1, 30), ('m_early', 1, 1, 30),
    ('m_odds3', 2, 1, 60), ('m_parlay', 2, 1, 50), ('m_friend', 2, 1, 60), ('m_bets5', 2, 5, 70),
    ('m_win1', 3, 1, 80), ('m_odds5', 3, 1, 100)
  ) as t(id, tier, target, reward)
$$;

create or replace function public.mission_progress(p_uid uuid, p_id text, p_day date, p_tz text) returns integer
language plpgsql security definer stable set search_path = public as $$
declare n integer := 0;
begin
  if p_id in ('m_parlay') then
    select count(*) into n from public.parlays x where x.user_id = p_uid and (x.placed_at at time zone p_tz)::date = p_day;
  elsif p_id = 'm_friend' then
    select (select count(*) from public.friend_challenges c where c.creator = p_uid and (c.created_at at time zone p_tz)::date = p_day)
         + (select count(*) from public.friend_picks f where f.user_id = p_uid and (f.created_at at time zone p_tz)::date = p_day) into n;
  elsif p_id = 'm_win1' then
    select count(*) into n from public.bets b where b.user_id = p_uid and b.status = 'won' and (b.settled_at at time zone p_tz)::date = p_day;
  elsif p_id = 'm_cats2' then
    select count(distinct m.category) into n from public.bets b join public.markets m on m.id = b.market_id where b.user_id = p_uid and (b.placed_at at time zone p_tz)::date = p_day;
  else
    select count(*) into n from public.bets b join public.markets m on m.id = b.market_id
     where b.user_id = p_uid and (b.placed_at at time zone p_tz)::date = p_day
       and case p_id
             when 'm_bets3' then true when 'm_bets5' then true
             when 'm_sport' then m.category = 'sport'
             when 'm_nature' then m.category in ('nature', 'finance', 'culture')
             when 'm_stake50' then b.stake >= 50
             when 'm_early' then extract(hour from b.placed_at at time zone p_tz) < 12
             when 'm_odds3' then b.odds >= 3
             when 'm_odds5' then b.odds >= 5
             else false end;
  end if;
  return n;
end $$;
revoke execute on function public.mission_progress(uuid, text, date, text) from public, anon, authenticated;

-- The three missions of today for one player: always the same ones for that player and day.
create or replace function public.mission_pick(p_uid uuid, p_day date) returns table(id text, target integer, reward integer)
language sql immutable as $$
  select x.id, x.target, x.reward from (
    select p.*, row_number() over (partition by p.tier order by md5(p_uid::text || p_day::text || p.id)) rn from public.mission_pool() p
  ) x where x.rn = 1 order by x.tier;
$$;
revoke execute on function public.mission_pick(uuid, date) from public, anon, authenticated;

create or replace function public.daily_missions() returns jsonb
language plpgsql security definer stable set search_path = public as $$
declare uid uuid := auth.uid(); tz text; today date; ms jsonb; done integer; chest boolean;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  select timezone into tz from public.profiles where id = uid;
  today := (now() at time zone tz)::date;
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', m.id, 'target', m.target, 'reward', m.reward,
      'progress', least(public.mission_progress(uid, m.id, today, tz), m.target),
      'claimed', exists (select 1 from public.quest_claims c where c.user_id = uid and c.quest_id = 'dm_' || m.id and c.period = today)
    )), '[]'::jsonb) into ms from public.mission_pick(uid, today) m;
  select count(*) into done from jsonb_array_elements(ms) e where (e->>'progress')::int >= (e->>'target')::int;
  chest := exists (select 1 from public.quest_claims c where c.user_id = uid and c.quest_id = 'dm_chest' and c.period = today);
  return jsonb_build_object('day', today, 'missions', ms, 'chest', jsonb_build_object('reward', 150, 'boosts', 1, 'ready', done = 3, 'claimed', chest));
end $$;
grant execute on function public.daily_missions() to authenticated;

create or replace function public.claim_mission(p_id text) returns integer
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); prof public.profiles; today date; m record;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  select * into prof from public.profiles where id = uid for update;
  today := (now() at time zone prof.timezone)::date;
  select * into m from public.mission_pick(uid, today) x where x.id = p_id;
  if not found then raise exception 'unknown_mission'; end if;
  if public.mission_progress(uid, m.id, today, prof.timezone) < m.target then raise exception 'mission_not_done'; end if;
  insert into public.quest_claims (user_id, quest_id, period) values (uid, 'dm_' || m.id, today) on conflict do nothing;
  if not found then return 0; end if;
  update public.profiles set credits = credits + m.reward where id = uid;
  return m.reward;
end $$;
grant execute on function public.claim_mission(text) to authenticated;

-- The chest: all three missions done. Pays credits and one boost.
create or replace function public.claim_chest() returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); prof public.profiles; today date; m record;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  select * into prof from public.profiles where id = uid for update;
  today := (now() at time zone prof.timezone)::date;
  for m in select * from public.mission_pick(uid, today) loop
    if public.mission_progress(uid, m.id, today, prof.timezone) < m.target then raise exception 'mission_not_done'; end if;
  end loop;
  insert into public.quest_claims (user_id, quest_id, period) values (uid, 'dm_chest', today) on conflict do nothing;
  if not found then return jsonb_build_object('credits', 0, 'boosts', 0); end if;
  update public.profiles set credits = credits + 150, boosts = boosts + 1 where id = uid;
  return jsonb_build_object('credits', 150, 'boosts', 1);
end $$;
grant execute on function public.claim_chest() to authenticated;

-- The old one-bet / parlay / win dailies are replaced by these missions.
create or replace function public.quest_defs() returns table(id text, kind text, reward integer)
language sql immutable as $$
  select * from (values
    ('o_nick', 'once', 100), ('o_push', 'once', 100), ('o_parlay', 'once', 150), ('o_win', 'once', 150), ('o_streak7', 'once', 200)
  ) as t(id, kind, reward)
$$;
