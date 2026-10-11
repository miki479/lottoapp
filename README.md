# lottoapp

A **play-money** betting game on real public-transport delays and weather.
Real data, fake credits. Starts in Tokyo; every city is just a config file.

> **Disclaimer.** This is a game. Credits are fictional, have no monetary value, cannot be
> bought, sold, withdrawn or exchanged for prizes, and there are no in-app purchases.
> It is not gambling and must not be used as such.

## Status

Done: shared game logic with tests, city configs (Tokyo, Rome, Amsterdam), feed adapters, DB schema,
market generator, `ingest` and `resolve` Edge Functions.
Next: the PWA, retention features, localisation, deploy and first calibration on real data.

## Coverage

| City | Bus/tram | Trains | Weather |
|---|---|---|---|
| Tokyo | Toei (positions + timetable), Keisei (explicit delays) | off (ODPT public train feed is nearly empty) | Open-Meteo |
| Rome | ATAC / Roma TPL (GTFS-RT TripUpdates) | no open feed | Open-Meteo |
| Amsterdam | off | Dutch railways (GTFS-RT TripUpdates) | Open-Meteo |

**Italian trains are not covered.** Trenitalia/RFI publish no official open real-time feed; the only source
is the unofficial ViaggiaTreno API, which has no licence and refused datacenter requests in testing.
Italian players get Rome for bus/tram and may bet on Dutch trains. Adding Italian trains needs written permission or an official feed.

**Licence gate.** A feed with `licenseVerified: false` in its city file is skipped by the Edge Functions
unless `ALLOW_UNVERIFIED_FEEDS=1`. Rome and the Dutch train feed are unverified until someone reads their current terms.

## Layout

| Path | What |
|---|---|
| `cities/*.json` | One file per city: timezone, tone, feeds, attribution. Adding a city needs no code change. |
| `shared/` | Pure TypeScript (no Node/Deno APIs): odds, resolution, wallet, delay maths, feed adapters. Used by tests, Edge Functions and the PWA. |
| `shared/adapters/` | One adapter per data format (`gtfs-rt`, `open-meteo`). New formats register in `adapters/index.ts`. |
| `scripts/` | `generate-markets.mjs` (builds the day's markets from static GTFS), `build-functions.mjs` (copies `shared/` + `cities/` for deploy), `smoke-feed.mjs` (live feed through the real adapters). |
| `supabase/functions/` | `ingest` and `resolve`, both called every minute by pg_cron with `x-cron-secret`. |
| `supabase/migrations/` | Postgres schema, RLS, and the transactional `place_bet` / `settle_market` functions. |
| `tests/` | Vitest. Resolution rules are covered, including feed-down and void cases. |
| `docs/phase0-findings.md` | Results of the live data-source verification. |

## Rules that the code enforces

- Resolution never guesses: with no valid reading after the deadline, or when the feed was down, the market is **void** and stakes are refunded.
- Odds come from history (Beta prior over fixed starting probabilities), with an 8% house margin; flash events multiply odds up to x3.
- 1000 starting credits; if the balance is under 100, one top-up to 250 per local day.
- Players only bet against the house.
- TripUpdates are forecasts: a delay counts as a fact only if the feed refreshed it within 2 minutes of the predicted passage or later. Earlier forecasts are ignored.

## Develop

```
npm install
npm test
npm run typecheck
node scripts/build-functions.mjs   # before `supabase functions deploy`
```

Live checks need network access to the providers; from the cloud sandbox use
`NODE_USE_ENV_PROXY=1 NODE_EXTRA_CA_CERTS=/root/.ccr/ca-bundle.crt`.

Copy `.env.example` to `.env`; never commit real keys.

## Data attribution

Attribution is stored per feed in the city file and must be shown in the app.

- Toei Bus: © 東京都交通局, via 公共交通オープンデータ協議会 (ODPT), CC BY 4.0.
- Keisei Transit Bus (Keisei Bus Chiba West): © 京成トランジットバス, via ODPT, CC BY 4.0.
- Rome: © Roma Servizi per la Mobilità (ATAC, Roma TPL data). Licence to be verified.
- Dutch trains: NDOV / OVapi data. Terms to be verified.
- Weather: Weather data by [Open-Meteo.com](https://open-meteo.com/), CC BY 4.0 (free tier is non-commercial use only).
