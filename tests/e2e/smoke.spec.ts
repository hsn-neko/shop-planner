// Smoke tests: the planner loads, renders, switches views, edits the room and keeps state, with no script errors.
import { expect, test, type Page } from "@playwright/test";

// Three.js and the fonts are bundled into the build, so the page needs no network.
const ORIGIN = "http://localhost:4173/";

function trackErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  return errors;
}
const placed = (t: string | null) => Number(/^(\d+) pieces/.exec(t ?? "")?.[1]);

async function openRoomEditor(page: Page): Promise<void> {
  if (!(await page.locator("#bRoomEd").isVisible())) await page.locator('[data-tab="room"]').click();
  await page.locator("#bRoomEd").click();
  await expect(page.locator("#roomEd")).toBeVisible();
}

test("loads nothing from other sites", async ({ page }) => {
  const external: string[] = [];
  page.on("request", (r) => {
    const u = r.url();
    if (!u.startsWith(ORIGIN) && !u.startsWith("data:") && !u.startsWith("blob:")) external.push(u);
  });
  await page.goto("/");
  await expect(page.locator("#stCount")).toHaveText(/seats$/);
  expect(external, external.join("\n")).toEqual([]);
});

test("loads, renders and switches views without errors", async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto("/");
  await expect(page).toHaveTitle("Shop Planner");
  await expect(page.locator(".brand")).toContainText("Shop Planner");

  // The default preset counts its seats once the scene is built.
  await expect(page.locator("#stCount")).toHaveText(/^[1-9]\d* seats$/);
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
  await expect(page.locator("#stCount")).toHaveText(/seats$/);
  const before = placed(await page.locator("#invSum").textContent());

  // On phones the inventory is a drawer behind the Items button.
  if (await page.locator("#bInv").isVisible()) await page.locator("#bInv").click();
  await page.locator('[data-add="plant"]').click();
  await expect.poll(async () => placed(await page.locator("#invSum").textContent())).toBe(before + 1);

  await page.waitForTimeout(400); // saves are debounced by 250 ms
  await page.reload();
  await expect.poll(async () => placed(await page.locator("#invSum").textContent())).toBe(before + 1);
});

test("room editor adds, edits and removes a window, and undo works", async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto("/");
  await expect(page.locator("#stCount")).toHaveText(/seats$/);
  await openRoomEditor(page);

  const windows = async () => Number(/(\d+) windows?/.exec((await page.locator("#rsArea").textContent()) ?? "")?.[1] ?? 0);
  const n0 = await windows();
  await page.locator("#wAdd").click();
  await expect(page.locator("#wPanel")).toBeVisible();
  await expect.poll(windows).toBe(n0 + 1);

  // a type button resets the height to that type's preset
  await page.locator('#wKind [data-v="high"]').click();
  await expect(page.locator("#wTitle")).toHaveText("High window");

  await page.locator("#wDel").click();
  await expect(page.locator("#wPanel")).toBeHidden();
  await expect.poll(windows).toBe(n0);

  await page.locator("#reUndo").click();
  await expect.poll(windows).toBe(n0 + 1);

  // the 3D editor view, where WebGL is available
  const seg3d = page.locator('#reSeg [data-v="3d"]');
  if (await seg3d.isEnabled()) {
    await seg3d.click();
    await expect(seg3d).toHaveAttribute("aria-pressed", "true");
    await expect(page.locator("#reBadge")).toContainText("window");
  }
  await page.locator("#reDone").click();
  await expect(page.locator("#roomEd")).toBeHidden();
  expect(errors, errors.join("\n")).toEqual([]);
});

test("room editor size sliders resize the shop", async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto("/");
  await expect(page.locator("#stCount")).toHaveText(/seats$/);
  await openRoomEditor(page);
  const w = page.locator("#rW");
  await w.fill("12");
  await w.dispatchEvent("input");
  await expect(page.locator("#oW")).toHaveText("12 m");
  await expect(page.locator("#reDims")).toContainText("12 ×");
  await page.locator("#reDone").click();
  await expect(page.locator("#stSize")).toContainText("12 ×");
  expect(errors, errors.join("\n")).toEqual([]);
});

test("opens in the 2D plan when the browser has no WebGL", async ({ page }) => {
  const errors = trackErrors(page);
  // Make every WebGL request fail, as on browsers with 3D turned off.
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
      return /webgl/i.test(type) ? null : (getContext as (...a: unknown[]) => unknown).call(this, type, ...rest);
    } as typeof getContext;
  });
  await page.goto("/");
  await expect(page.locator("#stCount")).toHaveText(/^[1-9]\d* seats$/);
  await expect(page.locator("html")).toHaveAttribute("data-webgl", "off");
  await expect(page.locator("#vPlan")).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("#v3d")).toBeDisabled();
  await expect(page.locator("#vWalk")).toBeDisabled();
  expect(errors, errors.join("\n")).toEqual([]);
});

async function openTab(page: Page, tab: string): Promise<void> {
  const t = page.locator(`[data-tab="${tab}"]`);
  if ((await t.getAttribute("aria-selected")) !== "true") await t.click();
}

test("new layouts start by picking a shop type", async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto("/");
  await expect(page.locator("#stCount")).toHaveText(/seats$/);
  await openTab(page, "layouts");

  await page.locator('[data-stype="books"]').click();
  await expect(page.locator('#starts [data-new]')).toHaveCount(3);
  await page.locator('[data-new="K1"]').click();
  await expect(page.locator("#stCount")).toHaveText(/^[\d.]+ m shelving$/);
  await openTab(page, "layouts");
  await expect(page.locator("#lType")).toHaveText("Bookshop / gift shop · Stockroom and Office");
  await expect(page.locator("#slots [aria-pressed=true]")).toContainText("Bookshop / gift shop");

  // a blank retail layout opens the room editor
  await page.locator('[data-stype="retail"]').click();
  await page.locator('[data-new="blank"]').click();
  await expect(page.locator("#roomEd")).toBeVisible();
  await page.locator("#reDone").click();
  await expect(page.locator("#stCount")).toHaveText("0 fixtures");
  expect(errors, errors.join("\n")).toEqual([]);
});

test("back rooms can take a name added in Settings", async ({ page }) => {
  const errors = trackErrors(page);
  await page.goto("/");
  await expect(page.locator("#stCount")).toHaveText(/seats$/);
  await page.locator("#bSettings").click();
  await page.locator("#sNameNew").fill("Bakehouse");
  await page.locator("#sNameAdd").click();
  await expect(page.locator("#sNames")).toContainText("Bakehouse");
  await page.locator("#setClose").click();

  await openRoomEditor(page);
  await page.locator("#bName1").selectOption("Bakehouse");
  await expect(page.locator("#rsArea")).toContainText("Bakehouse");
  await expect(page.locator('#bMode [data-v="kitchen"]')).toHaveText("Bakehouse");
  await page.locator("#reDone").click();

  // Settings shows where the name is used; removing it keeps it on the layout
  await page.locator("#bSettings").click();
  await expect(page.locator("#sNames")).toContainText("used in 1 layout");
  await page.getByRole("button", { name: /^Remove Bakehouse/ }).click();
  await expect(page.locator("#sNames")).not.toContainText("Bakehouse");
  await page.locator("#setClose").click();
  await openRoomEditor(page);
  await expect(page.locator("#rsArea")).toContainText("Bakehouse");
  await page.locator("#reDone").click();
  expect(errors, errors.join("\n")).toEqual([]);
});
