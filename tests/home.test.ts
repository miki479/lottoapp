import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MESSAGES } from "../web/src/i18n/all.ts";
import { bestSide, boardRows, boardStats, sortBoard } from "../web/src/lib/board.ts";
import { friendRows } from "../web/src/lib/feed.ts";
import type { MarketRow } from "../web/src/lib/format.ts";
import type { LiveDelay } from "../web/src/lib/types.ts";

const NOW = Date.parse("2026-10-14T08:00:00Z");
const iso = (ms: number) => new Date(ms).toISOString();
const train = (id: string, over: Partial<MarketRow> & { params?: Record<string, unknown> } = {}): MarketRow =>
  ({ id, city_id: "italia", category: "train", kind: "train_delay_gt", params: { routeName: `REG ${id}`, tripId: id, headsign: "ROMA TERMINI" }, closes_at: iso(NOW + 30 * 60_000), target_at: iso(NOW + 60 * 60_000), odds_yes: 3, odds_no: 1.3, status: "open", ...over }) as unknown as MarketRow;
const reading = (id: string, delay: number, prev: number | null = null, forecast = false, at = NOW - 60_000): LiveDelay => ({ market_id: id, delay_sec: delay, prev_delay_sec: prev, is_forecast: forecast, observed_at: iso(at) });

describe("the train board", () => {
  it("puts the trains with a live reading first, one row per trip, and fills up with the next departures", () => {
    const ms = [train("a"), train("b"), train("a2", { params: { routeName: "REG a", tripId: "a" } as never }), train("c", { target_at: iso(NOW + 10 * 60_000) }), train("d", { target_at: iso(NOW + 5 * 60_000) })];
    const rows = boardRows(ms, { a: reading("a", 720), b: reading("b", 0, 60) }, NOW, 4);
    expect(rows.map((r) => r.m.id)).toEqual(["a", "b", "d", "c"]);
    expect(rows.map((r) => r.live)).toEqual([true, true, false, false]);
    expect(rows[1]!.trend).toBe(-60);
  });
  it("leaves out what is not an Italian train that is still open, and forecasts are not readings", () => {
    const ms = [train("x", { city_id: "milano" }), train("y", { closes_at: iso(NOW - 1000) }), train("z", { params: { routeName: "REG z", tripId: "z", ladderOf: "q" } as never }), train("f")];
    const rows = boardRows(ms, { f: reading("f", 900, null, true) }, NOW, 4);
    expect(rows.map((r) => r.m.id)).toEqual(["f"]);
    expect(rows[0]!.live).toBe(false);
  });
  it("counts only real readings in its figures and dates the board by the latest one", () => {
    const rows = boardRows([train("a"), train("b"), train("c"), train("d")], { a: reading("a", 720, null, false, NOW - 120_000), b: reading("b", 60, null, false, NOW - 30_000), c: reading("c", 360) }, NOW, 4);
    const s = boardStats(rows);
    expect(s.live).toBe(3);
    expect(s.lateShare).toBeCloseTo(2 / 3);
    expect(s.avgMin).toBe(6);
    expect(s.updatedAt).toBe(NOW - 30_000);
    expect(boardStats(boardRows([train("a")], {}, NOW, 4))).toEqual({ live: 0, lateShare: null, avgMin: null, updatedAt: null });
  });
  it("sorts by delay or by the best price, and a tap on the odds tab opens the side that pays most", () => {
    const rows = boardRows([train("a", { odds_yes: 1.2, odds_no: 6 } as never), train("b", { odds_yes: 2, odds_no: 1.5 } as never)], { a: reading("a", 60), b: reading("b", 600) }, NOW, 2);
    expect(sortBoard(rows, "late").map((r) => r.m.id)).toEqual(["b", "a"]);
    expect(sortBoard(rows, "odds").map((r) => r.m.id)).toEqual(["a", "b"]);
    expect(bestSide(rows.find((r) => r.m.id === "a")!.m)).toBe("no");
    expect(bestSide(rows.find((r) => r.m.id === "b")!.m)).toBe("yes");
  });
});

describe("what friends are betting", () => {
  const m = (id: string, mins: number, params: Record<string, unknown> = {}) => ({ id, closes_at: iso(NOW + mins * 60_000), params });
  it("lists the busiest open questions first, a few of them, never the ones that are over or unknown", () => {
    const rows = friendRows([m("a", 10), m("b", 20), m("c", 30), m("d", 40), m("old", -5)], { a: 1, b: 3, c: 3, d: 2, old: 9, ghost: 4, zero: 0 }, NOW);
    expect(rows.map((r) => r.m.id)).toEqual(["b", "c", "d"]);
    expect(rows.map((r) => r.n)).toEqual([3, 3, 2]);
  });
  it("skips test markets and ladders, and handles a market list that has not loaded", () => {
    expect(friendRows([m("t", 10, { testOnly: true }), m("l", 10, { ladderOf: "x" }), m("ok", 10)], { t: 2, l: 2, ok: 1 }, NOW).map((r) => r.m.id)).toEqual(["ok"]);
    expect(friendRows(null, { a: 2 }, NOW)).toEqual([]);
  });
});

describe("the home", () => {
  const css = readFileSync("web/src/app.css", "utf8");
  const src = (f: string) => readFileSync(`web/src/${f}`, "utf8");
  /** `.home .x { order: n; }` lines → selector → n. */
  const orders = new Map<string, number>();
  for (const line of css.split("\n")) {
    const m = /^((?:\.home [^{,]+,?\s*)+)\{\s*order:\s*(\d+);\s*\}\s*$/.exec(line);
    if (m) for (const sel of m[1]!.split(",")) orders.set(sel.trim(), Number(m[2]));
  }
  it("is laid out top to bottom as: banners, featured, what to predict + where, for tonight, events, friends", () => {
    const seq = [".home .pofer", ".home .featured", ".home .chooser", ".home .foryou", ".home .events", ".home .friendsblock"].map((s) => orders.get(s));
    expect(seq.every((n) => typeof n === "number")).toBe(true);
    expect([...seq].sort((a, b) => a! - b!)).toEqual(seq);
    expect(new Set(seq).size).toBe(seq.length);
    // the hero and the how-to are not ordered: they come first, and the banners share one slot
    expect(orders.get(".home .installhint")).toBe(orders.get(".home .pofer"));
    expect(orders.get(".home .inbox")).toBe(orders.get(".home .pofer"));
    expect(orders.has(".home .hero")).toBe(false);
  });
  it("gives every one of those blocks the class its slot is attached to", () => {
    const home = src("views/Home.tsx");
    // the board lives only in the Trains category, first in its list
    expect(home).not.toContain('<TrainBoard variant="strip"');
    expect(home).toContain('<TrainBoard variant="full"');
    for (const c of ['class="chooser stack"', 'class="events stack"', "featured"]) expect(home).toContain(c);
    expect(home).toContain("<ForYou");
    expect(home).toContain("<FriendsBets");
    expect(src("components/ForYou.tsx")).toContain("foryou");
    expect(src("components/PersonalOffer.tsx")).toContain("pofer");
    expect(src("components/InstallHint.tsx")).toContain("installhint");
    expect(src("components/Inbox.tsx")).toContain("inbox");
    expect(src("components/FriendsBets.tsx")).toContain("friendsblock");
    expect(src("components/TrainBoard.tsx")).toContain("strip");
  });
  it("opens with the slogan and the short line under it, in every language", () => {
    expect(MESSAGES.it.home.hero).toEqual({ title: "Il ritardo è già tuo. Ora almeno ci scommetti.", body: "Dati veri, zero rimborsi, tanta soddisfazione." });
    for (const l of ["it", "en-US", "en-GB", "ja"] as const) expect(`${MESSAGES[l].home.hero.title} ${MESSAGES[l].home.hero.body}`).not.toMatch(/crediti finti|fake credits|架空/i);
    for (const l of ["en-US", "en-GB", "ja"] as const) { expect(MESSAGES[l].home.hero.title.length).toBeGreaterThan(10); expect(MESSAGES[l].home.hero.body.length).toBeGreaterThan(5); expect(MESSAGES[l].home.hero.title).not.toBe(MESSAGES.it.home.hero.title); }
  });
  it("draws the board in plain type: no letter-spacing, no dot overlay, a labelled clock", () => {
    const board = css.split("\n").filter((l) => /^\.led/.test(l) && !/^\.ledbezel/.test(l));
    expect(board.length).toBeGreaterThan(10);
    expect(board.filter((l) => /letter-spacing/.test(l))).toEqual([]);
    expect(css).toMatch(/\.led \.ledbezel::after \{ display: none; \}/);
    for (const l of ["it", "en-US", "en-GB", "ja"] as const) expect(MESSAGES[l].board.updated("08:16")).toContain("08:16");
    expect(MESSAGES.it.board.updated("08:16")).toBe("aggiornato alle 08:16");
  });
  it("marks the chosen category with the one selected state of the interface, the brand ring, not its own colour", () => {
    const on = css.split("\n").filter((l) => /^\.cc\.on \{/.test(l)).pop() ?? "";
    expect(on).toContain("var(--action)");
    expect(on).not.toMatch(/border-color:\s*var\(--cat/);
    expect(css).toMatch(/\.chip\.on \{ border-color: var\(--action\)/);
  });
});
