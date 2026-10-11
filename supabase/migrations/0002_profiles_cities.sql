-- Cities are defined in /cities/*.json; this table mirrors the bits the server must trust
-- (the timezone behind the daily refill). Filled by scripts/sync-cities.mjs.
create table public.cities (
  id text primary key,
  country text not null,
  timezone text not null,
  default_locale text not null
);
alter table public.cities enable row level security;
create policy "cities are public" on public.cities for select using (true);

-- Create the wallet of a new player (guests included). Idempotent.
-- The timezone is copied from the city and can never be changed by the client,
-- otherwise hopping timezones would farm daily refills.
create or replace function public.ensure_profile(p_city text, p_locale text, p_country text)
returns public.profiles
language plpgsql security definer set search_path = public as $$
declare
  prof public.profiles;
  c public.cities;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select * into prof from public.profiles where id = auth.uid();
  if found then return prof; end if;
  select * into c from public.cities where id = p_city;
  if not found then select * into c from public.cities order by id limit 1; end if;
  if not found then raise exception 'no_cities'; end if;
  insert into public.profiles (id, locale, country, city_id, timezone)
  values (
    auth.uid(),
    case when p_locale in ('it','en-US','en-GB','ja') then p_locale else 'en-US' end,
    case when p_country ~ '^[A-Za-z]{2}$' then upper(p_country) else null end,
    c.id, c.timezone
  ) returning * into prof;
  return prof;
end $$;
grant execute on function public.ensure_profile(text, text, text) to authenticated;

-- Switching city never changes the refill timezone.
create or replace function public.set_city(p_city text)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.cities where id = p_city) then raise exception 'unknown_city'; end if;
  update public.profiles set city_id = p_city where id = auth.uid();
end $$;
grant execute on function public.set_city(text) to authenticated;
