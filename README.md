# lottoapp

A **play-money** betting game on real public-transport delays and weather.
Real data, fake credits. Starts in Tokyo; every city is just a config file.

> **Disclaimer.** This is a game. Credits are fictional, have no monetary value, cannot be
> bought, sold, withdrawn or exchanged for prizes, and there are no in-app purchases.
> It is not gambling and must not be used as such.

## Status

Phase 2 (skeleton) done: shared game logic with tests, city config, feed adapters, DB schema.
Next: ingest/resolve functions, the PWA, retention features, localisation.

## Layout

| Path | What |
|---|---|
| `cities/*.json` | One file per city: timezone, tone, feeds, attribution. Adding a city needs no code change. |
| `shared/` | Pure TypeScript (no Node/Deno APIs): odds, resolution, wallet, delay maths, feed adapters. Used by tests, Edge Functions and the PWA. |
| `shared/adapters/` | One adapter per data format (`gtfs-rt`, `open-meteo`). New formats register in `adapters/index.ts`. |
| `supabase/migrations/` | Postgres schema, RLS, and the transactional `place_bet` / `settle_market` functions. |
| `tests/` | Vitest. Resolution rules are covered, including feed-down and void cases. |
| `docs/phase0-findings.md` | Results of the live data-source verification. |

## Rules that the code enforces

- Resolution never guesses: with no valid reading after the deadline, or when the feed was down, the market is **void** and stakes are refunded.
- Odds come from history (Beta prior over fixed starting probabilities), with an 8% house margin; flash events multiply odds up to x3.
- 1000 starting credits; if the balance is under 100, one top-up to 250 per local day.
- Players only bet against the house.

## Develop

```
npm install
npm test
npm run typecheck
```

Copy `.env.example` to `.env`; never commit real keys.

## Data attribution

Attribution is stored per feed in the city file and must be shown in the app.

- Toei Bus: © 東京都交通局, via 公共交通オープンデータ協議会 (ODPT), CC BY 4.0.
- Keisei Transit Bus (Keisei Bus Chiba West): © 京成トランジットバス, via ODPT, CC BY 4.0.
- Weather: Weather data by [Open-Meteo.com](https://open-meteo.com/), CC BY 4.0 (free tier is non-commercial use only).
