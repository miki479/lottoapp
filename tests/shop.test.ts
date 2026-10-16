import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CARDS, CARD_CATS, CARD_TOTAL, cardsOfCat } from "../shared/cards.ts";
import { DECORATIONS } from "../shared/looks.ts";
import {
  DAILY_AMOUNTS, DAILY_PACK_CAP, DAILY_WEEK_TOTAL, DEFAULT_AVATARS, PACKS, PACK_GAP_SEC, PACK_RARITIES, REFUND_PCT, SHOP_ITEMS, dailyAmount, dailyDay, daysBetween, duplicateChance,
  expectedNetCost, expectedRefund, itemKey, itemsOfRarity, lookChance, maxExpectedRefund, packRefund, rarityForRoll, rollPack, streakDayToday,
} from "../shared/shop.ts";
import { CARD_ICONS } from "../web/src/components/cardIcons.ts";
import { CARD_TEXT_ROWS, cardCaption, cardName } from "../web/src/lib/cardText.ts";
import { hubText } from "../web/src/lib/shopText.ts";

const sql = readFileSync(new URL("../supabase/migrations/0107_shop_daily.sql", import.meta.url), "utf8");
/** Rows of a `values (...)` list inside the body of one SQL function. */
const sql127 = readFileSync(new URL("../supabase/migrations/0127_new_avatars.sql", import.meta.url), "utf8");
const fnBody = (name: string) => { const i = sql.indexOf(`function public.${name}(`); expect(i, name).toBeGreaterThan(-1); return sql.slice(i, sql.indexOf("$$;", sql.indexOf("$$", i) + 2)); };

const fnBody127 = (name: string) => { const i = sql127.indexOf(`function public.${name}(`); expect(i, name).toBeGreaterThan(-1); return sql127.slice(i, sql127.indexOf("$$;", sql127.indexOf("$$", i) + 2)); };

describe("daily bonus", () => {
  it("pays 100 x the calendar day and starts again after day 7", () => {
    expect(DAILY_AMOUNTS).toEqual([100, 200, 300, 400, 500, 600, 700]);
    expect(DAILY_WEEK_TOTAL).toBe(2800);
    expect([1, 2, 3, 4, 5, 6, 7].map(dailyAmount)).toEqual([...DAILY_AMOUNTS]);
    expect([8, 9, 14, 15, 21, 22].map(dailyDay)).toEqual([1, 2, 7, 1, 7, 1]);
    expect(dailyAmount(14)).toBe(700);
    expect(dailyAmount(15)).toBe(100);
  });
  it("never goes below day 1", () => { expect(dailyAmount(0)).toBe(100); expect(dailyAmount(-4)).toBe(100); expect(dailyDay(Number.NaN)).toBe(1); });
  it("follows register_play for the day a bet would reach", () => {
    const today = "2026-10-13";
    expect(streakDayToday(3, today, today, 1)).toEqual({ day: 3, counted: true, usesFreeze: false });
    expect(streakDayToday(3, "2026-10-12", today, 0)).toEqual({ day: 4, counted: false, usesFreeze: false });
    expect(streakDayToday(3, "2026-10-11", today, 1)).toEqual({ day: 4, counted: false, usesFreeze: true });
    expect(streakDayToday(3, "2026-10-11", today, 0).day).toBe(1);
    expect(streakDayToday(3, "2026-10-08", today, 2).day).toBe(1);
    expect(streakDayToday(0, null, today, 1).day).toBe(1);
    expect(daysBetween("2026-02-27", "2026-03-01")).toBe(2);
  });
  it("is mirrored by the SQL", () => {
    const rows = [...fnBody("daily_amounts").matchAll(/\((\d), (\d+)\)/g)].map((m) => [Number(m[1]), Number(m[2])]);
    expect(rows).toEqual(DAILY_AMOUNTS.map((a, i) => [i + 1, a]));
    expect(fnBody("daily_amount")).toContain("% 7");
  });
});

describe("pack odds", () => {
  it("add up to 100% for every tier", () => { for (const p of PACKS) expect(PACK_RARITIES.reduce((a, r) => a + p.odds[r], 0), `tier ${p.tier}`).toBe(10000); });
  it("tiers cost 60 / 250 / 700 / 2000 and get kinder to the rare end", () => {
    expect(PACKS.map((p) => p.price)).toEqual([60, 250, 700, 2000]);
    for (let i = 1; i < PACKS.length; i++) { expect(PACKS[i]!.odds.legendary).toBeGreaterThan(PACKS[i - 1]!.odds.legendary); expect(PACKS[i]!.odds.common).toBeLessThan(PACKS[i - 1]!.odds.common); }
  });
  it("maps a roll to the first slice that covers it", () => {
    const p = PACKS[0]!;
    expect(rarityForRoll(p, 0)).toBe("common"); expect(rarityForRoll(p, 7699)).toBe("common"); expect(rarityForRoll(p, 7700)).toBe("rare");
    expect(rarityForRoll(p, 9599)).toBe("rare"); expect(rarityForRoll(p, 9600)).toBe("epic"); expect(rarityForRoll(p, 9949)).toBe("epic"); expect(rarityForRoll(p, 9950)).toBe("legendary"); expect(rarityForRoll(p, 9999)).toBe("legendary");
  });
  it("every rarity that can be rolled has something in it", () => { for (const r of PACK_RARITIES) expect(itemsOfRarity(r).length, r).toBeGreaterThan(0); });
  it("is mirrored by the SQL", () => {
    const rows = [...fnBody("shop_packs").matchAll(/\((\d), +(\d+), +(\d+), +(\d+), +(\d+), +(\d+)\)/g)].map((m) => m.slice(1).map(Number));
    expect(rows).toEqual(PACKS.map((p) => [p.tier, p.price, p.odds.common, p.odds.rare, p.odds.epic, p.odds.legendary]));
    expect(fnBody("shop_limits")).toContain(`select ${REFUND_PCT}, ${DAILY_PACK_CAP}, ${PACK_GAP_SEC}`);
  });
});

describe("catalogue", () => {
  it("has 100 numbered cards with unique ids, spread over every category", () => {
    expect(CARDS.length).toBe(CARD_TOTAL);
    expect(CARDS.map((c) => c.n)).toEqual(Array.from({ length: 100 }, (_, i) => i + 1));
    expect(new Set(CARDS.map((c) => c.id)).size).toBe(100);
    for (const c of CARD_CATS) expect(cardsOfCat(c).length, c).toBeGreaterThanOrEqual(10);
    expect(CARDS.filter((c) => c.rarity === "legendary").length).toBeLessThan(CARDS.filter((c) => c.rarity === "epic").length);
  });
  it("every card has an icon, a name and a caption in the four languages", () => {
    expect(CARD_TEXT_ROWS).toBe(CARD_TOTAL);
    for (const c of CARDS) {
      expect(CARD_ICONS[c.icon], `${c.id} icon ${c.icon}`).toBeTruthy();
      for (const l of ["it", "en-US", "en-GB", "ja"] as const) {
        expect(cardName(c.n, l).length, `${c.id} name ${l}`).toBeGreaterThan(0); expect(cardName(c.n, l).length).toBeLessThanOrEqual(32);
        expect(cardCaption(c.n, l).length, `${c.id} caption ${l}`).toBeGreaterThan(0); expect(cardCaption(c.n, l).length).toBeLessThanOrEqual(70);
      }
    }
    for (const l of ["it", "en-US", "ja"] as const) expect(new Set(CARDS.map((c) => cardName(c.n, l))).size, l).toBe(100);
  });
  it("holds the cards, the collectible avatars and the decorations no level unlocks", () => {
    const free = DECORATIONS.filter((d) => d.level === undefined);
    expect(SHOP_ITEMS.filter((i) => i.kind === "decoration").map((i) => i.id).sort()).toEqual(free.map((d) => d.id).sort());
    for (const d of free) expect(SHOP_ITEMS.find((i) => i.id === d.id)?.rarity).toBe(d.rarity);
    expect(SHOP_ITEMS.filter((i) => i.kind === "avatar").length).toBe(12);
    for (const a of DEFAULT_AVATARS) expect(SHOP_ITEMS.some((i) => i.id === a)).toBe(false);
    expect(SHOP_ITEMS.length).toBe(117);
    expect(new Set(SHOP_ITEMS.map((i) => itemKey(i.kind, i.id))).size).toBe(117);
    expect(SHOP_ITEMS.filter((i) => i.kind !== "card").every((i) => i.rarity !== "common")).toBe(true);
  });
  it("looks are the rarer pulls", () => { for (const p of PACKS) { expect(lookChance(p.tier)).toBeGreaterThan(0); expect(lookChance(p.tier)).toBeLessThan(0.35); } });
  it("is mirrored by the SQL list, in the same order", () => {
    const rows = [...fnBody127("shop_items").matchAll(/\('(avatar|card|decoration)', '([a-z0-9]+)', '(common|rare|epic|legendary)'\)/g)].map((m) => `${m[1]}:${m[2]}:${m[3]}`);
    expect(rows.slice().sort()).toEqual(SHOP_ITEMS.map((i) => `${i.kind}:${i.id}:${i.rarity}`).sort());
  });
  it("keeps the SQL default avatars", () => { expect(fnBody("default_avatars")).toContain(DEFAULT_AVATARS.map((a) => `'${a}'`).join(","));  });
});

describe("refund and sink", () => {
  it("pays back 10% of the price, rounded down", () => { expect(PACKS.map((p) => packRefund(p.price))).toEqual([6, 25, 70, 200]); expect(packRefund(65)).toBe(6); });
  it("a fresh album gets nothing back", () => { for (const p of PACKS) { expect(expectedRefund(p.tier, new Set())).toBe(0); expect(expectedNetCost(p.tier, new Set())).toBe(p.price); } });
  it("even a complete album gets back at most 10% of the price: a pack always takes credits out", () => {
    const all = new Set(SHOP_ITEMS.map((i) => itemKey(i.kind, i.id)));
    for (const p of PACKS) { expect(duplicateChance(p.tier, all)).toBeCloseTo(1, 10); expect(maxExpectedRefund(p.tier)).toBeCloseTo(p.price * REFUND_PCT / 100, 9); expect(expectedNetCost(p.tier, all)).toBeGreaterThanOrEqual(p.price * 0.9 - 1e-9); }
  });
  it("holds for random albums too (seeded)", () => {
    let s = 7; const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
    for (let k = 0; k < 300; k++) {
      const owned = new Set(SHOP_ITEMS.filter(() => rnd() < rnd()).map((i) => itemKey(i.kind, i.id)));
      for (const p of PACKS) { expect(expectedRefund(p.tier, owned)).toBeLessThanOrEqual(p.price * 0.1 + 1e-9); expect(expectedNetCost(p.tier, owned)).toBeGreaterThan(0); }
    }
  });
  it("simulated openings never return more than they cost", () => {
    let s = 99; const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
    for (const p of PACKS) {
      const owned = new Set<string>(); let spent = 0, back = 0;
      for (let i = 0; i < 20000; i++) { const r = rollPack(p.tier, Math.floor(rnd() * 10000), rnd(), owned)!; spent += p.price; back += r.refund; if (!r.duplicate) owned.add(itemKey(r.item.kind, r.item.id)); }
      expect(back / spent, `tier ${p.tier}`).toBeLessThan(0.1 + 1e-9);
    }
  });
  it("rollPack is deterministic and flags duplicates", () => {
    const first = rollPack(1, 0, 0, new Set())!;
    expect(first.rarity).toBe("common"); expect(first.item.id).toBe("c001"); expect(first.duplicate).toBe(false); expect(first.refund).toBe(0);
    const dup = rollPack(1, 0, 0, new Set([itemKey("card", "c001")]))!;
    expect(dup.duplicate).toBe(true); expect(dup.refund).toBe(6);
    const last = rollPack(4, 9999, 0.9999, new Set())!;
    expect(last.rarity).toBe("legendary"); expect(last.item).toEqual(itemsOfRarity("legendary").at(-1));
    expect(rollPack(9, 0, 0, new Set())).toBeNull();
  });
});

describe("hub texts", () => {
  it("have the same shape in every language", () => {
    const shape = (v: unknown): unknown => typeof v === "function" ? "fn" : Array.isArray(v) ? v.map(shape) : v && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, shape(x)])) : typeof v;
    const ref = shape(hubText("en-US"));
    for (const l of ["it", "en-GB", "ja"] as const) expect(shape(hubText(l)), l).toEqual(ref);
  });
  it("have a message for every server error", () => { for (const l of ["it", "en-US", "ja"] as const) for (const k of ["play_first", "insufficient_credits", "pack_limit", "too_fast", "registration_required", "generic"]) expect(hubText(l).shop.errors[k], `${l} ${k}`).toBeTruthy(); });
});
