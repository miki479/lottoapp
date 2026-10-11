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

async function send(userIds: string[], heading: string, body: string) {
  const key = Deno.env.get("ONESIGNAL_REST_API_KEY"), app = Deno.env.get("ONESIGNAL_APP_ID");
  if (!key || !app || userIds.length === 0) return;
  const r = await fetch("https://api.onesignal.com/notifications", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Key ${key}` },
    body: JSON.stringify({ app_id: app, target_channel: "push", include_aliases: { external_id: userIds }, headings: { en: heading }, contents: { en: body }, url: "https://latelotto.web.app/?open=bets", ttl: 3600 }),
  });
  if (!r.ok) console.error("onesignal", r.status, (await r.text()).slice(0, 200));
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
    await send([r.user_id], "LateLotto", body);
    await sb.from(r.kind === "bet" ? "bets" : "parlays").update({ notified: true }).eq("id", r.id);
    n++;
  }
  return n;
}
