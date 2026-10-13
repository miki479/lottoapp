-- Sarcastic player titles: profiles.title = '<subject>:<style>' (derived data, recomputed hourly). Mirrors shared/titles.ts.
-- Subject: where the player placed >= 50% of their settled bets of the last 60 days (strike counts as train; culture splits by
-- params->>'series': steam: -> games, lastfm: -> music), else 'mix'. Ties go to the first subject in the array below.
-- Style, first match wins: newbie (< 5 settled bets all time, id mix:newbie), highroller (avg stake >= 20% of balance (balance > 0) or >= 1000),
-- lucky (win rate >= 58% over >= 15 bets), risk (avg odds >= 3.0), cautious (avg odds <= 1.6), regular.
alter table public.profiles add column if not exists title text;

create or replace function public.refresh_titles() returns integer
language sql security definer set search_path = public as $$
  with w as (
    select b.user_id, b.stake, b.odds, b.status,
      case when m.category = 'strike' then 'train'
           when m.category = 'culture' and m.params->>'series' like 'steam:%' then 'games'
           when m.category = 'culture' and m.params->>'series' like 'lastfm:%' then 'music'
           else m.category end as subj
    from public.bets b join public.markets m on m.id = b.market_id
    where b.status in ('won', 'lost') and b.settled_at >= now() - interval '60 days'
  ), per as (
    select user_id, subj, count(*) k from w group by 1, 2
  ), top as (
    select distinct on (user_id) user_id, subj, k from per
    where subj = any(array['train','bus','weather','nature','traffic','finance','culture','games','music','sport','law'])
    order by user_id, k desc, array_position(array['train','bus','weather','nature','traffic','finance','culture','games','music','sport','law'], subj)
  ), agg as (
    select user_id, count(*) n, count(*) filter (where status = 'won') wins, avg(stake) avg_stake, avg(odds) avg_odds from w group by 1
  ), tot as (
    select user_id, count(*) n from public.bets where status in ('won', 'lost') group by 1
  ), calc as (
    select t.user_id, case
      when t.n < 5 then 'mix:newbie'
      else coalesce(case when tp.k >= 0.5 * a.n then tp.subj end, 'mix') || ':' || case
        when a.n is null then 'regular'
        when (p.credits > 0 and a.avg_stake >= 0.2 * p.credits) or a.avg_stake >= 1000 then 'highroller'
        when a.n >= 15 and a.wins >= 0.58 * a.n then 'lucky'
        when a.avg_odds >= 3.0 then 'risk'
        when a.avg_odds <= 1.6 then 'cautious'
        else 'regular' end
      end as title
    from tot t join public.profiles p on p.id = t.user_id
    left join agg a on a.user_id = t.user_id
    left join top tp on tp.user_id = t.user_id
  ), u as (
    update public.profiles p set title = c.title from calc c where p.id = c.user_id and p.title is distinct from c.title returning 1
  )
  select count(*)::integer from u;
$$;
revoke execute on function public.refresh_titles() from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'refresh-titles';
select cron.schedule('refresh-titles', '47 * * * *', $$ select public.refresh_titles() $$);

-- looks(ids): avatars for lists, now with the title
drop function if exists public.looks(uuid[]);
create or replace function public.looks(ids uuid[]) returns table(user_id uuid, avatar text, decoration text, level integer, title text)
language sql security definer stable set search_path = public as $$
  select p.id, p.avatar, p.decoration, p.level, p.title from public.profiles p where p.id = any(ids[1:100]) and auth.uid() is not null
$$;
grant execute on function public.looks(uuid[]) to authenticated;

-- leaderboard (0041 body) + title
drop function if exists public.leaderboard(text, text, integer);
create or replace function public.leaderboard(p_scope text, p_key text default null, p_limit integer default 50)
returns table(rank bigint, user_id uuid, display_name text, score bigint, bets bigint, streak integer, is_me boolean, title text)
language sql security definer stable set search_path = public as $$
  with ev as (
    select user_id, id, status, stake, payout, settled_at from public.bets where status <> 'open'
    union all select user_id, id, status, stake, payout, settled_at from public.parlays where status <> 'open'
  ), me as (
    select pl.lat, pl.lon from public.profiles mp join public.places pl on pl.id = mp.home_place where mp.id = auth.uid()
  ), scores as (
    select p.id, p.display_name, p.streak, p.title,
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
  select rank() over (order by score desc, bets desc), id, display_name, score, bets, streak, id = auth.uid(), title
  from scores order by 1, display_name limit least(p_limit, 100);
$$;
grant execute on function public.leaderboard(text, text, integer) to authenticated;

-- friends_board (0048 body) + title
drop function if exists public.friends_board();
create or replace function public.friends_board()
returns table(rank bigint, user_id uuid, display_name text, score bigint, bets bigint, streak integer, is_me boolean, prev_rank bigint, title text)
language sql security definer stable set search_path = public as $$
  with ids as (
    select auth.uid() as id union all select friend_id from public.friendships where user_id = auth.uid()
  ), ev as (
    select user_id, status, stake, payout, settled_at from public.bets where status <> 'open'
    union all select user_id, status, stake, payout, settled_at from public.parlays where status <> 'open'
  ), s as (
    select p.id, nullif(p.display_name, '') as display_name, p.streak, p.title,
           coalesce(sum(case b.status when 'won' then b.payout - b.stake when 'lost' then -b.stake else 0 end), 0)::bigint as score,
           coalesce(sum(case when b.settled_at < now() - interval '1 day' then case b.status when 'won' then b.payout - b.stake when 'lost' then -b.stake else 0 end else 0 end), 0)::bigint as before,
           count(b.status) filter (where b.status in ('won','lost')) as bets
    from ids join public.profiles p on p.id = ids.id
    left join ev b on b.user_id = p.id and b.settled_at >= date_trunc('month', now())
    where auth.uid() is not null
    group by p.id, p.display_name, p.streak, p.title
  )
  select rank() over (order by score desc, bets desc), id, display_name, score, bets, streak, id = auth.uid(),
         rank() over (order by before desc), title
  from s order by 1, display_name nulls last, id;
$$;
grant execute on function public.friends_board() to authenticated;

-- league_board (0095 body) + title
drop function if exists public.league_board(integer, integer);
create or replace function public.league_board(p_league integer, p_limit integer default 50)
returns table(rank bigint, user_id uuid, display_name text, credits integer, is_me boolean, title text)
language sql security definer stable set search_path = public as $$
  select rank() over (order by a.credits desc), a.user_id, a.display_name, a.credits, a.user_id = auth.uid(), p.title
  from public.league_active(date_trunc('month', now() at time zone 'utc')::date) a
  join public.profiles p on p.id = a.user_id
  where auth.uid() is not null and a.league = least(greatest(p_league, 0), 4)
  order by 1, a.display_name limit least(greatest(p_limit, 1), 100);
$$;
grant execute on function public.league_board(integer, integer) to authenticated;

create or replace function public.public_profile(p_user uuid) returns jsonb
language plpgsql security definer stable set search_path = public as $$
declare me uuid := auth.uid(); p public.profiles; rel text; best bigint; wins bigint; total integer; seen jsonb;
begin
  if me is null then raise exception 'not_authenticated'; end if;
  select * into p from public.profiles where id = p_user;
  if not found then return null; end if;
  select max(payout - stake) into best from (
    select payout, stake from public.bets where user_id = p_user and status = 'won'
    union all select payout, stake from public.parlays where user_id = p_user and status = 'won') w;
  select count(*) into wins from (
    select settled_at from public.bets where user_id = p_user and status = 'won'
    union all select settled_at from public.parlays where user_id = p_user and status = 'won') w
    where settled_at >= date_trunc('month', now());
  rel := case
    when p_user = me then 'me'
    when exists (select 1 from public.friendships where user_id = me and friend_id = p_user) then 'friends'
    when exists (select 1 from public.friend_requests where from_id = me and to_id = p_user) then 'sent'
    when exists (select 1 from public.friend_requests where from_id = p_user and to_id = me) then 'received'
    else 'none' end;
  select count(*) into total from public.trophies where user_id = p_user;
  if rel in ('me', 'friends') then
    select coalesce(jsonb_agg(trophy_id order by public.trophy_rank(trophy_id) desc, earned_at desc), '[]'::jsonb) into seen from public.trophies where user_id = p_user;
  else
    select coalesce(jsonb_agg(trophy_id), '[]'::jsonb) into seen from (
      select trophy_id from public.trophies where user_id = p_user order by public.trophy_rank(trophy_id) desc, earned_at limit 3) t;
  end if;
  return jsonb_build_object('id', p.id, 'name', nullif(p.display_name, ''), 'avatar', p.avatar, 'decoration', p.decoration,
    'level', p.level, 'title', p.title, 'streak', p.streak, 'best_streak', p.best_streak,
    'best_win', coalesce(best, 0), 'month_wins', wins,
    'trophies', seen, 'trophy_count', total, 'hidden', greatest(0, total - jsonb_array_length(seen)),
    'balance', case when rel in ('me', 'friends') then p.credits else null end,
    'relation', rel);
end $$;
grant execute on function public.public_profile(uuid) to authenticated;
