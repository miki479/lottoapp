-- Friends' big wins: an optional push (at most 2 optional pushes a day, never at night) when a friend wins 3,000 or more in one bet.
alter table public.profiles add column if not exists push_friends boolean not null default false;
alter table public.bets add column if not exists big_notified boolean not null default false;
create index if not exists bets_big_win on public.bets (settled_at) where status = 'won' and not big_notified;

drop function if exists public.set_push_prefs(boolean, boolean);
create or replace function public.set_push_prefs(p_flash boolean, p_streak boolean, p_friends boolean default null) returns void
language sql security definer set search_path = public as $$
  update public.profiles set push_flash = p_flash, push_streak = p_streak, push_friends = coalesce(p_friends, push_friends) where id = auth.uid()
$$;
revoke execute on function public.set_push_prefs(boolean, boolean, boolean) from public, anon;
grant execute on function public.set_push_prefs(boolean, boolean, boolean) to authenticated;
