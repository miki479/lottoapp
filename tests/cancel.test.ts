import { describe, expect, it } from "vitest";
import { cancelledMarkets } from "../shared/cancel.ts";
import { cancellationsFromTripUpdates } from "../shared/adapters/gtfsrt.ts";
import { viaggiatrenoCancellations } from "../shared/adapters/viaggiatreno.ts";

describe("cancelled trips", () => {
  it("reads cancelled trips and skipped stops from a GTFS-RT feed (numbers or names)", () => {
    const feed = { entity: [
      { tripUpdate: { trip: { tripId: "T1", scheduleRelationship: 3 } } },
      { tripUpdate: { trip: { tripId: "T2", scheduleRelationship: "CANCELED" } } },
      { tripUpdate: { trip: { tripId: "T3", scheduleRelationship: 0 }, stopTimeUpdate: [{ stopId: "S9", scheduleRelationship: 1 }, { stopId: "S8", scheduleRelationship: 0 }] } },
      { tripUpdate: { trip: { tripId: "T4" }, stopTimeUpdate: [{ stopSequence: 5, scheduleRelationship: "SKIPPED" }] } },
    ] };
    expect(cancellationsFromTripUpdates(feed, undefined, (t, seq) => (t === "T4" && seq === 5 ? { stopId: "S5" } : null))).toEqual([
      { tripId: "T1", stopId: null }, { tripId: "T2", stopId: null }, { tripId: "T3", stopId: "S9" }, { tripId: "T4", stopId: "S5" },
    ]);
  });
  it("reads a cancelled train and cancelled stops from ViaggiaTreno", () => {
    expect(viaggiatrenoCancellations({ provvedimento: 1 }, "S1/2/3")).toEqual([{ tripId: "S1/2/3", stopId: null }]);
    expect(viaggiatrenoCancellations({ provvedimento: 0, fermate: [{ id: "A", actualFermataType: 1 }, { id: "B", actualFermataType: 3 }] }, "S1/2/3")).toEqual([{ tripId: "S1/2/3", stopId: "B" }]);
    expect(viaggiatrenoCancellations({ provvedimento: 0 }, "x")).toEqual([]);
    expect(viaggiatrenoCancellations(null, "x")).toEqual([]);
  });
  it("matches the open questions of the cancelled trip, or of the skipped stop only", () => {
    const m = (id: string, trip: string, stop: string, feed = "f") => ({ id, feed_id: feed, params: { tripId: trip, stopId: stop } });
    const open = [m("a", "T1", "S1"), m("b", "T1", "S2"), m("c", "T2", "S1"), m("d", "T3", "S1", "other")];
    expect(cancelledMarkets(open, [{ feed_id: "f", tripId: "T1", stopId: null }]).map((x) => x.id)).toEqual(["a", "b"]);
    expect(cancelledMarkets(open, [{ feed_id: "f", tripId: "T2", stopId: "S1" }, { feed_id: "f", tripId: "T1", stopId: "S9" }]).map((x) => x.id)).toEqual(["c"]);
    expect(cancelledMarkets(open, [{ feed_id: "f", tripId: "T3", stopId: null }])).toEqual([]);
  });
});
