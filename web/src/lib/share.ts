import { TROPHY_IDS, type Messages, type TrophyId } from "../i18n/index.ts";

export const TROPHY_EMOJI: Record<TrophyId, string> = {
  first_win: "🏁", all_rings: "🎯", long_shot: "🔮", rain_man: "☔", streak_7: "🧘", train_whisperer: "🚆", high_roller: "💎", streak_30: "🏅", ghost_feed: "👻",
};

export interface CardData { name: string | null; streak: number; credits: number; rank: number | null; scope: string; trophies: TrophyId[]; season: string }

/** Draws the shareable profile card (1080x1350, made for Reddit and stories) and returns a PNG. */
export async function makeCard(d: CardData, msg: Messages): Promise<Blob> {
  await Promise.all(['800 160px "Big Shoulders Display"', '700 40px "Martian Mono"', '400 40px "Schibsted Grotesk"'].map((f) => document.fonts.load(f).catch(() => [])));
  const W = 1080, H = 1350, c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d")!;
  const bg = g.createLinearGradient(0, 0, W, H); bg.addColorStop(0, "#07080d"); bg.addColorStop(1, "#1a0f2e");
  g.fillStyle = bg; g.fillRect(0, 0, W, H);
  // glow blobs
  for (const [x, y, r, col] of [[200, 260, 360, "rgba(240,255,58,.16)"], [900, 980, 420, "rgba(255,45,149,.18)"]] as const) {
    const rg = g.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, col); rg.addColorStop(1, "transparent"); g.fillStyle = rg; g.fillRect(0, 0, W, H);
  }
  g.textBaseline = "alphabetic";
  g.fillStyle = "#f0ff3a"; g.font = '800 92px "Big Shoulders Display", sans-serif'; g.fillText("LATELOTTO", 72, 140);
  g.fillStyle = "#8d93a8"; g.font = '400 34px "Martian Mono", monospace'; g.fillText(d.season, 72, 190);
  if (d.name) { g.fillStyle = "#f2ede0"; g.font = '800 64px "Big Shoulders Display", sans-serif'; g.fillText(d.name.toUpperCase(), 72, 280); }
  // streak
  g.font = '800 420px "Big Shoulders Display", sans-serif'; g.fillStyle = "#ff4d62"; g.fillText(String(d.streak), 72, 640);
  const sw = g.measureText(String(d.streak)).width;
  g.font = "180px sans-serif"; g.fillText("🔥", 72 + sw + 24, 560);
  g.fillStyle = "#f2ede0"; g.font = '800 70px "Big Shoulders Display", sans-serif'; g.fillText(msg.missions.streak(d.streak).toUpperCase(), 80, 720);
  // credits and rank
  g.fillStyle = "#2ef5b4"; g.font = '800 120px "Big Shoulders Display", sans-serif'; g.fillText(d.credits.toLocaleString(), 72, 880);
  g.fillStyle = "#8d93a8"; g.font = '400 34px "Martian Mono", monospace'; g.fillText(msg.credits, 72, 925);
  if (d.rank) {
    g.fillStyle = "#f0ff3a"; g.font = '800 120px "Big Shoulders Display", sans-serif'; g.fillText(`#${d.rank}`, 620, 880);
    g.fillStyle = "#8d93a8"; g.font = '400 34px "Martian Mono", monospace'; g.fillText(d.scope, 620, 925);
  }
  // trophies
  g.fillStyle = "#f2ede0"; g.font = '700 36px "Martian Mono", monospace'; g.fillText(msg.missions.trophies.toUpperCase(), 72, 1010);
  const shown = TROPHY_IDS.filter((id) => d.trophies.includes(id)).slice(0, 4);
  shown.forEach((id, i) => {
    const x = 72 + (i % 2) * 480, y = 1050 + Math.floor(i / 2) * 110;
    g.fillStyle = "rgba(255,255,255,.07)"; g.beginPath(); g.roundRect(x, y, 450, 92, 22); g.fill();
    g.font = "52px sans-serif"; g.fillStyle = "#fff"; g.fillText(TROPHY_EMOJI[id], x + 18, y + 64);
    g.fillStyle = "#f2ede0"; g.font = '600 32px "Schibsted Grotesk", sans-serif'; g.fillText(msg.missions.trophy[id].name.slice(0, 22), x + 92, y + 58);
  });
  g.fillStyle = "#8d93a8"; g.font = '400 30px "Martian Mono", monospace'; g.fillText(`${msg.disclaimerShort}`, 72, 1300);
  return new Promise((res) => c.toBlob((b) => res(b!), "image/png"));
}

export async function shareCard(blob: Blob, msg: Messages): Promise<"shared" | "saved"> {
  const file = new File([blob], "latelotto-card.png", { type: "image/png" });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: msg.missions.share.title, text: msg.missions.share.text }); return "shared"; } catch { /* cancelled: fall through to download */ }
  }
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "latelotto-card.png"; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return "saved";
}
