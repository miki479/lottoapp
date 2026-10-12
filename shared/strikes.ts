import { computeOdds } from "./odds.ts";
import { localDateString, zonedEpoch } from "./time.ts";

/** One strike announced on the Italian Ministry of Transport's public list (RSS). */
export interface Strike {
  guid: string;
  /** Local start day, YYYY-MM-DD. */
  date: string;
  sector: string;
  scope: string;
  region: string;
  unions: string;
  who: string;
  hours: string;
}

const field = (desc: string, name: string): string => (desc.match(new RegExp(`${name}:\\s*([^<]*)`)) ?? [])[1]?.trim() ?? "";

/** Parses scioperi.mit.gov.it/.../rss. Unknown shapes yield no items: never a guess. */
export function parseStrikeRss(xml: string): Strike[] {
  const out: Strike[] = [];
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const item = m[1]!;
    const title = (item.match(/<title>([^<]*)<\/title>/) ?? [])[1] ?? "";
    const desc = (item.match(/<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>/) ?? [])[1] ?? "";
    const guid = (item.match(/<guid[^>]*>([^<]*)<\/guid>/) ?? [])[1]?.trim() ?? "";
    const d = title.match(/Data inizio:\s*(\d{2})\/(\d{2})\/(\d{4})/);
    if (!guid || !d) continue;
    out.push({
      guid, date: `${d[3]}-${d[2]}-${d[1]}`,
      sector: field(desc, "Settore"), scope: field(desc, "Rilevanza"), region: field(desc, "Regione"),
      unions: field(desc, "Sindacati"), who: field(desc, "Categoria interessata"),
      hours: (desc.match(/modalità:\s*([^<]*)/) ?? [])[1]?.trim() ?? "",
    });
  }
  return out;
}

/** National strikes that stop trains: general, multi-sector and rail. */
export const isTrainNational = (s: Strike) => /nazionale/i.test(s.scope) && /^(generale|plurisettoriale|ferroviario)/i.test(s.sector);

/** Prior that an announced strike is still on at the start of its day (an estimate: the app says so). */
export const STRIKE_GOES_AHEAD = 0.8;

export interface StrikeMarketInsert {
  city_id: string; category: "strike"; kind: "strike_on"; feed_id: string; params: Record<string, string>;
  closes_at: string; target_at: string; deadline_at: string; odds_yes: number; odds_no: number; dedupe_key: string;
}

/** Strikes starting 2–60 days ahead get one question each: still on at 00:30 of the day, or revoked / moved? */
export function buildStrikeMarkets(strikes: Strike[], nowEpoch: number, tz = "Europe/Rome"): StrikeMarketInsert[] {
  const out: StrikeMarketInsert[] = [];
  for (const s of strikes.filter(isTrainNational)) {
    const [y, mo, d] = s.date.split("-").map(Number);
    const noonUtc = Date.UTC(y!, mo! - 1, d!, 12) / 1000;
    const target = zonedEpoch(localDateString(noonUtc, tz), 1800, tz);
    const days = (target - nowEpoch) / 86400;
    if (days < 2 || days > 60) continue;
    const odds = computeOdds(STRIKE_GOES_AHEAD);
    out.push({
      city_id: "rome", category: "strike", kind: "strike_on", feed_id: "mit-scioperi",
      params: { guid: s.guid, date: s.date, sector: s.sector, who: s.who.slice(0, 120), hours: s.hours.slice(0, 160), unions: s.unions.slice(0, 80) },
      closes_at: new Date((target - 3600) * 1000).toISOString(), target_at: new Date(target * 1000).toISOString(),
      deadline_at: new Date((target + 12 * 3600) * 1000).toISOString(),
      odds_yes: odds.yes, odds_no: odds.no, dedupe_key: `mit|${s.guid}|${s.date}`,
    });
  }
  return out;
}
