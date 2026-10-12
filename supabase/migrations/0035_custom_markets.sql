-- Player-made questions: who made them, who shared them, and the ranking that decides what trends.
alter table public.markets add column if not exists created_by uuid references public.profiles(id) on delete set null;
create index if not exists markets_created_by on public.markets (created_by) where created_by is not null;

create table if not exists public.market_shares (
  user_id uuid not null references public.profiles(id) on delete cascade,
  market_id uuid not null references public.markets(id) on delete cascade,
  at timestamptz not null default now(),
  primary key (user_id, market_id)
);
alter table public.market_shares enable row level security;
revoke all on public.market_shares from anon, authenticated;

create or replace function public.register_share(p_market uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then return; end if;
  if (select count(*) from public.market_shares where user_id = auth.uid() and at > now() - interval '1 day') >= 30 then return; end if;
  insert into public.market_shares (user_id, market_id) values (auth.uid(), p_market) on conflict do nothing;
end $$;
grant execute on function public.register_share(uuid) to authenticated;

-- What trends: engagement of distinct players (the creator's own bets do not count), recent velocity, shares, age decay,
-- urgency, closeness to the viewer, creator reputation, quality gate and diversity.
create or replace function public.trending_markets(p_place text default null, p_near text[] default '{}', p_limit integer default 8)
returns table (market_id uuid, score numeric, bettors bigint, staked bigint, shares bigint)
language sql stable security definer set search_path = public as $$
  with act as (
    select b.market_id,
           count(distinct b.user_id) filter (where b.user_id is distinct from m.created_by) as bettors,
           count(distinct b.user_id) filter (where b.user_id is distinct from m.created_by and b.placed_at > now() - interval '1 hour') as b1,
           count(distinct b.user_id) filter (where b.user_id is distinct from m.created_by and b.placed_at > now() - interval '6 hours') as b6,
           coalesce(sum(b.stake) filter (where b.user_id is distinct from m.created_by), 0) as staked
    from public.bets b join public.markets m on m.id = b.market_id
    where m.status = 'open' and m.closes_at > now()
    group by b.market_id
  ), sh as (select s.market_id, count(*) n from public.market_shares s group by s.market_id),
  rep as (
    select created_by, avg(case when status = 'void' then 0.0 else 1.0 end) r from public.markets
    where created_by is not null and status in ('resolved','void') group by created_by
  ), rp as (select r.market_id, count(*) n from public.reports r where r.status = 'open' group by r.market_id),
  scored as (
    select m.id, m.category, m.created_by,
      coalesce(a.bettors, 0) bettors, coalesce(a.staked, 0) staked, coalesce(sh.n, 0) shares,
      (ln(1 + coalesce(a.bettors, 0)) + 0.4 * ln(1 + coalesce(a.staked, 0) / 100.0) + 0.6 * ln(1 + coalesce(sh.n, 0))
        + 0.8 * coalesce(a.b1, 0) + 0.3 * coalesce(a.b6, 0))
      / power(1 + extract(epoch from now() - m.created_at) / 21600.0, 1.2)
      * case when m.closes_at < now() + interval '6 hours' then 1 + 0.5 * (1 - extract(epoch from m.closes_at - now()) / 21600.0) else 1 end
      * case when p_place is not null and m.city_id = p_place then 2.0 when m.city_id = any (p_near) then 1.5 else 1 end
      * (0.8 + 0.4 * coalesce(rep.r, 1)) as s
    from public.markets m
    left join act a on a.market_id = m.id left join sh on sh.market_id = m.id
    left join rep on rep.created_by = m.created_by left join rp on rp.market_id = m.id
    where m.status = 'open' and m.closes_at > now() and coalesce(rp.n, 0) < 2 and coalesce(m.params->>'testOnly', '') <> 'true'
      and m.odds_yes between 1.15 and 8 and m.odds_no between 1.15 and 8
      and (coalesce(a.bettors, 0) > 0 or (m.params->>'custom' = 'true' and m.created_at > now() - interval '2 hours'))
  ), ranked as (
    select *, row_number() over (partition by category order by s desc) rn_cat, row_number() over (partition by created_by order by s desc) rn_by from scored
  )
  select id, round((s * power(0.85, rn_cat - 1) * case when created_by is null then 1 else power(0.7, rn_by - 1) end)::numeric, 4),
         bettors::bigint, staked::bigint, shares::bigint
  from ranked order by 2 desc limit least(greatest(p_limit, 1), 20);
$$;
grant execute on function public.trending_markets(text, text[], integer) to anon, authenticated;
