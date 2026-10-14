import { describe, expect, it } from "vitest";
import { pickFeed, type FeedItem } from "../web/src/lib/feed.ts";

const sys = (n: number, text = `system ${n}`): FeedItem => ({ id: `s${n}`, node: null, text });
const usr = (n: number, who: string, text = `${who} bet ${n}`): FeedItem => ({ id: `u${n}`, node: null, text, who });
const names = (xs: FeedItem[]) => xs.map((x) => x.who ?? "·");

describe("the live strip", () => {
  it("keeps at most ten lines, mostly what the lines and markets are doing", () => {
    const out = pickFeed(Array.from({ length: 12 }, (_, i) => usr(i, `p${i}`)), Array.from({ length: 12 }, (_, i) => sys(i)));
    expect(out.length).toBe(10);
    expect(out.filter((x) => x.who).length).toBeLessThanOrEqual(4);
    expect(out.filter((x) => !x.who).length).toBeGreaterThanOrEqual(6);
    expect(out[0]!.who).toBeUndefined();
  });
  it("gives one player two lines at most and never two in a row", () => {
    const out = pickFeed([usr(1, "Mario"), usr(2, "Mario"), usr(3, "Mario"), usr(4, "Mario"), usr(5, "Anna")], [sys(1), sys(2), sys(3), sys(4)]);
    expect(out.filter((x) => x.who === "Mario").length).toBeLessThanOrEqual(2);
    for (let i = 1; i < out.length; i++) if (out[i]!.who) expect(out[i]!.who).not.toBe(out[i - 1]!.who);
  });
  it("never lets the same player touch the strip where it starts over", () => {
    const out = pickFeed([usr(1, "Anna"), usr(2, "Anna")], [sys(1)]);
    if (out.length > 1 && out[0]!.who && out[out.length - 1]!.who) expect(out[0]!.who).not.toBe(out[out.length - 1]!.who);
    expect(names(out)).not.toEqual(["Anna", "Anna"]);
  });
  it("drops lines that say the same thing", () => {
    const out = pickFeed([usr(1, "Anna", "Anna ha puntato"), usr(2, "Luca", "anna ha puntato ")], [sys(1, "ICN 754 ora +14 min"), sys(2, "ICN 754 ora +14 min")]);
    expect(out.map((x) => x.text.trim().toLowerCase())).toEqual([...new Set(out.map((x) => x.text.trim().toLowerCase()))]);
    expect(out.length).toBe(2);
  });
  it("still shows something when only one kind of line exists", () => {
    expect(pickFeed([], [sys(1), sys(2)]).length).toBe(2);
    expect(pickFeed([usr(1, "Anna"), usr(2, "Luca")], []).length).toBeGreaterThan(0);
    expect(pickFeed([], [])).toEqual([]);
  });
});
