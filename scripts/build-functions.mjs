// Copy /shared and /cities next to the Edge Functions so `supabase functions deploy` can bundle them.
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
const out = new URL("../supabase/functions/_shared/", import.meta.url);
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
cpSync(new URL("../shared/", import.meta.url), new URL("shared/", out), { recursive: true });
const cities = readdirSync(new URL("../cities/", import.meta.url)).filter((f) => f.endsWith(".json"))
  .map((f) => JSON.parse(readFileSync(new URL(`../cities/${f}`, import.meta.url), "utf8")));
writeFileSync(new URL("cities.index.json", out), JSON.stringify(cities));
console.log(`copied shared/ and ${cities.length} cities into supabase/functions/_shared`);
