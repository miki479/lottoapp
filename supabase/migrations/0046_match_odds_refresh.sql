-- The odds of a football market follow the team strengths as the season goes on. Bets already placed keep the odds locked at placement.
create or replace function public.refresh_match_odds(p jsonb)
returns void language sql security definer set search_path = public as $$
  update public.markets m
     set odds_yes = x.odds_yes, odds_no = x.odds_no
    from jsonb_to_recordset(p) as x(dedupe_key text, odds_yes numeric, odds_no numeric)
   where m.dedupe_key = x.dedupe_key and m.kind = 'match_bet' and m.status = 'open' and m.closes_at > now()
     and x.odds_yes >= 1 and x.odds_no >= 1;
$$;
revoke all on function public.refresh_match_odds(jsonb) from public, anon, authenticated;
grant execute on function public.refresh_match_odds(jsonb) to service_role;
