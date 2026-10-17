-- The "In the city" collection: four more rendered avatars (traffic light, loudspeaker, oak, sun and cloud), allowed everywhere an avatar is stored and added to the pack pools.
alter table public.profiles drop constraint if exists profiles_avatar_check;
alter table public.profiles add constraint profiles_avatar_check check (avatar in ('conductor','busbot','cloud','fox','ball','bolt','alien','astro','clock','kandinsky','robot','panda','wizard','samurai','dragon','lion','gear','ziggurat','star','bear','owl','wolf','tiger','panther','raven','drop','pilot','knight','ninja','cosmonaut','mech','falcon','cobra','vixen','lionheart','emerald','prism','shogun','eagle','wyvern','orb','goldspiral','steelspiral','twinrings','ember','sculpt','coach','rail','skycloud','grove','horn','citybus','express','traffic','loudspeaker','oak','sunny'));
alter table public.user_avatars drop constraint if exists user_avatars_avatar_id_check;
alter table public.user_avatars add constraint user_avatars_avatar_id_check check (avatar_id in ('conductor','busbot','cloud','fox','ball','bolt','alien','astro','clock','kandinsky','robot','panda','wizard','samurai','dragon','lion','gear','ziggurat','star','bear','owl','wolf','tiger','panther','raven','drop','pilot','knight','ninja','cosmonaut','mech','falcon','cobra','vixen','lionheart','emerald','prism','shogun','eagle','wyvern','orb','goldspiral','steelspiral','twinrings','ember','sculpt','coach','rail','skycloud','grove','horn','citybus','express','traffic','loudspeaker','oak','sunny'));

create or replace function public.shop_items()
 RETURNS TABLE(kind text, id text, rarity text)
 LANGUAGE sql
 IMMUTABLE
AS $function$
  select * from (values
    ('card', 'c001', 'common'), ('card', 'c002', 'common'), ('card', 'c003', 'common'), ('card', 'c004', 'common'), ('card', 'c005', 'common'),
    ('card', 'c006', 'common'), ('card', 'c007', 'common'), ('card', 'c008', 'common'), ('card', 'c009', 'common'), ('card', 'c010', 'common'),
    ('card', 'c011', 'common'), ('card', 'c012', 'common'), ('card', 'c013', 'common'), ('card', 'c014', 'common'), ('card', 'c015', 'rare'),
    ('card', 'c016', 'rare'), ('card', 'c017', 'rare'), ('card', 'c018', 'rare'), ('card', 'c019', 'rare'), ('card', 'c020', 'rare'),
    ('card', 'c021', 'epic'), ('card', 'c022', 'epic'), ('card', 'c023', 'epic'), ('card', 'c024', 'legendary'), ('card', 'c025', 'common'),
    ('card', 'c026', 'common'), ('card', 'c027', 'common'), ('card', 'c028', 'common'), ('card', 'c029', 'common'), ('card', 'c030', 'common'),
    ('card', 'c031', 'rare'), ('card', 'c032', 'rare'), ('card', 'c033', 'rare'), ('card', 'c034', 'epic'), ('card', 'c035', 'epic'),
    ('card', 'c036', 'legendary'), ('card', 'c037', 'common'), ('card', 'c038', 'common'), ('card', 'c039', 'common'), ('card', 'c040', 'common'),
    ('card', 'c041', 'common'), ('card', 'c042', 'rare'), ('card', 'c043', 'rare'), ('card', 'c044', 'epic'), ('card', 'c045', 'epic'),
    ('card', 'c046', 'legendary'), ('card', 'c047', 'common'), ('card', 'c048', 'common'), ('card', 'c049', 'common'), ('card', 'c050', 'common'),
    ('card', 'c051', 'common'), ('card', 'c052', 'common'), ('card', 'c053', 'rare'), ('card', 'c054', 'rare'), ('card', 'c055', 'rare'),
    ('card', 'c056', 'epic'), ('card', 'c057', 'epic'), ('card', 'c058', 'legendary'), ('card', 'c059', 'common'), ('card', 'c060', 'common'),
    ('card', 'c061', 'common'), ('card', 'c062', 'common'), ('card', 'c063', 'common'), ('card', 'c064', 'common'), ('card', 'c065', 'common'),
    ('card', 'c066', 'rare'), ('card', 'c067', 'rare'), ('card', 'c068', 'epic'), ('card', 'c069', 'common'), ('card', 'c070', 'common'),
    ('card', 'c071', 'common'), ('card', 'c072', 'common'), ('card', 'c073', 'common'), ('card', 'c074', 'common'), ('card', 'c075', 'rare'),
    ('card', 'c076', 'rare'), ('card', 'c077', 'epic'), ('card', 'c078', 'legendary'), ('card', 'c079', 'common'), ('card', 'c080', 'common'),
    ('card', 'c081', 'common'), ('card', 'c082', 'common'), ('card', 'c083', 'common'), ('card', 'c084', 'common'), ('card', 'c085', 'rare'),
    ('card', 'c086', 'rare'), ('card', 'c087', 'rare'), ('card', 'c088', 'epic'), ('card', 'c089', 'epic'), ('card', 'c090', 'legendary'),
    ('card', 'c091', 'common'), ('card', 'c092', 'common'), ('card', 'c093', 'common'), ('card', 'c094', 'common'), ('card', 'c095', 'common'),
    ('card', 'c096', 'rare'), ('card', 'c097', 'rare'), ('card', 'c098', 'rare'), ('card', 'c099', 'rare'), ('card', 'c100', 'epic'),
    ('avatar', 'alien', 'legendary'), ('avatar', 'robot', 'rare'), ('avatar', 'panda', 'rare'), ('avatar', 'wizard', 'epic'), ('avatar', 'samurai', 'epic'), ('avatar', 'dragon', 'legendary'), ('avatar', 'lion', 'legendary'), ('avatar', 'astro', 'epic'), ('avatar', 'ball', 'rare'), ('avatar', 'bolt', 'rare'), ('avatar', 'clock', 'epic'), ('avatar', 'kandinsky', 'legendary'), ('avatar', 'gear', 'rare'), ('avatar', 'ziggurat', 'rare'), ('avatar', 'star', 'rare'), ('avatar', 'bear', 'rare'), ('avatar', 'owl', 'rare'), ('avatar', 'wolf', 'rare'), ('avatar', 'tiger', 'rare'), ('avatar', 'panther', 'rare'), ('avatar', 'raven', 'rare'), ('avatar', 'drop', 'rare'), ('avatar', 'pilot', 'epic'), ('avatar', 'knight', 'epic'), ('avatar', 'ninja', 'epic'), ('avatar', 'cosmonaut', 'epic'), ('avatar', 'mech', 'epic'), ('avatar', 'falcon', 'epic'), ('avatar', 'cobra', 'epic'), ('avatar', 'vixen', 'epic'), ('avatar', 'lionheart', 'epic'), ('avatar', 'emerald', 'epic'), ('avatar', 'prism', 'epic'), ('avatar', 'shogun', 'legendary'), ('avatar', 'eagle', 'legendary'), ('avatar', 'wyvern', 'legendary'), ('avatar', 'orb', 'legendary'), ('avatar', 'goldspiral', 'legendary'), ('avatar', 'steelspiral', 'legendary'), ('avatar', 'twinrings', 'legendary'), ('avatar', 'ember', 'legendary'), ('avatar', 'sculpt', 'legendary'), ('avatar', 'coach', 'rare'), ('avatar', 'rail', 'epic'), ('avatar', 'skycloud', 'epic'), ('avatar', 'grove', 'epic'), ('avatar', 'horn', 'rare'), ('avatar', 'citybus', 'rare'), ('avatar', 'express', 'epic'), ('avatar', 'traffic', 'rare'), ('avatar', 'loudspeaker', 'rare'), ('avatar', 'oak', 'epic'), ('avatar', 'sunny', 'rare'), ('decoration', 'jade', 'rare'), ('decoration', 'obsidian', 'legendary'), ('decoration', 'opal', 'legendary'), ('decoration', 'ruby', 'epic'), ('decoration', 'sapphire', 'epic')
  ) as t(kind, id, rarity)
$function$;
revoke execute on function public.shop_items() from public, anon, authenticated;
