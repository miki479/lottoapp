// Run a SQL file (or a one-line query) on the project through the Management API.
//   node scripts/supabase-sql.mjs supabase/migrations/0001_core.sql
//   node scripts/supabase-sql.mjs -q "select count(*) from markets"
import { readFileSync } from "node:fs";
import { projectRef } from "./lib-env.mjs";

const [a, b] = process.argv.slice(2);
const query = a === "-q" ? b : readFileSync(a, "utf8");
const res = await fetch(`https://api.supabase.com/v1/projects/${projectRef()}/database/query`, {
  method: "POST",
  headers: { Authorization: `Bearer ${process.env.SUPABASE_ACCESS_TOKEN}`, "Content-Type": "application/json" },
  body: JSON.stringify({ query }),
});
const text = await res.text();
console.log(res.status, text.slice(0, 2000));
process.exit(res.ok ? 0 : 1);
