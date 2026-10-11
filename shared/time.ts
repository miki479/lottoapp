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

/** Epoch seconds of local midnight (in `tz`) for the local day containing `epochSec`. */
export function localDayStart(epochSec: number, tz: string): number {
  const off = tzOffsetSec(epochSec, tz);
  const local = epochSec + off;
  const midnightLocal = local - (((local % 86400) + 86400) % 86400);
  return midnightLocal - off;
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
