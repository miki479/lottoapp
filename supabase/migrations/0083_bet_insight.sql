-- What the app shows under an open bet: the delay readings of the train or bus behind it, and the last results of the teams.
create or replace function public.bet_delay_series(p_market uuid) returns table(observed_at timestamptz, delay_sec integer, is_forecast boolean)
language sql stable security definer set search_path = public as $$
  select o.observed_at, o.delay_sec, (o.predicted_at is not null and o.observed_at < o.predicted_at - interval '120 seconds')
  from public.markets m
  join public.delay_observations o on o.feed_id = m.feed_id and o.trip_id = m.params->>'tripId'
  where m.id = p_market and o.observed_at > now() - interval '6 hours'
    and (m.params->>'stopSequence' is null or o.stop_sequence is null or o.stop_sequence <= (m.params->>'stopSequence')::int + 2)
  order by o.observed_at desc limit 80;
$$;
grant execute on function public.bet_delay_series(uuid) to anon, authenticated;

create or replace function public.team_recent(p_team text) returns table(kickoff timestamptz, home text, away text, hg integer, ag integer)
language sql stable security definer set search_path = public as $$
  select t.kickoff, t.home, t.away, t.hg, t.ag from public.team_form t
  where (t.home = p_team or t.away = p_team) and t.hg is not null and t.ag is not null and t.kickoff < now()
  order by t.kickoff desc limit 6;
$$;
grant execute on function public.team_recent(text) to anon, authenticated;
