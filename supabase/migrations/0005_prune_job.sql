-- Keep the free 500 MB database small: raw readings are only needed until their market settles.
select cron.unschedule(jobid) from cron.job where jobname = 'prune';
select cron.schedule('prune', '17 3 * * *', $$
  delete from public.delay_observations where observed_at < now() - interval '2 days';
  delete from public.weather_observations where hour_start < now() - interval '3 days';
  delete from public.trip_schedule where service_date < current_date - 1;
$$);
