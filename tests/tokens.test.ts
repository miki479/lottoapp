import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * Step 10, kept honest: the colour tokens pass WCAG AA in both themes on every surface they sit on, the type follows one scale, small controls have
 * a 44 px target, every control shows where the keyboard is and answers a press, and a button with only an icon in it has a name.
 */
const read = (f: string) => readFileSync(f, "utf8");
const tokens = read("web/src/tokens.css");
const CSS_FILES = ["web/src/app.css", ...readdirSync("web/src/components").filter((f) => f.endsWith(".css")).map((f) => `web/src/components/${f}`)];
const css = CSS_FILES.map(read).join("\n");
/** A check on the whole stylesheet that fails with the pattern, not with a hundred kilobytes of CSS. */
const has = (re: RegExp, what = String(re).slice(0, 90)) => expect(re.test(css), what).toBe(true);
const tsxFiles = (dir: string): string[] => readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? tsxFiles(`${dir}/${d.name}`) : d.name.endsWith(".tsx") ? [`${dir}/${d.name}`] : []));
const TSX = tsxFiles("web/src");

// ---- colour maths -------------------------------------------------------------------------------------------------------------------------------
type RGB = [number, number, number];
type Theme = Map<string, string>;
const split = tokens.split(/@media \(prefers-color-scheme: light\)/);
const declsOf = (block: string): Theme => new Map([...block.matchAll(/(--[a-z0-9-]+):\s*([^;]+);/g)].map((m) => [m[1]!, m[2]!.trim()] as [string, string]));
const dark: Theme = declsOf(split[0]!);
const light: Theme = new Map([...dark, ...declsOf(split[1] ?? "")]);
const THEMES: [string, Theme][] = [["dark", dark], ["light", light]];

const lin = (x: number) => { x /= 255; return x <= 0.04045 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; };
const lum = (c: RGB) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2]);
const ratio = (a: RGB, b: RGB) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const mix = (fg: RGB, a: number, bg: RGB): RGB => [0, 1, 2].map((i) => fg[i]! * a + bg[i]! * (1 - a)) as RGB;
const hslToRgb = (h: number, s: number, l: number): RGB => { const k = (n: number) => (n + h / 30) % 12, a = s * Math.min(l, 1 - l), f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1))); return [f(0) * 255, f(8) * 255, f(4) * 255]; };

/** A token as a colour: #hex, rgb()/rgba() or another token; with the alpha it carries. */
function colour(theme: Theme, name: string): { c: RGB; a: number } {
  const v = theme.get(name);
  if (v === undefined) throw new Error(`token ${name} is not defined`);
  const ref = /^var\((--[a-z0-9-]+)\)$/.exec(v);
  if (ref) return colour(theme, ref[1]!);
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(v);
  if (hex) { const h = hex[1]!.length === 3 ? [...hex[1]!].map((x) => x + x).join("") : hex[1]!; return { c: [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as RGB, a: 1 }; }
  const rgb = /^rgba?\(([^)]+)\)$/.exec(v);
  if (rgb) { const p = rgb[1]!.split(",").map((x) => parseFloat(x)); return { c: [p[0]!, p[1]!, p[2]!], a: p[3] ?? 1 }; }
  throw new Error(`token ${name} is not a colour: ${v}`);
}
const solid = (theme: Theme, name: string, over: RGB): RGB => { const { c, a } = colour(theme, name); return mix(c, a, over); };

/** Every surface a piece of text can sit on: the page, a card, a field, and each tint over a card and over a field. */
function surfaces(theme: Theme): Map<string, RGB> {
  const out = new Map<string, RGB>();
  for (const s of ["--bg", "--surface", "--surface-2"]) out.set(s, solid(theme, s, [0, 0, 0]));
  for (const t of ["--action-soft", "--live-soft", "--gain-soft", "--loss-soft", "--delay-soft", "--c-bus-soft", "--c-train-soft", "--c-weather-soft", "--c-pop-soft"]) {
    out.set(`${t} on card`, solid(theme, t, out.get("--surface")!));
    out.set(`${t} on field`, solid(theme, t, out.get("--surface-2")!));
  }
  return out;
}

describe("colour tokens: one action colour, one live colour, three meanings", () => {
  it("defines them once, with the same names in both themes", () => {
    for (const name of ["--action", "--action-strong", "--action-soft", "--action-ink", "--on-action", "--ring", "--live", "--live-soft", "--on-live", "--gain", "--gain-soft", "--loss", "--loss-soft", "--delay", "--delay-soft", "--line-ui", "--on-bright", "--star-ink", "--hot-l", "--sheen", "--sheen-gold"]) expect(dark.has(name), name).toBe(true);
    for (const old of ["--brand", "--on-brand", "--won-bg", "--won-fg", "--lost-bg", "--lost-fg", "--warn-fg", "--fs-title", "--fs-title-lg", "--fs-body", "--fs-detail"]) expect(new RegExp(`${old}(?![\\w-])`).test(css + TSX.map(read).join("\n") + tokens), `${old} was renamed`).toBe(false);
  });
  it("uses only tokens that exist: no variable with a hard-coded fallback in its place", () => {
    const all = css + TSX.map(read).join("\n") + tokens;
    const defined = new Set([...all.matchAll(/(--[a-z][a-z0-9-]*)(?=\s*:|["'`]\s*[,)])/g)].map((m) => m[1]!));
    const used = new Set([...css.matchAll(/var\((--[a-z][a-z0-9-]*)/g)].map((m) => m[1]!));
    expect([...used].filter((u) => !defined.has(u))).toEqual([]);
  });
  it("never writes text in the fill of the action colour: the readable shade is --action-ink", () => {
    expect(css.match(/(^|[^-a-z])color:\s*var\(--action\)/g)).toBeNull();
    expect(TSX.map(read).join("\n")).not.toMatch(/color:\s*var\(--action\)/);
  });
  for (const [name, theme] of THEMES) {
    const sf = surfaces(theme);
    it(`${name}: text and the colours used as text pass 4.5:1 on every surface and tint`, () => {
      const plain = ["--bg", "--surface", "--surface-2"];
      const withTint = (tint: string) => [...plain, `${tint} on card`, `${tint} on field`];
      // the neutral text colours go everywhere; an accent is set on the plain surfaces and on its own tint
      const where: Record<string, string[]> = {
        "--text": [...sf.keys()], "--text-2": [...sf.keys()], "--muted": [...sf.keys()],
        "--action-ink": withTint("--action-soft"), "--live": withTint("--live-soft"), "--gain": withTint("--gain-soft"), "--loss": withTint("--loss-soft"), "--delay": withTint("--delay-soft"),
        "--c-bus": withTint("--c-bus-soft"), "--c-train": withTint("--c-train-soft"), "--c-weather": withTint("--c-weather-soft"), "--c-pop": withTint("--c-pop-soft"), "--star-ink": plain,
      };
      const fails: string[] = [];
      for (const [t, on] of Object.entries(where)) for (const sn of on) { const bg = sf.get(sn)!, r = ratio(solid(theme, t, bg), bg); if (r < 4.5) fails.push(`${t} on ${sn}: ${r.toFixed(2)}`); }
      expect(fails).toEqual([]);
    });
    it(`${name}: text on a fill passes 4.5:1, and the edges and the ring pass 3:1`, () => {
      const page = sf.get("--surface")!, field = sf.get("--surface-2")!;
      expect(ratio(solid(theme, "--on-action", [0, 0, 0]), solid(theme, "--action", page))).toBeGreaterThanOrEqual(4.5);
      expect(ratio(solid(theme, "--on-action", [0, 0, 0]), solid(theme, "--action-strong", page))).toBeGreaterThanOrEqual(4.5);
      expect(ratio(solid(theme, "--on-live", [0, 0, 0]), solid(theme, "--live", page))).toBeGreaterThanOrEqual(4.5);
      expect(ratio(solid(theme, "--on-bright", [0, 0, 0]), solid(theme, "--star", page))).toBeGreaterThanOrEqual(4.5);
      for (const [n, bg] of [["surface", page], ["field", field], ["page", sf.get("--bg")!]] as const) {
        expect(ratio(solid(theme, "--line-ui", bg), bg), `--line-ui on ${n}`).toBeGreaterThanOrEqual(3);
        expect(ratio(solid(theme, "--ring", bg), bg), `--ring on ${n}`).toBeGreaterThanOrEqual(3);
        expect(ratio(solid(theme, "--action", bg), bg), `--action on ${n}`).toBeGreaterThanOrEqual(3);
      }
    });
    it(`${name}: the stake number keeps 3:1 (it is large type) on a field at every hue it passes through`, () => {
      const field = sf.get("--surface-2")!, l = parseFloat(theme.get("--hot-l")!) / 100;
      for (let h = 260; h <= 390; h += 5) expect(ratio(hslToRgb(h % 360, 0.95, l), field), `hue ${h % 360}`).toBeGreaterThanOrEqual(3);
      for (const [h, s] of [[24, 1], [265, 0.6]] as const) expect(ratio(hslToRgb(h, s, l), field), `boost hue ${h}`).toBeGreaterThanOrEqual(3);
    });
    it(`${name}: the delay figure and its gauge keep their contrast at every hue of the severity scale`, () => {
      const field = sf.get("--surface-2")!, text = parseFloat(theme.get("--sev-l")!) / 100, fill = parseFloat(theme.get("--sev-fill-l")!) / 100;
      for (let h = 255; h <= 390; h += 5) {
        expect(ratio(hslToRgb(h % 360, 0.95, text), field), `figure, hue ${h % 360}`).toBeGreaterThanOrEqual(3); // 32 px bold: large type
        expect(ratio(hslToRgb(h % 360, 0.95, fill), field), `cell, hue ${h % 360}`).toBeGreaterThanOrEqual(3);
      }
      expect(bodyOf(".meter .mnum small")).toMatch(/color:\s*var\(--text-2\)/); // the unit next to it is small type and stays neutral
      const boost = /^hsl\((\d+) (\d+)% (\d+)%\)$/.exec(theme.get("--boost")!)!;
      expect(ratio(hslToRgb(+boost[1]!, +boost[2]! / 100, +boost[3]! / 100), field), "boost").toBeGreaterThanOrEqual(3);
    });
  }
  it("keeps white readable along the whole of the hero gradient", () => {
    const g = tokens.match(/--grad-hero:[^;]*;/)![0];
    const stops = [...g.matchAll(/#[0-9a-f]{6}/gi)].map((m) => m[0]);
    expect(stops.length).toBeGreaterThanOrEqual(3);
    for (const s of stops) { const c = [0, 2, 4].map((i) => parseInt(s.slice(1 + i, 3 + i), 16)) as RGB; expect(ratio([255, 255, 255], c), s).toBeGreaterThanOrEqual(4.5); }
  });
});

// ---- type -----------------------------------------------------------------------------------------------------------------------------------------
describe("one type scale: 32 / 24 / 18 / 16 / 14 / 12", () => {
  it("defines the six steps and a body of 16 px", () => {
    expect(["xxl", "xl", "lg", "md", "sm", "xs"].map((s) => dark.get(`--fs-${s}`))).toEqual(["32px", "24px", "18px", "16px", "14px", "12px"]);
    has(/body \{[^}]*font: 400 var\(--fs-md\)/);
    has(/input, select, textarea \{ font-size: var\(--fs-md\); \}/);
  });
  it("sets every font size from the scale (or from a container for the art on the figurines), never a loose number", () => {
    const decl = [...css.matchAll(/font-size:\s*([^;}]+)/g)].map((m) => m[1]!.trim());
    const loose = decl.filter((d) => !/^var\(--fs-(xxl|xl|lg|md|sm|xs|hero)\)$/.test(d) && d !== "min(var(--fs-xxl), 5.4vw)" && !/^clamp\(\d+px, [\d.]+cqw, \d+px\)$/.test(d));
    expect(loose).toEqual([]);
    expect(decl.length).toBeGreaterThan(200);
    expect(css.match(/font:\s*[^;}]*\d(px|rem)\b/g)).toBeNull();
  });
  it("keeps the inline sizes in the markup on the scale too", () => {
    const inline = TSX.flatMap((f) => [...read(f).matchAll(/style="[^"]*font-size:\s*([^;"]+)/g)].map((m) => `${f}: ${m[1]}`));
    expect(inline.filter((s) => !/var\(--fs-/.test(s))).toEqual([]);
  });
});

// ---- reach, focus and press ---------------------------------------------------------------------------------------------------------------------------
const rules = [...css.matchAll(/([^{}@]+)\{([^{}]*)\}/g)].map((m) => ({ sel: m[1]!.replace(/\/\*[\s\S]*?\*\//g, "").trim().split(",").map((s) => s.trim().replace(/\s+/g, " ")), body: m[2]! }));
const bodyOf = (selector: string) => rules.filter((r) => r.sel.includes(selector)).map((r) => r.body).join(" ");

describe("touch targets, 12 px between chips, focus and press", () => {
  it("gives the small controls a 44 px target", () => {
    expect(dark.get("--hit")).toBe("44px");
    for (const s of [".chip", ".howx", ".qbtn", ".insbtn", ".reportlink", ".colhead", ".rowlink", ".citychip", ".mkchip", ".createbtn", ".dmbtn", ".lkxpmain", ".brand", ".townrow .btn", "footer.legal summary", ".histcats summary", ".itlist .mkchip", ".morecats"]) expect(bodyOf(s), s).toMatch(/min-height:\s*(var\(--hit\)|var\(--touch\)|4[4-9]px)/);
    expect(bodyOf("footer.legal .legallinks a")).toMatch(/min-height:\s*var\(--hit\)[^}]*min-width:\s*var\(--hit\)/);
    expect(bodyOf(".hdr-tools .iconbtn")).toMatch(/width:\s*var\(--hit\)/);
    expect(bodyOf(".infodot")).toMatch(/position:\s*relative/);
    expect(bodyOf(".infodot::after")).toMatch(/inset:\s*-12px/); // a 24 px mark with a 48 px area around it
    expect(bodyOf(".ledtabs button::after")).toMatch(/inset:\s*-7px -4px/);
  });
  it("puts 12 px between chips and lets a row of them snap to its left edge", () => {
    expect(dark.get("--space-3")).toBe("12px");
    for (const s of [".chiprow", ".catchips", ".mkchips", ".tryalt", ".itlist"]) expect(bodyOf(s), s).toMatch(/gap:\s*(var\(--space-3\)|12px)/);
    expect(bodyOf(".chiprow")).toMatch(/scroll-snap-type:\s*x proximity/);
    expect(bodyOf(".chiprow")).toMatch(/scroll-padding-inline:\s*var\(--gutter\)/);
    expect(bodyOf(".chip")).toMatch(/scroll-snap-align:\s*start/);
    expect(bodyOf(".mkchips")).toMatch(/scroll-snap-type:\s*x proximity/);
    expect(bodyOf(".mkchip")).toMatch(/scroll-snap-align:\s*start/);
  });
  it("shows where the keyboard is, on every control, in the ring colour", () => {
    has(/^:focus-visible \{ outline: 2px solid var\(--ring\); outline-offset: 2px; \}/m);
    // the only places that switch the outline off hand the job to something that shows it better
    const off = rules.filter((r) => /outline:\s*(none|0)\b/.test(r.body)).flatMap((r) => r.sel);
    expect(off.sort()).toEqual([".itcity", ".itreg", ".sheet:focus", ".stakein input"]);
    expect(bodyOf(".stakein:focus-within")).toMatch(/outline:\s*2px solid var\(--ring\)/);
    expect(bodyOf(".itreg:focus-visible .itprov")).toMatch(/fill/);
    expect(bodyOf("input.field:focus")).not.toMatch(/outline/);
    for (const s of [".list :focus-visible", ".chiprow :focus-visible", ".top-scroll :focus-visible"]) expect(bodyOf(s), s).toMatch(/outline-offset:\s*-2px/);
  });
  it("answers a press on every kind of control, with a state of its own where the control draws one", () => {
    has(/:where\(button, \[role="button"\], \[role="tab"\], \[role="menuitemradio"\], summary, a\[href\], label\.switchrow\):active:not\(:disabled\) \{ filter: brightness\(\.88\); \}/);
    for (const s of [".chip", ".cc", ".btn", ".opt", ".iconbtn", ".seg button", ".tabbar button"]) has(new RegExp(`${s.replace(/[.[\]]/g, "\\$&")}:(not\\(:disabled\\):|)active`), `${s}:active`);
  });
});

// ---- names ------------------------------------------------------------------------------------------------------------------------------------------
describe("a name for everything that has no words", () => {
  it("gives every button that holds only an icon an aria-label or a title", () => {
    const bare: string[] = [];
    for (const f of TSX) {
      const src = read(f);
      for (const m of src.matchAll(/<button\b([^>]*)>([\s\S]*?)<\/button>/g)) {
        const attrs = m[1]!, inner = m[2]!;
        // what is left once the icons, svgs and empty marks are taken out: words, or an expression that prints some
        const rest = inner.replace(/<svg[\s\S]*?<\/svg>/g, "").replace(/<[A-Z][A-Za-z0-9]*\b[^>]*\/>/g, "").replace(/<i\b[^>]*\/>/g, "").replace(/<i\b[^>]*>\s*<\/i>/g, "").replace(/\s+/g, "");
        if (rest === "" && !/aria-label|aria-labelledby|title=/.test(attrs)) bare.push(`${f}: <button${attrs.slice(0, 60)}`);
      }
    }
    expect(bare).toEqual([]);
  });
  it("gives the marks that have no words a role, so that their label is read out", () => {
    expect(read("web/src/components/Nav.tsx").match(/<i class="badge dot" role="img" aria-label=/g)).toHaveLength(2);
    for (const [f, m] of [["EventCard", 'class="frbadge" role="img"'], ["LevelBadge", 'class="lvlb num" role="img"'], ["DailyBonus", 'class="dbfreeze" role="img"'], ["DelayMeter", 'role="group" aria-label']] as const) expect(read(`web/src/components/${f}.tsx`), f).toContain(m);
  });
  it("names the balance with its figure, and the long ones step down a size", () => {
    const h = read("web/src/components/Header.tsx");
    expect(h).toMatch(/aria-label=\{credits === null \? label : `\$\{label\}: \$\{fmtInt\(credits, locale\)\}`\}/);
    expect(h).toMatch(/role="status"/);
    expect(h).toMatch(/figure\.length > LONG_FIGURE \? "long"/);
    expect(bodyOf(".wallet.long")).toMatch(/font-size:\s*var\(--fs-lg\)/);
  });
});
