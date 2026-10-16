-- Trophy "limit_breaker" (legendary): earned the first time the Limit Breaker is bought. Same evaluation as before plus that one condition.
create or replace function public.trophy_rank(t text) returns integer
language sql immutable as $$
  select case
    when t in ('wins_500','level_50','collector') then 5
    when t in ('streak_100','bets_500','win_row_10','parlay_5','level_25','limit_breaker') then 4
    when t in ('wins_100','all_categories','big_odds','friends_10','chest_30','train_whisperer','high_roller','streak_30','ghost_feed') then 3
    when t in ('long_shot','rain_man','streak_7') then 2
    else 1 end
$$;

create or replace function public.evaluate_trophies(u uuid) returns text[]
language plpgsql security definer set search_path = public as $$
declare got text[] := '{}'; c text[] := '{}'; wins integer; settled integer; cats integer := 0; best_row integer := 0; others integer; lv integer;
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
  if wins >= 10 then
    select coalesce(max(run), 0) into best_row from (
      select count(*) as run from (
        select status, sum(case when status <> 'won' then 1 else 0 end) over (order by settled_at, id) as grp
        from (select id, status, settled_at from public.bets where user_id = u and status in ('won','lost')
              union all select id, status, settled_at from public.parlays where user_id = u and status in ('won','lost')) ev
      ) x where status = 'won' group by grp) r;
    if best_row >= 10 then c := array_append(c, 'win_row_10'); end if;
  end if;
  if exists (select 1 from public.bets where user_id = u and status = 'won' and odds >= 10) then c := array_append(c, 'big_odds'); end if;
  if exists (select 1 from public.parlays p where p.user_id = u and p.status = 'won' and (select count(*) from public.parlay_legs l where l.parlay_id = p.id) >= 5) then c := array_append(c, 'parlay_5'); end if;
  if (select count(*) from public.friendships where user_id = u) >= 10 then c := array_append(c, 'friends_10'); end if;
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
    ('first_win','all_rings','long_shot','rain_man','streak_7','train_whisperer','high_roller','streak_30','ghost_feed','wins_100','wins_500','streak_100','bets_500','all_categories','win_row_10','big_odds','parlay_5','friends_10','level_25','level_50','chest_30');
  if others >= 21 then
    insert into public.trophies (user_id, trophy_id) values (u, 'collector') on conflict do nothing;
    if found then got := array_append(got, 'collector'); end if;
  end if;
  return got;
end $$;
revoke execute on function public.evaluate_trophies(uuid) from public, anon, authenticated;
