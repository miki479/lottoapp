import { describe, expect, it } from "vitest";
import { unseenResults } from "../web/src/lib/results.ts";
import type { MyBet } from "../web/src/lib/types.ts";

const bet = (id: string, status: string, settled_at: string | null) => ({ id, status, settled_at }) as unknown as MyBet;
const NOW = Date.parse("2026-10-14T12:00:00Z");

describe("unseenResults", () => {
  it("announces a result settled a moment ago", () => expect(unseenResults([bet("a", "won", "2026-10-14T11:00:00Z")], new Set(), NOW)).toHaveLength(1));
  it("does not replay old results on a device that has seen none", () => expect(unseenResults([bet("a", "won", "2026-09-01T11:00:00Z")], new Set(), NOW)).toHaveLength(0));
  it("skips open bets and the ones already seen", () => expect(unseenResults([bet("a", "open", null), bet("b", "lost", "2026-10-14T11:00:00Z")], new Set(["b"]), NOW)).toHaveLength(0));
});
