-- A friend request is announced by push to the person who received it (once).
alter table public.friend_requests add column if not exists notified boolean not null default false;
