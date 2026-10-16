-- National strikes (Italy only in the app) are their own category, shown in a separate section.
alter table public.markets drop constraint if exists markets_category_check;
alter table public.markets add constraint markets_category_check check (category in ('bus','train','weather','traffic','nature','strike'));
