/** Accepts the full project URL or just the 20-character project ref in SUPABASE_URL. */
export function supabaseUrl(raw = process.env.SUPABASE_URL) {
  if (!raw) return undefined;
  const v = raw.trim().replace(/\/+$/, "");
  return v.includes("://") ? v : `https://${v}.supabase.co`;
}
export function projectRef(raw = process.env.SUPABASE_URL) {
  return supabaseUrl(raw)?.replace(/^https:\/\//, "").split(".")[0];
}
