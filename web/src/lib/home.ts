import { sb } from "./api.ts";
import type { Place } from "./places.ts";

const KEY = "home_place";

/** The optional home town (town level only). It lives in this browser and, once chosen, in the profile for area statistics. */
export function loadHome(): Place | null {
  try { const v = JSON.parse(localStorage.getItem(KEY) ?? "null") as Place | null; return v && typeof v.lat === "number" && typeof v.lon === "number" ? v : null; } catch { return null; }
}

export async function saveHome(p: Place | null): Promise<void> {
  try { if (p) localStorage.setItem(KEY, JSON.stringify(p)); else localStorage.removeItem(KEY); } catch { /* private mode */ }
  try { await sb.rpc("set_home_place", p ? { p_name: p.name, p_admin: p.admin, p_country: p.country, p_lat: p.lat, p_lon: p.lon, p_tz: p.timezone } : { p_name: null, p_admin: null, p_country: null, p_lat: null, p_lon: null, p_tz: null }); } catch { /* the local copy still works */ }
}
