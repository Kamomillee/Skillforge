import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Isolation cross-origin : nécessaire pour SharedArrayBuffer, utilisé pour
// interrompre proprement un programme Python (KeyboardInterrupt) sans tuer le worker.
const isolationHeaders = {
  "Cross-Origin-Opener-Policy": "same-origin",
  "Cross-Origin-Embedder-Policy": "require-corp",
};

// Le tuteur IA vit sur le serveur SkillForge (server/main.ts, port 8787) : en développement, /api y est relayé.
// S'il ne tourne pas, /api/sante échoue et l'interface utilise le tuteur local.
const api = { "/api": { target: "http://localhost:8787", changeOrigin: true } };

export default defineConfig({
  plugins: [react()],
  server: { headers: isolationHeaders, port: 5173, proxy: api },
  preview: { headers: isolationHeaders, port: 4173, proxy: api },
  worker: { format: "es" },
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    testTimeout: 120_000,
    hookTimeout: 120_000,
  },
});
