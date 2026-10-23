-- Disk IO budget warning from Supabase: forecast values (metrics, not rain) that move by a tenth or less while the hour is still ahead are not worth a new row version.
-- Nothing the resolver trusts is affected: it only reads values fetched after hour_start + 1 hour, and that last refresh always goes through.
create or replace function public.skip_same_metric() returns trigger language plpgsql as $$
begin
  if new.feed_id = old.feed_id and new.metric = old.metric and new.hour_start = old.hour_start
     and not (old.fetched_at < old.hour_start + interval '1 hour' and new.fetched_at >= old.hour_start + interval '1 hour')
     and (new.value is not distinct from old.value
          or (new.fetched_at < old.hour_start + interval '1 hour' and abs(new.value - old.value) <= 0.1)) then
    return null;
  end if;
  return new;
end $$;
