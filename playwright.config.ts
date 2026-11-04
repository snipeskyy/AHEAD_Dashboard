import { defineConfig, devices } from "@playwright/test";

/**
 * E2E runs against the TEST database only (prisma/test.db via scripts/with-test-db.mjs) on its own
 * port and build dir, so it never touches your real data or a running `npm run dev`.
 */
const PORT = Number(process.env.E2E_PORT ?? 3100);
const desktop = { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } };

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  timeout: 60_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
  },
  projects: [
    // Populated fixture dataset (seeded in global-setup).
    { name: "fixtures", use: desktop, testIgnore: /empty\/.*\.spec\.ts/ },
    // Runs last: wipes the test DB and exercises first-run onboarding + import on zero records.
    {
      name: "empty",
      use: desktop,
      testMatch: /empty\/.*\.spec\.ts/,
      dependencies: ["fixtures"],
    },
  ],
  webServer: {
    command: process.env.E2E_SERVER_COMMAND ?? "npm run dev:test",
    url: `http://localhost:${PORT}/api/meta`,
    reuseExistingServer: true,
    timeout: 180_000,
    env: { NEXT_DIST_DIR: process.env.NEXT_DIST_DIR ?? ".next-e2e" },
  },
});
