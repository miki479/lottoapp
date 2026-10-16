-- Second pass: only Latin, Japanese, digits and a few separators are allowed in names (no look-alike Cyrillic/Greek letters),
-- full-width forms are folded, and a few innocent words that contain a banned stem are allowed.
insert into public.moderation_allow (term) values ('shiitake'), ('shitake'), ('shitzu') on conflict do nothing;
create or replace function public.mod_prep(p text) returns text language sql immutable as $$
  select translate(lower(normalize(coalesce(p, ''), NFKC)), 'àáâäãåèéêëìíîïòóôöõùúûüçñ013457$@!|€', 'aaaaaaeeeeiiiiooooouuuucnoieastsaiie');
$$;
create or replace function public.nickname_check(p_name text) returns text
language plpgsql volatile security definer set search_path = public as $$
declare
  n text := trim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g')); hit text;
begin
  if char_length(n) < 2 or char_length(n) > 24 or n !~ '^[0-9a-zA-ZÀ-ÿ_ .\u3040-\u30FF\u4E00-\u9FFF-]+$' then return 'bad_nickname'; end if;
  hit := public.mod_check(n);
  if hit is not null then
    if (select count(*) from public.moderation_log where created_at > now() - interval '1 hour') < 60
       and not exists (select 1 from public.moderation_log where text = n and created_at > now() - interval '1 day') then
      insert into public.moderation_log (user_id, text, matched, source) values (auth.uid(), left(n, 40), hit, 'nickname');
    end if;
    return 'nickname_not_allowed';
  end if;
  if exists (select 1 from public.profiles where lower(display_name) = lower(n)) then return 'nickname_taken'; end if;
  return 'ok';
end $$;
grant execute on function public.nickname_check(text) to anon, authenticated;

create or replace function public.set_nickname(p_name text) returns text
language plpgsql security definer set search_path = public as $$
declare n text := trim(regexp_replace(coalesce(p_name, ''), '\s+', ' ', 'g'));
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if not public.is_registered() then raise exception 'registration_required'; end if;
  if char_length(n) < 2 or char_length(n) > 24 or n !~ '^[0-9a-zA-ZÀ-ÿ_ .\u3040-\u30FF\u4E00-\u9FFF-]+$' then raise exception 'bad_nickname'; end if;
  if public.mod_check(n) is not null then raise exception 'nickname_not_allowed'; end if;
  begin
    update public.profiles set display_name = n where id = auth.uid();
  exception when unique_violation then raise exception 'nickname_taken';
  end;
  return n;
end $$;
grant execute on function public.set_nickname(text) to authenticated;

