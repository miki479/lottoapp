-- Halloween event: five challenges ("guess 3 predictions on distinct events" in one category each), five permanent badges.
-- The event window lives in one row and starts as a DRAFT with no dates: nothing is counted or awarded until it is configured and published.
create table if not exists public.halloween_event (
  id boolean primary key default true check (id),
  starts_at timestamptz,
  ends_at timestamptz,
  settle_by timestamptz,                 -- late settlements: a win only counts if it was settled by this time (defaults to ends_at)
  published boolean not null default false,
  check (starts_at is null or ends_at is null or starts_at < ends_at),
  check (settle_by is null or ends_at is null or settle_by >= ends_at)
);
insert into public.halloween_event (id) values (true) on conflict do nothing;
alter table public.halloween_event enable row level security;   -- no policies: read through halloween_status(), write with the service role

-- What "the same underlying event" means: the match, the train trip, the series at its target time, the road sensor at its target time, else city + target time.
create or replace function public.market_event_key(m public.markets) returns text
language sql immutable as $$
  select m.category || ':' || coalesce(
    m.params->>'eventId',
    m.params->>'tripId',
    case when m.params ? 'series' then (m.params->>'series') || '@' || m.target_at::text end,
    case when m.params ? 'siteId' then (m.params->>'siteId') || '@' || coalesce(m.params->>'direction', '') || '@' || m.target_at::text end,
    m.city_id || '@' || m.target_at::text)
$$;

-- Distinct events won in a category inside the window. Single bets only; parlays, pending/lost/void bets and friends' custom markets never count.
create or replace function public.halloween_wins(u uuid, cat text, p_from timestamptz, p_to timestamptz, p_settle timestamptz) returns integer
language sql stable security definer set search_path = public as $$
  select count(distinct public.market_event_key(m))::integer
  from public.bets b join public.markets m on m.id = b.market_id
  where b.user_id = u and m.category = cat and m.created_by is null
    and b.status = 'won' and m.status = 'resolved' and m.outcome = b.pick
    and b.placed_at >= p_from and b.placed_at <= p_to and b.settled_at <= p_settle
$$;
revoke all on function public.halloween_wins(uuid, text, timestamptz, timestamptz, timestamptz) from public, anon, authenticated;

create or replace function public.evaluate_halloween(u uuid) returns text[]
language plpgsql security definer set search_path = public as $$
declare ev public.halloween_event; got text[] := '{}'; c text[] := '{}'; r record;
begin
  select * into ev from public.halloween_event;
  if not found or not ev.published or ev.starts_at is null or ev.ends_at is null then return got; end if;
  for r in select * from (values ('halloween_treni','train'),('halloween_meteo','weather'),('halloween_traffico','traffic'),('halloween_mercati','finance'),('halloween_sport','sport')) v(id, cat) loop
    if public.halloween_wins(u, r.cat, ev.starts_at, ev.ends_at, coalesce(ev.settle_by, ev.ends_at)) >= 3 then c := array_append(c, r.id); end if;
  end loop;
  if cardinality(c) > 0 then
    -- the unique (user, trophy) key makes duplicate calls and concurrent jobs harmless; a badge is never taken back
    with ins as (insert into public.trophies (user_id, trophy_id) select u, t from unnest(c) t on conflict do nothing returning trophy_id)
    select coalesce(array_agg(trophy_id), '{}'::text[]) into got from ins;
  end if;
  return got;
end $$;
revoke all on function public.evaluate_halloween(uuid) from public, anon, authenticated;

create or replace function public.evaluate_trophies(u uuid) returns text[]
language plpgsql security definer set search_path = public as $$
declare a text[]; b text[]; h text[];
begin
  a := public.evaluate_trophies_base(u);
  b := public.evaluate_trophies_more(u);
  h := public.evaluate_halloween(u);
  return coalesce(a, '{}'::text[]) || coalesce(b, '{}'::text[]) || coalesce(h, '{}'::text[]);
end $$;
revoke execute on function public.evaluate_trophies(uuid) from public, anon, authenticated;

create or replace function public.halloween_status() returns jsonb
language plpgsql security definer set search_path = public as $$
declare ev public.halloween_event; uid uuid := auth.uid(); out jsonb := '[]'; r record; w integer; have boolean;
begin
  select * into ev from public.halloween_event;
  if not found or not ev.published then return jsonb_build_object('published', false); end if;
  if uid is not null then perform public.evaluate_halloween(uid); end if;
  for r in select * from (values ('halloween_treni','train'),('halloween_meteo','weather'),('halloween_traffico','traffic'),('halloween_mercati','finance'),('halloween_sport','sport')) v(id, cat) loop
    w := 0; have := false;
    if uid is not null and ev.starts_at is not null and ev.ends_at is not null then
      w := least(3, public.halloween_wins(uid, r.cat, ev.starts_at, ev.ends_at, coalesce(ev.settle_by, ev.ends_at)));
      have := exists (select 1 from public.trophies where user_id = uid and trophy_id = r.id);
    end if;
    out := out || jsonb_build_array(jsonb_build_object('id', r.id, 'category', r.cat, 'wins', case when have then 3 else w end, 'target', 3, 'unlocked', have));
  end loop;
  return jsonb_build_object('published', true, 'starts_at', ev.starts_at, 'ends_at', ev.ends_at, 'settle_by', coalesce(ev.settle_by, ev.ends_at), 'challenges', out);
end $$;
revoke all on function public.halloween_status() from public, anon;
grant execute on function public.halloween_status() to authenticated, anon;
