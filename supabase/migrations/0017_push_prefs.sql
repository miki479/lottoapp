-- Optional push categories (both off by default): flash events and a streak reminder. Results are always announced to those who opted in to push.
alter table public.profiles
  add column if not exists push_flash boolean not null default false,
  add column if not exists push_streak boolean not null default false,
  add column if not exists push_day date,                       -- local day of the last non-result push
  add column if not exists push_count integer not null default 0, -- non-result pushes sent that day (max 2)
  add column if not exists streak_push_day date;               -- placeholder
alter table public.markets add column if not exists flash_notified boolean not null default false;

create or replace function public.set_push_prefs(p_flash boolean, p_streak boolean) returns void
language sql security definer set search_path = public as $$
  update public.profiles set push_flash = p_flash, push_streak = p_streak where id = auth.uid()
$$;
revoke execute on function public.set_push_prefs(boolean, boolean) from public, anon;
grant execute on function public.set_push_prefs(boolean, boolean) to authenticated;
