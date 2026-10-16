-- Friends. Whoever accepts your invite becomes your friend automatically (both ways); either side can remove the tie.
-- Friends show up in the "Amici" ranking and can be invited to a friend challenge.
create table if not exists public.friendships (
  user_id uuid not null references public.profiles(id) on delete cascade,
  friend_id uuid not null references public.profiles(id) on delete cascade,
  source text not null default 'invite' check (source in ('invite')),
  created_at timestamptz not null default now(),
  primary key (user_id, friend_id),
  check (user_id <> friend_id)
);
create index if not exists friendships_friend on public.friendships (friend_id);
alter table public.friendships enable row level security;
revoke all on public.friendships from anon, authenticated;

-- Internal: the tie always exists in both directions.
create or replace function public.add_friendship(a uuid, b uuid) returns void
language sql security definer set search_path = public as $$
  insert into public.friendships (user_id, friend_id) values (a, b), (b, a) on conflict do nothing;
$$;
revoke execute on function public.add_friendship(uuid, uuid) from public, anon, authenticated;

-- Those who were already invited before this existed are friends too.
insert into public.friendships (user_id, friend_id)
  select referred_by, id from public.profiles where referred_by is not null and referred_by <> id
  union select id, referred_by from public.profiles where referred_by is not null and referred_by <> id
on conflict do nothing;

-- Accepting an invite code: still once, never your own; now it also makes you friends.
create or replace function public.redeem_referral(p_code text) returns boolean
language plpgsql security definer set search_path = public as $$
declare inviter uuid;
begin
  if not public.is_registered() then raise exception 'registration_required'; end if;
  select id into inviter from public.profiles where referral_code = upper(trim(p_code));
  if inviter is null or inviter = auth.uid() then return false; end if;
  update public.profiles set referred_by = inviter where id = auth.uid() and referred_by is null;
  if not found then return false; end if;
  perform public.add_friendship(inviter, auth.uid());
  return true;
end $$;
grant execute on function public.redeem_referral(text) to authenticated;

-- Me and my friends, ranked by this month's net credits (same rule as the other rankings). Friends without bets are listed too.
create or replace function public.friends_board()
returns table(rank bigint, user_id uuid, display_name text, score bigint, bets bigint, streak integer, is_me boolean, since timestamptz)
language sql security definer stable set search_path = public as $$
  with ids as (
    select auth.uid() as id, null::timestamptz as since
    union all select friend_id, created_at from public.friendships where user_id = auth.uid()
  ), ev as (
    select user_id, status, stake, payout, settled_at from public.bets where status <> 'open'
    union all select user_id, status, stake, payout, settled_at from public.parlays where status <> 'open'
  ), s as (
    select p.id, nullif(p.display_name, '') as display_name, p.streak, ids.since,
           coalesce(sum(case b.status when 'won' then b.payout - b.stake when 'lost' then -b.stake else 0 end), 0)::bigint as score,
           count(b.status) filter (where b.status in ('won','lost')) as bets
    from ids join public.profiles p on p.id = ids.id
    left join ev b on b.user_id = p.id and b.settled_at >= date_trunc('month', now())
    where auth.uid() is not null
    group by p.id, p.display_name, p.streak, ids.since
  )
  select rank() over (order by score desc, bets desc), id, display_name, score, bets, streak, id = auth.uid(), since
  from s order by 1, display_name nulls last, id;
$$;
grant execute on function public.friends_board() to authenticated;

create or replace function public.remove_friend(p_friend uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  delete from public.friendships where (user_id = auth.uid() and friend_id = p_friend) or (user_id = p_friend and friend_id = auth.uid());
  delete from public.challenge_invites ci using public.friend_challenges ch
   where ci.challenge_id = ch.id and ch.status = 'open'
     and ((ci.user_id = auth.uid() and ci.invited_by = p_friend) or (ci.user_id = p_friend and ci.invited_by = auth.uid()));
end $$;
grant execute on function public.remove_friend(uuid) to authenticated;

-- Invites to a friend challenge: only to my own friends, only while it is open.
create table if not exists public.challenge_invites (
  challenge_id uuid not null references public.friend_challenges(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  invited_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  notified boolean not null default false,
  primary key (challenge_id, user_id)
);
create index if not exists challenge_invites_user on public.challenge_invites (user_id, created_at desc);
alter table public.challenge_invites enable row level security;
revoke all on public.challenge_invites from anon, authenticated;

-- Who can be invited: the creator, or anyone already in the challenge. Returns how many invites were new.
create or replace function public.invite_friends(p_code text, p_friends uuid[]) returns integer
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); ch public.friend_challenges; f uuid; n integer := 0; today integer;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if not public.is_registered() then raise exception 'registration_required'; end if;
  if p_friends is null or array_length(p_friends, 1) is null then return 0; end if;
  if array_length(p_friends, 1) > 20 then raise exception 'too_many_invites'; end if;
  select * into ch from public.friend_challenges where code = lower(trim(p_code));
  if not found then raise exception 'unknown_challenge'; end if;
  if ch.status <> 'open' or now() >= ch.closes_at then raise exception 'challenge_closed'; end if;
  if ch.creator <> uid and not exists (select 1 from public.friend_picks where challenge_id = ch.id and user_id = uid) then raise exception 'not_in_challenge'; end if;
  select count(*) into today from public.challenge_invites where invited_by = uid and created_at > now() - interval '1 day';
  if today + array_length(p_friends, 1) > 60 then raise exception 'invite_limit'; end if;
  foreach f in array p_friends loop
    continue when f = uid or f = ch.creator;
    continue when not exists (select 1 from public.friendships where user_id = uid and friend_id = f);
    continue when exists (select 1 from public.friend_picks where challenge_id = ch.id and user_id = f);
    insert into public.challenge_invites (challenge_id, user_id, invited_by) values (ch.id, f, uid) on conflict do nothing;
    if found then n := n + 1; end if;
  end loop;
  return n;
end $$;
grant execute on function public.invite_friends(text, uuid[]) to authenticated;

-- Open challenges I was invited to and have not joined yet (a judge-creator's own never shows).
create or replace function public.my_invites() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(public.challenge_view(c.ch) || jsonb_build_object('invited_by', c.who) order by c.at desc), '[]'::jsonb) from (
    select ch as ch, coalesce(nullif(p.display_name, ''), '') as who, ci.created_at as at
    from public.challenge_invites ci
    join public.friend_challenges ch on ch.id = ci.challenge_id
    join public.profiles p on p.id = ci.invited_by
    where ci.user_id = auth.uid() and ch.status = 'open' and ch.closes_at > now()
      and not exists (select 1 from public.friend_picks fp where fp.challenge_id = ch.id and fp.user_id = auth.uid())
    order by ci.created_at desc limit 20) c;
$$;
grant execute on function public.my_invites() to authenticated;

-- Friends of mine who are already in a challenge or invited to it (so the picker can grey them out).
create or replace function public.challenge_friend_state(p_code text) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(x.fid), '[]'::jsonb) from (
    select distinct fid from (
      select ci.user_id as fid from public.challenge_invites ci join public.friend_challenges ch on ch.id = ci.challenge_id where ch.code = lower(trim(p_code))
      union all select fp.user_id from public.friend_picks fp join public.friend_challenges ch on ch.id = fp.challenge_id where ch.code = lower(trim(p_code))
    ) y where fid in (select friend_id from public.friendships where user_id = auth.uid())
  ) x;
$$;
grant execute on function public.challenge_friend_state(text) to authenticated;

-- Invites older than a few days are of no use.
select cron.unschedule(jobid) from cron.job where jobname = 'prune';
select cron.schedule('prune', '17 3 * * *', $$
  delete from public.delay_observations where observed_at < now() - interval '2 days';
  delete from public.weather_observations where hour_start < now() - interval '3 days';
  delete from public.metric_observations where hour_start < now() - interval '3 days';
  delete from public.traffic_observations where hour_start < now() - interval '3 days';
  delete from public.tick_observations where at < now() - interval '3 days';
  delete from public.tick_history where at < now() - interval '30 days';
  delete from public.match_results where kickoff < now() - interval '5 days';
  delete from public.match_details where kickoff < now() - interval '5 days';
  delete from public.team_form where kickoff < now() - interval '400 days';
  delete from public.challenge_invites where created_at < now() - interval '30 days';
  delete from public.trip_schedule where service_date < current_date - 1;
$$);
