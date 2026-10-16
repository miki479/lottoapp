import preact from "@preact/preset-vite";
import { defineConfig } from "vite";
import { supabaseUrl } from "../scripts/lib-env.mjs";

// The anon key is public by design (row level security protects the data); it is embedded at build time.
const url = process.env.VITE_SUPABASE_URL ?? supabaseUrl() ?? "";
const anon = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY ?? "";

export default defineConfig({
  plugins: [preact()],
  define: {
    "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(url),
    "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify(anon),
  },
  build: { target: "es2020", sourcemap: false },
  // no console output or debugger statements in what the browser receives
  esbuild: { drop: ["console", "debugger"], legalComments: "none" },
});
