-- One simple choice for everyone: notifications on, and the optional "events" (flash, super odds, streak reminder, friends' big wins) on by default.
alter table public.profiles alter column push_flash set default true, alter column push_streak set default true, alter column push_friends set default true;
update public.profiles set push_flash = true, push_streak = true, push_friends = true;
