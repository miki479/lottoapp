-- Aircraft over Italy get a main category of their own: "flights" (a chip next to trains and buses).
alter table public.markets drop constraint if exists markets_category_check;
alter table public.markets add constraint markets_category_check
  check (category in ('bus','train','weather','traffic','nature','strike','finance','culture','sport','law','space','games','flights'));
update public.markets set category = 'flights' where params->>'series' = 'flights:it' and category <> 'flights';
