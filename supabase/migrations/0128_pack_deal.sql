-- Deal of the day: every day (UTC) one of the three bigger packs costs 20 / 25 / 30% less, rotating. Price paid, refund and the pack row in the app all follow it.
create or replace function public.shop_deal(p_at timestamptz default now()) returns table(tier integer, pct integer)
language sql immutable as $$
  select 2 + (d % 3), (array[20, 30, 25])[1 + ((d / 3) % 3)]
  from (select floor(extract(epoch from p_at) / 86400)::integer as d) x
$$;
grant execute on function public.shop_deal(timestamptz) to anon, authenticated;

create or replace function public.buy_pack(p_tier integer) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid(); p public.profiles; pk record; dl record; paid integer; lim record; day_start timestamptz; opened integer; last_at timestamptz;
  roll integer; rar text; n integer; k integer; it record; dup boolean; refund integer := 0; bal integer; oid uuid;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if not public.is_registered() then raise exception 'registration_required'; end if;
  select * into pk from public.shop_packs() where tier = p_tier;
  if not found then raise exception 'unknown_pack'; end if;
  -- the deal of the day: one pack of the 250 / 700 / 2000 tiers is cheaper until midnight UTC (mirrors dealOf in shared/shop.ts)
  select * into dl from public.shop_deal();
  paid := pk.price - case when pk.tier = dl.tier then floor(pk.price * dl.pct / 100.0)::integer else 0 end;
  select * into lim from public.shop_limits();
  select * into p from public.profiles where id = uid for update;
  if not found then raise exception 'no_profile'; end if;
  day_start := ((now() at time zone p.timezone)::date)::timestamp at time zone p.timezone;
  select count(*), max(created_at) into opened, last_at from public.shop_openings where user_id = uid and created_at >= day_start;
  if last_at is not null and last_at > now() - make_interval(secs => lim.gap_sec) then raise exception 'too_fast'; end if;
  if opened >= lim.daily_cap then raise exception 'pack_limit'; end if;
  if p.credits < paid then raise exception 'insufficient_credits'; end if;

  -- rarity: the first slice of the odds that covers a draw in 0..9999; item: uniform inside the rarity, ordered by kind then id
  roll := floor(random() * 10000)::integer;
  rar := case when roll < pk.p_common then 'common'
              when roll < pk.p_common + pk.p_rare then 'rare'
              when roll < pk.p_common + pk.p_rare + pk.p_epic then 'epic'
              else 'legendary' end;
  select count(*) into n from public.shop_items() where rarity = rar;
  k := 1 + floor(random() * n)::integer;                    -- drawn once: a volatile call inside the WHERE would be redrawn for every row
  select s.kind, s.id into it from (
    select i.kind, i.id, row_number() over (order by i.kind, i.id) as rn from public.shop_items() i where i.rarity = rar) s
   where s.rn = k;

  if it.kind = 'avatar' then
    dup := exists (select 1 from public.user_avatars where user_id = uid and avatar_id = it.id);
    if not dup then insert into public.user_avatars (user_id, avatar_id) values (uid, it.id) on conflict do nothing; end if;
  elsif it.kind = 'card' then
    dup := exists (select 1 from public.user_cards where user_id = uid and card_id = it.id);
    if not dup then insert into public.user_cards (user_id, card_id) values (uid, it.id) on conflict do nothing; end if;
  else
    dup := exists (select 1 from public.user_decorations where user_id = uid and decoration_id = it.id);
    if not dup then insert into public.user_decorations (user_id, decoration_id) values (uid, it.id) on conflict do nothing; end if;
  end if;
  if dup then refund := floor(paid * lim.refund_pct / 100.0)::integer; end if;

  update public.profiles set credits = credits - paid + refund where id = uid returning credits into bal;
  insert into public.shop_openings (user_id, tier, price, item_kind, item_id, rarity, duplicate, refund)
  values (uid, pk.tier, paid, it.kind, it.id, rar, dup, refund) returning id into oid;
  return jsonb_build_object('id', oid, 'tier', pk.tier, 'price', paid, 'list_price', pk.price, 'kind', it.kind, 'item', it.id, 'rarity', rar,
                            'duplicate', dup, 'refund', refund, 'balance', bal, 'opened_today', opened + 1, 'daily_cap', lim.daily_cap);
end $$;
grant execute on function public.buy_pack(integer) to authenticated;
revoke execute on function public.buy_pack(integer) from public, anon;
