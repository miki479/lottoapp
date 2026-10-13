-- Messages from the team shown inside the app (the same text that goes out as a push), until the player dismisses them.
create table if not exists public.user_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  heading text not null,
  body text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);
create index if not exists user_messages_unread on public.user_messages (user_id) where read_at is null;
alter table public.user_messages enable row level security;
revoke all on public.user_messages from anon, authenticated;

create or replace function public.my_messages() returns table(id uuid, heading text, body text, created_at timestamptz)
language sql stable security definer set search_path = public as $$
  select m.id, m.heading, m.body, m.created_at from public.user_messages m where m.user_id = auth.uid() and m.read_at is null order by m.created_at desc limit 5;
$$;
grant execute on function public.my_messages() to authenticated;

create or replace function public.read_message(p_id uuid) returns void
language sql security definer set search_path = public as $$
  update public.user_messages set read_at = now() where id = p_id and user_id = auth.uid() and read_at is null;
$$;
grant execute on function public.read_message(uuid) to authenticated;
