-- Daily missions, second round: a big pool across every category, mood and difficulty, drawn per player and day with a seeded shuffle.
-- Easy / medium / hard slots; a rare "legendary" mission (about one day in eight) can replace the hard one; yesterday's missions and
-- the same family twice in a day are avoided, so days rarely look alike.
drop function if exists public.mission_pick(uuid, date);
drop function if exists public.mission_progress(uuid, text, date, text);
drop function if exists public.mission_pool();
create or replace function public.mission_pool() returns table(id text, tier integer, target integer, reward integer, fam text, counter text)
language sql immutable as $$
  select * from (values
    -- easy
    ('m_bets3', 1, 3, 40, 'count', 'bets'), ('m_cat_bus', 1, 1, 30, 'cat', 'cat_bus'), ('m_cat_train', 1, 1, 30, 'cat', 'cat_train'),
    ('m_cat_weather', 1, 1, 30, 'cat', 'cat_weather'), ('m_cat_nature', 1, 1, 35, 'cat', 'cat_nature'), ('m_cat_fin', 1, 1, 35, 'cat', 'cat_fin'),
    ('m_cat_cult', 1, 1, 35, 'cat', 'cat_cult'), ('m_sport', 1, 1, 30, 'cat', 'cat_sport'), ('m_stake25', 1, 1, 30, 'stake', 'stake25'),
    ('m_early', 1, 1, 30, 'time', 'early'), ('m_yes2', 1, 2, 35, 'pick', 'yes'), ('m_no2', 1, 2, 40, 'pick', 'no'), ('m_cats2', 1, 2, 40, 'spread', 'cats'),
    -- medium
    ('m_bets5', 2, 5, 70, 'count', 'bets'), ('m_odds3', 2, 1, 55, 'odds', 'odds3'), ('m_parlay', 2, 1, 50, 'multi', 'parlays'), ('m_friend', 2, 1, 60, 'social', 'friend'),
    ('m_metal', 2, 1, 55, 'market', 'metal'), ('m_fuel', 2, 1, 55, 'market', 'fuel'), ('m_oil', 2, 1, 60, 'market', 'oil'), ('m_draw', 2, 1, 55, 'market', 'draw'),
    ('m_player', 2, 1, 65, 'market', 'player'), ('m_last1h', 2, 1, 60, 'time', 'last1h'), ('m_night', 2, 1, 50, 'time', 'night'), ('m_cats3', 2, 3, 70, 'spread', 'cats'),
    ('m_stake100', 2, 1, 55, 'stake', 'stake100'), ('m_custom', 2, 1, 55, 'social', 'custom'), ('m_cities3', 2, 3, 65, 'spread', 'cities'),
    -- hard
    ('m_win1', 3, 1, 80, 'win', 'wins'), ('m_win2', 3, 2, 110, 'win', 'wins'), ('m_odds5', 3, 1, 100, 'odds', 'odds5'), ('m_odds8', 3, 1, 130, 'odds', 'odds8'),
    ('m_parlay3', 3, 1, 110, 'multi', 'parlays3'), ('m_winodds3', 3, 1, 120, 'win', 'winodds3'), ('m_bets8', 3, 8, 120, 'count', 'bets'), ('m_stake250', 3, 1, 100, 'stake', 'stake250'),
    -- legendary (rare)
    ('m_leg_win3', 4, 3, 250, 'win', 'wins'), ('m_leg_cats4', 4, 4, 220, 'spread', 'cats'), ('m_leg_bets10', 4, 10, 220, 'count', 'bets'), ('m_leg_odds12', 4, 1, 260, 'odds', 'odds12')
  ) as t(id, tier, target, reward, fam, counter)
$$;

-- Every counter of the day in one pass over the player's own bets.
create or replace function public.mission_counts(p_uid uuid, p_day date, p_tz text) returns jsonb
language plpgsql security definer stable set search_path = public as $$
declare r jsonb;
begin
  with b as (
    select m.category cat, coalesce(m.params->>'series', '') series, coalesce(m.params->>'bet', '') bet, m.city_id, bt.odds, bt.stake, bt.pick,
           extract(hour from bt.placed_at at time zone p_tz) hr, extract(epoch from (m.closes_at - bt.placed_at)) / 60 mins, coalesce(m.params->>'custom', '') custom
    from public.bets bt join public.markets m on m.id = bt.market_id
    where bt.user_id = p_uid and (bt.placed_at at time zone p_tz)::date = p_day
  )
  select jsonb_build_object(
    'bets', (select count(*) from b), 'yes', (select count(*) from b where pick = 'yes'), 'no', (select count(*) from b where pick = 'no'),
    'cat_bus', (select count(*) from b where cat = 'bus'), 'cat_train', (select count(*) from b where cat = 'train'), 'cat_weather', (select count(*) from b where cat = 'weather'),
    'cat_nature', (select count(*) from b where cat = 'nature'), 'cat_fin', (select count(*) from b where cat = 'finance'), 'cat_cult', (select count(*) from b where cat = 'culture'),
    'cat_sport', (select count(*) from b where cat = 'sport'), 'cats', (select count(distinct cat) from b), 'cities', (select count(distinct city_id) from b where city_id <> 'world'),
    'stake25', (select count(*) from b where stake >= 25), 'stake100', (select count(*) from b where stake >= 100), 'stake250', (select count(*) from b where stake >= 250),
    'early', (select count(*) from b where hr < 12), 'night', (select count(*) from b where hr >= 21 or hr < 5), 'last1h', (select count(*) from b where mins <= 60),
    'odds3', (select count(*) from b where odds >= 3), 'odds5', (select count(*) from b where odds >= 5), 'odds8', (select count(*) from b where odds >= 8), 'odds12', (select count(*) from b where odds >= 10),
    'metal', (select count(*) from b where series like 'metal:%'), 'fuel', (select count(*) from b where series like 'fuel:%'), 'oil', (select count(*) from b where series like 'oil:%'),
    'draw', (select count(*) from b where bet = 'draw'), 'player', (select count(*) from b where bet ~ '^p[gas]:'), 'custom', (select count(*) from b where custom = 'true'),
    'wins', (select count(*) from public.bets x where x.user_id = p_uid and x.status = 'won' and (x.settled_at at time zone p_tz)::date = p_day),
    'winodds3', (select count(*) from public.bets x where x.user_id = p_uid and x.status = 'won' and x.odds >= 3 and (x.settled_at at time zone p_tz)::date = p_day),
    'parlays', (select count(*) from public.parlays x where x.user_id = p_uid and (x.placed_at at time zone p_tz)::date = p_day),
    'parlays3', (select count(*) from public.parlays x where x.user_id = p_uid and (x.placed_at at time zone p_tz)::date = p_day and (select count(*) from public.parlay_legs l where l.parlay_id = x.id) >= 3),
    'friend', (select count(*) from public.friend_challenges c where c.creator = p_uid and (c.created_at at time zone p_tz)::date = p_day)
              + (select count(*) from public.friend_picks f where f.user_id = p_uid and (f.created_at at time zone p_tz)::date = p_day)
              + (select count(*) from public.challenge_invites i where i.invited_by = p_uid and (i.created_at at time zone p_tz)::date = p_day)
  ) into r;
  return r;
end $$;
revoke execute on function public.mission_counts(uuid, date, text) from public, anon, authenticated;

create or replace function public.mission_progress(p_uid uuid, p_id text, p_day date, p_tz text) returns integer
language sql security definer stable set search_path = public as $$
  select coalesce((public.mission_counts(p_uid, p_day, p_tz) ->> (select counter from public.mission_pool() where id = p_id))::int, 0);
$$;
revoke execute on function public.mission_progress(uuid, text, date, text) from public, anon, authenticated;

-- The day's missions. Seeded by player and day; avoids yesterday's missions and repeating a family; a legendary one shows up now and then.
create or replace function public.mission_pick(p_uid uuid, p_day date) returns table(id text, tier integer, target integer, reward integer)
language plpgsql stable set search_path = public as $$
declare yday text[]; fams text[] := '{}'; legend boolean; t integer; pick record; chosen text[] := '{}';
begin
  -- yesterday's raw draw (no exclusions), recomputed with the same rule so the function stays deterministic
  select coalesce(array_agg(y.id), '{}') into yday from (
    select distinct on (p.tier) p.id from public.mission_pool() p where p.tier in (1, 2, 3) order by p.tier, md5(p_uid::text || (p_day - 1)::text || p.id)) y;
  legend := (('x' || substr(md5(p_uid::text || p_day::text || 'legend'), 1, 6))::bit(24)::int % 8) = 0;
  for t in 1..3 loop
    select p.* into pick from public.mission_pool() p
     where p.tier = case when t = 3 and legend then 4 else t end and not (p.id = any (yday)) and not (p.fam = any (fams))
     order by md5(p_uid::text || p_day::text || p.id || 'a') limit 1;
    if not found then
      select p.* into pick from public.mission_pool() p where p.tier = case when t = 3 and legend then 4 else t end and not (p.id = any (chosen))
       order by md5(p_uid::text || p_day::text || p.id || 'b') limit 1;
    end if;
    fams := fams || pick.fam; chosen := chosen || pick.id;
    id := pick.id; tier := pick.tier; target := pick.target; reward := pick.reward; return next;
  end loop;
end $$;
revoke execute on function public.mission_pick(uuid, date) from public, anon, authenticated;

create or replace function public.daily_missions() returns jsonb
language plpgsql security definer stable set search_path = public as $$
declare uid uuid := auth.uid(); tz text; today date; ms jsonb; done integer; chest boolean; counts jsonb;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  select timezone into tz from public.profiles where id = uid;
  today := (now() at time zone tz)::date;
  counts := public.mission_counts(uid, today, tz);
  select coalesce(jsonb_agg(jsonb_build_object(
      'id', m.id, 'tier', m.tier, 'target', m.target, 'reward', m.reward,
      'progress', least(coalesce((counts ->> (select counter from public.mission_pool() where id = m.id))::int, 0), m.target),
      'claimed', exists (select 1 from public.quest_claims c where c.user_id = uid and c.quest_id = 'dm_' || m.id and c.period = today)
    ) order by m.tier), '[]'::jsonb) into ms from public.mission_pick(uid, today) m;
  select count(*) into done from jsonb_array_elements(ms) e where (e->>'progress')::int >= (e->>'target')::int;
  chest := exists (select 1 from public.quest_claims c where c.user_id = uid and c.quest_id = 'dm_chest' and c.period = today);
  return jsonb_build_object('day', today, 'missions', ms, 'chest', jsonb_build_object('reward', 150, 'boosts', 1, 'ready', done = 3, 'claimed', chest));
end $$;
grant execute on function public.daily_missions() to authenticated;
