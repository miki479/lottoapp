-- Re-running the generator must not create the same question twice.

-- 1) Remove existing duplicates that nobody bet on (keep the oldest of each group).
with ranked as (
  select id, row_number() over (
    partition by city_id, kind, feed_id, coalesce(params->>'tripId',''), coalesce(params->>'stopId',''), (extract(epoch from target_at))::bigint
    order by (exists (select 1 from public.bets b where b.market_id = m.id)) desc, created_at, id
  ) rn
  from public.markets m
)
delete from public.markets m using ranked r
where m.id = r.id and r.rn > 1 and not exists (select 1 from public.bets b where b.market_id = m.id);

-- 2) Key + unique constraint. Rows that still duplicate (because they hold bets) stay unkeyed.
alter table public.markets add column if not exists dedupe_key text unique;
with ranked as (
  select id, row_number() over (
    partition by city_id, kind, feed_id, coalesce(params->>'tripId',''), coalesce(params->>'stopId',''), (extract(epoch from target_at))::bigint
    order by created_at, id
  ) rn
  from public.markets
)
update public.markets m set dedupe_key =
  m.city_id || '|' || m.kind || '|' || m.feed_id || '|' || coalesce(m.params->>'tripId','') || '|' || coalesce(m.params->>'stopId','') || '|' || (extract(epoch from m.target_at))::bigint::text
from ranked r where r.id = m.id and r.rn = 1 and m.dedupe_key is null;
