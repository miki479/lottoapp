-- Privacy tools: a copy of the player's own data (portability) and a record of when the terms and the age confirmation were accepted.
alter table public.profiles add column if not exists terms_version text, add column if not exists terms_accepted_at timestamptz;

create or replace function public.accept_terms(p_version text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  update public.profiles set terms_version = left(p_version, 20), terms_accepted_at = now() where id = auth.uid();
end $$;
revoke all on function public.accept_terms(text) from public, anon;
grant execute on function public.accept_terms(text) to authenticated;

create or replace function public.export_my_data() returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); out jsonb; t text; x jsonb;
  tables text[] := array['bets','bank_deposits','challenge_invites','challenge_reports','contact_messages','daily_claims','daily_progress','friend_picks','friend_votes','friendships','group_members','league_seasons','market_reminders','market_shares','moderation_log','nearby_hits','parlays','personal_offers','push_log','quake_custom','quest_claims','rank_events','rank_snapshot','reports','shop_openings','shop_supply_log','trophies','user_avatars','user_cards','user_decorations','user_messages'];
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  select jsonb_build_object('exported_at', now(), 'account_id', uid, 'profile', (select to_jsonb(p) from public.profiles p where p.id = uid),
    'email', (select email from auth.users where id = uid)) into out;
  foreach t in array tables loop
    execute format('select coalesce(jsonb_agg(to_jsonb(r)), ''[]''::jsonb) from (select * from public.%I where user_id = $1 limit 5000) r', t) into x using uid;
    out := out || jsonb_build_object(t, x);
  end loop;
  out := out || jsonb_build_object('parlay_legs', (select coalesce(jsonb_agg(to_jsonb(l)), '[]'::jsonb) from public.parlay_legs l where l.parlay_id in (select id from public.parlays where user_id = uid)));
  out := out || jsonb_build_object('created_markets', (select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'label', m.label, 'created_at', m.created_at)), '[]'::jsonb) from public.markets m where m.created_by = uid));
  return out;
end $$;
revoke all on function public.export_my_data() from public, anon;
grant execute on function public.export_my_data() to authenticated;
