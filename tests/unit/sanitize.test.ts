// Saved data is checked before use. These tests feed it hostile and broken values and check that
// (1) the app's own data comes through unchanged, and (2) anything else is dropped or replaced by a safe default.
import { describe, expect, it } from "vitest";
import { BY, EXAMPLES, PALETTES } from "../../src/data/catalog";
import { isColor, isId, LIMITS, num, parseVersionData, sanitizeCustom, sanitizeLayout, sanitizeStore } from "../../src/data/sanitize";
import type { ItemDef, Layout } from "../../src/types";

const XSS = '"><img src=x onerror="alert(1)">';
const clone = <T>(o: T): T => JSON.parse(JSON.stringify(o)) as T;
/** A layout as the app saves it, minus fields the sanitizer may add (item ids are reassigned on load; windows get ids). */
const comparable = (L: Layout) => {
  const c = clone(L);
  for (const i of c.items) delete (i as { id?: number }).id;
  for (const w of c.windows ?? []) delete w.id;
  return c;
};

describe("the app's own data survives unchanged", () => {
  for (const [k, E] of Object.entries(EXAMPLES)) {
    it(`preset ${k}`, () => {
      expect(comparable(sanitizeLayout(clone(E))!)).toEqual(comparable(E));
    });
  }

  it("a custom item from each studio shape", () => {
    const items: ItemDef[] = [
      { type: "cabc1", name: "Cake shelf", shape: "parts", w: 1.2, d: 0.4, h: 1.6, seats: 0, color: "#8a5a44", ox: 0, oz: 0,
        parts: [{ k: "box", w: 0.04, h: 1.6, d: 0.4, x: -0.58, y: 0, z: 0, color: "#8a5a44" }, { k: "cyl", w: 0.3, h: 0.12, d: 0.3, x: -0.25, y: 1.33, z: 0, color: "#e3879a" }] },
      { type: "cabc2", name: "Block", shape: "block", w: 1, d: 0.5, h: 0.9, seats: 0, color: "#f2b880" },
      { type: "cabc3", name: "Round", shape: "round", tw: 0.8, td: 0.8, seats: 4, color: "#9fc48d", h: 0.76, w: 1.8, d: 1.8 },
    ];
    for (const c of items) expect(sanitizeCustom(clone(c))).toEqual(c);
  });

  it("a whole store with versions, settings and seen tips", () => {
    const A = clone(EXAMPLES.A!);
    const store = {
      active: "Lab12", order: ["Lab12"], slots: { Lab12: A }, custom: [], seen: { intro: true, scale_sAdult: false },
      versions: { Lab12: [{ id: "vlab", name: "More booths", time: 1_763_000_000_000, count: 3, seats: 8, sum: "8 seats", data: JSON.stringify(A) }] },
      settings: { win: { sillMin: 0, sillMax: 2.4, minH: 0.3, gap: 0.2, wMin: 0.5, wMax: 4, step: 0.05 }, roomNames: ["Bakery"] },
    };
    const s = sanitizeStore(clone(store))!;
    expect(s.active).toBe("Lab12");
    expect(s.order).toEqual(["Lab12"]);
    expect(comparable(s.slots!.Lab12!)).toEqual(comparable(A));
    expect(s.versions!.Lab12).toEqual(store.versions.Lab12);
    expect(s.settings).toEqual(store.settings);
    expect(s.seen).toEqual(store.seen);
  });
});

describe("script injection is removed", () => {
  it("colours must be #hex", () => {
    expect(isColor("#abc")).toBe(true);
    expect(isColor("#A1b2C3")).toBe(true);
    for (const bad of [XSS, "red", "#12", "#1234567", "url(x)", "#fff;background:url(//e)", 7, null]) expect(isColor(bad)).toBe(false);
  });

  it("ids are plain and never an Object built-in", () => {
    expect(isId("L1x-y_2")).toBe(true);
    for (const bad of [XSS, "", "a".repeat(41), "__proto__", "constructor", "prototype", "toString", "hasOwnProperty", "__defineGetter__", "a b", 1]) expect(isId(bad)).toBe(false);
  });

  it("drops attack strings from every field that reaches HTML", () => {
    const s = sanitizeStore({
      active: XSS, order: ["A", XSS], slots: {
        A: { room: { w: 8, d: 10, h: 3, door: 0 }, palette: XSS, warmth: 0.5, type: XSS,
          items: [{ type: "two", x: 0, z: 0, r: 0, color: XSS }, { type: XSS, x: 0, z: 0, r: 0 }],
          areas: [{ id: XSS, name: XSS, kind: XSS, finish: XSS, x0: 0, x1: 2, z0: 0, z1: 2 }],
          windows: [{ id: XSS, x: 0, z: 5, w: 1, kind: XSS }] },
        [XSS]: { room: {}, palette: "matcha", warmth: 0, items: [] },
      },
      custom: [{ type: XSS, name: "x", shape: "block", w: 1, d: 1, h: 1, seats: 0 }, { type: "cok", name: XSS, shape: XSS, w: 1, d: 1, h: 1, seats: 0, color: XSS }],
      versions: { A: [{ id: XSS, name: XSS, time: 0, count: XSS, seats: 0, sum: XSS, data: "{}" }] },
      seen: { [XSS]: true }, settings: { roomNames: [XSS] },
    })!;
    expect(s.active).toBe("A");
    expect(s.order).toEqual(["A"]);
    expect(Object.keys(s.slots!)).toEqual(["A"]);
    const L = s.slots!.A!;
    expect(L.palette in PALETTES).toBe(true);
    expect(L.type).toBe("cafe");
    expect(L.items).toHaveLength(1);
    expect(L.items[0]!.color).toBeUndefined();
    expect(isId(L.areas![0]!.id)).toBe(true);
    expect(L.areas![0]!.kind).toBe("general");
    expect(L.areas![0]!.finish).toBe("layout");
    expect(isId(L.windows![0]!.id)).toBe(true);
    expect(L.windows![0]!.kind).toBe("window");
    expect(s.custom).toHaveLength(1);
    expect(s.custom![0]!.shape).toBe("block");
    expect(s.custom![0]!.color).toBeUndefined();
    const v = s.versions!.A![0]!;
    expect(isId(v.id)).toBe(true);
    expect(v.count).toBe(0);
    expect(s.seen).toEqual({});
    // Free text (names) is kept as text: it is escaped where it's shown, and never used as a key or attribute name.
    expect(L.areas![0]!.name).toBe(XSS);
  });

  it("a custom item can't take over a built-in piece's type", () => {
    const type = Object.keys(BY)[0]!;
    expect(sanitizeCustom({ type, name: "x", shape: "block", w: 1, d: 1, h: 1, seats: 0 })).toBeNull();
  });
});

describe("broken or hostile data can't stop the app starting", () => {
  it("non-objects give a fresh start", () => {
    for (const v of [null, 1, "x", [], {}, { slots: [] }, { slots: null }]) expect(sanitizeStore(v)).toBeNull();
  });

  it("__proto__ and other built-in names never become keys or kinds", () => {
    const raw = JSON.parse(`{"active":"__proto__","order":["__proto__","toString","A"],"slots":{
      "__proto__":{"room":{},"palette":"matcha","warmth":0,"items":[]},
      "toString":{"room":{},"palette":"matcha","warmth":0,"items":[]},
      "A":{"room":{},"palette":"__proto__","warmth":0,"type":"__proto__","items":[{"type":"toString","x":0,"z":0,"r":0}],
           "areas":[{"id":"a1","name":"n","kind":"constructor","finish":"__proto__","x0":0,"x1":2,"z0":0,"z1":2,"div":{"n":{"kind":"__proto__","gap":0}}}]}},
      "versions":{"__proto__":[]}}`) as unknown;
    const s = sanitizeStore(raw)!;
    expect(Object.keys(s.slots!)).toEqual(["A"]);
    expect(Object.getPrototypeOf(s.slots)).toBeNull();
    expect(s.order).toEqual(["A"]);
    expect(s.active).toBe("A");
    const L = s.slots!.A!;
    expect(L.type).toBe("cafe");
    expect(L.palette in PALETTES).toBe(true);
    expect(L.items).toEqual([]);
    expect(L.areas![0]!.kind).toBe("general");
    expect(L.areas![0]!.finish).toBe("layout");
    expect(L.areas![0]!.div).toEqual({});
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
  });

  it("numbers are finite and in range", () => {
    expect(num(NaN, 0, 1, 0.5)).toBe(0.5);
    expect(num(Infinity, 0, 1, 0.5)).toBe(0.5);
    expect(num(1e9, 4, 20, 8)).toBe(20);
    expect(num("3", 0, 10, 1)).toBe(1);
    const L = sanitizeLayout({ room: { w: 1e9, d: -5, h: NaN, door: 9 }, palette: "matcha", warmth: 7, items: [{ type: "two", x: 1e9, z: -1e9, r: 725, sx: 0 }] })!;
    expect(L.room).toEqual({ w: 20, d: 4, h: 3.2, door: 1 });
    expect(L.warmth).toBe(1);
    expect(L.items[0]).toMatchObject({ x: 50, z: -50, r: 720, sx: 0.05 });
  });

  it("areas that are empty or inside-out are dropped", () => {
    const L = sanitizeLayout({ room: {}, palette: "matcha", warmth: 0, items: [], areas: [{ id: "a", x0: 2, x1: 1, z0: 0, z1: 1 }, { id: "b", x0: "0", x1: 1, z0: 0, z1: 1 }] })!;
    expect(L.areas).toEqual([]);
  });

  it("lists are capped so a huge file can't freeze the tab", () => {
    const items = Array.from({ length: LIMITS.items + 500 }, () => ({ type: "two", x: 0, z: 0, r: 0 }));
    expect(sanitizeLayout({ room: {}, palette: "matcha", warmth: 0, items })!.items).toHaveLength(LIMITS.items);
    const big = sanitizeStore({ slots: {}, versions: {}, custom: Array.from({ length: LIMITS.custom + 10 }, (_, k) => ({ type: "c" + k, name: "x", w: 1, d: 1, h: 1, seats: 0 })) })!;
    expect(big.custom).toHaveLength(LIMITS.custom);
  });

  it("damaged version data is refused instead of crashing", () => {
    expect(parseVersionData("{not json")).toBeNull();
    expect(parseVersionData("null")).toBeNull();
    expect(parseVersionData(JSON.stringify(EXAMPLES.B))).not.toBeNull();
    const s = sanitizeStore({ slots: { A: EXAMPLES.A }, versions: { A: [{ id: "v1", name: "x", time: 0, count: 0, seats: 0 }, { id: "v2", name: "y", time: 0, count: 0, seats: 0, data: "x".repeat(LIMITS.versionData + 1) }] } })!;
    expect(s.versions!.A).toBeUndefined();
  });

  it("versions of layouts that don't exist are dropped", () => {
    const s = sanitizeStore({ slots: { A: EXAMPLES.A }, versions: { Z: [{ id: "v", name: "x", time: 0, count: 0, seats: 0, data: "{}" }] } })!;
    expect(Object.keys(s.versions!)).toEqual([]);
  });
});
