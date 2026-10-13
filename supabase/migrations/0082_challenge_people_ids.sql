-- The people list of a challenge also carries each player's id, so the app can draw their avatar next to the name (ids are already public in the rankings).
do $$
declare def text;
begin
  select pg_get_functiondef('public.challenge_view(public.friend_challenges)'::regprocedure) into def;
  def := replace(def, $a$jsonb_build_object('name', coalesce(nullif(p.display_name, ''), '?'),$a$, $a$jsonb_build_object('uid', fp.user_id, 'name', coalesce(nullif(p.display_name, ''), '?'),$a$);
  if position($a$'uid', fp.user_id$a$ in def) = 0 then raise exception 'patch did not apply'; end if;
  execute def;
end $$;
