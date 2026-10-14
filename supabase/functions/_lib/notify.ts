// Push notifications through OneSignal. The REST key lives only in the function's secrets (ONESIGNAL_REST_API_KEY),
// never in the app. A player receives a message only if they allowed notifications in the app (OneSignal knows
// them by external_id = their user id). Nothing is sent without the secrets: results are then simply not announced.
import { DECORATIONS } from "../_shared/shared/looks.ts";
type Db = ReturnType<typeof import("./common.ts").db>;

const TRAIN_KIND: Record<string, [string, string, string]> = { it: ["Alta velocità", "Intercity", "REGIONALE"], "en-US": ["High-speed", "Intercity", "Regional"], "en-GB": ["High-speed", "Intercity", "Regional"] };
/** "REG 3935" → "Regionale 3935": the kind of train in words, as in the app. Any other name stays as it is. */
export function trainWords(route: string, loc: string): string {
  const names = TRAIN_KIND[loc], m = route.trim().match(/^([A-Za-z]{1,4})\s*(\d{1,5}[A-Za-z]?)$/);
  if (!names || !m) return route;
  const c = m[1]!.toUpperCase(), k = /^(FR|FA|FB|ES|ITA|NTV|EC|EN)$/.test(c) ? names[0] : /^(IC|ICN)$/.test(c) ? names[1] : /^(REG|RV|R|RE)$/.test(c) ? names[2] : null;
  return k ? `${k} ${m[2]}` : route;
}

const CURRENCY: Record<string, string> = { it: "EUR", "en-US": "USD", "en-GB": "GBP", ja: "JPY" };
const TAG: Record<string, string> = { it: "it-IT", "en-US": "en-US", "en-GB": "en-GB", ja: "ja-JP" };
const money = (n: number, loc: string) =>
  new Intl.NumberFormat(TAG[loc] ?? "en-US", { style: "currency", currency: CURRENCY[loc] ?? "USD", currencyDisplay: "narrowSymbol", maximumFractionDigits: 0 }).format(n);

const TEXT = {
  it: { won: (a: string, w: string) => `Hai vinto ${a} · ${w}`, lost: (w: string) => `Stavolta no · ${w}`, void: (w: string) => `Puntata rimborsata · ${w}`, parlay: "Multipla" },
  "en-US": { won: (a: string, w: string) => `You won ${a} · ${w}`, lost: (w: string) => `Not this time · ${w}`, void: (w: string) => `Bet refunded · ${w}`, parlay: "Parlay" },
  "en-GB": { won: (a: string, w: string) => `You won ${a} · ${w}`, lost: (w: string) => `Not this time · ${w}`, void: (w: string) => `Bet refunded · ${w}`, parlay: "Accumulator" },
  ja: { won: (a: string, w: string) => `${a}を獲得しました · ${w}`, lost: (w: string) => `今回は残念でした · ${w}`, void: (w: string) => `予想を返金しました · ${w}`, parlay: "複数予想" },
} as const;

export const lastNotifyError: { msg: string | null } = { msg: null };
async function send(userIds: string[], heading: string, body: string, url = "https://latelotto.web.app/?open=bets"): Promise<boolean> {
  const key = Deno.env.get("ONESIGNAL_REST_API_KEY")?.trim().replace(/^(Key|Basic)\s+/i, ""), app = Deno.env.get("ONESIGNAL_APP_ID");
  if (!key || !app || userIds.length === 0) return false;
  const r = await fetch("https://api.onesignal.com/notifications", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `${key.startsWith("os_v2") ? "Key" : "Basic"} ${key}` },
    body: JSON.stringify({ app_id: app, target_channel: "push", include_aliases: { external_id: userIds }, headings: { en: heading }, contents: { en: body }, url, ttl: 3600 }),
  });
  if (!r.ok) { lastNotifyError.msg = `onesignal ${r.status} ${(await r.text()).slice(0, 160)}`; console.error(lastNotifyError.msg); return false; }
  // OneSignal answers 200 also when nobody could be reached (no device linked to that id): an empty id means nothing was sent
  const j = await r.json().catch(() => null) as { id?: string; errors?: unknown } | null;
  if (j && !j.id) { lastNotifyError.msg = `onesignal not delivered ${JSON.stringify(j.errors ?? {}).slice(0, 140)}`; console.error(lastNotifyError.msg); return true; }
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
  ja: { flash: (m: number) => `フラッシュイベント：30分間オッズ×${m}`, streak: (n: number) => `${n}日連続中：今日1回予想すれば記録が続きます` },
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
    if (!(await send([p.id], "LateBet", text(p)))) continue;
    await sb.from("profiles").update({ push_day: lp.day, push_count: count + 1 }).eq("id", p.id);
    n++;
  }
  return n;
}
const PCOLS = "id,locale,timezone,city_id,streak,last_play_date,push_day,push_count,streak_push_day";

/** A new flash event: tell the opted-in players of that city (once per event). */
export async function notifyFlash(sb: Db): Promise<number> {
  if (!Deno.env.get("ONESIGNAL_REST_API_KEY")) return 0;
  const { data: ms } = await sb.from("markets").select("id,city_id,flash_multiplier").eq("flash_notified", false).neq("city_id", "world").gt("flash_multiplier", 1).gt("flash_until", new Date().toISOString()).limit(20);
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
    const what = r.kind === "parlay" ? t.parlay : String(trainWords(String(r.markets?.params.routeName ?? ""), loc) || (r.markets?.params.headsign ?? r.markets?.params.label ?? (r.markets?.params.home ? `${r.markets.params.home} – ${r.markets.params.away}` : "LateBet")));
    const body = r.status === "won" ? t.won(money(r.payout - r.stake, loc), what) : r.status === "lost" ? t.lost(what) : t.void(what);
    // Only mark as announced when OneSignal accepted it, so a wrong key or an outage retries within the 30-minute window.
    if (!(await send([r.user_id], "LateBet", body))) continue;
    await sb.from(r.kind === "bet" ? "bets" : "parlays").update({ notified: true }).eq("id", r.id);
    n++;
  }
  return n;
}

/** Tells the admins (push) when a name was blocked or removed by the moderation guard. At most one push per run. */
export async function notifyModeration(sb: Db): Promise<number> {
  const { data: rows } = await sb.from("moderation_log").select("id,text,matched,source").eq("notified", false).order("id").limit(10);
  if (!rows || rows.length === 0) return 0;
  const { data: admins } = await sb.rpc("admin_user_ids");
  const ids = ((admins ?? []) as string[]).filter(Boolean);
  const mark = () => sb.from("moderation_log").update({ notified: true }).in("id", rows.map((r) => r.id));
  if (ids.length === 0) { await mark(); return 0; }
  const label: Record<string, string> = { nickname: "Nickname bloccato", group: "Nome gruppo bloccato", existing: "Nome rimosso" };
  const last = rows[rows.length - 1]!;
  const body = rows.length === 1 ? `${label[last.source] ?? "Nome bloccato"}: «${last.text}» (${last.matched})` : `${rows.length} nomi bloccati o rimossi · ultimo: «${last.text}» (${last.matched})`;
  if (!(await send(ids, "LateBet · moderazione", body))) return 0; // not marked: retried next minute
  await mark();
  return 1;
}

const INVITE = {
  it: (who: string) => `${who} ti sfida a LateBet: apri e scegli Sì o No`,
  "en-US": (who: string) => `${who} challenged you on LateBet: open it and pick Yes or No`,
  "en-GB": (who: string) => `${who} challenged you on LateBet: open it and pick Yes or No`,
  ja: (who: string) => `${who}さんからLateBetでチャレンジです。開いて「はい」か「いいえ」を選びましょう`,
} as const;
const WHO = { it: "Un amico", "en-US": "A friend", "en-GB": "A friend", ja: "友達" } as const;

/** A friend invited me to a challenge: tell them (once). Marked as done only when OneSignal took it, so an outage retries within the hour. */
export async function notifyInvites(sb: Db): Promise<number> {
  if (!Deno.env.get("ONESIGNAL_REST_API_KEY")) return 0;
  const since = new Date(Date.now() - 60 * 60_000).toISOString();
  const { data } = await sb.from("challenge_invites").select("challenge_id,user_id,invited_by,friend_challenges(code),me:profiles!challenge_invites_user_id_fkey(locale),by:profiles!challenge_invites_invited_by_fkey(display_name)")
    .eq("notified", false).gte("created_at", since).limit(100);
  let n = 0;
  for (const r of (data ?? []) as unknown as { challenge_id: string; user_id: string; friend_challenges: { code: string } | null; me: { locale: string } | null; by: { display_name: string | null } | null }[]) {
    const loc = (r.me?.locale && r.me.locale in INVITE ? r.me.locale : "en-US") as keyof typeof INVITE;
    const who = r.by?.display_name?.trim() || WHO[loc];
    if (r.friend_challenges?.code && !(await send([r.user_id], "LateBet", INVITE[loc](who), `https://latelotto.web.app/?c=${r.friend_challenges.code}`))) continue;
    await sb.from("challenge_invites").update({ notified: true }).eq("challenge_id", r.challenge_id).eq("user_id", r.user_id);
    n++;
  }
  return n;
}

const FRIEND_REQ = {
  it: (who: string) => `${who} ti ha chiesto l'amicizia su LateBet`,
  "en-US": (who: string) => `${who} sent you a friend request on LateBet`,
  "en-GB": (who: string) => `${who} sent you a friend request on LateBet`,
  ja: (who: string) => `${who}さんからLateBetで友だち申請が届きました`,
} as const;

/** Someone asked to be my friend: tell me (once). Marked as done only when OneSignal took it, so an outage retries within the hour. */
export async function notifyFriendRequests(sb: Db): Promise<number> {
  if (!Deno.env.get("ONESIGNAL_REST_API_KEY")) return 0;
  const since = new Date(Date.now() - 60 * 60_000).toISOString();
  const { data } = await sb.from("friend_requests").select("from_id,to_id,me:profiles!friend_requests_to_id_fkey(locale),by:profiles!friend_requests_from_id_fkey(display_name)")
    .eq("notified", false).gte("created_at", since).limit(100);
  let n = 0;
  for (const r of (data ?? []) as unknown as { from_id: string; to_id: string; me: { locale: string } | null; by: { display_name: string | null } | null }[]) {
    const loc = (r.me?.locale && r.me.locale in FRIEND_REQ ? r.me.locale : "en-US") as keyof typeof FRIEND_REQ;
    const who = r.by?.display_name?.trim() || WHO[loc];
    if (!(await send([r.to_id], "LateBet", FRIEND_REQ[loc](who), "https://latelotto.web.app/?open=friends"))) continue;
    await sb.from("friend_requests").update({ notified: true }).eq("from_id", r.from_id).eq("to_id", r.to_id);
    n++;
  }
  return n;
}

const REMIND = {
  it: (t: string) => `Domani chiude: ${t}. Hai già puntato?`,
  "en-US": (t: string) => `Closes tomorrow: ${t}. Have you placed your bet?`,
  "en-GB": (t: string) => `Closes tomorrow: ${t}. Have you placed your bet?`,
  ja: (t: string) => `明日締め切り：${t}。もう予想しましたか？`,
} as const;

/** The reminder a player asked for: the day before a house market closes (between 08:00 and 22:00 local time), once. */
export async function notifyReminders(sb: Db): Promise<number> {
  if (!Deno.env.get("ONESIGNAL_REST_API_KEY")) return 0;
  const soon = new Date(Date.now() + 30 * 3600_000).toISOString();
  const { data } = await sb.from("market_reminders").select("user_id,market_id,markets!inner(params,closes_at,status),profiles(locale,timezone)")
    .eq("sent", false).eq("markets.status", "open").lte("markets.closes_at", soon).gt("markets.closes_at", new Date().toISOString()).limit(200);
  let n = 0;
  for (const r of (data ?? []) as unknown as { user_id: string; market_id: string; markets: { params: Record<string, unknown> }; profiles: { locale: string; timezone: string } | null }[]) {
    const loc = (r.profiles?.locale && r.profiles.locale in REMIND ? r.profiles.locale : "en-US") as keyof typeof REMIND;
    const hour = localParts(r.profiles?.timezone ?? "UTC").hour;
    if (hour >= 22 || hour < 8) continue;
    const q = r.markets.params.q as Record<string, string> | undefined, title = String(r.markets.params.label ?? "");
    const text = loc === "it" ? q?.it : loc === "ja" ? q?.ja : q?.en;
    if (!(await send([r.user_id], "LateBet", REMIND[loc](text ?? title)))) continue;
    await sb.from("market_reminders").update({ sent: true }).eq("user_id", r.user_id).eq("market_id", r.market_id);
    n++;
  }
  return n;
}

const SUPER: Record<string, Record<string, (l: string, v: number) => string>> = {
  it: { fuel_move: (l, v) => `Super quota: ${l} ${v < 0 ? "in calo" : "in rialzo"} di ${Math.abs(v)} cent`, price_move: (l, v) => `Super quota: ${l} ${v > 0 ? "vola" : "crolla"} del ${Math.abs(v)}%`, quake: (_l, v) => `Super quota: terremoto di magnitudo ${v}`, storm: (_l, v) => `Super quota: uragano a ${v} nodi` },
  "en-US": { fuel_move: (l, v) => `Super odds: ${l} ${v < 0 ? "down" : "up"} ${Math.abs(v)} cents`, price_move: (l, v) => `Super odds: ${l} ${v > 0 ? "jumps" : "drops"} ${Math.abs(v)}%`, quake: (_l, v) => `Super odds: magnitude ${v} earthquake`, storm: (_l, v) => `Super odds: hurricane at ${v} knots` },
  ja: { fuel_move: (l, v) => `スーパーオッズ：${l}が${Math.abs(v)}セント${v < 0 ? "下落" : "上昇"}`, price_move: (l, v) => `スーパーオッズ：${l}が${Math.abs(v)}%${v > 0 ? "急騰" : "急落"}`, quake: (_l, v) => `スーパーオッズ：マグニチュード${v}の地震`, storm: (_l, v) => `スーパーオッズ：風速${v}ノットのハリケーン` },
};
SUPER["en-GB"] = SUPER["en-US"]!;
const SUBJECT: Record<string, Record<string, string>> = {
  it: { "fuel:benzina": "la benzina", "fuel:gasolio": "il gasolio", btc: "Bitcoin", eth: "Ethereum", "metal:xau": "l'oro", "metal:xag": "l'argento", "metal:xpt": "il platino", "metal:hg": "il rame" },
  en: { "fuel:benzina": "petrol", "fuel:gasolio": "diesel", btc: "Bitcoin", eth: "Ethereum", "metal:xau": "gold", "metal:xag": "silver", "metal:xpt": "platinum", "metal:hg": "copper" },
  ja: { "fuel:benzina": "ガソリン", "fuel:gasolio": "軽油", btc: "ビットコイン", eth: "イーサリアム", "metal:xau": "金", "metal:xag": "銀", "metal:xpt": "プラチナ", "metal:hg": "銅" },
};

/** A "super quota" just started: tell everyone who allowed the optional pushes (once per question; at most 2 optional pushes a day each). */
export async function notifySupers(sb: Db): Promise<number> {
  if (!Deno.env.get("ONESIGNAL_REST_API_KEY")) return 0;
  const { data: ms } = await sb.from("markets").select("id,params").eq("flash_notified", false).eq("flash_kind", "super").gt("flash_until", new Date().toISOString()).limit(3);
  let n = 0;
  for (const m of ms ?? []) {
    const sp = (m.params as { super?: { reason: string; subject: string; value: string } }).super;
    const { data: who } = await sb.from("profiles").select(PCOLS).eq("push_flash", true).limit(1000);
    if (sp) n += await sendOptional(sb, (who ?? []) as Pref[], (p) => {
      const loc = p.locale in SUPER ? p.locale : "en-US", lang = loc === "it" ? "it" : loc === "ja" ? "ja" : "en";
      const subj = SUBJECT[lang]![sp.subject] ?? SUBJECT[lang]![sp.subject.replace(/:.*/, "")] ?? sp.subject;
      return (SUPER[loc]![sp.reason] ?? SUPER["en-US"]![sp.reason] ?? ((_l: string, _v: number) => "Super odds"))(subj, Number(sp.value));
    });
    await sb.from("markets").update({ flash_notified: true }).eq("id", m.id);
  }
  return n;
}

const BIG: Record<string, (who: string, amount: string) => string> = {
  it: (who, a) => `${who} ha appena vinto ${a} in una puntata! Riesci a fare di meglio?`,
  "en-US": (who, a) => `${who} just won ${a} on one bet! Can you beat that?`,
  "en-GB": (who, a) => `${who} just won ${a} on one bet! Can you beat that?`,
  ja: (who, a) => `${who}が1回の予想で${a}を獲得しました！あなたは超えられる？`,
};
/** Winnings (profit) from which a friend's win is worth a push. */
export const BIG_WIN = 3000;
/** A friend won 3,000 or more on one bet: tell the friends who allowed it (once per bet; the optional-push limits apply). */
export async function notifyFriendWins(sb: Db): Promise<number> {
  if (!Deno.env.get("ONESIGNAL_REST_API_KEY")) return 0;
  const since = new Date(Date.now() - 2 * 3600_000).toISOString();
  const { data } = await sb.from("bets").select("id,user_id,stake,payout,profiles(display_name)").eq("status", "won").eq("big_notified", false).gte("settled_at", since).limit(40);
  let n = 0;
  for (const b of (data ?? []) as unknown as { id: string; user_id: string; stake: number; payout: number; profiles: { display_name: string | null } | null }[]) {
    const net = b.payout - b.stake;
    if (net < BIG_WIN) { if (net >= 0) await sb.from("bets").update({ big_notified: true }).eq("id", b.id); continue; }
    const { data: fr } = await sb.from("friendships").select("friend_id").eq("user_id", b.user_id).limit(200);
    const ids = (fr ?? []).map((f) => f.friend_id as string);
    if (ids.length) {
      const { data: who } = await sb.from("profiles").select(PCOLS).eq("push_friends", true).in("id", ids);
      const name = b.profiles?.display_name?.trim() || "";
      n += await sendOptional(sb, (who ?? []) as Pref[], (p) => { const loc = p.locale in BIG ? p.locale : "en-US"; return BIG[loc]!(name || (loc === "it" ? "Un tuo amico" : "A friend"), money(net, loc)); });
    }
    await sb.from("bets").update({ big_notified: true }).eq("id", b.id);
  }
  return n;
}

/** One announcement to everybody who allowed notifications, sent once: it goes out when app_settings has broadcast_pending = <id> and broadcast_done is not that id yet. */
const BROADCAST = {
  looks_v1: {
    headings: { en: "LateBet is watching 👀", it: "LateBet ti sta guardando 👀", ja: "LateBetは見ています👀" },
    contents: {
      en: "New decorations, profile pictures and badges that are much, MUCH harder to get. Yes, even the ones you thought you already had. Go and look. It's not a threat. It's a fact, and facts can be scary.",
      it: "Nuove decorazioni, immagini profilo e distintivi MOLTO più difficili da ottenere. Sì, anche quelli che pensavi di avere già. Vai a dare un'occhiata. Non è una minaccia. È un fatto, e i fatti a volte fanno paura.",
      ja: "新しいデコレーション、プロフィール画像、そしてはるかに手に入りにくいバッジが登場。すでに持っていると思っていたものも例外ではありません。見に行ってください。脅しではありません。事実です。事実は時々怖いものです。",
    },
    url: "https://latelotto.web.app/?open=profile",
  },
  // everybody who allowed notifications; the in-app gift (credits and boosts) is written first, see scripts/send-bomb.sql
  bomb_v1: {
    headings: { en: "A 💣 is waiting for you", it: "C'è una 💣 che ti aspetta", ja: "💣があなたを待っています" },
    contents: {
      en: "The others are already playing a round. We left a 💣 inside the app for you: 1,500 pretend credits and 2 boosts. Come and have a game, there is a fresh question on your bus.",
      it: "Gli altri stanno già facendo la loro partita. Ti abbiamo lasciato una 💣 nell'app: 1.500 crediti finti e 2 boost. Vieni a farti una partita, c'è una domanda fresca sul tuo bus.",
      ja: "みんなはもう一局始めています。アプリの中に💣を置いておきました：ニセクレジット1,500と、ブースト2つ。ひと勝負どうぞ。あなたのバスに新しい予想があります。",
    },
    url: "https://latelotto.web.app/",
  },
  // a plain push with no gift: set app_settings broadcast_pending = 'bomb_v2'
  bomb_v2: {
    headings: { en: "💣 Don't look under the bed. Look at the app.", it: "💣 Non guardare sotto il letto. Guarda l'app.", ja: "💣 ベッドの下は見ないで。アプリを見て。" },
    contents: {
      en: "We planted a bomb. Relax: it is full of odds and late buses, so the real danger is how much time you will lose in there. Come in, or next time your bus will be on time, and you will wish you had never found out.",
      it: "Abbiamo piazzato una bomba. Tranquillo: è piena di quote e di bus in ritardo, quindi il vero pericolo è quanto tempo ci perderai dentro. Entra, o la prossima volta il tuo bus sarà puntuale e vorresti non averlo mai scoperto.",
      ja: "爆弾を仕掛けました。ご安心を。中身はオッズと遅れたバスだけなので、本当の危険は、そこでどれだけ時間を失うかです。入ってください。さもないと次はあなたのバスが定刻通りに来て、知らなければよかったと思うことになります。",
    },
    url: "https://latelotto.web.app/",
  },
  // the sarcastic bomb again, with 1,000 in the player's own money and a gift to choose inside (see scripts/send-gift-choice.sql). Sent per language: the money differs.
  gift_v1: {
    byLocale: {
      it: { h: "💣 Non guardare sotto il letto. Guarda l'app.", c: "Abbiamo piazzato una bomba. Tranquillo: dentro ci sono 1.000 € e un regalo a tua scelta, e il vero pericolo è quanto tempo ci perderai nell'app. Entra, o la prossima volta il tuo bus sarà puntuale e vorresti non averlo mai scoperto." },
      "en-US": { h: "💣 Don't look under the bed. Look at the app.", c: "We planted a bomb. Relax: inside there is $1,000 and a gift of your choice, and the real danger is how much time you will lose in the app. Come in, or next time your bus will be on time, and you will wish you had never found out." },
      "en-GB": { h: "💣 Don't look under the bed. Look at the app.", c: "We planted a bomb. Relax: inside there is £1,000 and a gift of your choice, and the real danger is how much time you will lose in the app. Come in, or next time your bus will be on time, and you will wish you had never found out." },
      ja: { h: "💣 ベッドの下は見ないで。アプリを見て。", c: "爆弾を仕掛けました。ご安心を。中には1,000円とお好きなプレゼントがひとつ入っています。本当の危険は、アプリで失う時間です。入ってください。さもないと次はあなたのバスが定刻通りに来て、知らなければよかったと思うことになります。" },
    },
    url: "https://latelotto.web.app/",
  },
  // the apology after the outage of 14 October (1,000 in the player's own money and a gift to choose: scripts/send-sorry.sql). Per language: the money differs.
  sorry_v1: {
    byLocale: {
      it: { h: "Siamo tornati online ✅", c: "Scusa per il problema tecnico. Per farci perdonare ti aspettano 1.000 € e un regalo a tua scelta nell'app." },
      "en-US": { h: "We are back online ✅", c: "Sorry for the technical problem. To make up for it, $1,000 and a gift of your choice are waiting in the app." },
      "en-GB": { h: "We are back online ✅", c: "Sorry for the technical problem. To make up for it, £1,000 and a gift of your choice are waiting in the app." },
      ja: { h: "オンラインに戻りました ✅", c: "技術的な問題でご迷惑をおかけしました。お詫びに1,000円とお好きなプレゼントをアプリでお受け取りください。" },
    },
    url: "https://latelotto.web.app/",
  },
  // ready for the day the frisbee questions go live: set app_settings broadcast_pending = 'frisbee_v1'
  frisbee_v1: {
    headings: { en: "Frisbee has landed 🥏", it: "È arrivato il frisbee 🥏", ja: "フリスビーが登場 🥏" },
    contents: {
      en: "Ultimate frisbee questions are in. Yes, the sport where the referee is honour. Come and see if your gut feeling holds up in the wind.",
      it: "Sono arrivate le domande sul frisbee. Sì, lo sport in cui l'arbitro è l'onore. Vieni a vedere se il tuo intuito regge anche col vento.",
      ja: "アルティメットフリスビーの予想が登場。審判は「名誉」というあのスポーツです。風の中でも勘が当たるか試してみて。",
    },
    url: "https://latelotto.web.app/",
  },
} as const;
export async function notifyBroadcast(sb: Db): Promise<number> {
  const { data } = await sb.from("app_settings").select("key,value").in("key", ["broadcast_pending", "broadcast_done"]);
  const v = Object.fromEntries((data ?? []).map((r) => [r.key as string, r.value as string]));
  const id = v.broadcast_pending as keyof typeof BROADCAST | undefined;
  if (!id || id === v.broadcast_done || !(id in BROADCAST)) return 0;
  const key = Deno.env.get("ONESIGNAL_REST_API_KEY")?.trim().replace(/^(Key|Basic)\s+/i, ""), app = Deno.env.get("ONESIGNAL_APP_ID");
  if (!key || !app) return 0;
  // mark first: a failure after the send must never repeat the message to everybody
  await sb.from("app_settings").upsert({ key: "broadcast_done", value: id });
  const b = BROADCAST[id];
  const post = async (body: Record<string, unknown>) => {
    const r = await fetch("https://api.onesignal.com/notifications", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `${key.startsWith("os_v2") ? "Key" : "Basic"} ${key}` },
      body: JSON.stringify({ app_id: app, target_channel: "push", url: b.url, ttl: 86400, ...body }),
    });
    if (!r.ok) { lastNotifyError.msg = `broadcast ${r.status} ${(await r.text()).slice(0, 160)}`; console.error(lastNotifyError.msg); return false; }
    // 200 with an empty id means nobody was reached (wrong segment name, nobody subscribed): that is a failure, not a success
    const j = await r.json().catch(() => null) as { id?: string; errors?: unknown } | null;
    if (!j?.id) { lastNotifyError.msg = `broadcast not delivered ${JSON.stringify(j?.errors ?? {}).slice(0, 140)}`; console.error(lastNotifyError.msg); return false; }
    return true;
  };
  let ok = 0;
  if ("byLocale" in b) {
    // one send per language, addressed by player id: the money in the text differs between en-US and en-GB
    const { data: rows } = await sb.from("profiles").select("id,locale").limit(20000);
    for (const [loc, t] of Object.entries(b.byLocale)) {
      const ids = (rows ?? []).filter((r) => (r.locale as string) === loc).map((r) => r.id as string);
      for (let i = 0; i < ids.length; i += 1000) if (await post({ include_aliases: { external_id: ids.slice(i, i + 1000) }, headings: { en: t.h }, contents: { en: t.c } })) ok++;
    }
  } else if (await post({ included_segments: ["Total Subscriptions"], headings: b.headings, contents: b.contents })) ok++;
  if (ok === 0) await sb.from("app_settings").upsert({ key: "broadcast_done", value: `${id}:failed` }); // so that a fixed run can send it again
  return ok > 0 ? 1 : 0;
}

// ---- more pushes: rewards, live delay, Sunday recap, coming back ----
// All of them go through sendOptional: at most 2 a day per player, never between 22:00 and 08:00 local time, and only for players who kept those alerts on.
type Loc = "it" | "en-US" | "en-GB" | "ja";
const L = (l: string): Loc => (l === "it" || l === "ja" || l === "en-GB" ? l : "en-US");
const MORE = {
  it: {
    level: (n: number, deco: boolean) => (deco ? `Livello ${n}: sbloccata una nuova decorazione. Il tuo profilo ringrazia.` : `Livello ${n}. Nessuno ha chiesto un applauso, ma te lo sei guadagnato.`),
    trophy: "Nuovo trofeo sbloccato. Passa a vederlo, è anche bello.",
    both: (n: number) => `Livello ${n} e un nuovo trofeo. Oggi il tuo profilo è in forma.`,
    live: (route: string, d: number, line: number) => `Il tuo ${route} ha ${d} min di ritardo (la soglia è ${line}). Ti teniamo informato.`,
    recap: (n: number, w: number) => `Il riepilogo della settimana: ${n} puntate chiuse, ${w} azzeccate. Niente di cui lamentarsi.`,
    back7: "È una settimana che non ci vediamo. Nessun debito, nessuna colpa: c'è una domanda nuova sul tuo bus.",
    back21: "Sono tre settimane. Se non ti va più, nessun problema: l'app resta qui, tranquilla.",
  },
  "en-US": {
    level: (n: number, deco: boolean) => (deco ? `Level ${n}: a new decoration unlocked. Your profile says thanks.` : `Level ${n}. Nobody asked for applause, but you earned it.`),
    trophy: "New trophy unlocked. Come and look, it is rather nice.",
    both: (n: number) => `Level ${n} and a new trophy. Your profile is in good shape today.`,
    live: (route: string, d: number, line: number) => `Your ${route} is ${d} min late (the line is ${line}). We will keep you posted.`,
    recap: (n: number, w: number) => `Your week: ${n} bets settled, ${w} right. Nothing to complain about.`,
    back7: "It has been a week. No debt, no guilt: there is a new question about your bus.",
    back21: "Three weeks now. If it is not for you any more, no problem: the app will wait quietly.",
  },
  "en-GB": {
    level: (n: number, deco: boolean) => (deco ? `Level ${n}: a new decoration unlocked. Your profile says thanks.` : `Level ${n}. Nobody asked for applause, but you earned it.`),
    trophy: "New trophy unlocked. Pop in and have a look, it is rather nice.",
    both: (n: number) => `Level ${n} and a new trophy. Your profile is in good shape today.`,
    live: (route: string, d: number, line: number) => `Your ${route} is ${d} min late (the line is ${line}). We will keep you posted.`,
    recap: (n: number, w: number) => `Your week: ${n} bets settled, ${w} right. Nothing to grumble about.`,
    back7: "It has been a week. No debt, no guilt: there is a new question about your bus.",
    back21: "Three weeks now. If it is not for you any more, no problem: the app will wait quietly.",
  },
  ja: {
    level: (n: number, deco: boolean) => (deco ? `レベル${n}：新しいデコレーションが解放されました。` : `レベル${n}に到達しました。`),
    trophy: "新しいトロフィーを獲得しました。見に来てください。",
    both: (n: number) => `レベル${n}と新しいトロフィーを獲得しました。`,
    live: (route: string, d: number, line: number) => `あなたの${route}は${d}分遅れです（基準は${line}分）。`,
    recap: (n: number, w: number) => `今週のまとめ：${n}件が確定、${w}件的中。`,
    back7: "1週間ぶりです。気軽にどうぞ。あなたのバスについて新しい質問があります。",
    back21: "3週間たちました。もう必要なければ大丈夫。アプリはここで静かに待っています。",
  },
} as const;

const PCOLS2 = `${PCOLS},level`;
type PrefL = Pref & { level?: number; level_pushed?: number | null; rewards_pushed_at?: string | null; comeback_stage?: number; recap_week?: string | null };
async function prefsOf(sb: Db, ids: string[], flag: "push_streak" | "push_ok", extra = ""): Promise<PrefL[]> {
  if (ids.length === 0) return [];
  const { data } = await sb.from("profiles").select(`${PCOLS2}${extra}`).eq(flag, true).in("id", ids).limit(500);
  return (data ?? []) as unknown as PrefL[];
}

/** A level reached or a trophy won since the last look: one friendly push each time, merged. */
export async function notifyRewards(sb: Db): Promise<number> {
  if (!Deno.env.get("ONESIGNAL_REST_API_KEY")) return 0;
  const { data: lv } = await sb.from("profiles").select(`${PCOLS2},level_pushed,rewards_pushed_at`).eq("push_streak", true).not("level_pushed", "is", null).limit(2000);
  const { data: tr } = await sb.from("trophies").select("user_id,earned_at").gt("earned_at", new Date(Date.now() - 6 * 3600_000).toISOString()).limit(500);
  const trophyUsers = new Set<string>();
  const byUser = new Map(((lv ?? []) as unknown as PrefL[]).map((p) => [p.id, p]));
  for (const t of tr ?? []) { const p = byUser.get(t.user_id as string); if (p && (!p.rewards_pushed_at || Date.parse(t.earned_at as string) > Date.parse(p.rewards_pushed_at))) trophyUsers.add(p.id); }
  const todo = [...byUser.values()].filter((p) => (p.level ?? 1) > (p.level_pushed ?? 1) || trophyUsers.has(p.id));
  if (todo.length === 0) return 0;
  const sent = await sendOptional(sb, todo, (p) => {
    const m = MORE[L(p.locale)], up = (p.level ?? 1) > (p.level_pushed ?? 1), deco = DECORATIONS.some((d) => d.level !== undefined && d.level > (p.level_pushed ?? 1) && d.level <= (p.level ?? 1));
    return up && trophyUsers.has(p.id) ? m.both(p.level ?? 1) : up ? m.level(p.level ?? 1, deco) : m.trophy;
  });
  // whether or not the daily cap let it through, it is handled: a push about something old is worse than none
  for (const p of todo) await sb.from("profiles").update({ level_pushed: p.level ?? 1, rewards_pushed_at: new Date().toISOString() }).eq("id", p.id);
  return sent;
}

/** A train or bus the player bet on is already past the line of the question: once per bet. */
export async function notifyLiveDelay(sb: Db): Promise<number> {
  if (!Deno.env.get("ONESIGNAL_REST_API_KEY")) return 0;
  const { data } = await sb.rpc("live_bet_alerts");
  const rows = (data ?? []) as { bet_id: string; user_id: string; route: string; delay_min: number; line_min: number }[];
  if (rows.length === 0) return 0;
  const prefs = new Map((await prefsOf(sb, [...new Set(rows.map((r) => r.user_id))], "push_ok")).map((p) => [p.id, p]));
  let n = 0;
  const done = new Set<string>(), seenUser = new Set<string>();
  for (const r of rows) {
    done.add(r.bet_id);
    const p = prefs.get(r.user_id);
    if (!p || seenUser.has(r.user_id)) continue; // one push per player per run, whatever the number of bets
    seenUser.add(r.user_id);
    n += await sendOptional(sb, [p], (x) => MORE[L(x.locale)].live(trainWords(r.route, L(x.locale)) || "—", r.delay_min, r.line_min));
  }
  if (done.size) await sb.from("bets").update({ live_alerted: true }).in("id", [...done]);
  return n;
}

const isoWeek = (d: Date) => { const t = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())); const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day); const y = new Date(Date.UTC(t.getUTCFullYear(), 0, 1)); return `${t.getUTCFullYear()}-W${Math.ceil(((t.getTime() - y.getTime()) / 86400000 + 1) / 7)}`; };

/** Sunday between 18:00 and 18:59 local: the week in one line, only for players who finished at least one bet. */
export async function notifyRecap(sb: Db): Promise<number> {
  if (!Deno.env.get("ONESIGNAL_REST_API_KEY")) return 0;
  const { data } = await sb.from("profiles").select(`${PCOLS2},recap_week`).eq("push_streak", true).limit(2000);
  const week = isoWeek(new Date());
  const due = ((data ?? []) as unknown as PrefL[]).filter((p) => { const d = new Date(new Date().toLocaleString("en-US", { timeZone: p.timezone })); return d.getDay() === 0 && d.getHours() === 18 && p.recap_week !== week; });
  let n = 0;
  for (const p of due) {
    const { data: r } = await sb.rpc("week_recap", { p_user: p.id });
    const row = (r as { n: number; won: number }[] | null)?.[0];
    await sb.from("profiles").update({ recap_week: week }).eq("id", p.id);
    if (!row || row.n < 1) continue;
    n += await sendOptional(sb, [p], (x) => MORE[L(x.locale)].recap(row.n, row.won));
  }
  return n;
}

/** Nobody played for 7 days, and again after 21: a light, guilt-free note, then silence until they come back. */
export async function notifyComeback(sb: Db): Promise<number> {
  if (!Deno.env.get("ONESIGNAL_REST_API_KEY")) return 0;
  const { data } = await sb.from("profiles").select(`${PCOLS2},comeback_stage`).eq("push_streak", true).not("last_play_date", "is", null).limit(3000);
  const day = (s: string) => Date.parse(`${s}T00:00:00Z`);
  let n = 0;
  for (const p of (data ?? []) as unknown as PrefL[]) {
    const lp = localParts(p.timezone), idle = Math.floor((day(lp.day) - day(p.last_play_date!)) / 86400000), stage = p.comeback_stage ?? 0;
    if (idle <= 3 && stage > 0) { await sb.from("profiles").update({ comeback_stage: 0 }).eq("id", p.id); continue; }
    const next = idle >= 21 && stage < 2 ? 2 : idle >= 7 && idle < 21 && stage < 1 ? 1 : 0;
    if (!next || lp.hour < 11 || lp.hour > 18) continue;
    const sent = await sendOptional(sb, [p], (x) => (next === 2 ? MORE[L(x.locale)].back21 : MORE[L(x.locale)].back7));
    if (sent > 0) { await sb.from("profiles").update({ comeback_stage: next }).eq("id", p.id); n++; }
  }
  return n;
}

/** One-off messages to one player, queued by an admin as app_settings rows named "direct:<anything>" holding {user, heading, body, url?, gifts?}. Sent once, then the row is removed. */
export async function notifyDirect(sb: Db): Promise<number> {
  const { data } = await sb.from("app_settings").select("key,value").like("key", "direct:%").limit(20);
  let n = 0;
  for (const r of data ?? []) {
    let m: { user?: string; heading?: string; body?: string; url?: string; gifts?: { credits?: number; boosts?: number; decoration?: string } } | null = null;
    try { m = JSON.parse(r.value as string); } catch { /* removed below */ }
    if (m?.user && m.heading && m.body) {
      // the in-app message (with its gifts) is stored first, so a player without push, or a push that is refused, still gets it
      await sb.from("user_messages").insert({ user_id: m.user, heading: m.heading, body: m.body, gifts: m.gifts ?? null });
      if (Deno.env.get("ONESIGNAL_REST_API_KEY")) await send([m.user], m.heading, m.body, m.url ?? "https://latelotto.web.app/?open=profile");
      n++;
    }
    await sb.from("app_settings").delete().eq("key", r.key as string);
  }
  return n;
}

// ---- personal super-odds (public.make_personal_offers, migration 0096) ----
// Warm, a little ironic, never about losses or chasing: the text only says there is a gift, how big, and that ignoring it is fine.
const OFFER_TXT = {
  it: {
    head: "Una quota solo per te",
    absent: (x: number, s: number) => `Ti abbiamo tenuto il posto caldo. Una quota ×${x} su una domanda scelta per te, puntata massima ${s} crediti finti. Nessun debito, giuro.`,
    losses: (x: number, s: number) => `Un regalo, non un invito: una quota ×${x} su una domanda scelta per te, puntata massima ${s} crediti finti. Guardala con calma, o ignorala senza rimorsi.`,
    random: (x: number, s: number) => `Oggi il caso ti ha scelto: una quota ×${x} tutta tua, puntata massima ${s} crediti finti. Il caso ha i suoi capricci.`,
  },
  "en-US": {
    head: "Odds just for you",
    absent: (x: number, s: number) => `We kept your seat warm. Odds of ×${x} on a question picked for you, max stake ${s} pretend credits. No debt, promise.`,
    losses: (x: number, s: number) => `A gift, not an invitation: odds of ×${x} on a question picked for you, max stake ${s} pretend credits. Look at it calmly, or ignore it with a clear conscience.`,
    random: (x: number, s: number) => `Chance picked you today: odds of ×${x} all your own, max stake ${s} pretend credits. Chance has its whims.`,
  },
  "en-GB": {
    head: "Odds just for you",
    absent: (x: number, s: number) => `We kept your seat warm. Odds of ×${x} on a question picked for you, max stake ${s} pretend credits. No debt, promise.`,
    losses: (x: number, s: number) => `A gift, not an invitation: odds of ×${x} on a question picked for you, max stake ${s} pretend credits. Have a calm look, or ignore it with a clear conscience.`,
    random: (x: number, s: number) => `Chance picked you today: odds of ×${x} all your own, max stake ${s} pretend credits. Chance does like its whims.`,
  },
  ja: {
    head: "あなただけのオッズ",
    absent: (x: number, s: number) => `席を温めておきました。あなたのために選んだ予想にオッズ×${x}。上限は${s}ニセクレジット。貸しはありません。`,
    losses: (x: number, s: number) => `お誘いではなく、ただの贈り物です。あなたのために選んだ予想にオッズ×${x}。上限は${s}ニセクレジット。ゆっくり見ても、見送ってもかまいません。`,
    random: (x: number, s: number) => `今日は偶然があなたを選びました。あなただけのオッズ×${x}。上限は${s}ニセクレジット。`,
  },
} as const;

/** A new personal offer: write the in-app message (once), then push it under the optional-push limits (2 a day, quiet hours); retried while the offer is alive. */
export async function notifyOffers(sb: Db): Promise<number> {
  const { data } = await sb.from("personal_offers").select("id,user_id,multiplier,max_stake,reason,messaged,profiles(id,locale,timezone,city_id,streak,last_play_date,push_day,push_count,streak_push_day,push_flash,push_streak)")
    .eq("notified", false).is("used_at", null).gt("expires_at", new Date().toISOString()).gt("created_at", new Date(Date.now() - 2 * 86400_000).toISOString()).limit(50);
  let n = 0;
  type Row = { id: string; user_id: string; multiplier: number; max_stake: number; reason: "absent" | "losses" | "random"; messaged: boolean; profiles: (Pref & { push_flash: boolean; push_streak: boolean }) | null };
  for (const r of (data ?? []) as unknown as Row[]) {
    const p = r.profiles;
    if (!p) continue;
    const t = OFFER_TXT[L(p.locale)], body = t[r.reason](r.multiplier, r.max_stake);
    // the message first, so a player without push (or in quiet hours) still finds the gift in the app
    if (!r.messaged) {
      const { error } = await sb.from("user_messages").insert({ user_id: r.user_id, heading: t.head, body });
      if (error) continue;
      await sb.from("personal_offers").update({ messaged: true }).eq("id", r.id);
    }
    if (!(p.push_flash || p.push_streak) || !Deno.env.get("ONESIGNAL_REST_API_KEY")) { await sb.from("personal_offers").update({ notified: true }).eq("id", r.id); continue; }
    if (await sendOptional(sb, [p], () => body) > 0) { await sb.from("personal_offers").update({ notified: true }).eq("id", r.id); n++; }
  }
  return n;
}
