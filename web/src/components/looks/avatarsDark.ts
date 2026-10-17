import { mix } from "./geo";

/**
 * The adult "low-poly premium" characters: faceted planes, a warm key light from the left and a cold rim light on the right edge, hard looks, a little wear.
 * Drawn inside a disc of radius 43 on a 120 grid. Half of each face is written once and mirrored: the right side is the same plane in shadow, pulled to violet.
 */
type P = [number, number];
const num = (n: number) => String(Math.round(n * 10) / 10);
const d = (pts: P[]) => "M" + pts.map(([x, y]) => `${num(x)} ${num(y)}`).join("L") + "Z";
const COLD = "#3a2f7a";
/** A facet and its mirror image: the left one catches the key light, the right one is darker and cold. */
const pair = (pts: P[], fill: string, k = 0.34): string => {
  const shade = mix(mix(fill, "#000000", 0.28), COLD, k * 0.5);
  return `<path d="${d(pts)}" fill="${fill}" stroke="${fill}" stroke-width=".35" stroke-linejoin="round"/><path d="${d(pts.map(([x, y]) => [120 - x, y] as P))}" fill="${shade}" stroke="${shade}" stroke-width=".35" stroke-linejoin="round"/>`;
};
/** A single facet that is not mirrored. */
const one = (pts: P[], fill: string, extra = "") => `<path d="${d(pts)}" fill="${fill}" stroke="${fill}" stroke-width=".35" stroke-linejoin="round" ${extra}/>`;
const line = (pts: P[], col: string, w: number, op = 1) => `<path d="M${pts.map(([x, y]) => `${num(x)} ${num(y)}`).join("L")}" fill="none" stroke="${col}" stroke-width="${w}" stroke-opacity="${op}" stroke-linecap="round" stroke-linejoin="round"/>`;
/** The cold edge light that runs down the right side of a form. */
const rim = (pts: P[], w = 1.1) => line(pts, "#8fb4ff", w, 0.7);

const CONDUCTOR = (() => {
  const navy = "#1c2a4a", navy2 = "#2f4372", navy3 = "#4a6296", skin = "#c98f66", skin2 = "#8e5c3e", brass = "#d9a23a", dark = "#14110f";
  let s = "";
  // shoulders and jacket
  s += pair([[14, 110], [30, 90], [52, 98], [48, 112]], navy2);
  s += pair([[30, 90], [44, 84], [52, 98]], navy);
  s += pair([[52, 98], [60, 96], [60, 112], [48, 112]], navy);
  // brass buttons, a lapel
  s += pair([[44, 88], [58, 100], [58, 112], [50, 108]], "#30457a");
  s += `<circle cx="56" cy="104" r="2" fill="${brass}"/><circle cx="64" cy="104" r="2" fill="#8a6521"/>`;
  // the whistle on a chain
  s += line([[48, 88], [54, 98], [60, 100]], brass, 0.9, 0.9);
  s += `<rect x="58" y="99" width="9" height="4.4" rx="2" fill="#bfc6d6"/><circle cx="68" cy="101" r="2.4" fill="#8f98ad"/>`;
  // neck and face
  s += pair([[50, 80], [60, 82], [60, 92], [52, 90]], skin2);
  s += pair([[40, 56], [60, 52], [60, 88], [52, 86], [42, 74]], skin);
  s += pair([[40, 56], [42, 74], [38, 68]], skin2);
  // the jaw is hard and square
  s += pair([[42, 74], [52, 86], [60, 88], [46, 84]], "#a46f4c");
  // heavy brow and a cold stare
  s += pair([[42, 62], [58, 64], [58, 60], [44, 57]], dark);
  s += pair([[45, 65], [56, 67], [54, 70], [47, 69]], "#e9eef7");
  s += pair([[50, 66], [54, 67.4], [52.4, 69.6]], "#0e1218");
  s += line([[60, 70], [57, 77], [60, 78]], "#6a3f28", 0.9, 0.7);
  s += line([[44, 82], [60, 84]], "#6a3f28", 0.9, 0.5);
  // a scar through the brow
  s += line([[43, 56], [47, 64]], "#f2d2b3", 0.8, 0.8);
  // the cap: crown, band, brim, a worn badge
  s += pair([[34, 52], [38, 26], [60, 20], [60, 52]], navy2);
  s += pair([[38, 26], [46, 24], [44, 50], [34, 52]], navy3);
  s += pair([[28, 54], [34, 48], [60, 48], [60, 56]], dark);
  s += pair([[32, 50], [60, 46], [60, 51], [32, 55]], brass);
  s += `<path d="M54 30 62 30 60 40Z" fill="${brass}" opacity=".9"/><circle cx="60" cy="33" r="3.2" fill="#f4d27a"/>`;
  // cold rim and the key light on the cap
  s += rim([[84, 54], [90, 56], [88, 78], [78, 90]]);
  s += rim([[84, 28], [88, 50]]);
  s += line([[40, 30], [48, 26]], "#9db7ee", 1, 0.55);
  return s;
})();

const DRAGON = (() => {
  const dk = "#07140d", g1 = "#12402a", g2 = "#1f6a41", g3 = "#3b9560", bone = "#e6d8a8", bone2 = "#9c8a5a", amber = "#ffb02e";
  let s = "";
  // horns: the left one is chipped
  s += pair([[40, 42], [24, 14], [32, 12], [46, 38]], bone);
  s += pair([[44, 40], [34, 18], [40, 20], [48, 38]], bone2);
  // skull and scaled brow
  s += pair([[46, 38], [60, 32], [60, 56], [44, 56]], g2);
  s += pair([[44, 56], [60, 56], [60, 62], [40, 62]], g1);
  s += pair([[40, 62], [30, 58], [28, 80], [36, 82]], g3);
  s += pair([[40, 62], [48, 62], [48, 80], [36, 82]], g2);
  s += pair([[28, 80], [36, 82], [42, 98], [32, 94]], g1);
  s += pair([[36, 82], [48, 80], [52, 98], [42, 98]], g2);
  // snout and nostril
  s += pair([[48, 62], [60, 60], [60, 90], [48, 80]], g3);
  s += pair([[48, 80], [60, 90], [52, 98]], g1);
  s += pair([[52, 76], [58, 76], [56, 80]], dk);
  // the eye: a narrow ember under a hard brow
  s += pair([[36, 54], [56, 60], [54, 55], [38, 49]], dk);
  s += pair([[39, 58], [52, 62], [49, 65], [40, 62]], amber);
  s += pair([[46, 60.5], [49, 62.4], [47, 64.4]], dk);
  // jaw teeth
  s += pair([[42, 96], [45, 92], [47, 97]], bone);
  s += pair([[50, 96], [53, 92], [55, 98]], bone);
  // scale ridges and a scar
  s += line([[48, 38], [52, 46], [50, 52]], "#6cd28f", 0.8, 0.5);
  s += line([[30, 62], [36, 72], [34, 80]], "#0a1f14", 1, 0.8);
  s += line([[33, 66], [38, 70]], "#e9a06a", 0.8, 0.7);
  s += rim([[78, 34], [90, 62], [86, 84], [74, 98]]);
  s += rim([[96, 14], [88, 36]], 0.9);
  // glow of embers from the nostril
  s += `<circle cx="64" cy="78" r="1.2" fill="#ffd27a" opacity=".85"/><circle cx="68" cy="72" r=".8" fill="#ffb02e" opacity=".7"/>`;
  return s;
})();

const SAMURAI = (() => {
  const steel = "#2a2d38", steel2 = "#454a5a", steel3 = "#6c7388", red = "#7d1b24", red2 = "#a8303a", gold = "#d9a23a", dk = "#0d0e14";
  let s = "";
  // the helmet bowl and its neck guard
  s += pair([[26, 58], [30, 34], [60, 24], [60, 56]], steel2);
  s += pair([[30, 34], [44, 28], [42, 52], [26, 58]], steel3);
  s += pair([[20, 74], [26, 58], [42, 62], [34, 82]], red);
  s += pair([[34, 82], [42, 62], [50, 70], [44, 90]], red2);
  // horn-like crest
  s += pair([[60, 24], [46, 8], [54, 22]], gold);
  s += pair([[44, 24], [32, 10], [46, 27]], "#9a7425");
  // brow plate and the face mask (menpo)
  s += pair([[28, 52], [60, 50], [60, 58], [34, 62]], dk);
  s += pair([[34, 62], [60, 58], [60, 66], [38, 70]], steel);
  s += pair([[38, 70], [60, 66], [60, 96], [46, 88]], steel2);
  s += pair([[38, 70], [46, 88], [34, 82]], steel);
  // slits for the eyes: cold and fixed
  s += pair([[40, 59], [56, 60.6], [54, 63], [42, 62]], "#cfe3ff");
  s += pair([[48, 60.4], [52, 61], [50.4, 62.6]], dk);
  // moustache lines and rivets
  s += line([[48, 78], [60, 80]], dk, 1.1, 0.8) + line([[46, 84], [60, 86]], dk, 0.9, 0.6);
  for (const [x, y] of [[40, 66], [44, 72], [40, 80]] as P[]) s += `<circle cx="${x}" cy="${y}" r=".9" fill="#b9c0d6"/>`;
  // a dent and a scratch, worn metal
  s += line([[30, 40], [38, 50]], "#a9b3cf", 0.8, 0.7);
  s += one([[28, 54], [31, 52], [30, 57]], "#14161e");
  s += rim([[92, 40], [90, 66], [82, 92]]);
  s += rim([[76, 30], [88, 46]], 0.9);
  return s;
})();

/** Backgrounds are deep charcoal with one colour of the character: nothing pastel. */
/** The rendered pictures (web/public/avatars/<id>.webp): one framed square each, clipped to the disc like every other character. */
/** Whole scenes (a bus, a train) are drawn smaller so they fit inside the disc. */
const SCENES = new Set(["coach", "rail", "skycloud", "grove", "horn", "citybus", "express", "traffic", "loudspeaker", "oak", "sunny", "clapper", "wheel", "growth", "spark", "curve", "fist", "leaf", "junction"]);
const pic = (id: string): { bg: string; art: string } => { const n = SCENES.has(id) ? 78 : 92, o = (120 - n) / 2; return { bg: "#141519", art: `<image href="/avatars/${id}.webp" x="${o}" y="${o}" width="${n}" height="${n}" preserveAspectRatio="xMidYMid slice"/>` }; };
const PICTURED = ["ball", "pilot", "star", "emerald", "orb", "bear", "ziggurat", "gear", "goldspiral", "falcon", "ninja", "steelspiral", "cobra", "shogun", "cosmonaut", "eagle", "raven", "sculpt", "owl", "lionheart", "wyvern", "tiger", "knight", "drop", "panther", "mech", "vixen", "prism", "twinrings", "ember", "wolf", "coach", "rail", "skycloud", "grove", "horn", "citybus", "express", "traffic", "loudspeaker", "oak", "sunny", "clapper", "shades", "wheel", "growth", "spark", "xeno", "curve", "fist", "spacesuit", "beats", "leaf", "junction"] as const;

export const DARK_AVATARS: Record<string, { bg: string; art: string }> = {
  // the fox is a rendered picture (web/public/avatars/fox.webp), clipped to the disc like every other character
  fox: { bg: "#141519", art: `<image href="/avatars/fox.webp" x="10" y="12" width="100" height="100" preserveAspectRatio="xMidYMid slice"/>` },
  conductor: { bg: "#182033", art: CONDUCTOR },
  dragon: { bg: "#0f1d17", art: DRAGON },
  samurai: { bg: "#27151b", art: SAMURAI },
  ...Object.fromEntries(PICTURED.map((id) => [id, pic(id)])),
};
