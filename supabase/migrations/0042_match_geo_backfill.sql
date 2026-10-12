-- Match markets created before their club's town was known get their coordinates afterwards.
create or replace function public.backfill_match_geo() returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  update public.markets m set lat = g.lat, lon = g.lon, params = m.params || '{"local":"true"}'::jsonb
  from public.team_geo g
  where m.kind = 'match_bet' and m.lat is null and g.lat is not null and m.params->>'home' = g.team and m.status = 'open';
  get diagnostics n = row_count;
  return n;
end $$;
revoke execute on function public.backfill_match_geo() from public, anon, authenticated;
select public.backfill_match_geo();
