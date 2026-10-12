// Push notifications through OneSignal. The REST key lives only in the function's secrets (ONESIGNAL_REST_API_KEY),
// never in the app. A player receives a message only if they allowed notifications in the app (OneSignal knows
// them by external_id = their user id). Nothing is sent without the secrets: results are then simply not announced.
type Db = ReturnType<typeof import("./common.ts").db>;

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
    const what = r.kind === "parlay" ? t.parlay : String(r.markets?.params.routeName ?? r.markets?.params.headsign ?? r.markets?.params.label ?? (r.markets?.params.home ? `${r.markets.params.home} – ${r.markets.params.away}` : "LateLotto"));
    const body = r.status === "won" ? t.won(money(r.payout - r.stake, loc), what) : r.status === "lost" ? t.lost(what) : t.void(what);
    // Only mark as announced when OneSignal accepted it, so a wrong key or an outage retries within the 30-minute window.
    if (!(await send([r.user_id], "LateLotto", body))) continue;
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
  if (!(await send(ids, "LateLotto · moderazione", body))) return 0; // not marked: retried next minute
  await mark();
  return 1;
}

const INVITE = {
  it: (who: string) => `${who} ti sfida a LateLotto: apri e scegli Sì o No`,
  "en-US": (who: string) => `${who} challenged you on LateLotto: open it and pick Yes or No`,
  "en-GB": (who: string) => `${who} challenged you on LateLotto: open it and pick Yes or No`,
  ja: (who: string) => `${who}さんからLateLottoでチャレンジです。開いて「はい」か「いいえ」を選びましょう`,
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
    if (r.friend_challenges?.code && !(await send([r.user_id], "LateLotto", INVITE[loc](who), `https://latelotto.web.app/?c=${r.friend_challenges.code}`))) continue;
    await sb.from("challenge_invites").update({ notified: true }).eq("challenge_id", r.challenge_id).eq("user_id", r.user_id);
    n++;
  }
  return n;
}

const FRIEND_REQ = {
  it: (who: string) => `${who} ti ha chiesto l'amicizia su LateLotto`,
  "en-US": (who: string) => `${who} sent you a friend request on LateLotto`,
  "en-GB": (who: string) => `${who} sent you a friend request on LateLotto`,
  ja: (who: string) => `${who}さんからLateLottoで友だち申請が届きました`,
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
    if (!(await send([r.to_id], "LateLotto", FRIEND_REQ[loc](who), "https://latelotto.web.app/?open=friends"))) continue;
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
    if (!(await send([r.user_id], "LateLotto", REMIND[loc](text ?? title)))) continue;
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
    headings: { en: "LateLotto is watching 👀", it: "LateLotto ti sta guardando 👀", ja: "LateLottoは見ています👀" },
    contents: {
      en: "New decorations, profile pictures and badges that are much, MUCH harder to get. Yes, even the ones you thought you already had. Go and look. It's not a threat. It's a fact, and facts can be scary.",
      it: "Nuove decorazioni, immagini profilo e distintivi MOLTO più difficili da ottenere. Sì, anche quelli che pensavi di avere già. Vai a dare un'occhiata. Non è una minaccia. È un fatto, e i fatti a volte fanno paura.",
      ja: "新しいデコレーション、プロフィール画像、そしてはるかに手に入りにくいバッジが登場。すでに持っていると思っていたものも例外ではありません。見に行ってください。脅しではありません。事実です。事実は時々怖いものです。",
    },
    url: "https://latelotto.web.app/?open=profile",
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
  const r = await fetch("https://api.onesignal.com/notifications", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `${key.startsWith("os_v2") ? "Key" : "Basic"} ${key}` },
    body: JSON.stringify({ app_id: app, target_channel: "push", included_segments: ["Subscribed Users"], headings: b.headings, contents: b.contents, url: b.url, ttl: 86400 }),
  });
  if (!r.ok) { lastNotifyError.msg = `broadcast ${r.status} ${(await r.text()).slice(0, 160)}`; console.error(lastNotifyError.msg); return 0; }
  return 1;
}
