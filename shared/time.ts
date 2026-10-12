/** Offset (seconds) of `tz` from UTC at the given instant. */
export function tzOffsetSec(epochSec: number, tz: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(new Date(epochSec * 1000));
  const g = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  const asUtc = Date.UTC(g("year"), g("month") - 1, g("day"), g("hour"), g("minute"), g("second")) / 1000;
  return Math.round(asUtc - epochSec);
}

/** Epoch seconds of local midnight (in `tz`) for the local day containing `epochSec`; right also on days when the clocks change. */
export function localDayStart(epochSec: number, tz: string): number {
  return zonedEpoch(localDateString(epochSec, tz), 0, tz);
}

/** "YYYY-MM-DD" of the local day. */
export function localDateString(epochSec: number, tz: string): string {
  return new Date((epochSec + tzOffsetSec(epochSec, tz)) * 1000).toISOString().slice(0, 10);
}

/** Parse GTFS "HH:MM:SS" (hours may exceed 24) into seconds since the service day start. */
export function parseGtfsTime(t: string): number {
  const m = /^(\d{1,3}):([0-5]\d):([0-5]\d)$/.exec(t.trim());
  if (!m) throw new Error(`Invalid GTFS time: ${t}`);
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
}

/** The start of a GTFS service day: noon of that local day minus 12 hours. It is not local midnight on a day when the clocks change. */
export function gtfsDayStart(epochSec: number, tz: string): number {
  const mid = localDayStart(epochSec, tz);
  return mid + tzOffsetSec(mid, tz) - tzOffsetSec(mid + 43200, tz);
}

/** The instant at which the wall clock of the local day `day` ("YYYY-MM-DD") reads `secs` seconds after midnight; right also on 23 and 25 hour days. */
export function zonedEpoch(day: string, secs: number, tz: string): number {
  const [y, m, d] = day.split("-").map(Number);
  const naive = Date.UTC(y!, m! - 1, d!) / 1000 + secs;
  const first = naive - tzOffsetSec(naive, tz);
  return naive - tzOffsetSec(first, tz);
}

/** The local day `n` days after `day` ("YYYY-MM-DD"), by calendar arithmetic. */
export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d! + n)).toISOString().slice(0, 10);
}
