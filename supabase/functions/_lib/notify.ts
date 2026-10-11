// Push notifications through OneSignal. The REST key lives only in the function's secrets (ONESIGNAL_REST_API_KEY),
// never in the app. A player receives a message only if they allowed notifications in the app (OneSignal knows
// them by external_id = their user id). Nothing is sent without the secrets: results are then simply not announced.
type Db = ReturnType<typeof import("./common.ts").db>;

const CURRENCY: Record<string, string> = { it: "EUR", "en-US": "USD", "en-GB": "GBP" };
const TAG: Record<string, string> = { it: "it-IT", "en-US": "en-US", "en-GB": "en-GB" };
const money = (n: number, loc: string) =>
  new Intl.NumberFormat(TAG[loc] ?? "en-US", { style: "currency", currency: CURRENCY[loc] ?? "USD", currencyDisplay: "narrowSymbol", maximumFractionDigits: 0 }).format(n);

const TEXT = {
  it: { won: (a: string, w: string) => `Hai vinto ${a} · ${w}`, lost: (w: string) => `Stavolta no · ${w}`, void: (w: string) => `Puntata rimborsata · ${w}`, parlay: "Multipla" },
  "en-US": { won: (a: string, w: string) => `You won ${a} · ${w}`, lost: (w: string) => `Not this time · ${w}`, void: (w: string) => `Bet refunded · ${w}`, parlay: "Parlay" },
  "en-GB": { won: (a: string, w: string) => `You won ${a} · ${w}`, lost: (w: string) => `Not this time · ${w}`, void: (w: string) => `Bet refunded · ${w}`, parlay: "Accumulator" },
} as const;

export const lastNotifyError: { msg: string | null } = { msg: null };
async function send(userIds: string[], heading: string, body: string): Promise<boolean> {
  const key = Deno.env.get("ONESIGNAL_REST_API_KEY")?.trim().replace(/^(Key|Basic)\s+/i, ""), app = Deno.env.get("ONESIGNAL_APP_ID");
  if (!key || !app || userIds.length === 0) return false;
  const r = await fetch("https://api.onesignal.com/notifications", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `${key.startsWith("os_v2") ? "Key" : "Basic"} ${key}` },
    body: JSON.stringify({ app_id: app, target_channel: "push", include_aliases: { external_id: userIds }, headings: { en: heading }, contents: { en: body }, url: "https://latelotto.web.app/?open=bets", ttl: 3600 }),
  });
  if (!r.ok) { lastNotifyError.msg = `onesignal ${r.status} ${(await r.text()).slice(0, 160)}`; console.error(lastNotifyError.msg); return false; }
  return true;
}

const localParts = (tz: string, d = new Date()) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: tz, hour: "2-digit", hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(d).map((x) => [x.type, x.value]));
  return { hour: Number(p.hour), day: `${p.year}-${p.month}-${p.day}` };
};
const OPT = {
  it: { flash: (m: number) => `Evento flash: quota ×${m} per una mezz'ora`, streak: (n: number) => `Serie di ${n} giorni: una puntata oggi la tiene viva` },
  "en-US": { flash: (m: number) => `Flash event: odds ×${m} for half an hour`, streak: (n: number) => `${n}-day streak: a bet today keeps it alive` },
  "en-GB": { flash: (m: number) => `Flash event: odds ×${m} for half an hour`, streak: (n: number) => `${n}-day streak: a bet today keeps it going` },
} as const;

type Pref = { id: string; locale: string; timezone: string; city_id: string; streak: number; last_play_date: string | null; push_day: string | null; push_count: number; streak_push_day?: string | null };
/** Extra (opt-in) pushes: at most 2 a day per player, never between 22:00 and 08:00 local time. */
async function sendOptional(sb: Db, who: Pref[], text: (p: Pref) => string): Promise<number> {
  let n = 0;
  for (const p of who) {
    const lp = localParts(p.timezone);
    if (lp.hour >= 22 || lp.hour < 8) continue;
    const count = p.push_day === lp.day ? p.push_count : 0;
    if (count >= 2) continue;
    if (!(await send([p.id], "LateLotto", text(p)))) continue;
    await sb.from("profiles").update({ push_day: lp.day, push_count: count + 1 }).eq("id", p.id);
    n++;
  }
  return n;
}
const PCOLS = "id,locale,timezone,city_id,streak,last_play_date,push_day,push_count,streak_push_day";

/** A new flash event: tell the opted-in players of that city (once per event). */
export async function notifyFlash(sb: Db): Promise<number> {
  if (!Deno.env.get("ONESIGNAL_REST_API_KEY")) return 0;
  const { data: ms } = await sb.from("markets").select("id,city_id,flash_multiplier").eq("flash_notified", false).gt("flash_multiplier", 1).gt("flash_until", new Date().toISOString()).limit(20);
  let n = 0;
  for (const m of ms ?? []) {
    const { data: who } = await sb.from("profiles").select(PCOLS).eq("push_flash", true).eq("city_id", m.city_id).limit(500);
    n += await sendOptional(sb, (who ?? []) as Pref[], (p) => (OPT[(p.locale in OPT ? p.locale : "en-US") as keyof typeof OPT]).flash(Number(m.flash_multiplier)));
    await sb.from("markets").update({ flash_notified: true }).eq("id", m.id);
  }
  return n;
}

/** Streak reminder: between 19:00 and 19:59 local time, for players with a streak of 3+ who have not bet today. */
export async function notifyStreak(sb: Db): Promise<number> {
  if (!Deno.env.get("ONESIGNAL_REST_API_KEY")) return 0;
  const { data: who } = await sb.from("profiles").select(PCOLS).eq("push_streak", true).gte("streak", 3).limit(1000);
  const due = ((who ?? []) as Pref[]).filter((p) => { const lp = localParts(p.timezone); return lp.hour === 19 && p.last_play_date !== lp.day && p.streak_push_day !== lp.day; });
  const sent = await sendOptional(sb, due, (p) => (OPT[(p.locale in OPT ? p.locale : "en-US") as keyof typeof OPT]).streak(p.streak));
  // one reminder per player per local day, whether or not the daily cap let it through
  for (const p of due) await sb.from("profiles").update({ streak_push_day: localParts(p.timezone).day }).eq("id", p.id);
  return sent;
}

/** Announce results settled in the last 30 minutes, once each. Returns how many were handled. */
export async function notifyResults(sb: Db): Promise<number> {
  if (!Deno.env.get("ONESIGNAL_REST_API_KEY")) return 0;
  const since = new Date(Date.now() - 30 * 60_000).toISOString();
  const { data: bets } = await sb.from("bets").select("id,user_id,status,stake,payout,markets(params,city_id,kind),profiles(locale)")
    .eq("notified", false).neq("status", "open").gte("settled_at", since).limit(200);
  const { data: pars } = await sb.from("parlays").select("id,user_id,status,stake,payout,profiles(locale)")
    .eq("notified", false).neq("status", "open").gte("settled_at", since).limit(200);
  let n = 0;
  type Row = { id: string; user_id: string; status: string; stake: number; payout: number; markets?: { params: Record<string, unknown>; city_id: string }; profiles?: { locale: string } | null };
  const rows = [
    ...((bets ?? []) as unknown as Row[]).map((b) => ({ ...b, kind: "bet" as const })),
    ...((pars ?? []) as unknown as Row[]).map((b) => ({ ...b, kind: "parlay" as const })),
  ];
  for (const r of rows) {
    const loc = (r.profiles?.locale && r.profiles.locale in TEXT ? r.profiles.locale : "en-US") as keyof typeof TEXT;
    const t = TEXT[loc];
    const what = r.kind === "parlay" ? t.parlay : String(r.markets?.params.routeName ?? r.markets?.params.headsign ?? "LateLotto");
    const body = r.status === "won" ? t.won(money(r.payout - r.stake, loc), what) : r.status === "lost" ? t.lost(what) : t.void(what);
    // Only mark as announced when OneSignal accepted it, so a wrong key or an outage retries within the 30-minute window.
    if (!(await send([r.user_id], "LateLotto", body))) continue;
    await sb.from(r.kind === "bet" ? "bets" : "parlays").update({ notified: true }).eq("id", r.id);
    n++;
  }
  return n;
}
