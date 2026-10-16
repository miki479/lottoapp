-- Friend requests made to cope with many of them: a sender can ask at most 30 players a day, and the receiver can turn them all down at once.
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
  if (select count(*) from public.friend_requests where from_id = me and created_at > now() - interval '1 day') >= 30 then raise exception 'too_many_requests'; end if;
  insert into public.friend_requests (from_id, to_id) values (me, p_user) on conflict do nothing;
  return 'sent';
end $$;
grant execute on function public.request_friend(uuid) to authenticated;

create or replace function public.decline_all_friend_requests() returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  with d as (delete from public.friend_requests where to_id = auth.uid() returning 1) select count(*) into n from d;
  return n;
end $$;
grant execute on function public.decline_all_friend_requests() to authenticated;

create or replace function public.friend_requests_in() returns table(user_id uuid, display_name text, created_at timestamptz)
language sql security definer stable set search_path = public as $$
  select r.from_id, nullif(p.display_name, ''), r.created_at from public.friend_requests r join public.profiles p on p.id = r.from_id
  where r.to_id = auth.uid() order by r.created_at desc limit 300
$$;
grant execute on function public.friend_requests_in() to authenticated;
