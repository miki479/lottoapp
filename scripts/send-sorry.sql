-- One-off: apology for the outage of 14 October. 1000 in the player's own money to every player plus a gift to choose (same reward screen as send-gift-choice.sql).
insert into public.user_messages (user_id, heading, body, gifts)
select id,
  case locale when 'it' then 'Siamo tornati online' when 'ja' then 'オンラインに戻りました' else 'We are back online' end,
  case locale when 'it' then 'Scusa per il problema tecnico: per un po'' l''app non si è caricata. Per farci perdonare ci sono 1.000 € e un regalo a tua scelta: uno solo.'
              when 'ja' then '技術的な問題でご迷惑をおかけしました。しばらくアプリが読み込めませんでした。お詫びに1,000円とプレゼントをひとつ、お選びください。'
              when 'en-GB' then 'Sorry for the technical problem: the app would not load for a while. To make up for it: £1,000 and a gift of your choice, just one.'
              else 'Sorry for the technical problem: the app would not load for a while. To make up for it: $1,000 and a gift of your choice, just one.' end,
  '{"credits":1000,"choose":[{"credits":1500},{"boosts":3},{"freezes":1},{"card":true}]}'::jsonb
from public.profiles;
update public.profiles set credits = credits + 1000;
