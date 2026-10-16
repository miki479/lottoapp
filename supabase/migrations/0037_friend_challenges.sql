-- Friend challenges: a private question about anything personal ("Marco arriva in ritardo alla cena?").
-- Only people with the link can see it. The creator is the judge. Stakes are a fair pot: everybody puts in the same
-- play credits, winners split the pot, nobody creates credits out of nothing. Not part of the public rankings.
alter table public.moderation_log drop constraint if exists moderation_log_source_check;
alter table public.moderation_log add constraint moderation_log_source_check check (source in ('nickname','group','existing','challenge'));

create table if not exists public.friend_challenges (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  creator uuid not null references public.profiles(id) on delete cascade,
  title text not null check (char_length(title) between 8 and 120 and title !~ '[<>]'),
  category text not null,
  stake integer not null default 0 check (stake in (0, 10, 25, 50)),
  closes_at timestamptz not null,
  status text not null default 'open' check (status in ('open','resolved','void')),
  outcome text check (outcome in ('yes','no')),
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);
create table if not exists public.friend_picks (
  challenge_id uuid not null references public.friend_challenges(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  pick text not null check (pick in ('yes','no')),
  stake integer not null default 0,
  payout integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (challenge_id, user_id)
);
alter table public.friend_challenges enable row level security;
alter table public.friend_picks enable row level security;
revoke all on public.friend_challenges, public.friend_picks from anon, authenticated;
create index if not exists friend_picks_user on public.friend_picks (user_id);

create or replace function public.create_challenge(p_title text, p_category text, p_stake integer, p_closes_at timestamptz)
returns jsonb language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); t text := trim(regexp_replace(coalesce(p_title, ''), '\s+', ' ', 'g')); hit text; c text; ch public.friend_challenges;
  cats constant text[] := array['friends','family','work','dinner','trip','sport','games','home','school','party','music','food','pets','tech','money_fun','random'];
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if not public.is_registered() then raise exception 'registration_required'; end if;
  if char_length(t) < 8 or char_length(t) > 120 or t ~ '[<>]' then raise exception 'bad_title'; end if;
  if not (p_category = any (cats)) then raise exception 'bad_category'; end if;
  if p_stake not in (0, 10, 25, 50) then raise exception 'bad_stake'; end if;
  if p_closes_at < now() + interval '10 minutes' or p_closes_at > now() + interval '30 days' then raise exception 'bad_time'; end if;
  hit := public.mod_check(t);
  if hit is not null then
    if (select count(*) from public.moderation_log where created_at > now() - interval '1 hour') < 60 then
      insert into public.moderation_log (user_id, text, matched, source) values (uid, left(t, 40), hit, 'challenge');
    end if;
    raise exception 'title_not_allowed';
  end if;
  if (select count(*) from public.friend_challenges where creator = uid and created_at > now() - interval '1 day') >= 5 then raise exception 'limit'; end if;
  if (select count(*) from public.friend_challenges where creator = uid and status = 'open') >= 10 then raise exception 'too_many_open'; end if;
  c := substr(replace(gen_random_uuid()::text, '-', ''), 1, 8);
  insert into public.friend_challenges (code, creator, title, category, stake, closes_at) values (lower(c), uid, t, p_category, p_stake, p_closes_at) returning * into ch;
  return jsonb_build_object('id', ch.id, 'code', ch.code);
end $$;
grant execute on function public.create_challenge(text, text, integer, timestamptz) to authenticated;

create or replace function public.challenge_view(ch public.friend_challenges) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'id', ch.id, 'code', ch.code, 'title', ch.title, 'category', ch.category, 'stake', ch.stake, 'closes_at', ch.closes_at,
    'status', ch.status, 'outcome', ch.outcome,
    'creator', coalesce((select display_name from public.profiles where id = ch.creator), ''),
    'is_creator', ch.creator = auth.uid(),
    'my_pick', (select pick from public.friend_picks where challenge_id = ch.id and user_id = auth.uid()),
    'my_payout', (select payout from public.friend_picks where challenge_id = ch.id and user_id = auth.uid()),
    'yes', (select count(*) from public.friend_picks where challenge_id = ch.id and pick = 'yes'),
    'no', (select count(*) from public.friend_picks where challenge_id = ch.id and pick = 'no'),
    'pot', (select coalesce(sum(stake), 0) from public.friend_picks where challenge_id = ch.id),
    -- who picked what stays hidden until betting closes
    'people', case when now() >= ch.closes_at or ch.status <> 'open' then
      (select coalesce(jsonb_agg(jsonb_build_object('name', coalesce(nullif(p.display_name, ''), '?'), 'pick', fp.pick, 'payout', fp.payout) order by fp.created_at), '[]'::jsonb)
         from public.friend_picks fp join public.profiles p on p.id = fp.user_id where fp.challenge_id = ch.id) else '[]'::jsonb end);
$$;

create or replace function public.get_challenge(p_code text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare ch public.friend_challenges;
begin
  select * into ch from public.friend_challenges where code = lower(trim(p_code));
  if not found then return null; end if;
  return public.challenge_view(ch);
end $$;
grant execute on function public.get_challenge(text) to anon, authenticated;

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
  if exists (select 1 from public.friend_picks where challenge_id = ch.id and user_id = uid) then raise exception 'already_picked'; end if;
  if (select count(*) from public.friend_picks where challenge_id = ch.id) >= 20 then raise exception 'challenge_full'; end if;
  select * into prof from public.profiles where id = uid for update;
  if prof.credits < ch.stake then raise exception 'insufficient_credits'; end if;
  if ch.stake > 0 then update public.profiles set credits = credits - ch.stake where id = uid; end if;
  insert into public.friend_picks (challenge_id, user_id, pick, stake) values (ch.id, uid, p_pick, ch.stake);
  return public.challenge_view(ch);
end $$;
grant execute on function public.pick_challenge(text, text) to authenticated;

-- Pays the pot: winners split it equally (the remainder stays unpaid, never created); void or no winners refunds everybody.
create or replace function public.settle_challenge(p_id uuid, p_outcome text) returns void
language plpgsql security definer set search_path = public as $$
declare ch public.friend_challenges; winners integer; pot integer; share integer;
begin
  select * into ch from public.friend_challenges where id = p_id for update;
  if not found or ch.status <> 'open' then return; end if;
  select count(*) filter (where pick = p_outcome), coalesce(sum(stake), 0) into winners, pot from public.friend_picks where challenge_id = ch.id;
  if p_outcome = 'void' or winners = 0 then
    update public.friend_picks set payout = stake where challenge_id = ch.id;
    update public.profiles p set credits = p.credits + fp.stake from public.friend_picks fp where fp.challenge_id = ch.id and fp.user_id = p.id and fp.stake > 0;
    update public.friend_challenges set status = 'void', outcome = null, resolved_at = now() where id = ch.id;
  else
    share := pot / winners;
    update public.friend_picks set payout = case when pick = p_outcome then share else 0 end where challenge_id = ch.id;
    update public.profiles p set credits = p.credits + share from public.friend_picks fp where fp.challenge_id = ch.id and fp.user_id = p.id and fp.pick = p_outcome and share > 0;
    update public.friend_challenges set status = 'resolved', outcome = p_outcome, resolved_at = now() where id = ch.id;
  end if;
end $$;
revoke execute on function public.settle_challenge(uuid, text) from public, anon, authenticated;

create or replace function public.resolve_challenge(p_code text, p_outcome text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare ch public.friend_challenges;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if p_outcome not in ('yes','no','void') then raise exception 'bad_outcome'; end if;
  select * into ch from public.friend_challenges where code = lower(trim(p_code));
  if not found then raise exception 'unknown_challenge'; end if;
  if ch.creator <> auth.uid() then raise exception 'not_judge'; end if;
  if now() < ch.closes_at then raise exception 'not_closed_yet'; end if;
  perform public.settle_challenge(ch.id, p_outcome);
  select * into ch from public.friend_challenges where id = ch.id;
  return public.challenge_view(ch);
end $$;
grant execute on function public.resolve_challenge(text, text) to authenticated;

-- A judge who never decides must not hold everyone's credits: after 3 days the challenge is voided and refunded.
create or replace function public.auto_void_challenges() returns integer
language plpgsql security definer set search_path = public as $$
declare r record; n integer := 0;
begin
  for r in select id from public.friend_challenges where status = 'open' and closes_at < now() - interval '3 days' loop
    perform public.settle_challenge(r.id, 'void'); n := n + 1;
  end loop;
  return n;
end $$;
revoke execute on function public.auto_void_challenges() from public, anon, authenticated;
select cron.unschedule(jobid) from cron.job where jobname = 'challenge-void';
select cron.schedule('challenge-void', '23 * * * *', $$ select public.auto_void_challenges(); $$);

create or replace function public.my_challenges() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(public.challenge_view(c) order by c.created_at desc), '[]'::jsonb) from (
    select ch.* from public.friend_challenges ch
    where ch.creator = auth.uid() or exists (select 1 from public.friend_picks fp where fp.challenge_id = ch.id and fp.user_id = auth.uid())
    order by ch.created_at desc limit 30) c;
$$;
grant execute on function public.my_challenges() to authenticated;
