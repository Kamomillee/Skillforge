import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Isolation cross-origin : nécessaire pour SharedArrayBuffer, utilisé pour
// interrompre proprement un programme Python (KeyboardInterrupt) sans tuer le worker.
const isolationHeaders = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp",
};

export default defineConfig({
  plugins: [react()],
  server: { headers: isolationHeaders, port: 5173 },
  preview: { headers: isolationHeaders, port: 4173 },
  worker: { format: "es" },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
});
