-- my_progress() no longer fails with a foreign-key error when the profile row does not exist yet.
create or replace function public.my_progress() returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); x integer; lv integer; p public.profiles; got text[] := '{}';
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  -- a brand-new session whose profile row is not there yet: nothing to report (the app asks again a moment later)
  if not exists (select 1 from public.profiles where id = uid) then
    return jsonb_build_object('xp', 0, 'level', 1, 'avatar', 'conductor', 'decoration', null, 'granted', '[]'::jsonb, 'owned', '[]'::jsonb);
  end if;
  if not exists (select 1 from public.trophy_checks where user_id = uid and checked_at > now() - interval '2 minutes') then
    got := public.evaluate_trophies(uid);
    insert into public.trophy_checks (user_id) values (uid) on conflict (user_id) do update set checked_at = now();
  end if;
  select * into p from public.profiles where id = uid;
  x := public.xp_of(uid); lv := public.level_of_xp(x);
  if p.level <> lv then update public.profiles set level = lv where id = uid; end if;
  return jsonb_build_object('xp', x, 'level', lv, 'avatar', p.avatar, 'decoration', p.decoration, 'granted', to_jsonb(got),
    'owned', coalesce((select jsonb_agg(decoration_id) from public.user_decorations where user_id = uid), '[]'::jsonb));
end $$;
grant execute on function public.my_progress() to authenticated;
