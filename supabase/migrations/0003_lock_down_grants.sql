-- Supabase grants broad table privileges to anon/authenticated by default; a column-level
-- REVOKE cannot undo a table-level GRANT. Start from nothing and grant only what the app needs.
revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
alter default privileges in schema public revoke all on tables from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;

-- Read-only public data
grant select on public.markets, public.cities, public.feed_health to anon, authenticated;
-- Own data (row level security still limits rows to the owner)
grant select on public.profiles, public.bets to authenticated;
-- The only things a player may edit directly. Credits, bets and timezone go through functions.
grant update (display_name, locale) on public.profiles to authenticated;

-- Functions: only the player-facing ones are callable from the client.
revoke execute on all functions in schema public from public, anon, authenticated;
grant execute on function public.ensure_profile(text, text, text) to authenticated;
grant execute on function public.set_city(text) to authenticated;
grant execute on function public.place_bet(uuid, text, integer) to authenticated;
grant execute on function public.claim_daily_refill() to authenticated;
