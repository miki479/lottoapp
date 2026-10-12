-- Private challenges: any stake from 0 to 1000 (it is play money), not only 10 / 25 / 50.
do $$
declare c text;
begin
  for c in select conname from pg_constraint where conrelid = 'public.friend_challenges'::regclass and contype = 'c' and pg_get_constraintdef(oid) like '%stake%' loop
    execute format('alter table public.friend_challenges drop constraint %I', c);
  end loop;
end $$;
alter table public.friend_challenges add constraint friend_challenges_stake_check check (stake between 0 and 1000);

do $$
declare def text;
begin
  select pg_get_functiondef('public.create_challenge(text,text,integer,timestamptz,text,text,boolean)'::regprocedure) into def;
  def := replace(def, 'if stake not in (0, 10, 25, 50) then', 'if stake is null or stake < 0 or stake > 1000 then');
  execute def;
end $$;
