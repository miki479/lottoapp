-- Rewards sheet: a seven-day daily bonus calendar and a shop of cosmetic packs. Fake credits only, no real money, nothing is for sale.
--
-- ONE daily reward system. The streak the game already keeps (profiles.streak / freezes / last_play_date, moved by register_play)
-- IS the calendar: streak day n pays 100 * n credits (day 7 -> back to day 1), claimed once per local day of the profile timezone,
-- and only once a bet has counted today (the same condition that moves the streak). Freezes cover a missed day exactly as before.
-- Nothing in register_play, claim_daily_refill or the streak milestones (3/7/14/30 days) changes: the calendar is paid on top.
--
-- The shop turns credits into collectibles (a sink: a pack never returns more than 10% of its price, and only when the item is a duplicate).
-- A pack holds one item: one of 100 numbered "figurine" cards (every category of the app: transport, weather, nature, sport, games, finance,
-- culture, law) or, as the rarer pulls, one of 11 looks (collectible avatars and decorations).
-- Avatars become collectible: four stay free for everybody, six are won in packs. Everyone keeps the avatar they wear now.
-- Mirrors shared/shop.ts (tests/shop.test.ts reads the numbers below).

-- ============ 1. avatars you own ============
create table if not exists public.user_avatars (
  user_id uuid not null references public.profiles(id) on delete cascade,
  avatar_id text not null check (avatar_id in ('conductor','busbot','cloud','fox','ball','bolt','alien','astro','clock','kandinsky')),
  created_at timestamptz not null default now(),
  primary key (user_id, avatar_id)
);
alter table public.user_avatars enable row level security;
drop policy if exists "own avatars" on public.user_avatars;
create policy "own avatars" on public.user_avatars for select using (auth.uid() = user_id);
grant select on public.user_avatars to authenticated;

-- The figurine cards a player owns (one row per card; the copies that came out of packs are counted in shop_openings).
create table if not exists public.user_cards (
  user_id uuid not null references public.profiles(id) on delete cascade,
  card_id text not null check (card_id ~ '^c[0-9]{3}$'),
  created_at timestamptz not null default now(),
  primary key (user_id, card_id)
);
alter table public.user_cards enable row level security;
drop policy if exists "own cards" on public.user_cards;
create policy "own cards" on public.user_cards for select using (auth.uid() = user_id);
grant select on public.user_cards to authenticated;

-- Free for everybody.
create or replace function public.default_avatars() returns text[]
language sql immutable as $$ select array['conductor','busbot','cloud','fox']::text[] $$;
revoke execute on function public.default_avatars() from public, anon, authenticated;

-- Nobody loses what they wear today.
insert into public.user_avatars (user_id, avatar_id)
select id, avatar from public.profiles where not (avatar = any (public.default_avatars()))
on conflict do nothing;

-- set_look as in 0066, plus: a collectible avatar must be owned (or already be the one worn).
create or replace function public.set_look(p_avatar text, p_decoration text) returns void
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); lv integer; d public.decorations; cur text;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if p_avatar is not null then
    select avatar into cur from public.profiles where id = uid;
    if p_avatar is distinct from cur and not (p_avatar = any (public.default_avatars()))
       and not exists (select 1 from public.user_avatars where user_id = uid and avatar_id = p_avatar) then
      raise exception 'avatar_locked';
    end if;
  end if;
  if p_decoration is not null then
    select * into d from public.decorations where id = p_decoration;
    if not found then raise exception 'unknown_decoration'; end if;
    lv := public.level_of_xp(public.xp_of(uid));
    if not ((d.level is not null and d.level <= lv) or exists (select 1 from public.user_decorations where user_id = uid and decoration_id = p_decoration)) then
      raise exception 'decoration_locked';
    end if;
  end if;
  update public.profiles set avatar = coalesce(p_avatar, avatar), decoration = p_decoration where id = uid;
end $$;
grant execute on function public.set_look(text, text) to authenticated;
revoke execute on function public.set_look(text, text) from public, anon;

-- The avatars the caller can wear: the free ones, the won ones and the one worn now.
create or replace function public.my_avatars() returns text[]
language sql security definer stable set search_path = public as $$
  select coalesce(array_agg(a order by a), '{}'::text[]) from (
    select unnest(public.default_avatars()) as a
    union select avatar_id from public.user_avatars where user_id = auth.uid()
    union select avatar from public.profiles where id = auth.uid()
  ) t
$$;
grant execute on function public.my_avatars() to authenticated;
revoke execute on function public.my_avatars() from public, anon;

-- ============ 2. daily bonus ============
-- Credits for day 1..7 of the calendar (shared/shop.ts DAILY_AMOUNTS).
create or replace function public.daily_amounts() returns table(day integer, amount integer)
language sql immutable as $$
  select * from (values (1, 100), (2, 200), (3, 300), (4, 400), (5, 500), (6, 600), (7, 700)) as t(day, amount)
$$;
revoke execute on function public.daily_amounts() from public, anon, authenticated;

-- Streak length -> credits; after day 7 the calendar starts again.
create or replace function public.daily_amount(p_streak integer) returns integer
language sql immutable as $$
  select amount from public.daily_amounts() where day = ((greatest(coalesce(p_streak, 1), 1) - 1) % 7) + 1
$$;
revoke execute on function public.daily_amount(integer) from public, anon, authenticated;

create table if not exists public.daily_claims (
  user_id uuid not null references public.profiles(id) on delete cascade,
  day date not null,                       -- the local day (profile timezone)
  streak integer not null,                 -- streak length that day
  cycle_day integer not null check (cycle_day between 1 and 7),
  amount integer not null check (amount > 0),
  claimed_at timestamptz not null default now(),
  primary key (user_id, day)
);
alter table public.daily_claims enable row level security;
revoke all on public.daily_claims from public, anon, authenticated;

-- What the calendar shows. A bet "counts" today when last_play_date is today (register_play sets it on the first bet of the day).
-- Before that, the day shown is the one a bet would reach, by the same rule as register_play (yesterday: +1; two days ago with a freeze: +1; else day 1).
create or replace function public.daily_bonus() returns jsonb
language plpgsql security definer stable set search_path = public as $$
declare uid uuid := auth.uid(); p public.profiles; today date; counted boolean; eff integer; uses_freeze boolean := false; claimed boolean;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  select * into p from public.profiles where id = uid;
  if not found then raise exception 'no_profile'; end if;
  today := (now() at time zone p.timezone)::date;
  counted := p.last_play_date is not distinct from today;
  if counted then eff := greatest(p.streak, 1);
  elsif p.last_play_date = today - 1 then eff := p.streak + 1;
  elsif p.last_play_date = today - 2 and p.freezes > 0 then eff := p.streak + 1; uses_freeze := true;
  else eff := 1; end if;
  claimed := exists (select 1 from public.daily_claims where user_id = uid and day = today);
  return jsonb_build_object(
    'day', today, 'streak', p.streak, 'freezes', p.freezes,
    'counted', counted, 'claimed', claimed, 'ready', counted and not claimed,
    'eff_streak', eff, 'cycle_day', ((eff - 1) % 7) + 1, 'amount', public.daily_amount(eff),
    'uses_freeze', uses_freeze, 'lapsed', (not counted) and eff = 1 and p.streak > 1,
    'amounts', (select jsonb_agg(amount order by day) from public.daily_amounts()));
end $$;
grant execute on function public.daily_bonus() to authenticated;
revoke execute on function public.daily_bonus() from public, anon;

-- Idempotent: once per local day. The profile row is locked, so two taps at once pay once.
create or replace function public.claim_daily_bonus() returns jsonb
language plpgsql security definer set search_path = public as $$
declare uid uuid := auth.uid(); p public.profiles; today date; cd integer; amt integer; bal integer;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  select * into p from public.profiles where id = uid for update;
  if not found then raise exception 'no_profile'; end if;
  today := (now() at time zone p.timezone)::date;
  if p.last_play_date is distinct from today then raise exception 'play_first'; end if;
  if exists (select 1 from public.daily_claims where user_id = uid and day = today) then
    return jsonb_build_object('credits', 0, 'already', true, 'streak', p.streak, 'balance', p.credits);
  end if;
  cd := ((greatest(p.streak, 1) - 1) % 7) + 1;
  amt := public.daily_amount(p.streak);
  insert into public.daily_claims (user_id, day, streak, cycle_day, amount) values (uid, today, greatest(p.streak, 1), cd, amt);
  update public.profiles set credits = credits + amt where id = uid returning credits into bal;
  return jsonb_build_object('credits', amt, 'already', false, 'cycle_day', cd, 'streak', p.streak, 'balance', bal);
end $$;
grant execute on function public.claim_daily_bonus() to authenticated;
revoke execute on function public.claim_daily_bonus() from public, anon;

-- ============ 3. shop ============
-- Packs: tier, price, and the chance of each rarity in basis points (10000 = 100%).
create or replace function public.shop_packs() returns table(tier integer, price integer, p_common integer, p_rare integer, p_epic integer, p_legendary integer)
language sql immutable as $$
  select * from (values
    (1,   60, 7700, 1900,  350,   50),
    (2,  250, 4800, 3500, 1500,  200),
    (3,  700, 1800, 4200, 3300,  700),
    (4, 2000,  500, 2000, 4000, 3500)
  ) as t(tier, price, p_common, p_rare, p_epic, p_legendary)
$$;
revoke execute on function public.shop_packs() from public, anon, authenticated;

-- What a pack can hold: the 100 figurine cards (c001..c100, rarity as in shared/cards.ts), the avatars that are not free and the decorations no level unlocks.
create or replace function public.shop_items() returns table(kind text, id text, rarity text)
language sql immutable as $$
  select * from (values
    ('card', 'c001', 'common'), ('card', 'c002', 'common'), ('card', 'c003', 'common'), ('card', 'c004', 'common'), ('card', 'c005', 'common'),
    ('card', 'c006', 'common'), ('card', 'c007', 'common'), ('card', 'c008', 'common'), ('card', 'c009', 'common'), ('card', 'c010', 'common'),
    ('card', 'c011', 'common'), ('card', 'c012', 'common'), ('card', 'c013', 'common'), ('card', 'c014', 'common'), ('card', 'c015', 'rare'),
    ('card', 'c016', 'rare'), ('card', 'c017', 'rare'), ('card', 'c018', 'rare'), ('card', 'c019', 'rare'), ('card', 'c020', 'rare'),
    ('card', 'c021', 'epic'), ('card', 'c022', 'epic'), ('card', 'c023', 'epic'), ('card', 'c024', 'legendary'), ('card', 'c025', 'common'),
    ('card', 'c026', 'common'), ('card', 'c027', 'common'), ('card', 'c028', 'common'), ('card', 'c029', 'common'), ('card', 'c030', 'common'),
    ('card', 'c031', 'rare'), ('card', 'c032', 'rare'), ('card', 'c033', 'rare'), ('card', 'c034', 'epic'), ('card', 'c035', 'epic'),
    ('card', 'c036', 'legendary'), ('card', 'c037', 'common'), ('card', 'c038', 'common'), ('card', 'c039', 'common'), ('card', 'c040', 'common'),
    ('card', 'c041', 'common'), ('card', 'c042', 'rare'), ('card', 'c043', 'rare'), ('card', 'c044', 'epic'), ('card', 'c045', 'epic'),
    ('card', 'c046', 'legendary'), ('card', 'c047', 'common'), ('card', 'c048', 'common'), ('card', 'c049', 'common'), ('card', 'c050', 'common'),
    ('card', 'c051', 'common'), ('card', 'c052', 'common'), ('card', 'c053', 'rare'), ('card', 'c054', 'rare'), ('card', 'c055', 'rare'),
    ('card', 'c056', 'epic'), ('card', 'c057', 'epic'), ('card', 'c058', 'legendary'), ('card', 'c059', 'common'), ('card', 'c060', 'common'),
    ('card', 'c061', 'common'), ('card', 'c062', 'common'), ('card', 'c063', 'common'), ('card', 'c064', 'common'), ('card', 'c065', 'common'),
    ('card', 'c066', 'rare'), ('card', 'c067', 'rare'), ('card', 'c068', 'epic'), ('card', 'c069', 'common'), ('card', 'c070', 'common'),
    ('card', 'c071', 'common'), ('card', 'c072', 'common'), ('card', 'c073', 'common'), ('card', 'c074', 'common'), ('card', 'c075', 'rare'),
    ('card', 'c076', 'rare'), ('card', 'c077', 'epic'), ('card', 'c078', 'legendary'), ('card', 'c079', 'common'), ('card', 'c080', 'common'),
    ('card', 'c081', 'common'), ('card', 'c082', 'common'), ('card', 'c083', 'common'), ('card', 'c084', 'common'), ('card', 'c085', 'rare'),
    ('card', 'c086', 'rare'), ('card', 'c087', 'rare'), ('card', 'c088', 'epic'), ('card', 'c089', 'epic'), ('card', 'c090', 'legendary'),
    ('card', 'c091', 'common'), ('card', 'c092', 'common'), ('card', 'c093', 'common'), ('card', 'c094', 'common'), ('card', 'c095', 'common'),
    ('card', 'c096', 'rare'), ('card', 'c097', 'rare'), ('card', 'c098', 'rare'), ('card', 'c099', 'rare'), ('card', 'c100', 'epic'),
    ('avatar', 'alien', 'legendary'), ('avatar', 'astro', 'epic'), ('avatar', 'ball', 'rare'), ('avatar', 'bolt', 'rare'), ('avatar', 'clock', 'epic'), ('avatar', 'kandinsky', 'legendary'), ('decoration', 'jade', 'rare'), ('decoration', 'obsidian', 'legendary'), ('decoration', 'opal', 'legendary'), ('decoration', 'ruby', 'epic'), ('decoration', 'sapphire', 'epic')
  ) as t(kind, id, rarity)
$$;
revoke execute on function public.shop_items() from public, anon, authenticated;

-- A duplicate pays back this share of the price; packs per local day; seconds between two purchases.
create or replace function public.shop_limits() returns table(refund_pct integer, daily_cap integer, gap_sec integer)
language sql immutable as $$ select 10, 12, 2 $$;
revoke execute on function public.shop_limits() from public, anon, authenticated;

-- The catalogue must be sound: odds add up, every item exists, every pool has something in it.
do $$ begin
  if exists (select 1 from public.shop_packs() where p_common + p_rare + p_epic + p_legendary <> 10000) then raise exception 'shop odds do not add up'; end if;
  if exists (select 1 from public.shop_items() i where i.kind = 'decoration' and not exists (select 1 from public.decorations d where d.id = i.id and d.level is null)) then raise exception 'shop decoration missing'; end if;
  if exists (select 1 from public.shop_items() i where i.kind = 'avatar' and i.id = any (public.default_avatars())) then raise exception 'default avatar in the shop'; end if;
  if (select count(distinct rarity) from public.shop_items()) <> 4 then raise exception 'a rarity has no items'; end if;
  if (select count(*) from public.shop_items() where kind = 'card') <> 100 then raise exception 'the album must have 100 cards'; end if;
  if (select count(*) from (select kind, id from public.shop_items() group by 1, 2 having count(*) > 1) d) > 0 then raise exception 'duplicate shop item'; end if;
end $$;

create table if not exists public.shop_openings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  tier integer not null,
  price integer not null check (price > 0),
  item_kind text not null check (item_kind in ('avatar','card','decoration')),
  item_id text not null,
  rarity text not null check (rarity in ('common','rare','epic','legendary')),
  duplicate boolean not null,
  refund integer not null default 0 check (refund >= 0),
  created_at timestamptz not null default now()
);
create index if not exists shop_openings_user_idx on public.shop_openings (user_id, created_at desc);
alter table public.shop_openings enable row level security;
revoke all on public.shop_openings from public, anon, authenticated;

-- The album: every collectible item with owned / missing and how many times it came out of a pack, plus the shop's totals for the caller.
create or replace function public.my_album() returns jsonb
language plpgsql security definer stable set search_path = public as $$
declare uid uuid := auth.uid(); p public.profiles; day_start timestamptz; res jsonb; lim record;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  select * into p from public.profiles where id = uid;
  if not found then raise exception 'no_profile'; end if;
  select * into lim from public.shop_limits();
  day_start := ((now() at time zone p.timezone)::date)::timestamp at time zone p.timezone;
  with got as (
    select o.item_kind, o.item_id, count(*) as copies from public.shop_openings o where o.user_id = uid group by o.item_kind, o.item_id),
  it as (
    select i.kind, i.id, i.rarity,
      case i.kind when 'avatar' then exists (select 1 from public.user_avatars a where a.user_id = uid and a.avatar_id = i.id)
                  when 'card' then exists (select 1 from public.user_cards c where c.user_id = uid and c.card_id = i.id)
                  else exists (select 1 from public.user_decorations d where d.user_id = uid and d.decoration_id = i.id) end as owned,
      coalesce(g.copies, 0) as copies
    from public.shop_items() i left join got g on g.item_kind = i.kind and g.item_id = i.id)
  select jsonb_build_object(
    'items', coalesce(jsonb_agg(jsonb_build_object('kind', kind, 'id', id, 'rarity', rarity, 'owned', owned, 'copies', copies) order by kind, id), '[]'::jsonb),
    'owned', count(*) filter (where owned), 'total', count(*))
  into res from it;
  return res || jsonb_build_object(
    'registered', public.is_registered(),
    'opened_today', (select count(*) from public.shop_openings where user_id = uid and created_at >= day_start),
    'daily_cap', lim.daily_cap,
    'spent', (select coalesce(sum(price), 0) from public.shop_openings where user_id = uid),
    'refunded', (select coalesce(sum(refund), 0) from public.shop_openings where user_id = uid));
end $$;
grant execute on function public.my_album() to authenticated;
revoke execute on function public.my_album() from public, anon;

-- Buys and opens one pack in a single transaction: debit, roll, grant or refund. The profile row is locked for the whole call.
-- Errors: not_authenticated, registration_required, unknown_pack, no_profile, too_fast, pack_limit, insufficient_credits.
create or replace function public.buy_pack(p_tier integer) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid(); p public.profiles; pk record; lim record; day_start timestamptz; opened integer; last_at timestamptz;
  roll integer; rar text; n integer; k integer; it record; dup boolean; refund integer := 0; bal integer; oid uuid;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  if not public.is_registered() then raise exception 'registration_required'; end if;
  select * into pk from public.shop_packs() where tier = p_tier;
  if not found then raise exception 'unknown_pack'; end if;
  select * into lim from public.shop_limits();
  select * into p from public.profiles where id = uid for update;
  if not found then raise exception 'no_profile'; end if;
  day_start := ((now() at time zone p.timezone)::date)::timestamp at time zone p.timezone;
  select count(*), max(created_at) into opened, last_at from public.shop_openings where user_id = uid and created_at >= day_start;
  if last_at is not null and last_at > now() - make_interval(secs => lim.gap_sec) then raise exception 'too_fast'; end if;
  if opened >= lim.daily_cap then raise exception 'pack_limit'; end if;
  if p.credits < pk.price then raise exception 'insufficient_credits'; end if;

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
  if dup then refund := floor(pk.price * lim.refund_pct / 100.0)::integer; end if;

  update public.profiles set credits = credits - pk.price + refund where id = uid returning credits into bal;
  insert into public.shop_openings (user_id, tier, price, item_kind, item_id, rarity, duplicate, refund)
  values (uid, pk.tier, pk.price, it.kind, it.id, rar, dup, refund) returning id into oid;
  return jsonb_build_object('id', oid, 'tier', pk.tier, 'price', pk.price, 'kind', it.kind, 'item', it.id, 'rarity', rar,
                            'duplicate', dup, 'refund', refund, 'balance', bal, 'opened_today', opened + 1, 'daily_cap', lim.daily_cap);
end $$;
grant execute on function public.buy_pack(integer) to authenticated;
revoke execute on function public.buy_pack(integer) from public, anon;
