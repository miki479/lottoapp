-- The aura: a soft glow in the colour of the ring around the profile picture, switched on by the player from level 50 and then seen by everybody.
alter table public.profiles add column if not exists aura boolean not null default false;

create or replace function public.set_aura(p_on boolean) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if p_on and public.level_of_xp(public.xp_of(uid)) < 50 then raise exception 'aura_locked'; end if;
  update public.profiles set aura = p_on where id = uid;
end $$;
revoke all on function public.set_aura(boolean) from public, anon;
grant execute on function public.set_aura(boolean) to authenticated;

drop function if exists public.looks(uuid[]);
create or replace function public.looks(ids uuid[]) returns table(user_id uuid, avatar text, decoration text, level integer, title text, aura boolean)
language sql stable security definer set search_path = public as $$
  select p.id, p.avatar, p.decoration, p.level, p.title, p.aura and p.level >= 50 from public.profiles p where p.id = any(ids[1:100]) and auth.uid() is not null
$$;
grant execute on function public.looks(uuid[]) to authenticated;

create or replace function public.my_progress() returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); x integer; lv integer; p public.profiles; got text[] := '{}';
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  -- a brand-new session whose profile row is not there yet: nothing to report (the app asks again a moment later)
  if not exists (select 1 from public.profiles where id = uid) then
    return jsonb_build_object('xp', 0, 'level', 1, 'avatar', 'conductor', 'decoration', null, 'aura', false, 'granted', '[]'::jsonb, 'owned', '[]'::jsonb);
  end if;
  if not exists (select 1 from public.trophy_checks where user_id = uid and checked_at > now() - interval '2 minutes') then
    got := public.evaluate_trophies(uid);
    insert into public.trophy_checks (user_id) values (uid) on conflict (user_id) do update set checked_at = now();
  end if;
  select * into p from public.profiles where id = uid;
  x := public.xp_of(uid); lv := public.level_of_xp(x);
  if p.level <> lv then update public.profiles set level = lv where id = uid; end if;
  return jsonb_build_object('xp', x, 'level', lv, 'avatar', p.avatar, 'decoration', p.decoration, 'aura', p.aura and lv >= 50, 'granted', to_jsonb(got),
    'owned', coalesce((select jsonb_agg(decoration_id) from public.user_decorations where user_id = uid), '[]'::jsonb));
end $$;
grant execute on function public.my_progress() to authenticated;

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
  return jsonb_build_object('id', p.id, 'name', nullif(p.display_name, ''), 'avatar', p.avatar, 'decoration', p.decoration, 'aura', p.aura and p.level >= 50,
    'level', p.level, 'title', p.title, 'streak', p.streak, 'best_streak', p.best_streak,
    'best_win', coalesce(best, 0), 'month_wins', wins,
    'trophies', seen, 'trophy_count', total, 'hidden', greatest(0, total - jsonb_array_length(seen)),
    'balance', case when rel in ('me', 'friends') then p.credits else null end,
    'relation', rel);
end $$;
grant execute on function public.public_profile(uuid) to authenticated;
