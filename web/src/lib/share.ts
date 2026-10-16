import { TROPHY_IDS, type Locale, type Messages, type TrophyId } from "../i18n/index.ts";
import { fmtOdds, money, question, resultAmount } from "./format.ts";
import { cityName, cityOf } from "./cities.ts";
import type { MyBet, MyStats } from "./types.ts";
import { evidenceLines } from "../components/ResultScreen.tsx";
import { fmtSigned } from "./num.ts";

// Colours mirror tokens.css (dark theme) so shared images match the app.
const C = { bg: "#0f1115", surface: "#181b21", border: "#272c35", text: "#f3f5f8", text2: "#b6bdca", muted: "#8a92a1", brand: "#6b5bff", wonBg: "#173a33", wonFg: "#7ee8bc", lostBg: "#40262a", lostFg: "#fca5a5" };
const F = (w: number, px: number) => `${w} ${px}px Manrope, system-ui, sans-serif`;

async function fonts() { await Promise.all([F(800, 100), F(600, 40), F(700, 30)].map((f) => document.fonts.load(f).catch(() => []))); }
function canvas(w: number, h: number) { const c = document.createElement("canvas"); c.width = w; c.height = h; const g = c.getContext("2d")!; g.fillStyle = C.bg; g.fillRect(0, 0, w, h); return { c, g }; }
function wrap(g: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lh: number, maxLines = 4) {
  const words = text.split(" "); let line = ""; let n = 0;
  for (const w of words) {
    const t = line ? `${line} ${w}` : w;
    if (g.measureText(t).width > maxW && line) { g.fillText(line, x, y); y += lh; line = w; if (++n >= maxLines - 1) break; } else line = t;
  }
  g.fillText(line, x, y); return y + lh;
}
const toBlob = (c: HTMLCanvasElement) => new Promise<Blob>((res) => c.toBlob((b) => res(b!), "image/png"));
function wordmark(g: CanvasRenderingContext2D) {
  g.fillStyle = C.brand; g.beginPath(); g.roundRect(72, 72, 64, 64, 18); g.fill();
  g.strokeStyle = "#fff"; g.lineWidth = 6; g.lineCap = "round"; g.beginPath(); g.arc(104, 104, 18, 0, Math.PI * 2); g.moveTo(104, 94); g.lineTo(104, 104); g.lineTo(112, 110); g.stroke();
  g.fillStyle = C.text; g.font = F(800, 44); g.textAlign = "left"; g.fillText("Late", 156, 118); const w = g.measureText("Late").width; g.fillStyle = C.brand; g.fillText("BET", 156 + w, 118);
}

/** 1080x1350 image of one result: soft colour, an icon, the amount, and what was measured. */
export async function makeResultCard(bet: MyBet, msg: Messages, locale: Locale): Promise<Blob> {
  await fonts();
  const { c, g } = canvas(1080, 1350);
  wordmark(g);
  const st = bet.status as "won" | "lost" | "void";
  const [bg, fg] = st === "won" ? [C.wonBg, C.wonFg] : st === "lost" ? [C.lostBg, C.lostFg] : [C.surface, C.text2];
  g.fillStyle = bg; g.beginPath(); g.arc(540, 360, 120, 0, Math.PI * 2); g.fill();
  g.strokeStyle = fg; g.lineWidth = 16; g.lineCap = "round"; g.lineJoin = "round"; g.beginPath();
  if (st === "won") { g.moveTo(490, 365); g.lineTo(528, 402); g.lineTo(595, 322); }
  else if (st === "lost") { g.moveTo(495, 315); g.lineTo(585, 405); g.moveTo(585, 315); g.lineTo(495, 405); }
  else { g.arc(540, 360, 44, Math.PI * 0.2, Math.PI * 1.7); g.moveTo(556, 296); g.lineTo(580, 322); g.lineTo(548, 330); }
  g.stroke();
  g.textAlign = "center"; g.fillStyle = C.muted; g.font = F(700, 30); g.fillText(msg.result[st].toUpperCase(), 540, 548);
  g.fillStyle = fg; g.font = F(800, 200);
  const amount = resultAmount(st, bet.stake, bet.payout, locale);
  g.fillText(amount, 540, 730);
  const m = bet.markets, city = cityOf(m.city_id);
  g.fillStyle = C.text; g.font = F(600, 42); wrap(g, question(m, msg, locale, cityName(city, locale), city.timezone), 540, 840, 880, 56, 4);
  g.fillStyle = C.text2; g.font = F(600, 34);
  evidenceLines(bet, msg).forEach((l, i) => g.fillText(l, 540, 1080 + i * 46));
  g.fillStyle = C.surface; g.beginPath(); g.roundRect(72, 1170, 936, 96, 24); g.fill();
  g.fillStyle = C.text2; g.font = F(600, 30); g.textAlign = "left"; g.fillText(`${msg.result.stake}  ${money(bet.stake, locale)}`, 112, 1232); g.textAlign = "right"; g.fillText(`${msg.result.odds}  ${fmtOdds(Number(bet.odds), locale)}`, 968, 1232);
  g.textAlign = "center"; g.fillStyle = C.muted; g.font = F(600, 26); g.fillText(`${msg.disclaimerShort}`, 540, 1312);
  return toBlob(c);
}

/** 1080x1350 profile card: streak, win rate, best win, trophies. */
export async function makeProfileCard(d: { name: string | null; streak: number; stats: MyStats | null; trophies: TrophyId[] }, msg: Messages): Promise<Blob> {
  await fonts();
  const { c, g } = canvas(1080, 1350);
  wordmark(g);
  g.textAlign = "left"; g.fillStyle = C.text; g.font = F(800, 64); g.fillText(d.name ?? msg.profile.guest, 72, 260);
  const settled = (d.stats?.won ?? 0) + (d.stats?.lost ?? 0);
  const rate = settled ? Math.round(((d.stats?.won ?? 0) / settled) * 100) : null;
  const tiles: [string, string][] = [[msg.profile.stats.streak, String(d.streak)], [msg.profile.stats.winRate, rate === null ? "—" : `${rate}%`], [msg.profile.stats.best, fmtSigned(d.stats?.best_win ?? 0)], [msg.profile.stats.bets, String(d.stats?.total ?? 0)]];
  tiles.forEach(([label, val], i) => {
    const x = 72 + (i % 2) * 480, y = 330 + Math.floor(i / 2) * 270;
    g.fillStyle = C.surface; g.beginPath(); g.roundRect(x, y, 456, 246, 32); g.fill(); g.strokeStyle = C.border; g.lineWidth = 2; g.stroke();
    g.fillStyle = C.muted; g.font = F(700, 28); g.textAlign = "left"; g.fillText(label.toUpperCase(), x + 36, y + 64);
    g.fillStyle = i === 0 ? C.brand : C.text; g.font = F(800, 120); g.fillText(val, x + 36, y + 190);
  });
  g.fillStyle = C.muted; g.font = F(700, 28); g.fillText(msg.profile.trophies.toUpperCase(), 72, 940);
  TROPHY_IDS.filter((t) => d.trophies.includes(t)).slice(0, 4).forEach((id, i) => {
    const x = 72 + (i % 2) * 480, y = 970 + Math.floor(i / 2) * 100;
    g.fillStyle = C.surface; g.beginPath(); g.roundRect(x, y, 456, 80, 22); g.fill();
    g.fillStyle = C.brand; g.beginPath(); g.arc(x + 40, y + 40, 12, 0, Math.PI * 2); g.fill();
    g.fillStyle = C.text; g.font = F(700, 30); g.fillText(msg.profile.trophy[id].name.slice(0, 24), x + 72, y + 51);
  });
  g.textAlign = "center"; g.fillStyle = C.muted; g.font = F(600, 26); g.fillText(msg.disclaimerShort, 540, 1312);
  return toBlob(c);
}

export async function shareImage(blob: Blob, title: string, text: string): Promise<"shared" | "saved"> {
  const file = new File([blob], "latelotto.png", { type: "image/png" });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title, text }); return "shared"; } catch { /* cancelled: fall through to download */ }
  }
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "latelotto.png"; a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return "saved";
}
