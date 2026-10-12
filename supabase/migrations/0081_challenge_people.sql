-- Challenge pages list who has joined from the start; what each one picked (and won) is shown only once it is closed.
do $$
declare def text;
begin
  select pg_get_functiondef('public.challenge_view(public.friend_challenges)'::regprocedure) into def;
  def := replace(def, $a$'people', case when now() >= ch.closes_at or ch.status <> 'open' then$a$, $a$'people', case when true then$a$);
  def := replace(def, $a$'pick', fp.pick, 'payout', fp.payout) order by fp.created_at), '[]'::jsonb)$a$, $a$'pick', case when now() >= ch.closes_at or ch.status <> 'open' then fp.pick end, 'payout', case when now() >= ch.closes_at or ch.status <> 'open' then fp.payout end) order by fp.created_at), '[]'::jsonb)$a$);
  def := replace(def, $a$from public.friend_picks fp join public.profiles p on p.id = fp.user_id where fp.challenge_id = ch.id) else$a$, $a$from (select * from public.friend_picks where challenge_id = ch.id order by created_at limit 30) fp join public.profiles p on p.id = fp.user_id) else$a$);
  if position('limit 30' in def) = 0 or position('case when true' in def) = 0 then raise exception 'patch did not apply'; end if;
  execute def;
end $$;
