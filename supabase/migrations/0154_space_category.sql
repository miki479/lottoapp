-- "Space & Earth" is a category of its own (rocket launches, asteroids, NASA natural events); Formula 1 questions belong to sport.
alter table public.markets drop constraint if exists markets_category_check;
alter table public.markets add constraint markets_category_check
  check (category in ('bus','train','weather','traffic','nature','strike','finance','culture','sport','law','space'));
update public.markets set category = 'space' where params->>'series' ~ '^(launch|neo|eonet):' and category <> 'space';
update public.markets set category = 'sport' where params->>'series' ~ '^f1:' and category <> 'sport';
