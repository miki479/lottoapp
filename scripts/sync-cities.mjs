// Mirror cities/*.json into the cities table (server-trusted fields only).
import { readdirSync, readFileSync } from "node:fs";
import { validateCity } from "../shared/cities.ts";
import { supabaseUrl } from "./lib-env.mjs";

const rows = readdirSync(new URL("../cities/", import.meta.url)).filter((f) => f.endsWith(".json"))
  .map((f) => validateCity(JSON.parse(readFileSync(new URL(`../cities/${f}`, import.meta.url), "utf8"))))
  .map((c) => ({ id: c.id, country: c.country, timezone: c.timezone, default_locale: c.defaultLocale }));
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const res = await fetch(`${supabaseUrl()}/rest/v1/cities`, {
  method: "POST",
  headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json", Prefer: "resolution=merge-duplicates,return=minimal" },
  body: JSON.stringify(rows),
});
console.log(res.ok ? `synced ${rows.length} cities` : `failed ${res.status} ${await res.text()}`);
process.exit(res.ok ? 0 : 1);
