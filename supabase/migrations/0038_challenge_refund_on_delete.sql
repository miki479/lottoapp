-- If a challenge disappears while open (its judge deleted their account), everybody gets their stake back.
create or replace function public.refund_open_challenge() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.status = 'open' and old.stake > 0 then
    update public.profiles p set credits = p.credits + fp.stake from public.friend_picks fp where fp.challenge_id = old.id and fp.user_id = p.id and fp.stake > 0;
  end if;
  return old;
end $$;
drop trigger if exists friend_challenges_refund on public.friend_challenges;
create trigger friend_challenges_refund before delete on public.friend_challenges for each row execute function public.refund_open_challenge();
