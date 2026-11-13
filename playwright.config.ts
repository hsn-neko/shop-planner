import { defineConfig, devices } from "@playwright/test";

const CI = !!process.env.CI;

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 60_000,
  retries: CI ? 1 : 0,
  reporter: CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://localhost:4173",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  // Tests run against the production build, served the way GitHub Pages serves it.
  webServer: {
    command: "npm run build && npm run preview",
    url: "http://localhost:4173",
    reuseExistingServer: !CI,
    timeout: 120_000,
  },
  // Desktop engines plus phone emulation, matching the page's responsive layouts
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    // Ask headless Firefox for software WebGL; if it still has none, the tests check the 2D fallback.
    { name: "firefox", use: { ...devices["Desktop Firefox"], launchOptions: { firefoxUserPrefs: { "webgl.force-enabled": true } } } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
    { name: "mobile-chrome", use: { ...devices["Pixel 7"] } },
    { name: "mobile-safari", use: { ...devices["iPhone 14"] } },
  ],
});
