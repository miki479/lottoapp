-- Flash events (boosted odds for a short, visible window) and richer streak/daily rewards.

alter table public.markets
  add column if not exists base_odds_yes numeric(6,2),
  add column if not exists flash_until timestamptz,
  add column if not exists flash_kind text check (flash_kind in ('weather_alert','rush'));

-- Streak milestones pay credits; closing the three daily rings now pays 150.
create or replace function public.streak_bonus(n integer) returns integer
language sql immutable as $$ select case n when 3 then 50 when 7 then 150 when 14 then 300 when 30 then 1000 else 0 end $$;

create or replace function public.register_play(p_uid uuid, p_category text) returns void
language plpgsql security definer set search_path = public as $$
declare
  prof public.profiles;
  today date;
  new_streak integer;
  new_freezes integer;
  dp public.daily_progress;
begin
  select * into prof from public.profiles where id = p_uid;
  today := (now() at time zone prof.timezone)::date;
  new_streak := prof.streak;
  new_freezes := prof.freezes;

  if prof.last_play_date is distinct from today then
    if prof.last_play_date = today - 1 then
      new_streak := prof.streak + 1;
    elsif prof.last_play_date = today - 2 and prof.freezes > 0 then
      new_streak := prof.streak + 1;          -- one missed day, bridged by a freeze
      new_freezes := prof.freezes - 1;
    else
      new_streak := 1;
    end if;
    if new_streak > prof.streak and new_streak % 7 = 0 then new_freezes := least(new_freezes + 1, 2); end if;
    update public.profiles set streak = new_streak, best_streak = greatest(best_streak, new_streak),
      freezes = new_freezes, last_play_date = today,
      credits = credits + case when new_streak > prof.streak then public.streak_bonus(new_streak) else 0 end
    where id = p_uid;
    if new_streak >= 7 then perform public.grant_trophy(p_uid, 'streak_7'); end if;
    if new_streak >= 30 then perform public.grant_trophy(p_uid, 'streak_30'); end if;
  end if;

  insert into public.daily_progress (user_id, day) values (p_uid, today) on conflict do nothing;
  update public.daily_progress set
    bus = bus + (p_category = 'bus')::int, train = train + (p_category = 'train')::int,
    weather = weather + (p_category = 'weather')::int, traffic = traffic + (p_category = 'traffic')::int
  where user_id = p_uid and day = today
  returning * into dp;

  if dp.bus > 0 and dp.train > 0 and dp.weather > 0 and not dp.bonus_claimed then
    update public.daily_progress set bonus_claimed = true where user_id = p_uid and day = today;
    update public.profiles set credits = credits + 150 where id = p_uid;
    perform public.grant_trophy(p_uid, 'all_rings');
  end if;
end $$;
revoke execute on function public.register_play(uuid, text), public.streak_bonus(integer) from public, anon, authenticated;

-- Flash events, run by pg_cron every 5 minutes.
--  * ends: odds go back to their base value when the window closes;
--  * weather alert (x3 on "yes"): it is actually raining in a city (latest hourly reading >= 0.3 mm), one rain market there;
--  * rush (x2 on "yes"): otherwise one bus/train market closing in 15-120 minutes.
-- At most one flash per city every 3 hours, window of 30 minutes (never beyond the market's closing time).
create or replace function public.run_flash() returns integer
language plpgsql security definer set search_path = public as $$
declare
  c record; m public.markets; started integer := 0; mult numeric; fkind text;
begin
  update public.markets set odds_yes = base_odds_yes, flash_multiplier = 1, base_odds_yes = null
  where flash_multiplier > 1 and flash_until <= now();

  for c in select id from public.cities loop
    if exists (select 1 from public.markets where city_id = c.id and flash_until > now() - interval '3 hours') then continue; end if;
    m := null;
    if exists (select 1 from public.weather_observations w where w.city_id = c.id and w.hour_start > now() - interval '2 hours' and w.precipitation_mm >= 0.3) then
      select * into m from public.markets where city_id = c.id and status = 'open' and kind = 'rain_at'
        and closes_at > now() + interval '10 minutes' order by closes_at limit 1;
      mult := 3; fkind := 'weather_alert';
    end if;
    if m.id is null then
      select * into m from public.markets where city_id = c.id and status = 'open' and category in ('bus','train')
        and closes_at between now() + interval '15 minutes' and now() + interval '120 minutes' order by random() limit 1;
      mult := 2; fkind := 'rush';
    end if;
    if m.id is not null then
      update public.markets set base_odds_yes = odds_yes, odds_yes = least(15, round(odds_yes * mult, 2)),
        flash_multiplier = mult, flash_kind = fkind, flash_until = least(closes_at, now() + interval '30 minutes')
      where id = m.id;
      started := started + 1;
    end if;
  end loop;
  return started;
end $$;
revoke execute on function public.run_flash() from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'flash';
select cron.schedule('flash', '*/5 * * * *', $$ select public.run_flash(); $$);
grant select on public.markets to anon, authenticated;
