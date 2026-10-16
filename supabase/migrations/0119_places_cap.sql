-- Room for the seeded capitals and big towns (about 170 permanent places): the limit of active places goes from 300 to 500 (ingest reads up to 500 too).
create or replace function public.ensure_place(p_name text, p_admin text, p_country text, p_lat numeric, p_lon numeric, p_tz text)
returns text
language plpgsql security definer set search_path = public as $$
declare pid text; ex public.places; nm text := trim(coalesce(p_name, ''));
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if char_length(nm) < 1 or char_length(nm) > 80 or nm ~ '[<>]' then raise exception 'bad_place'; end if;
  if p_lat is null or p_lon is null or p_lat not between -90 and 90 or p_lon not between -180 and 180 then raise exception 'bad_place'; end if;
  if p_country is null or p_country !~ '^[A-Za-z]{2}$' then raise exception 'bad_place'; end if;
  if not exists (select 1 from pg_timezone_names where name = p_tz) then raise exception 'bad_place'; end if;
  pid := 'p-' || round(p_lat, 2)::text || '_' || round(p_lon, 2)::text;
  select * into ex from public.places where id = pid;
  if not found then
    if (select count(*) from public.places where created_by = auth.uid() and created_at > now() - interval '1 day') >= 5 then raise exception 'places_limit'; end if;
    if (select count(*) from public.places where last_used_at > now() - interval '3 days') >= 500 then raise exception 'places_full'; end if;
    insert into public.places (id, name, admin, country, lat, lon, timezone, created_by)
    values (pid, left(nm, 80), left(nullif(trim(p_admin), ''), 80), upper(p_country), round(p_lat, 5), round(p_lon, 5), p_tz, auth.uid());
  elsif ex.last_used_at < now() - interval '30 minutes' then
    update public.places set last_used_at = now() where id = pid;
  end if;
  perform public.make_place_markets(pid);
  return pid;
end $$;
revoke execute on function public.ensure_place(text, text, text, numeric, numeric, text) from public, anon;
grant execute on function public.ensure_place(text, text, text, numeric, numeric, text) to authenticated;
