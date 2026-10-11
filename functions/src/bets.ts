import { HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { FieldValue } from "firebase-admin/firestore";
import { dailyRefill, START_CREDITS, validateStake } from "./_shared/shared/wallet.ts";
import { cityById, db, Timestamp, toEpoch } from "./common.ts";

function uidOf(req: CallableRequest): string {
  if (!req.auth) throw new HttpsError("unauthenticated", "sign_in_required");
  return req.auth.uid;
}

/** Create the player's wallet (guests included). The timezone comes from the city file, never from the client. */
export async function ensureProfile(req: CallableRequest<{ cityId?: string; locale?: string; country?: string }>) {
  const uid = uidOf(req);
  const city = cityById(req.data?.cityId ?? "") ?? cityById("tokyo");
  if (!city) throw new HttpsError("failed-precondition", "no_city");
  const ref = db.collection("users").doc(uid);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists) return { credits: snap.data()!.credits as number, created: false };
    tx.set(ref, {
      cityId: city.id, timezone: city.timezone, locale: String(req.data?.locale ?? city.defaultLocale).slice(0, 10),
      country: String(req.data?.country ?? city.country).slice(0, 2), credits: START_CREDITS,
      lastRefillDate: null, createdAt: Timestamp.now(),
    });
    return { credits: START_CREDITS, created: true };
  });
}

/** Debit the stake and lock the odds in one transaction. */
export async function placeBet(req: CallableRequest<{ marketId?: string; pick?: string; stake?: number }>) {
  const uid = uidOf(req);
  const { marketId, pick, stake } = req.data ?? {};
  if (!marketId || (pick !== "yes" && pick !== "no") || typeof stake !== "number") throw new HttpsError("invalid-argument", "bad_request");

  const marketRef = db.collection("markets").doc(marketId);
  const userRef = db.collection("users").doc(uid);
  const betRef = db.collection("bets").doc(`${uid}_${marketId}`); // one bet per player per market, by construction

  return db.runTransaction(async (tx) => {
    const [m, u, existing] = await Promise.all([tx.get(marketRef), tx.get(userRef), tx.get(betRef)]);
    if (!m.exists || m.data()!.status !== "open" || toEpoch(m.data()!.closesAt) <= Math.floor(Date.now() / 1000)) throw new HttpsError("failed-precondition", "market_closed");
    if (!u.exists) throw new HttpsError("failed-precondition", "no_profile");
    if (existing.exists) throw new HttpsError("already-exists", "already_bet");
    const check = validateStake(stake, u.data()!.credits);
    if (check !== "ok") throw new HttpsError("invalid-argument", check);

    const odds = (pick === "yes" ? m.data()!.oddsYes : m.data()!.oddsNo) as number;
    tx.update(userRef, { credits: FieldValue.increment(-stake) });
    tx.set(betRef, { userId: uid, marketId, pick, stake, odds, status: "open", payout: 0, placedAt: Timestamp.now() });
    return { odds, credits: (u.data()!.credits as number) - stake };
  });
}

/** Once per local day, when the balance is under the threshold. */
export async function claimDailyRefill(req: CallableRequest) {
  const uid = uidOf(req);
  const ref = db.collection("users").doc(uid);
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) throw new HttpsError("failed-precondition", "no_profile");
    const u = snap.data()!;
    const r = dailyRefill(u.credits, u.lastRefillDate ?? null, Math.floor(Date.now() / 1000), u.timezone);
    if (!r) return { credits: u.credits as number, refilled: false };
    tx.update(ref, { credits: r.balance, lastRefillDate: r.refillDate });
    return { credits: r.balance, refilled: true };
  });
}
