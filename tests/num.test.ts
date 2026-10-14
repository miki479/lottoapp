import { describe, expect, it } from "vitest";
import { fmtDec, fmtInt, fmtNum, fmtOdds, fmtPct, fmtSigned, MINUS, money, moneySigned, setNumLocale } from "../web/src/lib/num.ts";
import { clip, fmtLine, resultAmount, tickValueText } from "../web/src/lib/format.ts";

const plain = (s: string) => s.replace(/[  ]/g, " ");

describe("figures on screen", () => {
  it("puts thousands separators from four digits on, in every language", () => {
    expect(fmtInt(1100, "it")).toBe("1.100");
    expect(fmtInt(25718, "it")).toBe("25.718");
    expect(fmtInt(11119, "it")).toBe("11.119");
    expect(fmtInt(999, "it")).toBe("999");
    expect(fmtInt(1100, "en-US")).toBe("1,100");
    expect(fmtInt(1100, "en-GB")).toBe("1,100");
    expect(fmtInt(1100, "ja")).toBe("1,100");
  });
  it("signs a change with + and the true minus sign U+2212", () => {
    expect(fmtSigned(616, "it")).toBe("+616");
    expect(fmtSigned(-189, "it")).toBe(`${MINUS}189`);
    expect(fmtSigned(25718, "it")).toBe("+25.718");
    expect(fmtSigned(-1100, "en-US")).toBe(`${MINUS}1,100`);
    expect(fmtSigned(0, "it")).toBe("0");
    expect(fmtSigned(-189, "it")).not.toContain("-");
  });
  it("writes odds with two decimals and the decimal sign of the language", () => {
    expect(fmtOdds(1.56, "it")).toBe("1,56");
    expect(fmtOdds(1.56, "en-GB")).toBe("1.56");
    expect(fmtOdds(2, "it")).toBe("2,00");
    expect(fmtOdds(15, "en-US")).toBe("15.00");
  });
  it("writes other decimals and percentages the same way", () => {
    expect(fmtDec(0.04, 2, "it")).toBe("0,04");
    expect(fmtDec(5, 1, "it")).toBe("5,0");
    expect(fmtNum(226.5, "it")).toBe("226,5");
    expect(fmtLine(226.5, "en-US")).toBe("226.5");
    expect(fmtPct(0.56, "it")).toBe("56%");
  });
  it("shows credits with the currency of the audience and the thousands separator", () => {
    expect(plain(money(1100, "it"))).toBe("1.100 €");
    expect(money(1100, "en-US")).toBe("$1,100");
    expect(money(1100, "en-GB")).toBe("£1,100");
    expect(money(-189, "en-US")).toBe(`${MINUS}$189`);
    expect(moneySigned(40, "en-US")).toBe("+$40");
    expect(plain(moneySigned(-189, "it"))).toBe(`${MINUS}189 €`);
  });
  it("uses the language set for the interface when none is given", () => {
    setNumLocale("en-US");
    expect(fmtInt(12345)).toBe("12,345");
    setNumLocale("it");
    expect(fmtInt(12345)).toBe("12.345");
    expect(fmtOdds(3.07)).toBe("3,07");
  });
  it("keeps the result amounts of the outcome screen with the true minus", () => {
    expect(resultAmount("won", 50, 200, "en-US")).toBe("+$150");
    expect(resultAmount("lost", 50, 0, "en-US")).toBe(`${MINUS}$50`);
    expect(plain(resultAmount("lost", 1500, 0, "it"))).toBe(`${MINUS}1.500 €`);
  });
});

describe("texts and readings on a card", () => {
  it("cuts a text at the end of a whole word and only when something is left out", () => {
    expect(clip("Il treno è in orario", 40)).toBe("Il treno è in orario");
    const c = clip("Sarà più di 5 minuti in ritardo a Torino Porta Nuova alle 18:40?", 40);
    expect(c.endsWith("\u2026")).toBe(true);
    expect(c.slice(0, -1)).toBe("Sarà più di 5 minuti in ritardo a Torino");
    expect(clip("Parola", 3)).toBe("Par\u2026");
  });
  it("writes a measured value with its unit the way the questions do", () => {
    expect(plain(tickValueText("fuel:benzina", 1.9, 3, "it"))).toBe("1,900 €");
    expect(tickValueText("oil:brent", 84.5, 2, "en-US")).toBe("$84.50");
    expect(tickValueText("kp", 4.33, 0, "it")).toBe("4,3");
    expect(tickValueText("steam:730", 1234567, 0, "it")).toBe("1.234.567");
    expect(tickValueText("tide:venice", 1.2, 2, "it")).toBe("1,20 m");
  });
});

