-- Bug: every player could read everybody's trophies, so a new player saw the ones other people had won. Each player reads only their own.
drop policy if exists "trophies are public" on public.trophies;
create policy "own trophies" on public.trophies for select using (user_id = auth.uid());
