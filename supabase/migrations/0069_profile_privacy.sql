-- What a stranger sees of a profile: level, ring, streak, biggest win, and only the three rarest trophies (with how many are hidden). The balance and the full
-- trophy case are for friends. Also: a request that was sent can be taken back.
create or replace function public.trophy_rank(t text) returns integer
language sql immutable as $$
  select case
    when t in ('wins_500','level_50','collector') then 5
    when t in ('streak_100','bets_500','win_row_10','parlay_5','level_25') then 4
    when t in ('wins_100','all_categories','big_odds','friends_10','chest_30','train_whisperer','high_roller','streak_30','ghost_feed') then 3
    when t in ('long_shot','rain_man','streak_7') then 2
    else 1 end
$$;

create or replace function public.public_profile(p_user uuid) returns jsonb
language plpgsql security definer stable set search_path = public as $$
declare me uuid := auth.uid(); p public.profiles; rel text; best bigint; wins bigint; total integer; seen jsonb;
begin
  if me is null then raise exception 'not_authenticated'; end if;
  select * into p from public.profiles where id = p_user;
  if not found then return null; end if;
  select max(payout - stake) into best from (
    select payout, stake from public.bets where user_id = p_user and status = 'won'
    union all select payout, stake from public.parlays where user_id = p_user and status = 'won') w;
  select count(*) into wins from (
    select settled_at from public.bets where user_id = p_user and status = 'won'
    union all select settled_at from public.parlays where user_id = p_user and status = 'won') w
    where settled_at >= date_trunc('month', now());
  rel := case
    when p_user = me then 'me'
    when exists (select 1 from public.friendships where user_id = me and friend_id = p_user) then 'friends'
    when exists (select 1 from public.friend_requests where from_id = me and to_id = p_user) then 'sent'
    when exists (select 1 from public.friend_requests where from_id = p_user and to_id = me) then 'received'
    else 'none' end;
  select count(*) into total from public.trophies where user_id = p_user;
  if rel in ('me', 'friends') then
    select coalesce(jsonb_agg(trophy_id order by public.trophy_rank(trophy_id) desc, earned_at desc), '[]'::jsonb) into seen from public.trophies where user_id = p_user;
  else
    select coalesce(jsonb_agg(trophy_id), '[]'::jsonb) into seen from (
      select trophy_id from public.trophies where user_id = p_user order by public.trophy_rank(trophy_id) desc, earned_at limit 3) t;
  end if;
  return jsonb_build_object('id', p.id, 'name', nullif(p.display_name, ''), 'avatar', p.avatar, 'decoration', p.decoration,
    'level', public.level_of_xp(public.xp_of(p_user)), 'streak', p.streak, 'best_streak', p.best_streak,
    'best_win', coalesce(best, 0), 'month_wins', wins,
    'trophies', seen, 'trophy_count', total, 'hidden', greatest(0, total - jsonb_array_length(seen)),
    'balance', case when rel in ('me', 'friends') then p.credits else null end,
    'relation', rel);
end $$;
grant execute on function public.public_profile(uuid) to authenticated;

create or replace function public.cancel_friend_request(p_user uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  delete from public.friend_requests where from_id = auth.uid() and to_id = p_user;
end $$;
grant execute on function public.cancel_friend_request(uuid) to authenticated;
