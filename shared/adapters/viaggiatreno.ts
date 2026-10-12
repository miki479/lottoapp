import type { DelayObservation } from "../types.ts";
import type { Cancellation, TrainJsonAdapter } from "./types.ts";

/** Subset of ViaggiaTreno `andamentoTreno` we rely on (unofficial, undocumented API). Times are epoch ms. */
interface VtStop {
  id?: string | null;
  progressivo?: number | null;
  arrivoReale?: number | null;
  partenzaReale?: number | null;
  /** 3 = the stop is cancelled */
  actualFermataType?: number | null;
  ritardoArrivo?: number | null;
  ritardoPartenza?: number | null;
}
interface VtTrain {
  /** 1 = the train is cancelled, 2 = partly cancelled */
  provvedimento?: number | null;
  categoria?: string | null;
  oraUltimoRilevamento?: number | null;
  fermate?: VtStop[] | null;
}

const MAX_DELAY_MIN = 600;

/** tripId = `codOrigine/numeroTreno/epochMs` of the service day: exactly the three parts `andamentoTreno` needs. */
export const trainTripId = (codOrigine: string, numero: number | string, serviceDayMs: number) => `${codOrigine}/${numero}/${serviceDayMs}`;
export const parseTrainTripId = (id: string): { codOrigine: string; numero: string; serviceDayMs: string } | null => {
  const m = /^([A-Z0-9]+)\/(\d+)\/(\d+)$/.exec(id);
  return m ? { codOrigine: m[1]!, numero: m[2]!, serviceDayMs: m[3]! } : null;
};

/**
 * One observation per stop the train has actually reached (a recorded real time = a fact, not a forecast).
 * Stops without a real time and trains with an implausible delay are skipped, never counted as on time.
 */
export const viaggiatrenoAdapter: TrainJsonAdapter = (json, ctx) => {
  const out: DelayObservation[] = [];
  const t = json as VtTrain | null;
  if (!t || typeof t !== "object") return out;
  // codOrigine/numeroTreno are null or unreliable in this response: the id we asked for is the truth.
  const tripId = ctx.tripId;
  const lastSeen = t.oraUltimoRilevamento ? Math.floor(t.oraUltimoRilevamento / 1000) : ctx.fetchedAt;
  for (const s of t.fermate ?? []) {
    if (!s.id) continue;
    const arrived = s.arrivoReale != null;
    const real = arrived ? s.arrivoReale : s.partenzaReale;
    const delayMin = arrived ? s.ritardoArrivo : s.ritardoPartenza;
    if (real == null || delayMin == null || !Number.isFinite(delayMin) || Math.abs(delayMin) > MAX_DELAY_MIN) continue;
    out.push({
      feedId: ctx.feedId,
      tripId,
      stopId: s.id,
      stopSequence: s.progressivo ?? undefined,
      routeId: t.categoria ?? "",
      observedAt: Math.min(lastSeen, Math.floor(real / 1000)) || lastSeen,
      delaySec: delayMin * 60,
    });
  }
  return out;
};

/** A cancelled train (provvedimento 1) or the stops of it that are cancelled (actualFermataType 3). */
export function viaggiatrenoCancellations(json: unknown, tripId: string): Cancellation[] {
  const t = json as VtTrain | null;
  if (!t || typeof t !== "object") return [];
  if (t.provvedimento === 1) return [{ tripId, stopId: null }];
  return (t.fermate ?? []).filter((s) => s.id && s.actualFermataType === 3).map((s) => ({ tripId, stopId: s.id! }));
}
