# Phase 0: live verification (2026-10-11)

| Source | Result |
|---|---|
| Toei Bus GTFS-RT `https://api-public.odpt.org/api/v4/gtfs/realtime/ToeiBus` | 200, no token. VehiclePosition only (~240 vehicles), refreshed about every 30 s. CC BY 4.0. |
| Toei static GTFS `/api/v4/files/Toei/data/ToeiBus-GTFS.zip` | 200 after a redirect to a 2-minute signed link; 7.5 MB zip, `stop_times.txt` 75 MB. 233 of 234 realtime trip_ids matched `trips.txt`. |
| Keisei `odpt_KeiseiTransitBus_AllLines_{trip_update,vehicle,alert}` | 200, no token. TripUpdates carry explicit `delay` (seconds). CC BY 4.0. |
| Yokohama Municipal Bus | Needs an ODPT token (`api.odpt.org`, 403 without). ODPT Basic License, not CC BY. |
| ODPT trains | `odpt:Train` public for Toei only (delay mostly 0); Tokyo Metro, JR East, Tobu, Keio empty without token. Excluded from the MVP. |
| Open-Meteo | 200 without key. One 429 from a shared IP, then fine. Free tier: non-commercial, <10k calls/day, CC BY 4.0. |
| TomTom | Flow Segment Data free: 20,000 requests/month. Data-storage terms not verified. |

## Open points

- **Toei delay semantics.** The feed has no `current_status`. Raw offsets between vehicle timestamp and scheduled time at `current_stop_sequence` ranged from -95 s to +2188 s (median +102 s), consistent with "last passed stop" but not proven. Collect a few days of data and calibrate before settling real markets on Toei.
- **Rate limits.** ODPT publishes none; the Center may limit access at its discretion. Poll once a minute per feed.
- **Attribution text.** Use the credit shown on each ckan.odpt.org dataset page.

## Added later: trains and other cities (2026-10-11)

| Source | Result |
|---|---|
| Rome `rome_rtgtfs_trip_updates_feed.pb` | 200 (served as text/html but valid protobuf). 689 trips, delays on 13.8k stops. All 689 trip_ids and 99.99% of stop_ids match the static GTFS (46 MB). Licence (CC BY 3.0 Italia) only from a 2018 source. |
| Dutch `gtfs.ovapi.nl/nl/trainUpdates.pb` | 200, 2.2 MB, 3,844 trips. 97% of trip_ids and 99.6% of stop_ids match the static GTFS (259 MB, `stop_times.txt` 1.2 GB). README: no SLA, do not impersonate operators. |
| ViaggiaTreno (Italian trains) | `Access Denied` from the sandbox; unofficial API, no licence. Not used. |
| iRail (Belgium) | Works, ~3 req/s limit, needs a custom adapter. Not implemented. |
| SBB (Switzerland), Trenord | Not reachable without a key / dataset not found. Not used. |

**TripUpdates are forecasts.** Share of stop delays whose predicted time had already passed in one snapshot:
Rome 1%, Keisei 0%, Dutch trains 14%. Resolving on an earlier forecast would be wrong, so the resolver
requires the reading to be refreshed within 120 s of the predicted passage (`FORECAST_FRESHNESS_SEC`).
