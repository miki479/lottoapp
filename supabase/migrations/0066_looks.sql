-- Looks: a cartoon avatar and a decoration ring, levels from experience, random drops, public profiles and friend requests.
alter table public.profiles add column if not exists avatar text not null default 'conductor' check (avatar in ('conductor','busbot','cloud','fox','ball','bolt','alien','astro','clock','kandinsky'));
alter table public.profiles add column if not exists decoration text;

create table if not exists public.decorations (
  id text primary key,
  rarity text not null,
  level integer,            -- null: only drops at random
  drop_weight integer not null default 0
);
insert into public.decorations (id, rarity, level, drop_weight) values
  ('copper','common',2,0),('bronze','common',4,0),('silver','uncommon',6,0),('gold','rare',9,0),('diamond','epic',13,0),
  ('amethyst','epic',18,0),('platinum','legendary',24,0),('mithril','legendary',31,0),('orichalcum','mythic',40,0),('adamantium','mythic',50,0),
  ('jade','rare',null,40),('ruby','epic',null,25),('sapphire','epic',null,25),('obsidian','legendary',null,6),('opal','legendary',null,4)
on conflict (id) do update set rarity = excluded.rarity, level = excluded.level, drop_weight = excluded.drop_weight;
alter table public.decorations enable row level security;
create policy "decorations are public" on public.decorations for select using (true);
grant select on public.decorations to authenticated;

create table if not exists public.user_decorations (
  user_id uuid not null references public.profiles(id) on delete cascade,
  decoration_id text not null references public.decorations(id),
  created_at timestamptz not null default now(),
  primary key (user_id, decoration_id)
);
alter table public.user_decorations enable row level security;
create policy "own decorations" on public.user_decorations for select using (auth.uid() = user_id);
grant select on public.user_decorations to authenticated;

create table if not exists public.friend_requests (
  from_id uuid not null references public.profiles(id) on delete cascade,
  to_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (from_id, to_id),
  check (from_id <> to_id)
);
create index if not exists friend_requests_to on public.friend_requests (to_id);
alter table public.friend_requests enable row level security;
revoke all on public.friend_requests from anon, authenticated;

-- Experience: the same weights as the app shows.
create or replace function public.xp_of(u uuid) returns integer
language sql security definer stable set search_path = public as $$
  select (
    10 * (select count(*) from public.bets where user_id = u and status in ('won','lost'))
  + 15 * (select count(*) from public.bets where user_id = u and status = 'won')
  + 30 * (select count(*) from public.parlays where user_id = u and status = 'won')
  + 80 * (select count(*) from public.trophies where user_id = u)
  + 12 * (select coalesce(best_streak, 0) from public.profiles where id = u)
  +  5 * (select count(*) from public.friendships where user_id = u)
  )::integer
$$;
revoke execute on function public.xp_of(uuid) from public, anon, authenticated;

create or replace function public.level_of_xp(xp integer) returns integer
language plpgsql immutable as $$
declare l integer;
begin
  if xp is null or xp <= 0 then return 1; end if;
  l := least(99, 1 + floor(power(xp / 100.0, 1 / 1.65))::integer);
  while l < 99 and round(100 * power(l, 1.65)) <= xp loop l := l + 1; end loop;
  while l > 1 and round(100 * power(l - 1, 1.65)) > xp loop l := l - 1; end loop;
  return l;
end $$;

-- Always returns the same shape; the app draws the level bar from it.
create or replace function public.my_progress() returns jsonb
language plpgsql security definer stable set search_path = public as $$
declare uid uuid := auth.uid(); x integer; lv integer; p public.profiles;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  select * into p from public.profiles where id = uid;
  x := public.xp_of(uid); lv := public.level_of_xp(x);
  return jsonb_build_object('xp', x, 'level', lv, 'avatar', p.avatar, 'decoration', p.decoration,
    'owned', coalesce((select jsonb_agg(decoration_id) from public.user_decorations where user_id = uid), '[]'::jsonb));
end $$;
grant execute on function public.my_progress() to authenticated;

create or replace function public.set_look(p_avatar text, p_decoration text) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); lv integer; d public.decorations;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if p_decoration is not null then
    select * into d from public.decorations where id = p_decoration;
    if not found then raise exception 'unknown_decoration'; end if;
    lv := public.level_of_xp(public.xp_of(uid));
    if not ((d.level is not null and d.level <= lv) or exists (select 1 from public.user_decorations where user_id = uid and decoration_id = p_decoration)) then
      raise exception 'decoration_locked';
    end if;
  end if;
  update public.profiles set avatar = coalesce(p_avatar, avatar), decoration = p_decoration where id = uid;
end $$;
grant execute on function public.set_look(text, text) to authenticated;

-- Avatars and rings of other people (names are already public in the rankings).
create or replace function public.looks(ids uuid[]) returns table(user_id uuid, avatar text, decoration text, level integer)
language sql security definer stable set search_path = public as $$
  select p.id, p.avatar, p.decoration, public.level_of_xp(public.xp_of(p.id))
  from public.profiles p where p.id = any(ids[1:100]) and auth.uid() is not null
$$;
grant execute on function public.looks(uuid[]) to authenticated;

-- A random drop of a locked ring: the roll and the pick are made here.
create or replace function public.roll_drop(u uuid, chance numeric) returns text
language plpgsql security definer set search_path = public as $$
declare pick text; total integer;
begin
  if random() >= chance then return null; end if;
  select sum(drop_weight) into total from public.decorations d
   where d.drop_weight > 0 and not exists (select 1 from public.user_decorations x where x.user_id = u and x.decoration_id = d.id);
  if coalesce(total, 0) = 0 then return null; end if;
  select id into pick from (
    select d.id, sum(d.drop_weight) over (order by d.id) as run from public.decorations d
     where d.drop_weight > 0 and not exists (select 1 from public.user_decorations x where x.user_id = u and x.decoration_id = d.id)
  ) t where run > random() * total order by run limit 1;
  insert into public.user_decorations (user_id, decoration_id) values (u, pick) on conflict do nothing;
  return pick;
end $$;
revoke execute on function public.roll_drop(uuid, numeric) from public, anon, authenticated;

create or replace function public.claim_chest() returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); prof public.profiles; today date; m record; got text;
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
  got := public.roll_drop(uid, 0.12);
  return jsonb_build_object('credits', 150, 'boosts', 1, 'decoration', got);
end $$;
grant execute on function public.claim_chest() to authenticated;

create or replace function public.claim_flash() returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); prof public.profiles; today date; w record; got text;
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
  got := public.roll_drop(uid, 0.2);
  return jsonb_build_object('credits', w.reward, 'boosts', w.boosts, 'decoration', got);
end $$;
grant execute on function public.claim_flash() to authenticated;

-- What another player shows: only what makes you want to catch up. Never losses.
create or replace function public.public_profile(p_user uuid) returns jsonb
language plpgsql security definer stable set search_path = public as $$
declare me uuid := auth.uid(); p public.profiles; rel text; best bigint; wins bigint; cr bigint;
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
  cr := p.credits;
  return jsonb_build_object('id', p.id, 'name', nullif(p.display_name, ''), 'avatar', p.avatar, 'decoration', p.decoration,
    'level', public.level_of_xp(public.xp_of(p_user)), 'streak', p.streak, 'best_streak', p.best_streak,
    'best_win', coalesce(best, 0), 'month_wins', wins,
    'trophies', coalesce((select jsonb_agg(trophy_id order by earned_at desc) from (select trophy_id, earned_at from public.trophies where user_id = p_user order by earned_at desc limit 8) t), '[]'::jsonb),
    'trophy_count', (select count(*) from public.trophies where user_id = p_user),
    'balance', case when cr >= 5000 then (cr / 1000) * 1000 else null end,
    'relation', rel);
end $$;
grant execute on function public.public_profile(uuid) to authenticated;

create or replace function public.request_friend(p_user uuid) returns text
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'not_authenticated'; end if;
  if not public.is_registered() then raise exception 'registration_required'; end if;
  if p_user = me or not exists (select 1 from public.profiles where id = p_user) then raise exception 'bad_user'; end if;
  if exists (select 1 from public.friendships where user_id = me and friend_id = p_user) then return 'friends'; end if;
  if exists (select 1 from public.friend_requests where from_id = p_user and to_id = me) then
    delete from public.friend_requests where from_id = p_user and to_id = me;
    perform public.add_friendship(me, p_user);
    return 'friends';
  end if;
  if (select count(*) from public.friend_requests where from_id = me) >= 50 then raise exception 'too_many_requests'; end if;
  insert into public.friend_requests (from_id, to_id) values (me, p_user) on conflict do nothing;
  return 'sent';
end $$;
grant execute on function public.request_friend(uuid) to authenticated;

create or replace function public.respond_friend(p_user uuid, p_accept boolean) returns void
language plpgsql security definer set search_path = public as $$
declare me uuid := auth.uid();
begin
  if me is null then raise exception 'not_authenticated'; end if;
  if exists (select 1 from public.friend_requests where from_id = p_user and to_id = me) then
    delete from public.friend_requests where from_id = p_user and to_id = me;
    if p_accept then perform public.add_friendship(me, p_user); end if;
  end if;
end $$;
grant execute on function public.respond_friend(uuid, boolean) to authenticated;

create or replace function public.friend_requests_in() returns table(user_id uuid, display_name text, created_at timestamptz)
language sql security definer stable set search_path = public as $$
  select r.from_id, nullif(p.display_name, ''), r.created_at from public.friend_requests r join public.profiles p on p.id = r.from_id
  where r.to_id = auth.uid() order by r.created_at desc
$$;
grant execute on function public.friend_requests_in() to authenticated;
