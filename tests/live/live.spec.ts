// The published site keeps its security settings: a Content Security Policy, nothing loaded from other sites, no script errors.
import { expect, test } from "@playwright/test";

const LIVE = process.env.LIVE_URL ?? "https://hsn-neko.github.io/shop-planner/";
// A query string that changes each run, so the check sees the newest deploy rather than a cached page.
const url = `${LIVE}?check=${process.env.GITHUB_SHA ?? Date.now()}`;

test("the live site sets its Content Security Policy and loads nothing from other sites", async ({ page }) => {
  const origin = new URL(LIVE).origin;
  const external: string[] = [], errors: string[] = [];
  page.on("request", (r) => {
    const u = r.url();
    if (!u.startsWith(origin) && !u.startsWith("data:") && !u.startsWith("blob:")) external.push(u);
  });
  page.on("pageerror", (e) => errors.push(e.message));

  await expect(async () => {
    await page.goto(url);
    const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute("content", { timeout: 2_000 });
    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain("script-src 'self'");
  }).toPass({ timeout: 45_000, intervals: [5_000] });

  await expect(page.locator("#stSize")).toHaveText(/^[\d.]+ × [\d.]+ m/);
  expect(external, external.join("\n")).toEqual([]);
  expect(errors, errors.join("\n")).toEqual([]);
});
