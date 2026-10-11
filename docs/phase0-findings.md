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
