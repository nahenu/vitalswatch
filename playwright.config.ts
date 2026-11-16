import { defineConfig, devices } from "@playwright/test";

const PORT = 3100;
const BASE_URL = `http://localhost:${PORT}`;
const CI = !!process.env.CI;

/**
 * End-to-end tests run against a production build on its own port, with a
 * throwaway PGlite database that is wiped before every run. Nothing touches
 * your dev server (3001) or its data.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  workers: CI ? 2 : 3,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: CI ? [["github"], ["html", { open: "never" }]] : [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] }, testIgnore: /mobile\.spec/ },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /mobile\.spec/ },
  ],
  webServer: {
    command: `npm run build && node -e "require('fs').rmSync('.data/e2e',{recursive:true,force:true})" && npx next start -p ${PORT}`,
    url: BASE_URL,
    reuseExistingServer: false,
    timeout: 300_000,
    stdout: "ignore",
    stderr: "pipe",
    env: {
      PGLITE_DIR: ".data/e2e",
      BETTER_AUTH_SECRET: "e2e-only-secret-never-used-in-production-0123456789",
      BETTER_AUTH_URL: BASE_URL,
      NEXT_PUBLIC_SITE_URL: BASE_URL,
      // Many parallel sign-ups from one IP would trip auth rate limiting. Test server only.
      AUTH_RATE_LIMIT: "off",
      // Emails (password reset) are appended here for tests to read.
      EMAIL_OUTBOX_FILE: ".data/e2e/outbox.jsonl",
      // PageSpeed Insights is replaced by a deterministic fake, so tests never call Google.
      PSI_MOCK: "1",
      CRON_SECRET: "e2e-cron-secret",
    },
  },
});
