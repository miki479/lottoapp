-- For each of my friends: already playing this challenge ('joined') or only invited ('invited').
create or replace function public.challenge_friend_state2(p_code text) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', x.fid, 'state', x.st)), '[]'::jsonb) from (
    select fid, case when bool_or(joined) then 'joined' else 'invited' end st from (
      select ci.user_id as fid, false as joined from public.challenge_invites ci join public.friend_challenges ch on ch.id = ci.challenge_id where ch.code = lower(trim(p_code))
      union all select fp.user_id, true from public.friend_picks fp join public.friend_challenges ch on ch.id = fp.challenge_id where ch.code = lower(trim(p_code))
    ) y where fid in (select friend_id from public.friendships where user_id = auth.uid()) group by fid
  ) x;
$$;
grant execute on function public.challenge_friend_state2(text) to authenticated;
