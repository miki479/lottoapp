-- A creator can take back a challenge that is still open. Nobody else joined: it simply disappears (the creator's own stake comes back).
-- Others joined: it is voided and every stake goes back in full (the people who joined did nothing wrong); the creator can do this 3 times a day.
alter table public.friend_challenges add column if not exists cancelled boolean not null default false;

create or replace function public.cancel_challenge(p_code text) returns text
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); ch public.friend_challenges; others integer;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  select * into ch from public.friend_challenges where code = lower(trim(p_code)) for update;
  if not found then raise exception 'unknown_challenge'; end if;
  if ch.creator <> uid then raise exception 'not_creator'; end if;
  if ch.status <> 'open' then raise exception 'challenge_closed'; end if;
  select count(*) into others from public.friend_picks where challenge_id = ch.id and user_id <> uid;
  if others = 0 then
    perform public.settle_challenge(ch.id, 'void');
    delete from public.friend_challenges where id = ch.id;
    return 'deleted';
  end if;
  if (select count(*) from public.friend_challenges where creator = uid and cancelled and resolved_at > now() - interval '1 day') >= 3 then raise exception 'limit'; end if;
  perform public.settle_challenge(ch.id, 'void');
  update public.friend_challenges set cancelled = true where id = ch.id;
  return 'voided';
end $$;
grant execute on function public.cancel_challenge(text) to authenticated;
