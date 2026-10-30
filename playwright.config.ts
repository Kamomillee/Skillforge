import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "e2e",
  timeout: 90_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: { baseURL: "http://localhost:4173", trace: "retain-on-failure" },
  webServer: [
    { command: "npx vite preview --port 4173 --strictPort", port: 4173, reuseExistingServer: true, timeout: 60_000 },
    // Vrai serveur SkillForge, base neuve à chaque lancement, tuteur IA simulé (aucune clé), budget IA de 2 demandes.
    {
      command: "rm -rf .e2e && node --experimental-strip-types --no-warnings server/main.ts",
      port: 8788,
      reuseExistingServer: false,
      timeout: 60_000,
      env: { PORT: "8788", SKILLFORGE_DB: ".e2e/serveur.db", SKILLFORGE_TUTEUR: "simule", SKILLFORGE_ADMINS: "prof@example.ch", AI_REQUESTS_PER_USER_PER_DAY: "2" },
    },
  ],
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } }, testIgnore: /(mobile|serveur)\.spec\.ts/ },
    { name: "serveur", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 }, baseURL: "http://localhost:8788" }, testMatch: /serveur\.spec\.ts/ },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /mobile\.spec\.ts/ },
  ],
});
