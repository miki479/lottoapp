-- Player reports ("segnalazioni") and an admin-only overview of feed health.
-- Admins are listed by email in app_settings.admin_emails (comma separated), never in code.
insert into public.app_settings (key, value) values ('admin_emails', 'mikiforte1@gmail.com') on conflict do nothing;

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public, auth as $$
  select exists (
    select 1 from auth.users u
    where u.id = auth.uid() and not u.is_anonymous and u.email is not null
      and lower(u.email) = any (
        select lower(trim(x)) from unnest(string_to_array(coalesce((select value from public.app_settings where key = 'admin_emails'), ''), ',')) x)
  );
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete set null,
  market_id uuid references public.markets(id) on delete cascade,
  kind text not null check (kind in ('wrong_data','wrong_result','other')),
  note text not null default '' check (char_length(note) <= 300 and note !~ '[<>]'),
  status text not null default 'open' check (status in ('open','resolved')),
  created_at timestamptz not null default now(),
  unique (user_id, market_id)
);
alter table public.reports enable row level security;
revoke all on public.reports from anon, authenticated;

create or replace function public.report_market(p_market uuid, p_kind text, p_note text default '') returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid();
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if p_kind not in ('wrong_data','wrong_result','other') then raise exception 'bad_report'; end if;
  if (select count(*) from public.reports where user_id = uid and created_at > now() - interval '1 day') >= 5 then raise exception 'rate_limited'; end if;
  insert into public.reports (user_id, market_id, kind, note)
  values (uid, p_market, p_kind, left(coalesce(p_note, ''), 300))
  on conflict (user_id, market_id) do nothing;
end $$;
revoke all on function public.report_market(uuid, text, text) from public, anon;
grant execute on function public.report_market(uuid, text, text) to authenticated;

create or replace function public.admin_resolve_report(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  update public.reports set status = 'resolved' where id = p_id;
end $$;
revoke all on function public.admin_resolve_report(uuid) from public, anon;
grant execute on function public.admin_resolve_report(uuid) to authenticated;

create or replace function public.admin_overview() returns jsonb
language plpgsql security definer set search_path = public, auth as $$
declare out jsonb;
begin
  if not public.is_admin() then raise exception 'forbidden'; end if;
  select jsonb_build_object(
    'feeds', coalesce((select jsonb_agg(jsonb_build_object(
        'id', f.feed_id, 'last_ok_at', f.last_ok_at, 'last_attempt_at', f.last_attempt_at, 'last_error', f.last_error, 'last_error_at', f.last_error_at)
        order by f.feed_id) from public.feed_health f), '[]'::jsonb),
    'markets', jsonb_build_object(
      'open', (select count(*) from public.markets where status = 'open'),
      'resolved_24h', (select count(*) from public.markets where status = 'resolved' and target_at > now() - interval '24 hours'),
      'void_24h', (select count(*) from public.markets where status = 'void' and target_at > now() - interval '24 hours'),
      'void_reasons', coalesce((select jsonb_object_agg(r, c) from (
          select coalesce(void_reason, '?') r, count(*) c from public.markets where status = 'void' and target_at > now() - interval '24 hours' group by 1) v), '{}'::jsonb)),
    'users', jsonb_build_object(
      'registered', (select count(*) from auth.users where not is_anonymous and email is not null),
      'guests', (select count(*) from auth.users where is_anonymous),
      'bets_24h', (select count(*) from public.bets where placed_at > now() - interval '24 hours')),
    'places', jsonb_build_object(
      'active', (select count(*) from public.places where last_used_at > now() - interval '3 days'), 'limit', 300),
    'reports', coalesce((select jsonb_agg(jsonb_build_object(
        'id', r.id, 'kind', r.kind, 'note', r.note, 'created_at', r.created_at, 'market_id', r.market_id,
        'market_kind', m.kind, 'city_id', m.city_id, 'status', m.status, 'outcome', m.outcome, 'void_reason', m.void_reason, 'evidence', m.evidence, 'label', m.label)
        order by r.created_at desc)
      from (select * from public.reports where status = 'open' order by created_at desc limit 50) r left join public.markets m on m.id = r.market_id), '[]'::jsonb)
  ) into out;
  return out;
end $$;
revoke all on function public.admin_overview() from public, anon;
grant execute on function public.admin_overview() to authenticated;
