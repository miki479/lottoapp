-- "Super quota": when real data moves sharply (fuel list, gold, crypto, a big earthquake, a hurricane) one open question about it
-- gets boosted odds on the Yes side for an hour. At most two a day for everybody; the same subject is never boosted twice in 12 hours.
alter table public.markets drop constraint if exists markets_flash_kind_check;
alter table public.markets add constraint markets_flash_kind_check check (flash_kind in ('weather_alert', 'rush', 'super'));

create table if not exists public.super_log (
  id bigserial primary key,
  day date not null default (now() at time zone 'utc')::date,
  subject text not null,
  reason text not null,
  market_id uuid references public.markets(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table public.super_log enable row level security;
revoke all on public.super_log from anon, authenticated;

create or replace function public.make_super(p_market uuid, p_subject text, p_reason text, p_value text, p_mult numeric default 1.6)
returns boolean language plpgsql security definer set search_path = public as $$
declare m public.markets;
begin
  if (select count(*) from public.super_log where day = (now() at time zone 'utc')::date) >= 2 then return false; end if;
  if exists (select 1 from public.super_log where subject = p_subject and created_at > now() - interval '12 hours') then return false; end if;
  select * into m from public.markets where id = p_market and status = 'open' and flash_multiplier = 1 and closes_at > now() + interval '20 minutes' for update;
  if not found then return false; end if;
  update public.markets set base_odds_yes = odds_yes, odds_yes = least(15, round(odds_yes * p_mult, 2)), flash_multiplier = p_mult, flash_kind = 'super',
         flash_until = least(closes_at, now() + interval '60 minutes'), flash_notified = false,
         params = params || jsonb_build_object('super', jsonb_build_object('reason', p_reason, 'subject', p_subject, 'value', p_value))
   where id = p_market;
  insert into public.super_log (subject, reason, market_id) values (p_subject, p_reason, p_market);
  return true;
end $$;
revoke all on function public.make_super(uuid, text, text, text, numeric) from public, anon, authenticated;
grant execute on function public.make_super(uuid, text, text, text, numeric) to service_role;
