-- Football, second step: team strengths from played matches (the free league table lists five teams only)
-- and the match details (half-time score, corners, cards) used to settle the extra bets.
create table if not exists public.team_form (
  event_id text primary key,
  league text not null,
  season text not null,
  kickoff timestamptz not null,
  home text not null,
  away text not null,
  hg integer not null,
  ag integer not null,
  api_id text
);
create index if not exists team_form_league_idx on public.team_form (league, season);
alter table public.team_form enable row level security;
revoke all on public.team_form from anon, authenticated;

create table if not exists public.match_details (
  event_id text primary key,
  api_id text not null,
  kickoff timestamptz not null,
  status text not null default '',
  ht_home integer,
  ht_away integer,
  corners integer,
  cards integer,
  reds integer,
  attempted_at timestamptz not null default now(),
  fetched_at timestamptz
);
alter table public.match_details enable row level security;
revoke all on public.match_details from anon, authenticated;

-- Keeps the "what would this bet pay" figures (and the data-source id) of the open markets of one match current.
create or replace function public.refresh_match_info(p_event text, p_priors jsonb, p_api_id text)
returns void language sql security definer set search_path = public as $$
  update public.markets
     set params = params || jsonb_build_object('priors', p_priors) || case when p_api_id is not null then jsonb_build_object('apiId', p_api_id) else '{}'::jsonb end
   where kind = 'match_bet' and status = 'open' and params->>'eventId' = p_event;
$$;
revoke all on function public.refresh_match_info(text, jsonb, text) from public, anon, authenticated;
grant execute on function public.refresh_match_info(text, jsonb, text) to service_role;

select cron.unschedule(jobid) from cron.job where jobname = 'prune';
select cron.schedule('prune', '17 3 * * *', $$
  delete from public.delay_observations where observed_at < now() - interval '2 days';
  delete from public.weather_observations where hour_start < now() - interval '3 days';
  delete from public.metric_observations where hour_start < now() - interval '3 days';
  delete from public.traffic_observations where hour_start < now() - interval '3 days';
  delete from public.tick_observations where at < now() - interval '3 days';
  delete from public.tick_history where at < now() - interval '30 days';
  delete from public.match_results where kickoff < now() - interval '5 days';
  delete from public.match_details where kickoff < now() - interval '5 days';
  delete from public.team_form where kickoff < now() - interval '400 days';
  delete from public.trip_schedule where service_date < current_date - 1;
$$);
