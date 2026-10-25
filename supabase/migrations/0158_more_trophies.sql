-- Forty-five more trophies: the six challenges of the "6 nuove sfide" pack, thirty long and hard ones (wins, streaks, time on the app, friends and groups, collections) and one for every ten levels.
-- The old evaluator stays as evaluate_trophies_base; the new one runs it and then the checks below.
do $$ begin
  if exists (select 1 from pg_proc where proname = 'evaluate_trophies_base' and pronamespace = 'public'::regnamespace) then null;
  else alter function public.evaluate_trophies(uuid) rename to evaluate_trophies_base; end if;
end $$;

create or replace function public.trophy_rank(t text) returns integer
language sql immutable as $$
  select case
    when t in ('wins_500','level_50','collector','wins_1000','bets_2000','win_row_20','all_cats_8','streak_200','streak_365','veteran_365','friends_50','comeback_10','level_70','level_80','level_90','level_100') then 5
    when t in ('streak_100','bets_500','win_row_10','parlay_5','level_25','limit_breaker','big_odds_25','rocket_x3','single_win_25k','category_100','parlay_wins_10','regular_100','friends_25','group_owner','organizer_10','chal_joined_25','recruiter_5','packs_100','decos_15','perfect_week','level_40','level_60') then 4
    when t in ('wins_100','all_categories','big_odds','friends_10','chest_30','train_whisperer','high_roller','streak_30','ghost_feed','exact_minute','tide_turn','wins_250','night_owl','early_bird','weekend_20','groups_3','avatars_30','hall_25','level_20','level_30') then 3
    when t in ('long_shot','rain_man','streak_7','champion','five_row','cup','diamond','insight','phoenix','rocket','contrarian','double_sense','local_explorer','friend_challenge','level_10') then 2
    else 1 end
$$;

create or replace function public.evaluate_trophies_more(u uuid) returns text[]
language plpgsql security definer set search_path = public as $$
declare got text[] := '{}'; c text[] := '{}'; wins integer; settled integer; cats integer := 0; best_row integer := 0; best_win_days integer := 0; days_played integer := 0;
  best_streak integer := 0; created_at timestamptz; lv integer; trophy_count integer; comeback10 boolean := false;
begin
  select (select count(*) from public.bets where user_id = u and status = 'won') + (select count(*) from public.parlays where user_id = u and status = 'won') into wins;
  select (select count(*) from public.bets where user_id = u and status in ('won','lost')) + (select count(*) from public.parlays where user_id = u and status in ('won','lost')) into settled;
  select p.best_streak, p.created_at into best_streak, created_at from public.profiles p where p.id = u;
  select count(distinct m.category) into cats from public.bets b join public.markets m on m.id = b.market_id where b.user_id = u and b.status = 'won';
  select count(distinct (placed_at at time zone 'utc')::date) into days_played from public.bets where user_id = u;
  if wins >= 20 then
    select coalesce(max(run), 0) into best_row from (
      select count(*) as run from (
        select status, sum(case when status <> 'won' then 1 else 0 end) over (order by settled_at, id) as grp
        from (select id, status, settled_at from public.bets where user_id = u and status in ('won','lost')
              union all select id, status, settled_at from public.parlays where user_id = u and status in ('won','lost')) ev
      ) x where status = 'won' group by grp) r;
  end if;
  if wins >= 7 then
    select coalesce(max(run), 0) into best_win_days from (
      select count(*) as run from (
        select d, d - (row_number() over (order by d))::integer as grp
        from (select distinct (settled_at at time zone 'utc')::date as d from public.bets where user_id = u and status = 'won') x) y group by grp) z;
  end if;
  if wins >= 1 and settled >= 11 then
    select exists (
      select 1 from (
        select status, count(*) filter (where status = 'lost') over (order by settled_at, id rows between 10 preceding and 1 preceding) as prev_lost
        from (select id, status, settled_at from public.bets where user_id = u and status in ('won','lost')
              union all select id, status, settled_at from public.parlays where user_id = u and status in ('won','lost')) ev
      ) y where status = 'won' and prev_lost = 10) into comeback10;
  end if;
  if exists (select 1 from public.bets where user_id = u and status = 'won' and odds > 4) then c := array_append(c, 'contrarian'); end if;
  if exists (select 1 from public.bets b join public.markets m on m.id = b.market_id where b.user_id = u and b.status = 'won' and m.category = 'train' and m.evidence ? 'delaySec' and m.params ? 'thresholdSec' and abs((m.evidence->>'delaySec')::numeric - (m.params->>'thresholdSec')::numeric) <= 60) then c := array_append(c, 'exact_minute'); end if;
  if exists (select 1 from public.bets b join public.markets m on m.id = b.market_id where b.user_id = u and b.status = 'won' group by (b.settled_at at time zone 'utc')::date having count(distinct m.category) >= 2) then c := array_append(c, 'double_sense'); end if;
  if exists (select 1 from public.bets b join public.markets m on m.id = b.market_id join public.profiles p on p.id = u join public.places pl on pl.id = p.home_place where b.user_id = u and m.lat is not null and m.lon is not null and 6371 * acos(least(1, cos(radians(pl.lat)) * cos(radians(m.lat)) * cos(radians(m.lon) - radians(pl.lon)) + sin(radians(pl.lat)) * sin(radians(m.lat)))) <= 50) then c := array_append(c, 'local_explorer'); end if;
  if exists (select 1 from public.bets b join public.markets m on m.id = b.market_id where b.user_id = u and b.status = 'won' and b.odds >= 2 and ((b.pick = 'yes' and m.odds_yes < 2) or (b.pick = 'no' and m.odds_no < 2))) then c := array_append(c, 'tide_turn'); end if;
  if exists (select 1 from public.bets b join public.markets m on m.id = b.market_id join public.friendships f on f.user_id = u and f.friend_id = m.created_by where b.user_id = u and b.status in ('won','lost')) then c := array_append(c, 'friend_challenge'); end if;
  if wins >= 250 then c := array_append(c, 'wins_250'); end if;
  if wins >= 1000 then c := array_append(c, 'wins_1000'); end if;
  if settled >= 2000 then c := array_append(c, 'bets_2000'); end if;
  if exists (select 1 from public.bets where user_id = u and status = 'won' and odds >= 25) then c := array_append(c, 'big_odds_25'); end if;
  if (select count(*) from public.bets where user_id = u and status = 'won' and odds >= 4) >= 10 then c := array_append(c, 'rocket_x3'); end if;
  if coalesce((select max(payout - stake) from public.bets where user_id = u and status = 'won'), 0) >= 25000 then c := array_append(c, 'single_win_25k'); end if;
  if best_row >= 20 then c := array_append(c, 'win_row_20'); end if;
  if exists (select 1 from public.bets b join public.markets m on m.id = b.market_id where b.user_id = u and b.status = 'won' group by m.category having count(*) >= 100) then c := array_append(c, 'category_100'); end if;
  if cats >= 8 then c := array_append(c, 'all_cats_8'); end if;
  if (select count(*) from public.parlays where user_id = u and status = 'won') >= 10 then c := array_append(c, 'parlay_wins_10'); end if;
  if best_streak >= 200 then c := array_append(c, 'streak_200'); end if;
  if best_streak >= 365 then c := array_append(c, 'streak_365'); end if;
  if created_at <= now() - interval '365 days' and exists (select 1 from public.bets where user_id = u and placed_at > now() - interval '30 days') then c := array_append(c, 'veteran_365'); end if;
  if days_played >= 100 then c := array_append(c, 'regular_100'); end if;
  if exists (select 1 from public.bets where user_id = u and extract(hour from placed_at at time zone 'utc') between 0 and 3 group by 1 having count(distinct (placed_at at time zone 'utc')::date) >= 20) then c := array_append(c, 'night_owl'); end if;
  if exists (select 1 from public.bets where user_id = u and extract(hour from placed_at at time zone 'utc') between 5 and 7 group by 1 having count(distinct (placed_at at time zone 'utc')::date) >= 20) then c := array_append(c, 'early_bird'); end if;
  if (select count(distinct (placed_at at time zone 'utc')::date) from public.bets where user_id = u and extract(isodow from placed_at at time zone 'utc') in (6, 7)) >= 20 then c := array_append(c, 'weekend_20'); end if;
  if (select count(*) from public.friendships where user_id = u) >= 25 then c := array_append(c, 'friends_25'); end if;
  if (select count(*) from public.friendships where user_id = u) >= 50 then c := array_append(c, 'friends_50'); end if;
  if (select count(*) from public.group_members where user_id = u) >= 3 then c := array_append(c, 'groups_3'); end if;
  if exists (select 1 from public.groups g where g.owner = u and (select count(*) from public.group_members m where m.group_code = g.code) >= 5) then c := array_append(c, 'group_owner'); end if;
  if (select count(*) from public.markets where created_by = u) >= 10 then c := array_append(c, 'organizer_10'); end if;
  if (select count(*) from public.bets b join public.markets m on m.id = b.market_id join public.friendships f on f.user_id = u and f.friend_id = m.created_by where b.user_id = u) >= 25 then c := array_append(c, 'chal_joined_25'); end if;
  if (select count(*) from public.profiles where referred_by = u) >= 5 then c := array_append(c, 'recruiter_5'); end if;
  if (select count(*) from public.shop_openings where user_id = u) >= 100 then c := array_append(c, 'packs_100'); end if;
  if (select count(*) from public.user_avatars where user_id = u) >= 30 then c := array_append(c, 'avatars_30'); end if;
  if (select count(*) from public.user_decorations where user_id = u) >= 15 then c := array_append(c, 'decos_15'); end if;
  if best_win_days >= 7 then c := array_append(c, 'perfect_week'); end if;
  if comeback10 then c := array_append(c, 'comeback_10'); end if;
  if cardinality(c) > 0 then
    with ins as (insert into public.trophies (user_id, trophy_id) select u, t from unnest(c) t on conflict do nothing returning trophy_id)
    select coalesce(array_agg(trophy_id), '{}'::text[]) into got from ins;
  end if;
  -- levels and the trophy hall come last: they count what is already earned
  lv := public.level_of_xp(public.xp_of(u));
  c := '{}';
  if lv >= 10 then c := array_append(c, 'level_10'); end if;
  if lv >= 20 then c := array_append(c, 'level_20'); end if;
  if lv >= 30 then c := array_append(c, 'level_30'); end if;
  if lv >= 40 then c := array_append(c, 'level_40'); end if;
  if lv >= 60 then c := array_append(c, 'level_60'); end if;
  if lv >= 70 then c := array_append(c, 'level_70'); end if;
  if lv >= 80 then c := array_append(c, 'level_80'); end if;
  if lv >= 90 then c := array_append(c, 'level_90'); end if;
  if lv >= 100 then c := array_append(c, 'level_100'); end if;
  select count(*) into trophy_count from public.trophies where user_id = u;
  if trophy_count >= 25 then c := array_append(c, 'hall_25'); end if;
  if cardinality(c) > 0 then
    with ins as (insert into public.trophies (user_id, trophy_id) select u, t from unnest(c) t on conflict do nothing returning trophy_id)
    select got || coalesce(array_agg(trophy_id), '{}'::text[]) into got from ins;
  end if;
  return got;
end $$;
revoke all on function public.evaluate_trophies_more(uuid) from public, anon, authenticated;

create or replace function public.evaluate_trophies(u uuid) returns text[]
language plpgsql security definer set search_path = public as $$
declare a text[]; b text[];
begin
  a := public.evaluate_trophies_base(u);
  b := public.evaluate_trophies_more(u);
  return coalesce(a, '{}'::text[]) || coalesce(b, '{}'::text[]);
end $$;
