-- Sensible multipliers: x5 for a random gift, x10 for someone away for long or on a bad run (max stake stays 20).
alter table public.personal_offers drop constraint if exists personal_offers_multiplier_check;
alter table public.personal_offers add constraint personal_offers_multiplier_check check (multiplier in (5, 10, 20, 40));
create or replace function public.make_personal_offers() returns integer
language plpgsql security definer set search_path = public as $$
declare n integer := 0;
begin
  if coalesce((select value from public.app_settings where key = 'personal_offers_on'), '') <> 'true' then return 0; end if;
  with cand as (
    select p.id, p.city_id,
      case
        when p.last_play_date <= current_date - 5 and p.last_play_date >= current_date - 90 then 'absent'
        when (select count(*) filter (where r.status = 'lost') from (
                select b.status, b.settled_at from public.bets b where b.user_id = p.id and b.status in ('won', 'lost') order by b.settled_at desc limit 8) r) >= 6
             and exists (select 1 from public.bets b where b.user_id = p.id and b.status in ('won', 'lost') and b.settled_at > now() - interval '30 days') then 'losses'
        -- once a day per player (at 10:00 local time), so 2% means "some days", not "most days"
        when p.last_play_date >= current_date - 14 and extract(hour from now() at time zone p.timezone) = 10 and random() < 0.02 then 'random'
      end as reason
    from public.profiles p
    where p.credits >= 10
      and not exists (select 1 from public.personal_offers o where o.user_id = p.id and o.created_at > now() - interval '10 days')
      and (not public.registration_required() or exists (select 1 from auth.users u where u.id = p.id and not u.is_anonymous and u.email is not null))
  ), cand2 as (
    select * from cand where reason is not null order by case reason when 'absent' then 0 when 'losses' then 1 else 2 end, random() limit 200
  ), picked as (
    select c.id as user_id, c.reason, m.id as market_id, m.closes_at
    from cand2 c
    cross join lateral (
      select m.id, m.closes_at from public.markets m
      where m.status = 'open'
        and m.closes_at between now() + interval '6 hours' and now() + interval '48 hours'
        and m.odds_yes between 1.5 and 4 and m.odds_no between 1.5 and 4        -- a genuinely open question on both sides
        and coalesce(m.flash_multiplier, 1) = 1 and m.flash_kind is null
        and m.kind not in ('bus_delay_gt', 'train_delay_gt', 'bus_full')          -- delay questions are priced near-certain too often
        and not (m.params ? 'ladderOf') and not (m.params ? 'viceBonus') and coalesce(m.params->>'occBonus', '') <> 'true' and coalesce(m.params->>'testOnly', '') <> 'true'
        and (m.city_id = c.city_id or m.city_id = 'world' or m.category not in ('bus', 'train', 'weather', 'traffic'))
        and not exists (select 1 from public.bets b where b.user_id = c.id and b.market_id = m.id)
      order by (m.city_id = c.city_id) desc, md5(m.id::text || c.id::text) limit 1
    ) m
    order by case c.reason when 'absent' then 0 when 'losses' then 1 else 2 end, random() limit 50
  ), ins as (
    insert into public.personal_offers (user_id, market_id, multiplier, max_stake, reason, expires_at)
    select user_id, market_id, case when reason = 'random' then 5 else 10 end, 20, reason, closes_at from picked
    on conflict (user_id, market_id) do nothing
    returning 1
  )
  select count(*) into n from ins;
  return n;
end $$;
