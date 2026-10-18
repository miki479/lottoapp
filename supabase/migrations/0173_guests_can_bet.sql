-- A visitor can place the first bets as a guest: the profile is asked for later. Before, the first stake met a sign-up wall
-- (7 of 213 new profiles in a week ever bet). Set back to 'true' to ask for e-mail or Google at the first stake again.
update public.app_settings set value = 'false' where key = 'registration_required';
