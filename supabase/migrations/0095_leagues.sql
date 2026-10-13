-- Monthly leagues (fake credits only). Five leagues named after the avatar-decoration metals: 0 Bronze, 1 Silver, 2 Gold, 3 Platinum, 4 Diamond.
-- On the 1st of every month, among the players who bet at least once that month, the top 10 of each league (by credits) and anyone
-- with 1,000,000+ credits move up one league. Everyone's balance restarts at 1000 + 150 * league; nobody goes down. Players who did
-- not play keep their league and are only lifted to 1000 if below it. Rules are mirrored by shared/leagues.ts (tested).
-- Off until app_settings.leagues_on = 'true' (this migration does NOT turn it on).

alter table public.profiles add column if not exists league smallint not null default 0;
do $$ begin
  alter table public.profiles add constraint profiles_league_range check (league between 0 and 4);
exception when duplicate_object then null; end $$;

insert into public.app_settings (key, value) values ('leagues_on', 'false') on conflict do nothing;

create table if not exists public.league_seasons (
  month date not null,
  user_id uuid not null references public.profiles(id) on delete cascade,
  league_before smallint not null,
  league_after smallint not null,
  final_credits integer not null,
  rank integer not null,
  primary key (month, user_id)
);
alter table public.league_seasons enable row level security;
drop policy if exists "own seasons" on public.league_seasons;
create policy "own seasons" on public.league_seasons for select using (user_id = auth.uid());
revoke all on public.league_seasons from anon, authenticated;
grant select on public.league_seasons to authenticated;

-- Who is ranked in a month: shown on the public boards (registered, with a nickname) and bet at least once (single or parlay) in that month.
create or replace function public.league_active(p_month date) returns table(user_id uuid, league smallint, credits integer, display_name text)
language sql stable set search_path = public as $$
  select p.id, p.league, p.credits, p.display_name
  from public.profiles p
  join auth.users u on u.id = p.id and not u.is_anonymous and u.email is not null
  where p.display_name is not null and (
    exists (select 1 from public.bets b where b.user_id = p.id and b.placed_at >= p_month and b.placed_at < p_month + interval '1 month')
    or exists (select 1 from public.parlays c where c.user_id = p.id and c.placed_at >= p_month and c.placed_at < p_month + interval '1 month'));
$$;
revoke execute on function public.league_active(date) from public, anon, authenticated;

create or replace function public.close_league_season(p_month date default null) returns integer
language plpgsql security definer set search_path = public as $$
declare m date := coalesce(date_trunc('month', p_month)::date, date_trunc('month', now() at time zone 'utc' - interval '1 day')::date);
        r record; n integer := 0; ring text; got text; loc text; nl smallint; h text; b text;
begin
  if coalesce((select value from public.app_settings where key = 'leagues_on'), 'false') <> 'true' then return 0; end if;
  if exists (select 1 from public.league_seasons where month = m) then return 0; end if; -- already closed: safe to run twice

  -- the ranking is read once, before any balance changes
  create temp table _lg on commit drop as
    select a.user_id, a.league, a.credits, rank() over (partition by a.league order by a.credits desc)::integer as rnk from public.league_active(m) a;

  for r in select * from _lg loop
    nl := case when r.league < 4 and (r.rnk <= 10 or r.credits >= 1000000) then r.league + 1 else r.league end;
    insert into public.league_seasons (month, user_id, league_before, league_after, final_credits, rank)
    values (m, r.user_id, r.league, nl, r.credits, r.rnk) on conflict do nothing;
    update public.profiles set league = nl, credits = 1000 + 150 * nl where id = r.user_id;
    n := n + 1;
    if nl > r.league then
      ring := (array['silver','gold','platinum','diamond'])[nl];
      got := null;
      if exists (select 1 from public.decorations where id = ring) then
        insert into public.user_decorations (user_id, decoration_id) values (r.user_id, ring) on conflict do nothing;
        if found then got := ring; end if;
      end if;
      update public.profiles set boosts = boosts + 1 where id = r.user_id returning locale into loc;
      if loc = 'it' then
        h := 'Sei salito in lega ' || (array['Bronzo','Argento','Oro','Platino','Diamante'])[nl + 1];
        b := 'Hai chiuso il mese tra i migliori della tua lega. Nuovo mese, nuovo inizio: i crediti ripartono da ' || (1000 + 150 * nl) || '.';
      elsif loc = 'ja' then
        h := (array['ブロンズ','シルバー','ゴールド','プラチナ','ダイヤモンド'])[nl + 1] || 'リーグに昇格しました';
        b := '先月はリーグの上位でした。新しい月が始まり、クレジットは' || (1000 + 150 * nl) || 'からスタートです。';
      else
        h := 'You moved up to the ' || (array['Bronze','Silver','Gold','Platinum','Diamond'])[nl + 1] || ' league';
        b := 'You finished the month among the best of your league. A new month, a fresh start: your credits restart from ' || (1000 + 150 * nl) || '.';
      end if;
      -- the resolve job turns this queue row into the in-app message (with its gifts) and the push, then removes it
      insert into public.app_settings (key, value) values ('direct:league:' || to_char(m, 'YYYYMM') || ':' || r.user_id,
        jsonb_build_object('user', r.user_id, 'heading', h, 'body', b, 'url', 'https://latelotto.web.app/?open=ranking',
          'gifts', jsonb_strip_nulls(jsonb_build_object('boosts', 1, 'decoration', got)))::text) on conflict do nothing;
    end if;
  end loop;

  -- everyone else keeps their league; credits are only lifted to the base, never taken away
  update public.profiles set credits = 1000 where credits < 1000 and id not in (select user_id from _lg);
  return n;
end $$;
revoke execute on function public.close_league_season(date) from public, anon, authenticated;

create or replace function public.my_league() returns jsonb
language plpgsql security definer stable set search_path = public as $$
declare uid uuid := auth.uid(); m date := date_trunc('month', now() at time zone 'utc')::date; lg smallint; cr integer; myrank integer; cnt integer; tenth integer;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  select league, credits into lg, cr from public.profiles where id = uid;
  select count(*)::integer, max(t.credits) filter (where t.rnk = 10), max(t.rnk) filter (where t.user_id = uid)
    into cnt, tenth, myrank
  from (select a.user_id, a.credits, rank() over (order by a.credits desc)::integer as rnk from public.league_active(m) a where a.league = lg) t;
  -- rank is null until I have bet this month; threshold is the credits of 10th place (null with fewer than 10 players)
  return jsonb_build_object('league', lg, 'credits', cr, 'rank', myrank, 'players', cnt, 'threshold', tenth,
    'days_left', greatest(1, ceil(extract(epoch from (m + interval '1 month') - (now() at time zone 'utc')) / 86400)::integer),
    'on', coalesce((select value from public.app_settings where key = 'leagues_on'), 'false') = 'true');
end $$;
grant execute on function public.my_league() to authenticated;

create or replace function public.league_board(p_league integer, p_limit integer default 50)
returns table(rank bigint, user_id uuid, display_name text, credits integer, is_me boolean)
language sql security definer stable set search_path = public as $$
  select rank() over (order by a.credits desc), a.user_id, a.display_name, a.credits, a.user_id = auth.uid()
  from public.league_active(date_trunc('month', now() at time zone 'utc')::date) a
  where auth.uid() is not null and a.league = least(greatest(p_league, 0), 4)
  order by 1, a.display_name limit least(greatest(p_limit, 1), 100);
$$;
grant execute on function public.league_board(integer, integer) to authenticated;

-- 00:05 UTC on the 1st; a no-op until leagues_on is 'true'
select cron.schedule('close-league-season', '5 0 1 * *', $$ select public.close_league_season() $$);
