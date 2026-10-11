import { setGlobalOptions } from "firebase-functions/v2";
import { onCall } from "firebase-functions/v2/https";
import { onSchedule } from "firebase-functions/v2/scheduler";
import { claimDailyRefill, ensureProfile, placeBet } from "./bets.ts";
import { ingestAll } from "./ingest.ts";
import { resolveDue } from "./resolve.ts";

setGlobalOptions({ region: "europe-west1", maxInstances: 5 });

/** One Cloud Scheduler job (the free tier covers 3): fetch feeds, then settle what is due. */
export const tick = onSchedule({ schedule: "every 1 minutes", timeoutSeconds: 120, memory: "512MiB" }, async () => {
  const ingest = await ingestAll();
  const resolve = await resolveDue();
  console.log(JSON.stringify({ ingest, resolve }));
});

export const ensureProfileFn = onCall(ensureProfile);
export const placeBetFn = onCall(placeBet);
export const claimDailyRefillFn = onCall(claimDailyRefill);
