// @ts-check
const { defineConfig, devices } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "tests",
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: "http://localhost:4173",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "node tests/server.js",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
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
