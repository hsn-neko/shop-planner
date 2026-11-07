// Smoke test: the planner loads, renders, switches views and keeps state, with no script errors.
const { test, expect } = require("@playwright/test");
const fs = require("fs");
const path = require("path");

// Three.js and the fonts are served from this repo (vendor/, fonts/), so tests need no network.

test("vendored Three.js matches the pinned npm package", async () => {
  const root = path.join(__dirname, "..");
  for (const [vendored, npm] of [
    ["vendor/three/three.min.js", "node_modules/three/build/three.min.js"],
    ["vendor/three/OrbitControls.js", "node_modules/three/examples/js/controls/OrbitControls.js"],
  ]) {
    expect(fs.readFileSync(path.join(root, vendored)).equals(fs.readFileSync(path.join(root, npm))), vendored).toBe(true);
  }
});

test("loads nothing from other sites", async ({ page }) => {
  const external = [];
  page.on("request", (r) => { if (!r.url().startsWith("http://localhost:4173/") && !r.url().startsWith("data:") && !r.url().startsWith("blob:")) external.push(r.url()); });
  await page.goto("/");
  await expect(page.locator("#stSeats")).toHaveText(/seats$/);
  expect(external, external.join("\n")).toEqual([]);
});

test("loads, renders and switches views without errors", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await page.goto("/");
  await expect(page).toHaveTitle("Dessert Cafe Planner");

  // The default "Cosy dine-in" preset counts its seats once the scene is built.
  await expect(page.locator("#stSeats")).toHaveText(/^[1-9]\d* seats$/);
  await expect(page.locator("html")).toHaveAttribute("data-webgl", /^(on|off)$/);
  const has3d = (await page.locator("html").getAttribute("data-webgl")) === "on";

  await page.locator("#vPlan").click();
  await expect(page.locator("#vPlan")).toHaveAttribute("aria-pressed", "true");
  if (has3d) {
    await expect(page.locator(".stage canvas").first()).toBeAttached();
    await page.locator("#vWalk").click();
    await expect(page.locator("#walkpad")).toBeVisible();
    await page.locator("#v3d").click();
    await expect(page.locator("#v3d")).toHaveAttribute("aria-pressed", "true");
  } else {
    // Headless browsers without graphics may have no WebGL: the planner must still work in 2D.
    await expect(page.locator("#v3d")).toBeDisabled();
    await expect(page.locator("#vWalk")).toBeDisabled();
  }

  expect(errors, errors.join("\n")).toEqual([]);
});

test("adding furniture is saved across reloads", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#stSeats")).toHaveText(/seats$/);
  const before = await page.locator("#invSum").textContent();
  const placed = (t) => Number(/^(\d+) pieces/.exec(t || "")[1]);

  // On phones the inventory is a drawer behind the Items button.
  if (await page.locator("#bInv").isVisible()) await page.locator("#bInv").click();
  await page.locator('[data-add="plant"]').click();
  await expect.poll(async () => placed(await page.locator("#invSum").textContent())).toBe(placed(before) + 1);

  await page.waitForTimeout(400); // saves are debounced by 250 ms
  await page.reload();
  await expect.poll(async () => placed(await page.locator("#invSum").textContent())).toBe(placed(before) + 1);
});

test("opens in the 2D plan when the browser has no WebGL", async ({ page }) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  // Make every WebGL request fail, as on browsers with 3D turned off.
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
      return /webgl/i.test(type) ? null : getContext.call(this, type, ...rest);
    };
  });
  await page.goto("/");
  await expect(page.locator("#stSeats")).toHaveText(/^[1-9]\d* seats$/);
  await expect(page.locator("html")).toHaveAttribute("data-webgl", "off");
  await expect(page.locator("#vPlan")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#v3d")).toBeDisabled();
  await expect(page.locator("#vWalk")).toBeDisabled();
  expect(errors, errors.join("\n")).toEqual([]);
});
