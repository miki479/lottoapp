-- Who bought the Limit Breaker in the last 24 hours: shown on the moving strip under the top bar. Only the display name and the time are exposed.
create or replace function public.recent_limit_breaks() returns table(who text, at timestamptz)
language sql stable security definer set search_path = public as $$
  select p.display_name, l.created_at
  from public.shop_supply_log l join public.profiles p on p.id = l.user_id
  where l.item = 'limit_break' and l.created_at > now() - interval '24 hours' and p.display_name is not null
  order by l.created_at desc limit 3
$$;
grant execute on function public.recent_limit_breaks() to anon, authenticated;
