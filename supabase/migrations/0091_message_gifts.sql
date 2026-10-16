-- A team message can carry gifts (credits, boosts, a decoration) so the app shows them as a reward screen at start.
alter table public.user_messages add column if not exists gifts jsonb;
drop function if exists public.my_messages();
create or replace function public.my_messages() returns table(id uuid, heading text, body text, created_at timestamptz, gifts jsonb)
language sql stable security definer set search_path = public as $$
  select m.id, m.heading, m.body, m.created_at, m.gifts from public.user_messages m where m.user_id = auth.uid() and m.read_at is null order by m.created_at desc limit 5;
$$;
grant execute on function public.my_messages() to authenticated;
