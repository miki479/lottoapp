-- History: net result per local day and per category, from the player's own settled bets and parlays.
create or replace function public.my_balance_series(p_days integer default 30)
returns table(day date, net bigint, bets bigint)
language plpgsql security definer stable set search_path = public as $$
declare tz text; since date;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select timezone into tz from public.profiles where id = auth.uid();
  since := (now() at time zone tz)::date - (least(greatest(p_days, 7), 120) - 1);
  return query
    select s.d, sum(s.n)::bigint, count(*)::bigint from (
      select (b.settled_at at time zone tz)::date d, case b.status when 'won' then b.payout - b.stake when 'lost' then -b.stake else 0 end n
        from public.bets b where b.user_id = auth.uid() and b.status <> 'open' and b.settled_at is not null
      union all
      select (x.settled_at at time zone tz)::date, case x.status when 'won' then x.payout - x.stake when 'lost' then -x.stake else 0 end
        from public.parlays x where x.user_id = auth.uid() and x.status <> 'open' and x.settled_at is not null
    ) s where s.d >= since group by s.d order by s.d;
end $$;
grant execute on function public.my_balance_series(integer) to authenticated;

create or replace function public.my_category_stats()
returns table(category text, bets bigint, won bigint, lost bigint, net bigint)
language sql security definer stable set search_path = public as $$
  select m.category, count(*), count(*) filter (where b.status = 'won'), count(*) filter (where b.status = 'lost'),
         coalesce(sum(case b.status when 'won' then b.payout - b.stake when 'lost' then -b.stake else 0 end), 0)::bigint
  from public.bets b join public.markets m on m.id = b.market_id
  where b.user_id = auth.uid() and b.status <> 'open' group by m.category order by 5 desc;
$$;
grant execute on function public.my_category_stats() to authenticated;
