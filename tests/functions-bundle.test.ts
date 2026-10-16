import { build } from "esbuild";
import { readdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { beforeAll, describe, expect, it } from "vitest";

// The Edge Functions import shared/ and cities/ through supabase/functions/_shared (a gitignored copy made by
// scripts/build-functions.mjs, which this test runs first). Bundling catches a missing export or a broken import before a deploy
// (which otherwise shows up only as BOOT_ERROR on every cron call).
const root = resolve(__dirname, "..");
const fnDir = join(root, "supabase/functions");
const functions = readdirSync(fnDir).filter((d) => !d.startsWith("_") && existsSync(join(fnDir, d, "index.ts")));

describe("edge functions", () => {
  beforeAll(() => { execFileSync(process.execPath, [join(root, "scripts/build-functions.mjs")], { stdio: "pipe" }); });
  for (const name of functions) {
    it(`${name} bundles (imports and exports resolve)`, async () => {
      const r = await build({
        entryPoints: [join(fnDir, name, "index.ts")], bundle: true, write: false, format: "esm", platform: "neutral", logLevel: "silent",
        external: ["npm:*", "jsr:*", "https:*", "node:*"],
      });
      expect(r.errors).toEqual([]);
    });
  }
});
