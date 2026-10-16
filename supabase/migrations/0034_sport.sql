-- Football matches: results come from TheSportsDB; a market asks about one bet on one match.
create table if not exists public.match_results (
  event_id text primary key,
  kickoff timestamptz not null,
  home_goals integer,
  away_goals integer,
  status text not null default '',
  fetched_at timestamptz not null default now()
);
alter table public.match_results enable row level security;
revoke all on public.match_results from anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'prune';
select cron.schedule('prune', '17 3 * * *', $$
  delete from public.delay_observations where observed_at < now() - interval '2 days';
  delete from public.weather_observations where hour_start < now() - interval '3 days';
  delete from public.metric_observations where hour_start < now() - interval '3 days';
  delete from public.traffic_observations where hour_start < now() - interval '3 days';
  delete from public.tick_observations where at < now() - interval '3 days';
  delete from public.tick_history where at < now() - interval '30 days';
  delete from public.match_results where kickoff < now() - interval '5 days';
  delete from public.trip_schedule where service_date < current_date - 1;
$$);
