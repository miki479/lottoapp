-- One-off: 1000 in the player's own money to every player plus a gift to choose (one of: 1500 more credits, 3 boosts, 1 streak freeze, a surprise card), shown as a reward screen.
-- The push ("gift_v1") goes out afterwards from the resolve job once app_settings.broadcast_pending = 'gift_v1'.
insert into public.user_messages (user_id, heading, body, gifts)
select id,
  case locale when 'it' then '💣 Bomba consegnata' when 'ja' then '💣 爆弾が届きました' else '💣 Bomb delivered' end,
  case locale when 'it' then 'Dentro c''erano 1.000 €. E ora scegli un regalo: uno solo, come in ogni buona minaccia.'
              when 'ja' then '中には1,000円が入っていました。さあ、プレゼントをひとつだけ選んでください。'
              when 'en-GB' then 'Inside: £1,000. Now pick a gift: just one, like in any good threat.'
              else 'Inside: $1,000. Now pick a gift: just one, like in any good threat.' end,
  '{"credits":1000,"choose":[{"credits":1500},{"boosts":3},{"freezes":1},{"card":true}]}'::jsonb
from public.profiles;
update public.profiles set credits = credits + 1000;
