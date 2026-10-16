-- A month without any bet moves a player down one league (bronze stays bronze).
create or replace function public.close_league_season(p_month date default null) returns integer
language plpgsql security definer set search_path = public as $$
declare m date := coalesce(date_trunc('month', p_month)::date, date_trunc('month', now() at time zone 'utc' - interval '1 day')::date);
        r record; n integer := 0; ring text; got text; loc text; nl smallint; h text; b text;
begin
  if coalesce((select value from public.app_settings where key = 'leagues_on'), 'false') <> 'true' then return 0; end if;
  if exists (select 1 from public.league_seasons where month = m) then return 0; end if; -- already closed: safe to run twice

  -- the ranking is read once, before any balance changes
  create temp table _lg on commit drop as
    select a.user_id, a.league, a.credits, rank() over (partition by a.league order by a.credits desc)::integer as rnk, count(*) over (partition by a.league)::integer as cnt from public.league_active(m) a;

  for r in select * from _lg loop
    nl := case when r.league < 4 and (r.rnk <= least(10, r.cnt / 4) or r.credits >= 1000000) then r.league + 1 else r.league end;
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

  -- a month without a single bet moves you down one league (bronze stays bronze): the player keeps the credits, lifted to the base of the new league if lower
  for r in select p.id, p.league, p.credits, p.locale from public.profiles p
           where p.league > 0 and p.id not in (select user_id from _lg)
             and not exists (select 1 from public.bets b where b.user_id = p.id and b.placed_at >= m and b.placed_at < m + interval '1 month')
             and not exists (select 1 from public.parlays q where q.user_id = p.id and q.placed_at >= m and q.placed_at < m + interval '1 month') loop
    nl := r.league - 1;
    update public.profiles set league = nl, credits = greatest(credits, 1000 + 150 * nl) where id = r.id;
    if r.locale = 'it' then
      h := 'Sei sceso in lega ' || (array['Bronzo','Argento','Oro','Platino','Diamante'])[nl + 1];
      b := 'Un mese senza puntate: la lega si perde se non si gioca. Torna a giocare e ti riprendi il posto.';
    elsif r.locale = 'ja' then
      h := (array['ブロンズ','シルバー','ゴールド','プラチナ','ダイヤモンド'])[nl + 1] || 'リーグに降格しました';
      b := '1か月予想がなかったため降格しました。また遊べば戻れます。';
    else
      h := 'You dropped to the ' || (array['Bronze','Silver','Gold','Platinum','Diamond'])[nl + 1] || ' league';
      b := 'A month without a single bet: a league has to be kept by playing. Play again and you can climb back.';
    end if;
    insert into public.app_settings (key, value) values ('direct:league:' || to_char(m, 'YYYYMM') || ':' || r.id,
      jsonb_build_object('user', r.id, 'heading', h, 'body', b, 'url', 'https://latelotto.web.app/?open=ranking')::text) on conflict do nothing;
    n := n + 1;
  end loop;
  -- everyone else keeps their league; credits are only lifted to the base, never taken away
  update public.profiles set credits = 1000 where credits < 1000 and id not in (select user_id from _lg);
  return n;
end $$;
