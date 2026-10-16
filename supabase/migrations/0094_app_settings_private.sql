-- app_settings was readable by anyone (policy "settings are public", using true): that exposed the admin e-mail (admin_emails),
-- the queued direct messages ("direct:*", with the player's id and gifts) and the broadcast text. Only the registration rule is
-- meant to be public; everything else is read by security-definer functions and the service role, which bypass RLS.
drop policy if exists "settings are public" on public.app_settings;
create policy "settings are public" on public.app_settings for select using (key = 'registration_required');
