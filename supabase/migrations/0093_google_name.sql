-- People who sign in with Google rarely pick a nickname: take the first name from the Google profile when they have none.
-- Someone who already has a nickname keeps it. A taken or refused name gets the last initial, then a number.
create or replace function public.pick_google_name(p_user uuid) returns text
language plpgsql volatile security definer set search_path = public as $$
declare
  raw text; first text; last text; cand text; i int; cur text;
begin
  select display_name into cur from public.profiles where id = p_user;
  if cur is not null then return cur; end if;
  select coalesce(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name') into raw from auth.users u where u.id = p_user;
  raw := trim(regexp_replace(regexp_replace(coalesce(raw, ''), '[^0-9a-zA-ZÀ-ÿ_ .぀-ヿ一-鿿-]', '', 'g'), '\s+', ' ', 'g'));
  if raw = '' then return null; end if;
  first := split_part(raw, ' ', 1);
  last := nullif(split_part(raw, ' ', 2), '');
  for i in 0..6 loop
    cand := case when i = 0 then first when i = 1 and last is not null then first || ' ' || left(last, 1) when i = 1 then first || ' ' || (10 + floor(random() * 90))::int else coalesce(first || ' ' || left(last, 1), first) || ' ' || (10 + floor(random() * 90))::int end;
    if char_length(cand) >= 2 and public.nickname_check(cand) = 'ok' then
      begin
        update public.profiles set display_name = cand where id = p_user and display_name is null;
        if found then return cand; end if;
      exception when unique_violation then null;
      end;
    end if;
  end loop;
  return null;
end $$;
revoke all on function public.pick_google_name(uuid) from public, anon, authenticated;

create or replace function public.claim_google_name() returns text
language plpgsql volatile security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if not public.is_registered() then return null; end if;
  return public.pick_google_name(auth.uid());
end $$;
grant execute on function public.claim_google_name() to authenticated;

-- the Google accounts that exist already and never chose a nickname
select public.pick_google_name(p.id) from public.profiles p join auth.users u on u.id = p.id
 where p.display_name is null and u.raw_app_meta_data->>'provider' = 'google';
