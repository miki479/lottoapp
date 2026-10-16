-- Team crests: kept in the market's parameters and refreshed with the other match info.
drop function if exists public.refresh_match_info(text, jsonb, text);
create or replace function public.refresh_match_info(p_event text, p_priors jsonb, p_api_id text, p_home_badge text default null, p_away_badge text default null)
returns void language sql security definer set search_path = public as $$
  update public.markets
     set params = params || jsonb_build_object('priors', p_priors)
                         || case when p_api_id is not null then jsonb_build_object('apiId', p_api_id) else '{}'::jsonb end
                         || case when p_home_badge is not null then jsonb_build_object('homeBadge', p_home_badge) else '{}'::jsonb end
                         || case when p_away_badge is not null then jsonb_build_object('awayBadge', p_away_badge) else '{}'::jsonb end
   where kind = 'match_bet' and status = 'open' and params->>'eventId' = p_event;
$$;
revoke all on function public.refresh_match_info(text, jsonb, text, text, text) from public, anon, authenticated;
grant execute on function public.refresh_match_info(text, jsonb, text, text, text) to service_role;
