-- An all-but-decided outcome (odds under 1.10) still allows a token stake of 20, so the pick stays playable for fun but cannot be milked.
create or replace function public.stake_cap(o numeric) returns integer language sql immutable as $$
  select case when o < 1.10 then 20 when o < 1.30 then 200 when o < 1.60 then 2000 when o < 2.20 then 10000 else 100000 end;
$$;
