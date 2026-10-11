# Deploy checklist (all on free plans)

## 1. Supabase (done once)
- Apply `supabase/migrations/*.sql` in order (SQL editor, or `node scripts/supabase-sql.mjs <file>` with `SUPABASE_ACCESS_TOKEN`).
- Authentication → Sign In / Providers: **Anonymous sign-ins** on.
- Authentication → URL Configuration: see step 3 (needed for the "save your progress" email link).
  The built-in mail sender is rate limited (a few emails per hour); add a custom SMTP before promoting the app.
- Functions: `node scripts/build-functions.mjs`, then `supabase functions deploy ingest resolve --use-api --no-verify-jwt`.
- Secrets: `CRON_SECRET`, `CONTACT_EMAIL` (OVapi asks for a contact in the User-Agent).
- Cron: `ingest` and `resolve` every minute, `prune` daily (see `supabase/migrations/0005_prune_job.sql` and the commented
  `cron.schedule` calls at the end of `0001_core.sql`).
- `node scripts/sync-cities.mjs` whenever a file in `cities/` changes.

## 2. GitHub
- Repository secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (used by `.github/workflows/markets.yml`).

## 3. PWA on Firebase Hosting (project `latelotto`)
Hosting only serves static files, so the free Spark plan is enough (10 GB storage, 360 MB/day transfer).
The backend stays on Supabase; the Firebase web config (apiKey, appId, analytics) is not used and not needed.

From your computer, once:
```
npm i -g firebase-tools
firebase login
npm ci
export VITE_SUPABASE_URL=https://<project-ref>.supabase.co
export VITE_SUPABASE_ANON_KEY=<anon key>      # the public one, never the service role key
npm run deploy:web                            # builds web/ and runs `firebase deploy --only hosting`
```
`firebase.json` adds a strict Content-Security-Policy (scripts and styles from the site itself, network only to
`*.supabase.co`), long caching for hashed assets and `no-cache` for the service worker. Tested with the Hosting emulator.

Automatic deploys: `.github/workflows/deploy-hosting.yml` (push to `main`) needs the secrets
`FIREBASE_SERVICE_ACCOUNT`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`.

In Supabase → Authentication → URL Configuration set **Site URL** to `https://latelotto.web.app`
and add `https://latelotto.firebaseapp.com` to the redirect URLs.

## 4. Before the first real users
- Rotate the service role key and the access token if they were ever shared with a tool or a chat.
- Read the licence of every feed marked `licenseVerified: false` and keep the attribution visible in the app.
