-- Video games (Steam players) and chess get a category of their own: "games".
alter table public.markets drop constraint if exists markets_category_check;
alter table public.markets add constraint markets_category_check
  check (category in ('bus','train','weather','traffic','nature','strike','finance','culture','sport','law','space','games'));
update public.markets set category = 'games' where params->>'series' ~ '^(steam|chess):' and category <> 'games';
