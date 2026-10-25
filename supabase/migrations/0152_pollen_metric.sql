-- The "pollen" metric (all the pollen species Open-Meteo models, added up) is a valid observation.
alter table public.metric_observations drop constraint if exists metric_observations_metric_check;
alter table public.metric_observations add constraint metric_observations_metric_check check (metric in ('temp','wind','snow','uv','aqi','hail','pollen'));
