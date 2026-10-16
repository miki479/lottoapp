-- Abuse protection, nickname filter, account deletion and the aggregates the app needs.

-- 1) At most 8 bets per minute per player (place_bet is the only way to bet).
create or replace function public.place_bet(p_market uuid, p_pick text, p_stake integer)
returns public.bets
language plpgsql security definer set search_path = public as $$
declare
  m public.markets;
  prof public.profiles;
  b public.bets;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if p_pick not in ('yes','no') then raise exception 'bad_pick'; end if;
  select * into m from public.markets where id = p_market for share;
  if not found or m.status <> 'open' or now() >= m.closes_at then raise exception 'market_closed'; end if;
  select * into prof from public.profiles where id = auth.uid() for update;
  if not found then raise exception 'no_profile'; end if;
  if (select count(*) from public.bets where user_id = prof.id and placed_at > now() - interval '1 minute') >= 8 then
    raise exception 'rate_limited';
  end if;
  if p_stake < 10 or p_stake > 500 then raise exception 'bad_stake'; end if;
  if prof.credits < p_stake then raise exception 'insufficient_credits'; end if;
  update public.profiles set credits = credits - p_stake where id = prof.id;
  insert into public.bets (user_id, market_id, pick, stake, odds)
  values (prof.id, m.id, p_pick, p_stake, case when p_pick = 'yes' then m.odds_yes else m.odds_no end)
  returning * into b;
  perform public.register_play(prof.id, m.category);
  return b;
end $$;

-- 2) Public nickname: only through this function, with a basic offensive-name filter (it + en).
create unique index if not exists profiles_display_name_ci on public.profiles (lower(display_name)) where display_name is not null;
revoke update (display_name) on public.profiles from authenticated;

create or replace function public.set_nickname(p_name text) returns text
language plpgsql security definer set search_path = public as $$
declare
  n text := trim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
  norm text;
  banned constant text[] := array[
    'fuck','shit','bitch','cunt','dick','cock','pussy','asshole','nigg','fag','whore','slut','rape','nazi','hitler','retard',
    'cazzo','merd','stronz','puttan','troia','vaffa','minchia','frocio','ricchion','negro','sborr','pompin','coglion','mussolini','bastard',
    'admin','latelotto','support','moderator'];
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if not public.is_registered() then raise exception 'registration_required'; end if;
  if char_length(n) < 2 or char_length(n) > 24 or n !~ '^[[:alnum:]_ .-]+$' then raise exception 'bad_nickname'; end if;
  -- undo common leetspeak and ignore separators, so "Sh1t", "s h i t" and "$hit" are all caught
  norm := regexp_replace(translate(lower(n), '013457$@', 'oieastsa'), '[^a-z]', '', 'g');
  if exists (select 1 from unnest(banned) w where norm like '%' || w || '%') then raise exception 'nickname_not_allowed'; end if;
  begin
    update public.profiles set display_name = n where id = auth.uid();
  exception when unique_violation then raise exception 'nickname_taken';
  end;
  return n;
end $$;
grant execute on function public.set_nickname(text) to authenticated;

-- 3) Delete the account and every row that belongs to it (profile, bets, progress, trophies, groups it owns).
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  delete from auth.users where id = auth.uid();
end $$;
grant execute on function public.delete_my_account() to authenticated;

-- 4) Aggregates (no personal data in the public one).
create or replace function public.popular_markets(p_limit integer default 5)
returns table(market_id uuid, bets bigint, staked bigint)
language sql security definer stable set search_path = public as $$
  select b.market_id, count(*), sum(b.stake)::bigint
  from public.bets b join public.markets m on m.id = b.market_id
  where m.status = 'open' and m.closes_at > now()
  group by b.market_id order by count(*) desc, sum(b.stake) desc limit least(p_limit, 20);
$$;
grant execute on function public.popular_markets(integer) to anon, authenticated;

create or replace function public.my_stats()
returns table(total bigint, won bigint, lost bigint, voided bigint, best_win bigint, net bigint, staked bigint)
language sql security definer stable set search_path = public as $$
  select count(*) filter (where status <> 'open'),
         count(*) filter (where status = 'won'),
         count(*) filter (where status = 'lost'),
         count(*) filter (where status = 'void'),
         coalesce(max(payout - stake) filter (where status = 'won'), 0)::bigint,
         coalesce(sum(case status when 'won' then payout - stake when 'lost' then -stake else 0 end), 0)::bigint,
         coalesce(sum(stake) filter (where status <> 'void'), 0)::bigint
  from public.bets where user_id = auth.uid();
$$;
grant execute on function public.my_stats() to authenticated;
