-- Pack economy: the newest decorations are rarer inside their rarity (cards and profile pictures weigh more), a lucky hour comes round on a schedule,
-- a streak of eight dull packs ends with an epic, and a launch promo cuts every pack (10 / 15 / 20 / 25%, never stacked with the deal of the day).
create or replace function public.shop_weight(p_kind text, p_id text) returns integer
language sql immutable as $$
  select case
    when p_kind = 'decoration' and p_id in ('cinder','rosegold','starlight','aurum','glacier','crimson','azure','vortex','onyx') then 25
    when p_kind = 'decoration' then 60
    when p_kind = 'avatar' then 130
    else 160 end
$$;
revoke execute on function public.shop_weight(text, text) from public, anon, authenticated;

create or replace function public.shop_lucky_active() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select value::timestamptz > now() from public.app_settings where key = 'lucky_until'), false)
$$;
create or replace function public.shop_promo_active() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select value::timestamptz > now() from public.app_settings where key = 'promo_until'), false)
$$;
revoke execute on function public.shop_lucky_active() from public, anon, authenticated;
revoke execute on function public.shop_promo_active() from public, anon, authenticated;

-- what the app shows: when the lucky hour and the promo end (null when not running)
create or replace function public.shop_status() returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'lucky_until', (select value from public.app_settings where key = 'lucky_until' and value::timestamptz > now()),
    'promo_until', (select value from public.app_settings where key = 'promo_until' and value::timestamptz > now()))
$$;
grant execute on function public.shop_status() to anon, authenticated;

-- a lucky hour (30 minutes) at four fixed times a day, UTC
select cron.unschedule('lucky-hour') where exists (select 1 from cron.job where jobname = 'lucky-hour');
select cron.schedule('lucky-hour', '2 9,13,18,21 * * *', $$ insert into public.app_settings (key, value) values ('lucky_until', (now() + interval '30 minutes')::text) on conflict (key) do update set value = excluded.value $$);
-- the launch promo: 72 hours from now
insert into public.app_settings (key, value) values ('promo_until', (now() + interval '72 hours')::text) on conflict (key) do update set value = excluded.value;

create or replace function public.buy_pack(p_tier integer) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid(); p public.profiles; pk record; dl record; paid integer; lim record; day_start timestamptz; opened integer; last_at timestamptz;
  roll integer; rar text; it record; lucky boolean; promo boolean; pct integer := 0; pc integer; pr integer; pe integer; pl integer; streak integer := 0; total numeric; target numeric; dup boolean; refund integer := 0; bal integer; oid uuid;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if not public.is_registered() then raise exception 'registration_required'; end if;
  select * into pk from public.shop_packs() where tier = p_tier;
  if not found then raise exception 'unknown_pack'; end if;
  -- the deal of the day: one pack of the 250 / 700 / 2000 tiers is cheaper until midnight UTC (mirrors dealOf in shared/shop.ts)
  select * into dl from public.shop_deal();
  -- the launch promo: every pack is cheaper for a while, the bigger the pack the bigger the cut; it never stacks with the deal of the day (the better of the two wins)
  promo := public.shop_promo_active();
  if promo then pct := (array[10, 15, 20, 25])[pk.tier]; end if;
  if pk.tier = dl.tier and dl.pct > pct then pct := dl.pct; end if;
  paid := pk.price - floor(pk.price * pct / 100.0)::integer;
  select * into lim from public.shop_limits();
  select * into p from public.profiles where id = uid for update;
  if not found then raise exception 'no_profile'; end if;
  day_start := ((now() at time zone p.timezone)::date)::timestamp at time zone p.timezone;
  select count(*), max(created_at) into opened, last_at from public.shop_openings where user_id = uid and created_at >= day_start;
  if last_at is not null and last_at > now() - make_interval(secs => lim.gap_sec) then raise exception 'too_fast'; end if;
  if opened >= lim.daily_cap then raise exception 'pack_limit'; end if;
  if p.credits < paid then raise exception 'insufficient_credits'; end if;

  -- rarity: the first slice of the odds that covers a draw in 0..9999. In a lucky hour the epic and legendary slices are half as big again (taken from the commons)
  lucky := public.shop_lucky_active();
  pc := pk.p_common; pr := pk.p_rare; pe := pk.p_epic; pl := pk.p_legendary;
  if lucky then pe := pk.p_epic + pk.p_epic / 2; pl := pk.p_legendary + pk.p_legendary / 2; pc := pk.p_common - (pe - pk.p_epic) - (pl - pk.p_legendary); end if;
  roll := floor(random() * 10000)::integer;
  rar := case when roll < pc then 'common' when roll < pc + pr then 'rare' when roll < pc + pr + pe then 'epic' else 'legendary' end;
  -- a kindness: eight opened packs of the 250+ tiers in a row without anything epic or better, and the next one is epic
  if pk.tier >= 2 and rar in ('common', 'rare') then
    select count(*) into streak from (
      select rarity, row_number() over (order by created_at desc) as rn from public.shop_openings where user_id = uid and tier >= 2 order by created_at desc limit 8) r
     where rarity in ('common', 'rare');
    if streak >= 8 then rar := 'epic'; end if;
  end if;
  -- item: weighted inside the rarity, ordered by kind then id (the weights favour cards and profile pictures over the newest decorations)
  select sum(public.shop_weight(kind, id)) into total from public.shop_items() where rarity = rar;
  target := random() * total;                                -- drawn once: a volatile call inside the query would be redrawn for every row
  select s.kind, s.id into it from (
    select i.kind, i.id, sum(public.shop_weight(i.kind, i.id)) over (order by i.kind, i.id) as run from public.shop_items() i where i.rarity = rar) s
   where s.run > target order by s.run limit 1;

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
                            'duplicate', dup, 'refund', refund, 'balance', bal, 'opened_today', opened + 1, 'daily_cap', lim.daily_cap, 'promo_pct', pct, 'lucky', lucky);
end $$;
grant execute on function public.buy_pack(integer) to authenticated;
revoke execute on function public.buy_pack(integer) from public, anon;
