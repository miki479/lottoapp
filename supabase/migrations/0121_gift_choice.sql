-- A team message can offer gifts "one or the other": gifts.choose is a list of options, each {credits, boosts, freezes, card}; the player takes ONE.
-- The options are written only by the team (user_messages has no write policy for players). The grant happens here, once, and marks the message read.
create or replace function public.claim_message_choice(p_id uuid, p_index integer) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  uid uuid := auth.uid(); m public.user_messages; opt jsonb; cr integer; bo integer; fr integer; card text; res jsonb;
begin
  if uid is null then raise exception 'not_authenticated'; end if;
  select * into m from public.user_messages where id = p_id and user_id = uid and read_at is null for update;
  if not found then raise exception 'no_message'; end if;
  opt := (m.gifts -> 'choose') -> p_index;
  if opt is null or jsonb_typeof(opt) <> 'object' then raise exception 'bad_choice'; end if;
  cr := least(greatest(coalesce((opt ->> 'credits')::integer, 0), 0), 5000);
  bo := least(greatest(coalesce((opt ->> 'boosts')::integer, 0), 0), 10);
  fr := least(greatest(coalesce((opt ->> 'freezes')::integer, 0), 0), 2);
  if coalesce((opt ->> 'card')::boolean, false) then
    -- a figurine the player does not have yet, never a legendary, rarer ones first; with a full album the gift turns into credits
    select i.id into card from public.shop_items() i
     where i.kind = 'card' and i.rarity <> 'legendary' and not exists (select 1 from public.user_cards c where c.user_id = uid and c.card_id = i.id)
     order by (case i.rarity when 'epic' then 0 when 'rare' then 1 else 2 end) + random() * 1.5 limit 1;
    if card is null then cr := cr + 500;
    else insert into public.user_cards (user_id, card_id) values (uid, card) on conflict do nothing; end if;
  end if;
  update public.profiles set credits = credits + cr, boosts = least(20, boosts + bo), freezes = least(2, freezes + fr) where id = uid;
  update public.user_messages set read_at = now() where id = p_id;
  res := jsonb_build_object('credits', cr, 'boosts', bo, 'freezes', fr, 'card', card);
  return res;
end $$;
grant execute on function public.claim_message_choice(uuid, integer) to authenticated;
revoke execute on function public.claim_message_choice(uuid, integer) from public, anon;
