-- Eighteen more badges (the "badge" and "challenge" pictures): how each one is earned, checked together with the others whenever trophies are evaluated.
create or replace function public.evaluate_badges(u uuid) returns text[]
language plpgsql security definer set search_path = public as $$
declare got text[] := '{}'; c text[] := '{}'; days_played integer; net bigint; lost_prev boolean := false;
begin
  select count(distinct (placed_at at time zone 'utc')::date) into days_played from public.bets where user_id = u;
  select coalesce(sum(case when status = 'won' then payout - stake when status = 'lost' then -stake else 0 end), 0) into net from public.bets where user_id = u;
  if (select count(*) from public.bets where user_id = u and status = 'won' and odds >= 5) >= 5 then c := array_append(c, 'crown_cracked'); end if;
  if (select count(*) from public.bets b join public.markets m on m.id = b.market_id where b.user_id = u and b.status = 'won' and m.category = 'sport') >= 25 then c := array_append(c, 'star_green'); end if;
  if exists (select 1 from public.bets where user_id = u and status = 'won' and odds >= 3 group by (settled_at at time zone 'utc')::date having count(*) >= 3) then c := array_append(c, 'bullseye'); end if;
  if (select count(*) from public.bets b join public.markets m on m.id = b.market_id where b.user_id = u and b.status = 'won' and m.category = 'space') >= 10 then c := array_append(c, 'stargazer'); end if;
  if (select count(*) from public.bets b join public.markets m on m.id = b.market_id where b.user_id = u and b.status = 'won' and m.category = 'weather') >= 20 then c := array_append(c, 'storm_umbrella'); end if;
  if days_played >= 50 then c := array_append(c, 'calendar_check'); end if;
  if (select count(*) from public.bets b join public.markets m on m.id = b.market_id where b.user_id = u and b.status = 'won' and m.category = 'train') >= 50 then c := array_append(c, 'locomotive_wins'); end if;
  if coalesce((select max(payout - stake) from public.bets where user_id = u and status = 'won'), 0) >= 10000 then c := array_append(c, 'amethyst'); end if;
  if exists (select 1 from public.bets b join public.markets m on m.id = b.market_id where b.user_id = u and b.status = 'won' and m.closes_at - b.placed_at <= interval '2 minutes') then c := array_append(c, 'last_minute'); end if;
  if exists (select 1 from public.bets b join public.markets m on m.id = b.market_id where b.user_id = u and b.status = 'won' group by (b.settled_at at time zone 'utc')::date having count(distinct m.category) >= 3) then c := array_append(c, 'three_rings'); end if;
  if exists (select 1 from public.bets b join public.markets m on m.id = b.market_id where b.user_id = u and b.status = 'won' and m.category = 'train' and b.odds >= 4) then c := array_append(c, 'rail_bolt'); end if;
  if net >= 5000 then c := array_append(c, 'net_5k'); end if;
  if (select count(*) from public.bets b join public.markets m on m.id = b.market_id where b.user_id = u and b.status = 'won' and m.category = 'bus') >= 10 then c := array_append(c, 'bus_line'); end if;
  if (select count(*) from public.bets where user_id = u and status = 'won' and stake >= 500) >= 10 then c := array_append(c, 'coin_cup'); end if;
  if (select count(distinct m.city_id) from public.bets b join public.markets m on m.id = b.market_id where b.user_id = u) >= 10 then c := array_append(c, 'compass_walk'); end if;
  if (select count(*) from public.bets b join public.markets m on m.id = b.market_id where b.user_id = u and b.status = 'won' and m.category = 'train' and b.pick = 'no') >= 10 then c := array_append(c, 'train_lens'); end if;
  select exists (
    select 1 from (
      select status, count(*) filter (where status = 'lost') over (order by settled_at, id rows between 5 preceding and 1 preceding) as prev_lost
      from (select id, status, settled_at from public.bets where user_id = u and status in ('won','lost')) ev
    ) y where status = 'won' and prev_lost = 5) into lost_prev;
  if lost_prev then c := array_append(c, 'chain_break'); end if;
  if (select count(*) from public.bets where user_id = u and status = 'won' and extract(hour from placed_at at time zone 'utc') between 0 and 3) >= 5 then c := array_append(c, 'moon_train'); end if;
  if cardinality(c) > 0 then
    with ins as (insert into public.trophies (user_id, trophy_id) select u, t from unnest(c) t on conflict do nothing returning trophy_id)
    select coalesce(array_agg(trophy_id), '{}'::text[]) into got from ins;
  end if;
  return got;
end $$;
revoke all on function public.evaluate_badges(uuid) from public, anon, authenticated;

create or replace function public.evaluate_trophies(u uuid) returns text[]
language plpgsql security definer set search_path = public as $$
declare a text[]; b text[]; h text[]; g text[];
begin
  a := public.evaluate_trophies_base(u);
  b := public.evaluate_trophies_more(u);
  h := public.evaluate_halloween(u);
  g := public.evaluate_badges(u);
  return coalesce(a, '{}'::text[]) || coalesce(b, '{}'::text[]) || coalesce(h, '{}'::text[]) || coalesce(g, '{}'::text[]);
end $$;
revoke execute on function public.evaluate_trophies(uuid) from public, anon, authenticated;

-- the showcase order of the profile: the new ones rank with the others of their rarity
create or replace function public.trophy_rank(t text) returns integer
language sql immutable as $$
  select case
    when t in ('wins_500','level_50','collector','wins_1000','bets_2000','win_row_20','all_cats_8','streak_200','streak_365','veteran_365','friends_50','comeback_10','level_70','level_80','level_90','level_100') then 5
    when t in ('streak_100','bets_500','win_row_10','parlay_5','level_25','limit_breaker','big_odds_25','rocket_x3','single_win_25k','category_100','parlay_wins_10','regular_100','friends_25','group_owner','organizer_10','chal_joined_25','recruiter_5','packs_100','decos_15','perfect_week','level_40','level_60') then 4
    when t in ('wins_100','all_categories','big_odds','friends_10','chest_30','train_whisperer','high_roller','streak_30','ghost_feed','exact_minute','tide_turn','wins_250','night_owl','early_bird','weekend_20','groups_3','avatars_30','hall_25','level_20','level_30','crown_cracked','storm_umbrella','locomotive_wins','amethyst','three_rings','coin_cup','moon_train') then 3
    when t in ('long_shot','rain_man','streak_7','champion','five_row','cup','diamond','insight','phoenix','rocket','contrarian','double_sense','local_explorer','friend_challenge','level_10','star_green','bullseye','stargazer','calendar_check','last_minute','rail_bolt','net_5k','bus_line','compass_walk','train_lens','chain_break') then 2
    else 1 end
$$;
