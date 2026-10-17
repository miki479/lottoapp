import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { HALLOWEEN_CHALLENGES, HALLOWEEN_PICTURES, HALLOWEEN_TARGET } from "../shared/halloween.ts";
import { MORE_TROPHIES } from "../shared/trophies-more.ts";
import { TROPHY_IDS } from "../web/src/i18n/index.ts";

const sql = readFileSync("supabase/migrations/0160_halloween.sql", "utf8");

describe("Halloween challenges", () => {
  it("are exactly five, three wins each, on categories the project really has", () => {
    expect(HALLOWEEN_CHALLENGES.map((c) => c.id)).toEqual(["halloween_treni", "halloween_meteo", "halloween_traffico", "halloween_mercati", "halloween_sport"]);
    expect(HALLOWEEN_TARGET).toBe(3);
    expect(HALLOWEEN_CHALLENGES.map((c) => c.category)).toEqual(["train", "weather", "traffic", "finance", "sport"]);
    const cats = readFileSync("supabase/migrations/0155_games_category.sql", "utf8");
    for (const c of HALLOWEEN_CHALLENGES) expect(cats).toContain(`'${c.category}'`);
  });
  it("each has its own trophy with texts in all languages, and only those five were added", () => {
    const own = MORE_TROPHIES.filter((t) => t.id.startsWith("halloween_"));
    expect(own.map((t) => t.id)).toEqual(HALLOWEEN_CHALLENGES.map((c) => c.id));
    for (const t of own) for (const l of ["it", "en", "ja"] as const) { expect(t.text[l].name).toBeTruthy(); expect(t.text[l].desc).toBeTruthy(); }
    for (const c of HALLOWEEN_CHALLENGES) expect(TROPHY_IDS).toContain(c.id);
  });
  it("only pictures that exist are declared, and the traffic picture is not faked", () => {
    for (const id of HALLOWEEN_PICTURES) expect(existsSync(`web/public/trophies/${id}.webp`)).toBe(true);
    expect(HALLOWEEN_PICTURES).not.toContain("halloween_traffico");
    expect(existsSync("web/public/trophies/halloween_traffico.webp")).toBe(false);
  });
  it("counting rules live in the database: backend wins only, distinct events, window, settle deadline, idempotent award, draft by default", () => {
    expect(sql).toContain("b.status = 'won' and m.status = 'resolved' and m.outcome = b.pick");
    expect(sql).toContain("count(distinct public.market_event_key(m))");
    expect(sql).toContain("b.placed_at >= p_from and b.placed_at <= p_to and b.settled_at <= p_settle");
    expect(sql).toContain("on conflict do nothing");
    expect(sql).toContain("published boolean not null default false");
    expect(sql).toContain("if not found or not ev.published or ev.starts_at is null or ev.ends_at is null then return got");
    expect(sql).not.toMatch(/credits\s*=|update public\.profiles/);
  });
});
