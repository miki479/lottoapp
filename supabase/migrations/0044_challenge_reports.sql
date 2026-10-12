-- Players can report a public challenge; two reports take it out of the nearby lists until an admin looks.
create table if not exists public.challenge_reports (
  challenge_id uuid not null references public.friend_challenges(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  at timestamptz not null default now(),
  primary key (challenge_id, user_id)
);
alter table public.challenge_reports enable row level security;
revoke all on public.challenge_reports from anon, authenticated;

create or replace function public.report_challenge(p_code text) returns void
language plpgsql security definer set search_path = public as $$
declare id uuid;
begin
  if auth.uid() is null then return; end if;
  if (select count(*) from public.challenge_reports where user_id = auth.uid() and at > now() - interval '1 day') >= 10 then return; end if;
  select c.id into id from public.friend_challenges c where c.code = lower(trim(p_code));
  if id is null then return; end if;
  insert into public.challenge_reports (challenge_id, user_id) values (id, auth.uid()) on conflict do nothing;
end $$;
grant execute on function public.report_challenge(text) to authenticated;

create or replace function public.nearby_challenges(p_lat numeric, p_lon numeric, p_country text default null, p_limit integer default 10)
returns table (challenge jsonb, km numeric, players bigint)
language sql stable security definer set search_path = public as $$
  select public.challenge_view(c), round(public.km_between(p_lat, p_lon, c.lat, c.lon), 1), n.players
  from public.friend_challenges c
  cross join lateral (select count(*) players from public.friend_picks where challenge_id = c.id) n
  where c.visibility = 'public' and c.status = 'open' and c.closes_at > now() and c.lat is not null
    and (select count(*) from public.challenge_reports r where r.challenge_id = c.id) < 2
    and (public.km_between(p_lat, p_lon, c.lat, c.lon) <= 30
      or (n.players >= 10 and public.km_between(p_lat, p_lon, c.lat, c.lon) <= 150)
      or (n.players >= 40 and p_country is not null and c.country = upper(p_country))
      or (n.players >= 150 and c.world_opt))
  order by (1 + n.players) / (1 + public.km_between(p_lat, p_lon, c.lat, c.lon) / 15.0) desc, c.closes_at
  limit least(greatest(p_limit, 1), 20);
$$;
grant execute on function public.nearby_challenges(numeric, numeric, text, integer) to anon, authenticated;
