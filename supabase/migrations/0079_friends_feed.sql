-- A third visibility for challenges: 'friends' — behaves like a private one (stake, who judges) but every friend of the creator sees it in their feed.
alter table public.friend_challenges drop constraint if exists friend_challenges_visibility_check;
alter table public.friend_challenges add constraint friend_challenges_visibility_check check (visibility in ('private','public','friends'));

do $$
declare def text;
begin
  select pg_get_functiondef('public.create_challenge(text,text,integer,timestamptz,text,text,boolean)'::regprocedure) into def;
  def := replace(def, $a$p_visibility not in ('private','public')$a$, $a$p_visibility not in ('private','public','friends')$a$);
  if position($a$'friends')$a$ in def) = 0 then raise exception 'patch did not apply'; end if;
  execute def;
end $$;

-- Open challenges made by my friends for their friends that I have not joined yet.
create or replace function public.friends_challenges_feed() returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(public.challenge_view(c) order by c.closes_at), '[]'::jsonb)
  from (
    select c.* from public.friend_challenges c
    where c.visibility = 'friends' and c.status = 'open' and c.closes_at > now()
      and c.creator <> auth.uid()
      and exists (select 1 from public.friendships f where f.user_id = auth.uid() and f.friend_id = c.creator)
      and not exists (select 1 from public.friend_picks p where p.challenge_id = c.id and p.user_id = auth.uid())
    order by c.closes_at limit 30) c;
$$;
grant execute on function public.friends_challenges_feed() to authenticated;
