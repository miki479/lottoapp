-- The name TheSportsDB itself uses for a club ("Paris SG" for "Paris Saint-Germain"): the event search by "Home_vs_Away" needs that spelling.
alter table public.team_ids add column if not exists sportsdb_name text;
