-- Daily budget and pause switch for the paid-per-call match-details source (API-Football). Only the Edge Functions (service role) touch it.
create table if not exists public.api_budget (
  source text not null,
  day date not null default (now() at time zone 'utc')::date,
  used int not null default 0,
  remaining int,
  paused_until timestamptz,
  pause_reason text,
  primary key (source, day)
);
alter table public.api_budget enable row level security;

-- One call may go out: false when the source is paused or today's own cap is spent. Counts the call atomically.
create or replace function public.api_take(p_source text, p_cap int) returns boolean
language plpgsql security definer set search_path = public as $$
declare d date := (now() at time zone 'utc')::date; r public.api_budget;
begin
  insert into public.api_budget(source, day) values (p_source, d) on conflict do nothing;
  select * into r from public.api_budget where source = p_source and day = d for update;
  if exists (select 1 from public.api_budget where source = p_source and paused_until > now()) then return false; end if;
  if r.used >= p_cap then return false; end if;
  update public.api_budget set used = used + 1 where source = p_source and day = d;
  return true;
end $$;

-- What the source answered: the quota it says is left, and a pause when it complained (suspended, limit) or when almost nothing is left.
create or replace function public.api_report(p_source text, p_remaining int, p_pause_minutes int, p_reason text) returns void
language plpgsql security definer set search_path = public as $$
declare d date := (now() at time zone 'utc')::date;
begin
  insert into public.api_budget(source, day) values (p_source, d) on conflict do nothing;
  update public.api_budget set
    remaining = coalesce(p_remaining, remaining),
    paused_until = case when p_pause_minutes > 0 then now() + make_interval(mins => p_pause_minutes) else paused_until end,
    pause_reason = case when p_pause_minutes > 0 then left(p_reason, 200) else pause_reason end
  where source = p_source and day = d;
end $$;

revoke all on function public.api_take(text, int), public.api_report(text, int, int, text) from public, anon, authenticated;
grant execute on function public.api_take(text, int), public.api_report(text, int, int, text) to service_role;
