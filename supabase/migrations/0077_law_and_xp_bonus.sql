-- The "law" category, and extra experience for missions and for a first win in each category.
alter table public.markets drop constraint if exists markets_category_check;
alter table public.markets add constraint markets_category_check
  check (category in ('bus','train','weather','traffic','nature','strike','finance','culture','sport','law'));

-- Missions: 20 per mission claimed, 40 for the chest, 20 for the flash one; at most 80 a day so it cannot be farmed.
-- First win: 25 for each category where the player has won at least once (a handful in total, then it is over).
create or replace function public.xp_of(u uuid) returns integer
language sql security definer stable set search_path = public as $$
  select (
    10 * (select count(*) from public.bets where user_id = u and status in ('won','lost'))
  + 15 * (select count(*) from public.bets where user_id = u and status = 'won')
  + 30 * (select count(*) from public.parlays where user_id = u and status = 'won')
  + 80 * (select count(*) from public.trophies where user_id = u)
  + 12 * (select coalesce(best_streak, 0) from public.profiles where id = u)
  +  5 * (select count(*) from public.friendships where user_id = u)
  + (select coalesce(sum(least(80, d.x)), 0) from (
       select period, sum(case quest_id when 'dm_chest' then 40 else 20 end) x
       from public.quest_claims where user_id = u and quest_id like 'dm\_%' group by period) d)
  + 25 * (select count(distinct m.category) from public.bets b join public.markets m on m.id = b.market_id where b.user_id = u and b.status = 'won')
  )::integer
$$;
revoke execute on function public.xp_of(uuid) from public, anon, authenticated;
update public.profiles set level = public.level_of_xp(public.xp_of(id));
