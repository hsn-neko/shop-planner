import { defineConfig, devices } from "@playwright/test";

// Checks against the published GitHub Pages site (LIVE_URL), not a local build. Run by CI after each deploy and weekly.
export default defineConfig({
  testDir: "tests/live",
  timeout: 60_000,
  // GitHub Pages can take a few minutes to serve a new deploy everywhere.
  retries: 2,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  use: { ...devices["Desktop Chrome"], trace: "retain-on-failure" },
});
