-- The twelve plain-style trophies get easy challenges (the shiny, faceted ones keep the hard ones), so the two styles tell the difficulty at a glance.
create or replace function public.trophy_rank(t text) returns integer
language sql immutable as $$
  select case
    when t in ('wins_500','level_50','collector') then 5
        when t in ('streak_100','bets_500','win_row_10','parlay_5','level_25','limit_breaker') then 4
    when t in ('wins_100','all_categories','big_odds','friends_10','chest_30','train_whisperer','high_roller','streak_30','ghost_feed') then 3
    when t in ('long_shot','rain_man','streak_7','champion','five_row','cup','diamond','insight','phoenix','rocket') then 2
    else 1 end
$$;

create or replace function public.evaluate_trophies(u uuid) returns text[]
language plpgsql security definer set search_path = public as $$
declare got text[] := '{}'; c text[] := '{}'; best_loss integer := 0;  wins integer; settled integer; cats integer := 0; best_row integer := 0; others integer; lv integer;
begin
  select (select count(*) from public.bets where user_id = u and status = 'won') + (select count(*) from public.parlays where user_id = u and status = 'won') into wins;
  select (select count(*) from public.bets where user_id = u and status in ('won','lost')) + (select count(*) from public.parlays where user_id = u and status in ('won','lost')) into settled;
  if wins >= 100 then c := array_append(c, 'wins_100'); end if;
  if wins >= 500 then c := array_append(c, 'wins_500'); end if;
  if settled >= 500 then c := array_append(c, 'bets_500'); end if;
  if (select best_streak from public.profiles where id = u) >= 100 then c := array_append(c, 'streak_100'); end if;
  if wins >= 7 then
    select count(distinct m.category) into cats from public.bets b join public.markets m on m.id = b.market_id where b.user_id = u and b.status = 'won';
    if cats >= 7 then c := array_append(c, 'all_categories'); end if;
  end if;
  if wins >= 3 then
    select coalesce(max(run), 0) into best_row from (
      select count(*) as run from (
        select status, sum(case when status <> 'won' then 1 else 0 end) over (order by settled_at, id) as grp
        from (select id, status, settled_at from public.bets where user_id = u and status in ('won','lost')
              union all select id, status, settled_at from public.parlays where user_id = u and status in ('won','lost')) ev
      ) x where status = 'won' group by grp) r;
    if best_row >= 3 then c := array_append(c, 'five_row'); end if;
    if best_row >= 10 then c := array_append(c, 'win_row_10'); end if;
  end if;
  if settled >= 3 then
    select coalesce(max(run), 0) into best_loss from (
      select count(*) as run from (
        select status, sum(case when status <> 'lost' then 1 else 0 end) over (order by settled_at, id) as grp
        from (select id, status, settled_at from public.bets where user_id = u and status in ('won','lost')
              union all select id, status, settled_at from public.parlays where user_id = u and status in ('won','lost')) ev
      ) x where status = 'lost' group by grp) r;
    if best_loss >= 3 then c := array_append(c, 'ghost_streak'); end if;
  end if;
  -- a win straight after three losses in a row
  if wins >= 1 and settled >= 4 and exists (
    select 1 from (
      select status, count(*) filter (where status = 'lost') over (order by settled_at, id rows between 3 preceding and 1 preceding) as prev_lost
      from (select id, status, settled_at from public.bets where user_id = u and status in ('won','lost')
            union all select id, status, settled_at from public.parlays where user_id = u and status in ('won','lost')) ev
    ) y where status = 'won' and prev_lost = 3) then c := array_append(c, 'phoenix'); end if;
  if wins >= 10 then c := array_append(c, 'champion'); end if;
  if settled >= 25 then c := array_append(c, 'cup'); end if;
  if (select count(*) from public.bets where user_id = u and status = 'won' and odds >= 2) >= 3 then c := array_append(c, 'diamond'); end if;
  if (select count(*) from public.bets where user_id = u and status = 'won' and odds >= 2) >= 5 then c := array_append(c, 'insight'); end if;
  if exists (select 1 from public.bets where user_id = u and status = 'won' and odds >= 4) then c := array_append(c, 'rocket'); end if;
  if exists (select 1 from public.bets where user_id = u group by (placed_at at time zone 'utc')::date having count(*) >= 3) then c := array_append(c, 'pace'); end if;
  if (select count(distinct m.category) from public.bets b join public.markets m on m.id = b.market_id where b.user_id = u) >= 3 then c := array_append(c, 'compass'); end if;
  if (select best_streak from public.profiles where id = u) >= 3 then c := array_append(c, 'wave'); end if;
  if exists (select 1 from public.bets where user_id = u and status = 'won' and odds >= 10) then c := array_append(c, 'big_odds'); end if;
  if exists (select 1 from public.parlays p where p.user_id = u and p.status = 'won' and (select count(*) from public.parlay_legs l where l.parlay_id = p.id) >= 5) then c := array_append(c, 'parlay_5'); end if;
  if (select count(*) from public.friendships where user_id = u) >= 10 then c := array_append(c, 'friends_10'); end if;
  if (select count(*) from public.friendships where user_id = u) >= 1 then c := array_append(c, 'alliance'); end if;
  if (select count(*) from public.quest_claims where user_id = u and quest_id = 'dm_chest') >= 30 then c := array_append(c, 'chest_30'); end if;
  -- the Limit Breaker was bought at least once (migration 0130 / shop_supply_log)
  if exists (select 1 from public.shop_supply_log where user_id = u and item = 'limit_break') then c := array_append(c, 'limit_breaker'); end if;
  if cardinality(c) > 0 or true then
    with ins as (insert into public.trophies (user_id, trophy_id) select u, t from unnest(c) t on conflict do nothing returning trophy_id)
    select coalesce(array_agg(trophy_id), '{}'::text[]) into got from ins;
  end if;
  -- levels count the trophies already earned, so they are checked after the others
  lv := public.level_of_xp(public.xp_of(u));
  c := '{}';
  if lv >= 25 then c := array_append(c, 'level_25'); end if;
  if lv >= 50 then c := array_append(c, 'level_50'); end if;
  if cardinality(c) > 0 then
    with ins as (insert into public.trophies (user_id, trophy_id) select u, t from unnest(c) t on conflict do nothing returning trophy_id)
    select got || coalesce(array_agg(trophy_id), '{}'::text[]) into got from ins;
  end if;
  select count(*) into others from public.trophies where user_id = u and trophy_id in
    ('first_win','all_rings','long_shot','rain_man','streak_7','train_whisperer','high_roller','streak_30','ghost_feed','wins_100','wins_500','streak_100','bets_500','all_categories','win_row_10','big_odds','parlay_5','friends_10','level_25','level_50','chest_30','alliance','compass','champion','five_row','cup','pace','diamond','ghost_streak','phoenix','insight','wave','rocket');
  if others >= 33 then
    insert into public.trophies (user_id, trophy_id) values (u, 'collector') on conflict do nothing;
    if found then got := array_append(got, 'collector'); end if;
  end if;
  return got;
end $$;
revoke execute on function public.evaluate_trophies(uuid) from public, anon, authenticated;
