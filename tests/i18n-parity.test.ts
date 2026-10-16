import { describe, expect, it } from "vitest";
import it_ from "../web/src/i18n/it.ts";
import enUS from "../web/src/i18n/en-US.ts";
import enGB from "../web/src/i18n/en-GB.ts";
import ja from "../web/src/i18n/ja.ts";

const locales = { "en-US": enUS, "en-GB": enGB, it: it_, ja } as const;

/** Every leaf as "path" -> kind ; objects recurse. */
function shape(v: unknown, path = "", out: Record<string, string> = {}): Record<string, string> {
  if (typeof v === "function") out[path] = "fn"; // arity may differ: a language without plurals can ignore a parameter
  else if (Array.isArray(v)) { out[path] = `array/${v.length}`; v.forEach((x, i) => { if (x && typeof x === "object") shape(x, `${path}[${i}]`, out); }); }
  else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) shape(x, path ? `${path}.${k}` : k, out);
  else out[path] = typeof v;
  return out;
}

describe("locale parity", () => {
  const ref = shape(enUS);
  for (const [name, msgs] of Object.entries(locales)) {
    it(`${name} has the same keys, kinds and array lengths as en-US`, () => {
      const s = shape(msgs);
      expect(Object.keys(ref).filter((k) => !(k in s)), "missing").toEqual([]);
      expect(Object.keys(s).filter((k) => !(k in ref)), "extra").toEqual([]);
      expect(Object.keys(ref).filter((k) => s[k] !== ref[k]).map((k) => `${k}: ${s[k]} vs ${ref[k]}`)).toEqual([]);
    });
    it(`${name} has no empty strings`, () => {
      const empty = Object.entries(shape(msgs)).filter(([k, t]) => t === "string" && k.length > 0 && (k.split(".").reduce((o: any, p) => o?.[p.replace(/\[\d+\]/, "")], msgs) === ""));
      expect(empty.map(([k]) => k)).toEqual([]);
    });
  }
});
