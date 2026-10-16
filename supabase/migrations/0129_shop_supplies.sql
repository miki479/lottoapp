-- Shop supplies: boosts and streak freezes sold for credits, in singles and bundles (mirrors SUPPLIES in shared/shop.ts, tested).
-- Prices are set against what a boost can earn (it doubles the net win of one bet, the extra capped at 1000: worth up to ~800 on the best bet) so buying
-- boosts is never a way to print credits. Stock stays capped as everywhere else: 20 boosts, 2 freezes.
create or replace function public.shop_supplies() returns table(id text, price integer, boosts integer, freezes integer)
language sql immutable as $$
  select * from (values
    ('boost1',  750, 1, 0),
    ('boost5', 3250, 5, 0),
    ('freeze1', 400, 0, 1),
    ('kit',    2650, 3, 2)
  ) as t(id, price, boosts, freezes)
$$;
grant execute on function public.shop_supplies() to anon, authenticated;

create table if not exists public.shop_supply_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  item text not null,
  price integer not null,
  created_at timestamptz not null default now()
);
alter table public.shop_supply_log enable row level security;
revoke all on public.shop_supply_log from anon, authenticated;

create or replace function public.buy_supply(p_item text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); s record; p public.profiles; bal integer;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if not public.is_registered() then raise exception 'registration_required'; end if;
  select * into s from public.shop_supplies() where id = p_item;
  if not found then raise exception 'unknown_item'; end if;
  select * into p from public.profiles where id = uid for update;
  if not found then raise exception 'no_profile'; end if;
  if p.credits < s.price then raise exception 'insufficient_credits'; end if;
  if p.boosts + s.boosts > 20 or p.freezes + s.freezes > 2 then raise exception 'stock_full'; end if;
  update public.profiles set credits = credits - s.price, boosts = boosts + s.boosts, freezes = freezes + s.freezes where id = uid
    returning credits into bal;
  insert into public.shop_supply_log (user_id, item, price) values (uid, s.id, s.price);
  return jsonb_build_object('item', s.id, 'price', s.price, 'balance', bal, 'boosts', p.boosts + s.boosts, 'freezes', p.freezes + s.freezes);
end $$;
grant execute on function public.buy_supply(text) to authenticated;
revoke execute on function public.buy_supply(text) from public, anon;
