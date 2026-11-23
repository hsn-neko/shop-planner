// Security tests: hostile saved data must not inject markup or stop the app, and the page must
// run under its Content Security Policy without violations. Saved data reaches the page from
// browser storage today and from imported files later, so it is treated as untrusted.
import { expect, test, type Page } from "@playwright/test";

const KEY = "shop-planner-v1";
const XSS = '"><img src=x onerror="window.__pwn=1"><svg onload="window.__pwn=1">';

type Json = Record<string, unknown>;
const layout = (extra: Json = {}): Json => ({ room: { w: 8, d: 10, h: 3.2, door: 0 }, palette: "matcha", warmth: 0.5, items: [], ...extra });
const store = (slots: Json, extra: Json = {}): Json => ({
  active: Object.keys(slots)[0], order: Object.keys(slots), slots, custom: [], versions: {}, seen: { intro: true, empty: true }, ...extra,
});

/** Saves `data` as the app's store before the page's own scripts run, on the first load only. */
async function seed(page: Page, data: unknown): Promise<void> {
  await page.addInitScript(([k, v]) => {
    if (!sessionStorage.getItem("seeded")) {
      localStorage.setItem(k, v);
      sessionStorage.setItem("seeded", "1");
    }
  }, [KEY, typeof data === "string" ? data : JSON.stringify(data)] as const);
}

/** Collects script errors and CSP violations. */
async function watch(page: Page): Promise<{ errors: string[]; csp: () => Promise<string[]> }> {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.addInitScript(() => {
    (window as unknown as { __csp: string[] }).__csp = [];
    document.addEventListener("securitypolicyviolation", (e) => (window as unknown as { __csp: string[] }).__csp.push(`${e.violatedDirective} ${e.blockedURI}`));
  });
  return { errors, csp: () => page.evaluate(() => (window as unknown as { __csp: string[] }).__csp) };
}

/** Opens every panel that draws saved data into HTML: layouts, inventory, item editor, room and area editor, studio, settings. */
async function renderEverything(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const tick = () => new Promise((r) => setTimeout(r, 60));
    const click = async (sel: string) => {
      document.querySelector<HTMLElement>(sel)?.click();
      await tick();
    };
    await click('[data-tab="layouts"]');
    await click("#bInv");
    for (const b of document.querySelectorAll<HTMLButtonElement>("[data-find]:not([disabled])")) {
      b.click();
      await tick();
      await click("#bEdit");
    }
    await click("#bRoomEd");
    for (const b of document.querySelectorAll<HTMLButtonElement>("#aChips button")) {
      b.click();
      await tick();
    }
    await click("#reDone");
    await click("[data-edit]");
    await click("#sCancel");
    await click("#bSettings");
    await click("#setClose");
  });
}

async function expectNoInjection(page: Page): Promise<void> {
  const r = await page.evaluate(() => ({
    pwn: (window as unknown as { __pwn?: number }).__pwn ?? 0,
    // markup from the payload, whether or not CSP stopped its script
    injected: document.querySelectorAll("[onerror], [onload], img[src='x']").length,
  }));
  expect(r).toEqual({ pwn: 0, injected: 0 });
}

async function expectAppRunning(page: Page): Promise<void> {
  // the header shows the shop size once the scene is built (a mixed shop with no furniture counts nothing yet)
  await expect(page.locator("#stSize")).toHaveText(/^[\d.]+ × [\d.]+ m/);
  await expect(page.locator("#stCount")).not.toBeEmpty();
}

const injection: Record<string, Json> = {
  "furniture colour": store({ A: layout({ items: [{ type: "two", x: 0, z: 0, r: 0, color: XSS }] }) }),
  "custom item colour and type": store({ A: layout({ items: [{ type: "cxss", x: 1, z: 1, r: 0 }] }) }, {
    custom: [
      { type: "cxss", name: XSS, shape: "parts", w: 1, d: 1, h: 1, seats: 0, color: XSS, parts: [{ k: "box", w: 1, h: 1, d: 1, x: 0, y: 0, z: 0, color: XSS }] },
      { type: XSS, name: "x", shape: "block", w: 1, d: 1, h: 1, seats: 0, color: "#ffffff" },
    ],
  }),
  "layout id and name": store({ [XSS]: layout({ label: XSS }), A: layout({ label: XSS }) }),
  "version id, name and summary": store({ A: layout() }, {
    versions: { A: [{ id: XSS, name: XSS, time: 0, count: XSS, seats: XSS, sum: XSS, data: JSON.stringify(layout({ label: XSS })) }] },
  }),
  "floor area id and name": store({ A: layout({ type: "mixed", areas: [{ id: XSS, name: XSS, kind: "cafe", finish: "oak", x0: -3, x1: 0, z0: -3, z1: 0 }] }) }),
  "back-room names": store({ A: layout({ names: { kitchen: XSS, storage: XSS } }) }, { settings: { roomNames: [XSS] } }),
};

for (const [name, data] of Object.entries(injection)) {
  test(`saved data can't inject markup: ${name}`, async ({ page }) => {
    const w = await watch(page);
    await seed(page, data);
    await page.goto("/");
    await expectAppRunning(page);
    await renderEverything(page);
    await expectNoInjection(page);
    expect(w.errors, w.errors.join("\n")).toEqual([]);
  });
}

const broken: Record<string, unknown> = {
  "unknown shop type": store({ A: layout({ type: "nope" }) }),
  "unknown palette": store({ A: layout({ palette: "nope" }) }),
  "__proto__ as a shop type, palette and layout id": `{"active":"__proto__","order":["__proto__","A"],"slots":{"__proto__":{"room":{},"palette":"matcha","warmth":0,"items":[]},"A":{"room":{},"palette":"__proto__","type":"__proto__","warmth":0,"items":[{"type":"toString","x":0,"z":0,"r":0}]}}}`,
  "built-in names as ids": store({ toString: layout(), constructor: layout(), A: layout({ items: [{ type: "hasOwnProperty", x: 0, z: 0, r: 0 }] }) }),
  "unknown area kind, finish and divider": store({ A: layout({ type: "mixed", areas: [{ id: "a1", name: "x", kind: "nope", finish: "nope", x0: -2, x1: 0, z0: -2, z1: 0, div: { n: { kind: "nope", gap: 0 } } }] }) }),
  "impossible numbers": store({ A: layout({ room: { w: 1e308, d: -1, h: "x", door: null }, warmth: NaN, items: [{ type: "two", x: 1e308, z: -1e308, r: 1e9, sx: 0 }] }) }),
  "wrong shapes everywhere": store({ A: { room: [], palette: 7, warmth: "x", items: "x", windows: {}, areas: "x", boh: [] } }, { custom: "x", versions: [], seen: 7, settings: null }),
  "damaged version data": store({ A: layout() }, { versions: { A: [{ id: "v1", name: "v", time: 0, count: 0, seats: 0, data: "{not json" }] } }),
  "not JSON at all": "{not json",
  "thousands of items": store({ A: layout({ items: Array.from({ length: 20000 }, (_, k) => ({ type: "plant", x: (k % 100) / 10, z: k / 2000, r: 0 })) }) }),
};

for (const [name, data] of Object.entries(broken)) {
  test(`broken saved data doesn't stop the app: ${name}`, async ({ page }) => {
    // the item cap still leaves a thousand pieces to draw, which is slow in software 3D
    if (name === "thousands of items") test.slow();
    const w = await watch(page);
    await seed(page, data);
    await page.goto("/");
    await expectAppRunning(page);
    await renderEverything(page);
    await expectAppRunning(page);
    expect(w.errors, w.errors.join("\n")).toEqual([]);
  });
}

test("a damaged saved version is refused, not opened", async ({ page }) => {
  const w = await watch(page);
  await seed(page, store({ A: layout() }, { versions: { A: [{ id: "v1", name: "Bad", time: 0, count: 0, seats: 0, data: '{"room":"x"' }] } }));
  await page.goto("/");
  await expectAppRunning(page);
  await page.evaluate(() => {
    document.querySelector<HTMLElement>('[data-tab="layouts"]')?.click();
    document.querySelector<HTMLElement>('[data-vres="v1"]')?.click();
  });
  await expect(page.locator("#hint")).toContainText("can't be opened");
  expect(w.errors, w.errors.join("\n")).toEqual([]);
});

test("the page sets a Content Security Policy and breaks none of it", async ({ page }) => {
  const w = await watch(page);
  await page.goto("/");
  await expectAppRunning(page);
  const csp = await page.locator('meta[http-equiv="Content-Security-Policy"]').getAttribute("content");
  expect(csp).toContain("default-src 'none'");
  expect(csp).toContain("script-src 'self'");
  expect(csp).not.toMatch(/script-src[^;]*'unsafe-(inline|eval)'/);

  // use every view and editor, so anything they load or run is checked against the policy
  for (const v of ["#vPlan", "#vWalk", "#v3d"]) {
    const b = page.locator(v);
    if (await b.isEnabled()) await b.click();
  }
  await renderEverything(page);
  await page.evaluate(() => document.querySelector<HTMLElement>("#bMaker")?.click());
  await expect(page.locator("#studio")).toBeVisible();
  await page.locator("#sCancel").click();
  expect(await w.csp()).toEqual([]);
  expect(w.errors, w.errors.join("\n")).toEqual([]);
});

test("a script injected into the page is blocked by the policy", async ({ page }) => {
  const w = await watch(page);
  await page.goto("/");
  await expectAppRunning(page);
  // Simulates a missed escape: markup with an inline handler lands in the DOM.
  await page.evaluate(() => {
    const d = document.createElement("div");
    d.innerHTML = '<img src="data:," onerror="window.__pwn=1">';
    document.body.append(d);
  });
  await page.waitForTimeout(200);
  expect(await page.evaluate(() => (window as unknown as { __pwn?: number }).__pwn ?? 0)).toBe(0);
  expect((await w.csp()).some((v) => v.startsWith("script-src"))).toBe(true);
});
