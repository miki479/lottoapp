-- The results a player has already looked at are remembered on the account, not only on the phone: a new device or a cleared browser no longer brings old results back.
alter table public.profiles add column if not exists results_seen_at timestamptz;
create or replace function public.mark_results_seen() returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  update public.profiles set results_seen_at = now() where id = auth.uid();
end $$;
revoke all on function public.mark_results_seen() from public, anon;
grant execute on function public.mark_results_seen() to authenticated;
