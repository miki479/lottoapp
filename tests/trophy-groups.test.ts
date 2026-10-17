import { describe, expect, it } from "vitest";
import { TROPHY_GROUPS, TROPHY_IDS, TROPHY_RARITY } from "../web/src/i18n/index.ts";

describe("trophy groups", () => {
  it("lists every trophy exactly once", () => {
    const all = TROPHY_GROUPS.flatMap((g) => g.ids);
    expect(new Set(all).size).toBe(all.length);
    expect([...all].sort()).toEqual([...TROPHY_IDS].sort());
  });
  it("gives every trophy a rarity", () => { for (const id of TROPHY_IDS) expect(TROPHY_RARITY[id]).toBeTruthy(); });
});
