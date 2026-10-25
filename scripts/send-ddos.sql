-- One-off: sarcastic "extraordinary maintenance" message for the outage of 23 October, with 10,000 credits and 1 boost for every player.
-- The push ("ddos_v1") goes out afterwards from the resolve job once app_settings.broadcast_pending = 'ddos_v1'.
insert into public.user_messages (user_id, heading, body, gifts)
select id,
  case locale when 'it' then 'Manutenzione straordinaria' when 'ja' then '緊急メンテナンス' else 'Extraordinary maintenance' end,
  case locale when 'it' then 'Un gravissimo attacco hacker DDoS (pare) ci ha messo KO. Li abbiamo respinti con eroismo e, per i disagi, ecco 10.000 crediti e un boost. Non fare domande, spendili.'
              when 'ja' then '深刻なハッカーのDDoS攻撃（らしい）でダウンしました。英雄的に撃退したお詫びに10,000クレジットとブーストをひとつどうぞ。深く考えずに使ってください。'
              else 'A very serious hacker DDoS attack (allegedly) knocked us out. We fought them off heroically and, for the trouble, here are 10,000 credits and a boost. Do not ask questions, spend them.' end,
  '{"credits":10000,"boosts":1}'::jsonb
from public.profiles;
update public.profiles set credits = credits + 10000, boosts = least(20, boosts + 1);
