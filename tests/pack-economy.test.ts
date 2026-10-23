import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { NEWEST_DECORATIONS, PACKS, SHOP_ITEMS, itemWeight, lookChance, packPct, rollPack } from "../shared/shop.ts";

const sql = readFileSync(new URL("../supabase/migrations/0149_pack_economy.sql", import.meta.url), "utf8");

describe("pack economy", () => {
  it("weighs the newest decorations least, cards most", () => {
    const w = (kind: string, id: string) => itemWeight({ kind, id, rarity: "rare" } as never);
    expect(w("decoration", "aurum")).toBeLessThan(w("decoration", "jade"));
    expect(w("decoration", "jade")).toBeLessThan(w("avatar", "bull"));
    expect(w("avatar", "bull")).toBeLessThan(w("card", "c001"));
  });
  it("mirrors the SQL weights", () => {
    for (const id of NEWEST_DECORATIONS) expect(sql).toContain(`'${id}'`);
    expect(sql).toMatch(/then 25\s+when p_kind = 'decoration' then 60\s+when p_kind = 'avatar' then 130\s+else 160/);
  });
  it("makes a newest decoration the rare pull of its rarity", () => {
    const pool = SHOP_ITEMS.filter((i) => i.rarity === "legendary"), total = pool.reduce((s, i) => s + itemWeight(i), 0);
    const share = pool.filter((i) => NEWEST_DECORATIONS.includes(i.id)).reduce((s, i) => s + itemWeight(i), 0) / total;
    expect(share).toBeLessThan(0.25);
  });
  it("rollPack follows the weights from both ends of the roll", () => {
    const first = rollPack(4, 9999, 0, new Set())!, last = rollPack(4, 9999, 0.999999, new Set())!;
    expect(first.item).not.toEqual(last.item);
  });
  it("keeps the chance of a look below 70%", () => { for (const p of PACKS) expect(lookChance(p.tier)).toBeLessThan(0.7); });
  it("takes the better of the promo and the deal of the day, never both", () => {
    expect(packPct(1, true, { tier: 3, pct: 30 })).toBe(10);
    expect(packPct(3, true, { tier: 3, pct: 30 })).toBe(30);
    expect(packPct(3, true, { tier: 3, pct: 15 })).toBe(20);
    expect(packPct(4, false, { tier: 4, pct: 25 })).toBe(25);
    expect(packPct(2, false, { tier: 4, pct: 25 })).toBe(0);
  });
});
