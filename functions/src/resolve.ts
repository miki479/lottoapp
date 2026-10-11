import { resolveEvent } from "./_shared/shared/resolve.ts";
import { historyKey, marketToEvent, type MarketRow } from "./_shared/shared/market.ts";
import { settleBet, type SettleResult } from "./_shared/shared/settle.ts";
import type { DelayObservation, WeatherObservation } from "./_shared/shared/types.ts";
import { cityById, cities, db, fromEpoch, safeId, toEpoch, Timestamp } from "./common.ts";

const CHUNK = 200; // 200 bets + at most 200 profile updates stay under the 500-write limit

const iso = (t: Timestamp) => t.toDate().toISOString();

/** Convert a Firestore market document to the row shape the shared code understands. */
function toRow(id: string, m: FirebaseFirestore.DocumentData): MarketRow {
  return {
    id, city_id: m.cityId, category: m.category, kind: m.kind, feed_id: m.feedId, params: m.params,
    closes_at: iso(m.closesAt), target_at: iso(m.targetAt), deadline_at: iso(m.deadlineAt),
  };
}

export async function resolveDue(now = Math.floor(Date.now() / 1000)): Promise<{ settled: number; voided: number; pending: number; errors: number }> {
  const out = { settled: 0, voided: 0, pending: 0, errors: 0 };
  const stale = new Map(cities.flatMap((c) => c.feeds.map((f) => [f.id, f.staleAfterSeconds] as const)));
  const health = new Map((await db.collection("feedHealth").get()).docs.map((d) => [d.id, d.data()]));

  const due = await db.collection("markets").where("status", "in", ["open", "settling"]).where("targetAt", "<=", fromEpoch(now)).limit(300).get();
  for (const doc of due.docs) {
    try {
      const m = doc.data();
      // A previous run decided the result but crashed while paying bets: just finish the job.
      if (m.status === "settling") { await finishSettlement(doc.id, m.result as SettleResult); continue; }

      const row = toRow(doc.id, m);
      const event = marketToEvent(row);
      const city = cityById(m.cityId);
      if (!city) throw new Error(`unknown city ${m.cityId}`);

      let delays: DelayObservation[] = [];
      let weather: WeatherObservation[] = [];
      if (event.kind === "rain_at") {
        const hourStart = Math.floor(event.targetAt / 3600) * 3600;
        const w = await db.collection("weatherObservations").doc(safeId(event.feedId, String(hourStart))).get();
        if (w.exists) weather = [{ feedId: event.feedId, hourStart, precipitationMm: Number(w.data()!.precipitationMm) }];
      } else {
        const o = await db.collection("delayObservations").doc(safeId(event.feedId, event.tripId, event.stopId)).get();
        const readings = (o.data()?.readings ?? {}) as Record<string, { delaySec: number; predictedAt?: number }>;
        delays = Object.entries(readings).map(([ts, r]) => ({
          feedId: event.feedId, tripId: event.tripId, stopId: event.stopId, routeId: event.routeId,
          observedAt: Number(ts), delaySec: r.delaySec, predictedAt: r.predictedAt,
        }));
      }

      const lastOk = health.get(event.feedId)?.lastOkAt;
      const res = resolveEvent({
        event, now, feed: { feedId: event.feedId, lastOkAt: lastOk ? toEpoch(lastOk) : null },
        staleAfterSec: stale.get(event.feedId) ?? 300, delays, weather,
      });
      if (res.status === "pending") { out.pending++; continue; }

      const result: SettleResult = res.status === "void" ? "void" : res.outcome;
      await doc.ref.update({
        status: "settling", result, evidence: res.status === "resolved" ? res.evidence : null,
        voidReason: res.status === "void" ? res.reason : null,
      });
      await finishSettlement(doc.id, result);

      if (res.status === "resolved") {
        const k = historyKey(event, city.timezone);
        const id = safeId(city.id, k.kind, k.routeId || "-", String(k.hourOfDay), String(k.threshold));
        await db.collection("oddsHistory").doc(id).set({
          cityId: city.id, kind: k.kind, routeId: k.routeId, hourOfDay: k.hourOfDay, threshold: k.threshold,
          n: (await import("firebase-admin/firestore")).FieldValue.increment(1),
          yes: (await import("firebase-admin/firestore")).FieldValue.increment(res.outcome === "yes" ? 1 : 0),
        }, { merge: true });
        out.settled++;
      } else out.voided++;
    } catch (e) {
      console.error("resolve failed", doc.id, e);
      out.errors++; // stays open or settling: retried next minute, never settled on a guess
    }
  }
  return out;
}

/** Pay every open bet of a market in chunks, then close the market. Safe to re-run. */
export async function finishSettlement(marketId: string, result: SettleResult): Promise<void> {
  const { FieldValue } = await import("firebase-admin/firestore");
  for (;;) {
    const paid = await db.runTransaction(async (tx) => {
      const snap = await tx.get(db.collection("bets").where("marketId", "==", marketId).where("status", "==", "open").limit(CHUNK));
      const credit = new Map<string, number>();
      for (const b of snap.docs) {
        const bet = b.data();
        const s = settleBet({ pick: bet.pick, stake: bet.stake, odds: bet.odds }, result);
        tx.update(b.ref, { status: s.status, payout: s.payout, settledAt: Timestamp.now() });
        if (s.payout > 0) credit.set(bet.userId, (credit.get(bet.userId) ?? 0) + s.payout);
      }
      for (const [uid, amount] of credit) tx.update(db.collection("users").doc(uid), { credits: FieldValue.increment(amount) });
      return snap.size;
    });
    if (paid < CHUNK) break;
  }
  await db.collection("markets").doc(marketId).update({ status: result === "void" ? "void" : "resolved", outcome: result === "void" ? null : result, settledAt: Timestamp.now() });
}
