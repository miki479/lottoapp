import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MESSAGES } from "../web/src/i18n/index.ts";
import { balanceAfter, bigStakePct, outcomes } from "../web/src/lib/stake.ts";

describe("the figures around a stake", () => {
  it("asks twice only above 30% of the balance, and says how much it is", () => {
    expect(bigStakePct(300, 1000)).toBeNull();
    expect(bigStakePct(301, 1000)).toBe(30);
    expect(bigStakePct(600, 1000)).toBe(60);
    expect(bigStakePct(1000, 1000)).toBe(100);
    expect(bigStakePct(50, 1000)).toBeNull();
    expect(bigStakePct(50, 0)).toBeNull();
    expect(bigStakePct(0, 100)).toBeNull();
  });
  it("shows the balance once the stake is paid and the two sides of the bet", () => {
    expect(balanceAfter(1000, 50)).toBe(950);
    expect(balanceAfter(1000.9, 50)).toBe(950);
    expect(balanceAfter(40, 50)).toBe(0);
    expect(outcomes(50, 161)).toEqual({ lose: -50, win: 111, back: 161 });
    expect(outcomes(100, 100)).toEqual({ lose: -100, win: 0, back: 100 });
  });
});

describe("the bet sheet", () => {
  const css = readFileSync("web/src/app.css", "utf8"), tokens = readFileSync("web/src/tokens.css", "utf8");
  const src = (f: string) => readFileSync(`web/src/${f}`, "utf8");
  it("is a bottom sheet with a 40% backdrop, 90dvh at most and room for the home indicator", () => {
    expect(tokens.match(/--scrim:\s*rgba\([^)]*\.4\)/g)?.length).toBe(2);
    expect(css).toMatch(/\.sheet \{[^}]*max-height: 90dvh/);
    expect(css).toMatch(/\.sheet \{[^}]*env\(safe-area-inset-bottom\)/);
  });
  it("closes on Escape, drags down to close and keeps the focus inside while it is open", () => {
    const s = src("components/Sheet.tsx");
    expect(s).toContain('"Escape"');
    expect(s).toContain("onPointerDown");
    expect(s).toContain('e.key !== "Tab"');
    expect(s).toContain("focus(");
  });
  it("asks a second time before a stake above 30% goes out, in the single bet and in the multiple", () => {
    for (const f of ["components/BetSheet.tsx", "components/ParlaySheet.tsx"]) expect(src(f)).toContain("<BetFoot");
    const foot = src("components/BetFoot.tsx");
    expect(foot).toContain("bigStakePct");
    expect(foot).toContain("bigStake");
  });
  it("words the second question and the two outcomes in every language", () => {
    expect(MESSAGES.it.sheet.bigStake(60)).toBe("Stai puntando il 60% del tuo saldo. Confermi?");
    for (const l of ["it", "en-US", "en-GB", "ja"] as const) {
      const t = MESSAGES[l].sheet;
      expect(t.bigStake(60)).toContain("60");
      expect(t.bigYes("300")).toContain("300");
      expect(t.ifLose.length).toBeGreaterThan(1);
      expect(t.ifWin.length).toBeGreaterThan(1);
      expect(t.after.length).toBeGreaterThan(1);
    }
    expect(MESSAGES.it.sheet.ifLose).toBe("Se perdi");
    expect(MESSAGES.it.sheet.ifWin).toBe("Se vinci");
  });
});
