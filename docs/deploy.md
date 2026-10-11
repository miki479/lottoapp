# Deploy checklist (all on free plans)

## 1. Supabase (done once)
- Apply `supabase/migrations/*.sql` in order (SQL editor, or `node scripts/supabase-sql.mjs <file>` with `SUPABASE_ACCESS_TOKEN`).
- Authentication → Sign In / Providers: **Anonymous sign-ins** on.
- Authentication → URL Configuration: set **Site URL** to the PWA address (needed for the "save your progress" email link).
  The built-in mail sender is rate limited (a few emails per hour); add a custom SMTP before promoting the app.
- Functions: `node scripts/build-functions.mjs`, then `supabase functions deploy ingest resolve --use-api --no-verify-jwt`.
- Secrets: `CRON_SECRET`, `CONTACT_EMAIL` (OVapi asks for a contact in the User-Agent).
- Cron: `ingest` and `resolve` every minute, `prune` daily (see `supabase/migrations/0005_prune_job.sql` and the commented
  `cron.schedule` calls at the end of `0001_core.sql`).
- `node scripts/sync-cities.mjs` whenever a file in `cities/` changes.

## 2. GitHub
- Repository secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (used by `.github/workflows/markets.yml`).

## 3. PWA on Cloudflare Pages
- Build command `npm ci && npm run web:build`, output directory `web/dist`.
- Variables: `VITE_SUPABASE_URL` (full `https://<ref>.supabase.co`), `VITE_SUPABASE_ANON_KEY` (public key).
- `web/functions/api/geo.ts` becomes `/api/geo` (visitor country from the edge, used to pick the default city).

## 4. Before the first real users
- Rotate the service role key and the access token if they were ever shared with a tool or a chat.
- Read the licence of every feed marked `licenseVerified: false` and keep the attribution visible in the app.
