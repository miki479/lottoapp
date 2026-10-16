-- The feed also lists the open 'friends' challenges I made myself (so I see what my friends see).
create or replace function public.friends_challenges_feed() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(public.challenge_view(c) order by c.closes_at), '[]'::jsonb)
  from (
    select c.* from public.friend_challenges c
    where c.visibility = 'friends' and c.status = 'open' and c.closes_at > now()
      and (c.creator = auth.uid() or (
        exists (select 1 from public.friendships f where f.user_id = auth.uid() and f.friend_id = c.creator)
        and not exists (select 1 from public.friend_picks p where p.challenge_id = c.id and p.user_id = auth.uid())))
    order by c.closes_at limit 30) c;
$$;
grant execute on function public.friends_challenges_feed() to authenticated;
