-- One-off gift to every player: 1500 credits + 2 boosts (boosts stay within the 0..20 limit), shown as a reward screen at the next opening.
-- The push ("bomb_v1") is sent afterwards by the resolve job once app_settings.broadcast_pending = 'bomb_v1'.
insert into public.user_messages (user_id, heading, body, gifts)
select id,
  case locale when 'it' then 'Una 💣 per te' when 'ja' then '💣をどうぞ' else 'A 💣 for you' end,
  case locale when 'it' then 'Gli altri stanno già giocando: ti abbiamo lasciato una bomba. Usala come vuoi, o non usarla affatto.'
              when 'ja' then 'みんなはもう遊んでいます。あなたに爆弾を置いておきました。好きに使ってください。'
              else 'Everybody else is already playing, so we left you a bomb. Use it however you like, or not at all.' end,
  jsonb_build_object('credits', 1500, 'boosts', 2)
from public.profiles;
update public.profiles set credits = credits + 1500, boosts = least(20, boosts + 2);
