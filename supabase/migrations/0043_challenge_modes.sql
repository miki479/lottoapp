-- Friend challenges: who judges, and who can see them.
--  * judge 'creator': the creator decides but cannot bet (no conflict of interest).
--  * judge 'vote': everybody who bet votes the result after closing; majority wins, a tie voids; the creator may bet.
--  * visibility 'private' (link only, light filter) or 'public' (shown to people nearby; strict filter, no stake, always a vote).
-- A public challenge grows its reach with real participation: 30 km, then 150 km at 10 players, the whole country at 40,
-- the world at 150 (only if the creator allowed it).
alter table public.friend_challenges add column if not exists judge_mode text not null default 'creator' check (judge_mode in ('creator','vote'));
alter table public.friend_challenges add column if not exists visibility text not null default 'private' check (visibility in ('private','public'));
alter table public.friend_challenges add column if not exists world_opt boolean not null default false;
alter table public.friend_challenges add column if not exists lat numeric(8,5);
alter table public.friend_challenges add column if not exists lon numeric(8,5);
alter table public.friend_challenges add column if not exists country text;

create table if not exists public.friend_votes (
  challenge_id uuid not null references public.friend_challenges(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  outcome text not null check (outcome in ('yes','no')),
  created_at timestamptz not null default now(),
  primary key (challenge_id, user_id)
);
alter table public.friend_votes enable row level security;
revoke all on public.friend_votes from anon, authenticated;

-- Very serious things are refused everywhere, also between friends.
create or replace function public.severe_check(p text) returns boolean
language sql immutable as $$
  select public.mod_prep(p) ~ '(nazi|hitler|stupr|violenz|pedofil|suicid|terror|strage|attentat|ammazz|uccid|bombard|sparator|negro|frocio|ricchion|rape|kill|bomb|shooting|massacre)';
$$;

drop function if exists public.create_challenge(text, text, integer, timestamptz);
create or replace function public.create_challenge(p_title text, p_category text, p_stake integer, p_closes_at timestamptz,
  p_judge text default 'creator', p_visibility text default 'private', p_world boolean default false)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); t text := trim(regexp_replace(coalesce(p_title, ''), '\s+', ' ', 'g')); hit text; c text; ch public.friend_challenges; hp public.places; judge text := p_judge; stake integer := p_stake;
  cats constant text[] := array['friends','family','work','dinner','trip','sport','games','home','school','party','music','food','pets','tech','money_fun','random'];
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if not public.is_registered() then raise exception 'registration_required'; end if;
  if char_length(t) < 8 or char_length(t) > 120 or t ~ '[<>]' then raise exception 'bad_title'; end if;
  if not (p_category = any (cats)) then raise exception 'bad_category'; end if;
  if p_judge not in ('creator','vote') or p_visibility not in ('private','public') then raise exception 'bad_mode'; end if;
  if stake not in (0, 10, 25, 50) then raise exception 'bad_stake'; end if;
  if p_closes_at < now() + interval '10 minutes' or p_closes_at > now() + interval '30 days' then raise exception 'bad_time'; end if;
  if public.severe_check(t) then
    insert into public.moderation_log (user_id, text, matched, source) select uid, left(t, 40), 'severe', 'challenge' where (select count(*) from public.moderation_log where created_at > now() - interval '1 hour') < 60;
    raise exception 'title_not_allowed';
  end if;
  if p_visibility = 'public' then
    -- public: full word filter, no links/contacts, a home town to place it, no stake, always decided by vote, not for brand-new accounts
    hit := public.mod_check(t);
    if hit is not null or t ~* '(https?://|www\.|@[a-z0-9_]{3,}|\+?\d[\d ]{8,})' then
      insert into public.moderation_log (user_id, text, matched, source) select uid, left(t, 40), coalesce(hit, 'link'), 'challenge' where (select count(*) from public.moderation_log where created_at > now() - interval '1 hour') < 60;
      raise exception 'title_not_allowed';
    end if;
    select pl.* into hp from public.profiles pr join public.places pl on pl.id = pr.home_place where pr.id = uid;
    if not found then raise exception 'home_required'; end if;
    if (select created_at from auth.users where id = uid) > now() - interval '6 hours' then raise exception 'account_too_new'; end if;
    if (select count(*) from public.friend_challenges where creator = uid and visibility = 'public' and created_at > now() - interval '1 day') >= 3 then raise exception 'limit'; end if;
    judge := 'vote'; stake := 0;
  end if;
  if (select count(*) from public.friend_challenges where creator = uid and created_at > now() - interval '1 day') >= 5 then raise exception 'limit'; end if;
  if (select count(*) from public.friend_challenges where creator = uid and status = 'open') >= 10 then raise exception 'too_many_open'; end if;
  c := substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
  insert into public.friend_challenges (code, creator, title, category, stake, closes_at, judge_mode, visibility, world_opt, lat, lon, country)
  values (lower(c), uid, t, p_category, stake, p_closes_at, judge, p_visibility, p_visibility = 'public' and coalesce(p_world, false), hp.lat, hp.lon, hp.country) returning * into ch;
  return jsonb_build_object('id', ch.id, 'code', ch.code);
end $$;
grant execute on function public.create_challenge(text, text, integer, timestamptz, text, text, boolean) to authenticated;

create or replace function public.challenge_view(ch public.friend_challenges) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', ch.id, 'code', ch.code, 'title', ch.title, 'category', ch.category, 'stake', ch.stake, 'closes_at', ch.closes_at,
    'status', ch.status, 'outcome', ch.outcome, 'judge_mode', ch.judge_mode, 'visibility', ch.visibility, 'world_opt', ch.world_opt,
    'creator', coalesce((select display_name from public.profiles where id = ch.creator), ''),
    'is_creator', ch.creator = auth.uid(),
    'my_pick', (select pick from public.friend_picks where challenge_id = ch.id and user_id = auth.uid()),
    'my_payout', (select payout from public.friend_picks where challenge_id = ch.id and user_id = auth.uid()),
    'my_vote', (select outcome from public.friend_votes where challenge_id = ch.id and user_id = auth.uid()),
    'voted', (select count(*) from public.friend_votes where challenge_id = ch.id),
    'yes', (select count(*) from public.friend_picks where challenge_id = ch.id and pick = 'yes'),
    'no', (select count(*) from public.friend_picks where challenge_id = ch.id and pick = 'no'),
    'pot', (select coalesce(sum(stake), 0) from public.friend_picks where challenge_id = ch.id),
    'people', case when now() >= ch.closes_at or ch.status <> 'open' then
      (select coalesce(jsonb_agg(jsonb_build_object('name', coalesce(nullif(p.display_name, ''), '?'), 'pick', fp.pick, 'payout', fp.payout) order by fp.created_at), '[]'::jsonb)
         from public.friend_picks fp join public.profiles p on p.id = fp.user_id where fp.challenge_id = ch.id) else '[]'::jsonb end);
$$;

create or replace function public.pick_challenge(p_code text, p_pick text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); ch public.friend_challenges; prof public.profiles;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if not public.is_registered() then raise exception 'registration_required'; end if;
  if p_pick not in ('yes','no') then raise exception 'bad_pick'; end if;
  select * into ch from public.friend_challenges where code = lower(trim(p_code)) for update;
  if not found then raise exception 'unknown_challenge'; end if;
  if ch.status <> 'open' or now() >= ch.closes_at then raise exception 'challenge_closed'; end if;
  if ch.judge_mode = 'creator' and ch.creator = uid then raise exception 'judge_cannot_bet'; end if;
  if exists (select 1 from public.friend_picks where challenge_id = ch.id and user_id = uid) then raise exception 'already_picked'; end if;
  if (select count(*) from public.friend_picks where challenge_id = ch.id) >= (case when ch.visibility = 'public' then 500 else 20 end) then raise exception 'challenge_full'; end if;
  select * into prof from public.profiles where id = uid for update;
  if prof.credits < ch.stake then raise exception 'insufficient_credits'; end if;
  if ch.stake > 0 then update public.profiles set credits = credits - ch.stake where id = uid; end if;
  insert into public.friend_picks (challenge_id, user_id, pick, stake) values (ch.id, uid, p_pick, ch.stake);
  return public.challenge_view(ch);
end $$;

create or replace function public.resolve_challenge(p_code text, p_outcome text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare ch public.friend_challenges;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if p_outcome not in ('yes','no','void') then raise exception 'bad_outcome'; end if;
  select * into ch from public.friend_challenges where code = lower(trim(p_code));
  if not found then raise exception 'unknown_challenge'; end if;
  if ch.judge_mode <> 'creator' then raise exception 'decided_by_vote'; end if;
  if ch.creator <> auth.uid() then raise exception 'not_judge'; end if;
  if now() < ch.closes_at then raise exception 'not_closed_yet'; end if;
  perform public.settle_challenge(ch.id, p_outcome);
  select * into ch from public.friend_challenges where id = ch.id;
  return public.challenge_view(ch);
end $$;

-- Majority of the votes once everybody voted or 24 hours after closing; a tie or no votes voids and refunds.
create or replace function public.tally_challenge(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare ch public.friend_challenges; players integer; yv integer; nv integer;
begin
  select * into ch from public.friend_challenges where id = p_id for update;
  if not found or ch.status <> 'open' or ch.judge_mode <> 'vote' or now() < ch.closes_at then return; end if;
  select count(*) into players from public.friend_picks where challenge_id = ch.id;
  select count(*) filter (where outcome = 'yes'), count(*) filter (where outcome = 'no') into yv, nv from public.friend_votes where challenge_id = ch.id;
  if yv + nv < players and now() < ch.closes_at + interval '24 hours' then return; end if;
  perform public.settle_challenge(ch.id, case when yv > nv then 'yes' when nv > yv then 'no' else 'void' end);
end $$;
revoke execute on function public.tally_challenge(uuid) from public, anon, authenticated;

create or replace function public.vote_challenge(p_code text, p_outcome text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare ch public.friend_challenges;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if p_outcome not in ('yes','no') then raise exception 'bad_outcome'; end if;
  select * into ch from public.friend_challenges where code = lower(trim(p_code));
  if not found then raise exception 'unknown_challenge'; end if;
  if ch.judge_mode <> 'vote' then raise exception 'decided_by_judge'; end if;
  if ch.status <> 'open' or now() < ch.closes_at then raise exception 'not_closed_yet'; end if;
  if not exists (select 1 from public.friend_picks where challenge_id = ch.id and user_id = auth.uid()) then raise exception 'not_a_player'; end if;
  insert into public.friend_votes (challenge_id, user_id, outcome) values (ch.id, auth.uid(), p_outcome) on conflict do nothing;
  perform public.tally_challenge(ch.id);
  select * into ch from public.friend_challenges where id = ch.id;
  return public.challenge_view(ch);
end $$;
grant execute on function public.vote_challenge(text, text) to authenticated;

create or replace function public.auto_void_challenges() returns integer
language plpgsql security definer set search_path = public as $$
declare r record; n integer := 0;
begin
  for r in select id from public.friend_challenges where status = 'open' and judge_mode = 'creator' and closes_at < now() - interval '3 days' loop
    perform public.settle_challenge(r.id, 'void'); n := n + 1;
  end loop;
  for r in select id from public.friend_challenges where status = 'open' and judge_mode = 'vote' and closes_at < now() - interval '24 hours' loop
    perform public.tally_challenge(r.id); n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function public.auto_void_challenges() from public, anon, authenticated;

-- Public challenges around a point; reach grows with real participation (see the header).
create or replace function public.nearby_challenges(p_lat numeric, p_lon numeric, p_country text default null, p_limit integer default 10)
returns table (challenge jsonb, km numeric, players bigint)
language sql stable security definer set search_path = public as $$
  select public.challenge_view(c), round(public.km_between(p_lat, p_lon, c.lat, c.lon), 1), n.players
  from public.friend_challenges c
  cross join lateral (select count(*) players from public.friend_picks where challenge_id = c.id) n
  where c.visibility = 'public' and c.status = 'open' and c.closes_at > now() and c.lat is not null
    and not exists (select 1 from public.reports r where r.market_id = c.id)
    and (public.km_between(p_lat, p_lon, c.lat, c.lon) <= 30
      or (n.players >= 10 and public.km_between(p_lat, p_lon, c.lat, c.lon) <= 150)
      or (n.players >= 40 and p_country is not null and c.country = upper(p_country))
      or (n.players >= 150 and c.world_opt))
  order by (1 + n.players) / (1 + public.km_between(p_lat, p_lon, c.lat, c.lon) / 15.0) desc, c.closes_at
  limit least(greatest(p_limit, 1), 20);
$$;
grant execute on function public.nearby_challenges(numeric, numeric, text, integer) to anon, authenticated;
