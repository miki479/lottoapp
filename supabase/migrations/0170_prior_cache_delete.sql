-- The database refuses a DELETE without WHERE (pg_safeupdate): the prior cache could never be rebuilt and every ingest call failed on it.
create or replace function public.learned_prior_counts(p_max_age_s integer default 1800)
 returns table(country text, kind text, yes integer, n integer)
 language plpgsql security definer set search_path to 'public'
as $function$
#variable_conflict use_column
begin
  if not exists (select 1 from public.learned_prior_cache where updated_at > now() - make_interval(secs => p_max_age_s)) then
    -- one writer at a time; the others read the old rows
    if pg_try_advisory_xact_lock(7160001) then
      delete from public.learned_prior_cache where true;
      insert into public.learned_prior_cache (country, kind, yes, n)
      select c.country, k.kind, count(*) filter (where r.outcome = 'yes')::int, count(*)::int
      from (select distinct country from public.cities) c
      cross join (values ('bus_delay_gt'), ('train_delay_gt')) k(kind)
      cross join lateral (
        select m.outcome from public.markets m
        where m.kind = k.kind and m.status = 'resolved' and m.params->>'ladderOf' is null
          and m.city_id in (select id from public.cities where country = c.country)
        order by m.target_at desc limit 1000) r
      group by c.country, k.kind;
    end if;
  end if;
  return query select l.country, l.kind, l.yes, l.n from public.learned_prior_cache l;
end $function$;
