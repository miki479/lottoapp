-- Quotes must never let a player lock in a profit: the two sides of a question have to imply more than 100% together.
-- The earthquake questions and the "Ci scusiamo per il disagio" rungs floored the safe side at 1.10 while the long shot was capped at 15-30
-- (1/15.7 + 1/1.10 = 0.97), and old Italian train quotes did the same. A trigger keeps the invariant whatever wrote the quote: when the pair
-- implies less than 102%, the shorter side is lowered (it ends below 1.10, so nobody can stake on it anyway). Flash and Super quotes
-- (flash_multiplier > 1) are boosted on purpose and left alone; one bet per player and question already stops a player taking both sides.
create or replace function public.markets_odds_guard() returns trigger language plpgsql as $$
declare other numeric;
begin
  if coalesce(new.flash_multiplier, 1) > 1 or new.odds_yes is null or new.odds_no is null then return new; end if;
  if 1 / new.odds_yes + 1 / new.odds_no >= 1.02 then return new; end if;
  if new.odds_yes <= new.odds_no then
    other := 1 / new.odds_no;
    new.odds_yes := greatest(1, floor(100 / (1.02 - other)) / 100);
  else
    other := 1 / new.odds_yes;
    new.odds_no := greatest(1, floor(100 / (1.02 - other)) / 100);
  end if;
  return new;
end $$;

drop trigger if exists markets_odds_guard on public.markets;
create trigger markets_odds_guard before insert or update of odds_yes, odds_no, flash_multiplier on public.markets
  for each row execute function public.markets_odds_guard();

-- the quotes already open
update public.markets set odds_yes = odds_yes where status = 'open' and flash_multiplier = 1 and 1 / odds_yes + 1 / odds_no < 1.02;
