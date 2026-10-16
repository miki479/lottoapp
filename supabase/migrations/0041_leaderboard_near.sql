-- Leaderboard "near me": players whose home town is within p_key km (default 30) of mine. Needs my own home town.
create or replace function public.leaderboard(p_scope text, p_key text default null, p_limit integer default 50)
returns table(rank bigint, user_id uuid, display_name text, score bigint, bets bigint, streak integer, is_me boolean)
language sql security definer stable set search_path = public as $$
  with ev as (
    select user_id, id, status, stake, payout, settled_at from public.bets where status <> 'open'
    union all select user_id, id, status, stake, payout, settled_at from public.parlays where status <> 'open'
  ), me as (
    select pl.lat, pl.lon from public.profiles mp join public.places pl on pl.id = mp.home_place where mp.id = auth.uid()
  ), scores as (
    select p.id, p.display_name, p.streak,
           coalesce(sum(case b.status when 'won' then b.payout - b.stake when 'lost' then -b.stake else 0 end), 0)::bigint as score,
           count(b.id) filter (where b.status in ('won','lost')) as bets
    from public.profiles p
    join auth.users u on u.id = p.id and not u.is_anonymous and u.email is not null
    join ev b on b.user_id = p.id and b.settled_at >= date_trunc('month', now())
    where p.display_name is not null and (
      p_scope = 'global'
      or (p_scope = 'country' and p.country = upper(p_key))
      or (p_scope = 'city' and p.city_id = p_key)
      or (p_scope = 'near' and exists (
            select 1 from me join public.places pl on pl.id = p.home_place
            where public.km_between(me.lat, me.lon, pl.lat, pl.lon) <= least(greatest(coalesce(nullif(p_key, '')::int, 30), 5), 200)))
      or (p_scope = 'group'
          and exists (select 1 from public.group_members g where g.group_code = upper(p_key) and g.user_id = p.id)
          and exists (select 1 from public.group_members g2 where g2.group_code = upper(p_key) and g2.user_id = auth.uid()))
    )
    group by p.id
  )
  select rank() over (order by score desc, bets desc), id, display_name, score, bets, streak, id = auth.uid()
  from scores order by 1, display_name limit least(p_limit, 100);
$$;
