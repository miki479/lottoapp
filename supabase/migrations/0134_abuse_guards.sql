-- Abuse guards: invite farming from one phone / one address / aliases of one mailbox, and internal jobs that no player should be able to call.

-- 1. what the server can tell about the caller (PostgREST puts the request headers in a setting)
create or replace function public.req_header(h text) returns text language sql stable as $$
  select (nullif(current_setting('request.headers', true), '')::json) ->> h
$$;
create or replace function public.client_ip_hash() returns text language sql stable as $$
  select md5('lb-ip:' || coalesce(public.req_header('cf-connecting-ip'), split_part(coalesce(public.req_header('x-forwarded-for'), ''), ',', 1), ''))
$$;
-- one mailbox, many spellings: dots (gmail), +tag, googlemail
create or replace function public.norm_email(e text) returns text language sql immutable as $$
  select case
    when e is null or position('@' in e) = 0 then lower(coalesce(e, ''))
    else (
      select case when d in ('gmail.com', 'googlemail.com') then replace(split_part(l, '+', 1), '.', '') || '@gmail.com' else split_part(l, '+', 1) || '@' || d end
      from (select lower(split_part(e, '@', 1)) as l, lower(split_part(e, '@', 2)) as d) x
    ) end
$$;

-- 2. who invited whom, from where
create table if not exists public.referral_log (
  invitee uuid primary key,
  inviter uuid not null,
  ip_hash text,
  dev_hash text,
  at timestamptz not null default now()
);
create index if not exists referral_log_ip on public.referral_log (ip_hash, at);
create index if not exists referral_log_dev on public.referral_log (dev_hash);
alter table public.referral_log enable row level security;
revoke all on public.referral_log from anon, authenticated;

drop function if exists public.redeem_referral(text);
create or replace function public.redeem_referral(p_code text, p_device text default null) returns boolean
language plpgsql security definer set search_path = public as $$
declare inviter uuid;
begin
  if not public.is_registered() then raise exception 'registration_required'; end if;
  select id into inviter from public.profiles where referral_code = upper(trim(p_code));
  if inviter is null or inviter = auth.uid() then return false; end if;
  update public.profiles set referred_by = inviter where id = auth.uid() and referred_by is null;
  if not found then return false; end if;
  insert into public.referral_log (invitee, inviter, ip_hash, dev_hash)
  values (auth.uid(), inviter, public.client_ip_hash(), case when length(coalesce(p_device, '')) between 8 and 64 then md5('lb-dev:' || p_device) end)
  on conflict do nothing;
  perform public.add_friendship(inviter, auth.uid());
  return true;
end $$;
grant execute on function public.redeem_referral(text, text) to authenticated;

-- 3. the inviter is paid only for a real player: three bets made, not the same mailbox, not the same device or address over and over, at most three a day
create or replace function public.pay_referral(p_uid uuid) returns void
language plpgsql security definer set search_path = public as $$
declare inv uuid; ok boolean := true; l public.referral_log; em_a text; em_b text;
begin
  select referred_by into inv from public.profiles where id = p_uid and not referral_paid;
  if inv is null then return; end if;
  if (select count(*) from public.bets where user_id = p_uid) + (select count(*) from public.parlays where user_id = p_uid) < 3 then return; end if;
  update public.profiles set referral_paid = true where id = p_uid;
  select * into l from public.referral_log where invitee = p_uid;
  select public.norm_email(email) into em_a from auth.users where id = p_uid;
  select public.norm_email(email) into em_b from auth.users where id = inv;
  if em_a is not null and em_a = em_b then ok := false; end if;
  if ok and l.ip_hash is not null and (select count(*) from public.referral_log x where x.ip_hash = l.ip_hash and x.at > now() - interval '1 day') > 3 then ok := false; end if;
  if ok and l.dev_hash is not null and (select count(*) from public.referral_log x where x.dev_hash = l.dev_hash) > 2 then ok := false; end if;
  if ok and (select count(*) from public.referral_payouts where inviter = inv and paid_at > now() - interval '1 day') >= 3 then ok := false; end if;
  if not ok then return; end if;
  insert into public.referral_payouts (invitee, inviter) values (p_uid, inv) on conflict do nothing;
  if found and (select count(*) from public.referral_payouts where inviter = inv) <= 10 then
    update public.profiles set credits = credits + 1500 where id = inv;
  end if;
end $$;
revoke execute on function public.pay_referral(uuid) from public, anon, authenticated;

-- 4. jobs and triggers: run by cron / the database only
do $$ declare f text; begin
  foreach f in array array['rank_watch()', 'refresh_nudge_hours()', 'snapshot_tracked()', 'snapshot_market(uuid)', 'markets_odds_guard()', 'refund_open_challenge()', 'req_header(text)', 'client_ip_hash()'] loop
    execute format('revoke execute on function public.%s from public, anon, authenticated', f);
  end loop;
end $$;

-- 5. messages from the contact form (read in the dashboard, never by players)
create table if not exists public.contact_messages (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  user_id uuid,
  email text,
  message text not null,
  ip_hash text
);
alter table public.contact_messages enable row level security;
revoke all on public.contact_messages from anon, authenticated;
create index if not exists contact_messages_ip on public.contact_messages (ip_hash, at);
