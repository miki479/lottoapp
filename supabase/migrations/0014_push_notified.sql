-- Push notifications for bet results are sent once: these flags record that a result was already announced.
alter table public.bets add column if not exists notified boolean not null default false;
alter table public.parlays add column if not exists notified boolean not null default false;
-- Results that settled before this migration are not announced.
update public.bets set notified = true where status <> 'open';
update public.parlays set notified = true where status <> 'open';
create index if not exists bets_unnotified on public.bets (settled_at) where not notified and status <> 'open';
create index if not exists parlays_unnotified on public.parlays (settled_at) where not notified and status <> 'open';
