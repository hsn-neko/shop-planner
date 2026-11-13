import { describe, expect, it } from "vitest";
import { BY, CAT, DEF_WIN, EXAMPLES } from "../../src/data/catalog";
import { collides, dims, findClashes, footprint, itemHeight, tableChairs } from "../../src/geometry/items";
import { computeGeo, defaultBoh } from "../../src/geometry/rooms";
import type { ItemDef, Layout, Placed } from "../../src/types";

const custom: ItemDef = { type: "c_tab", name: "Round table", w: 0.8, d: 0.8, h: 0.75, seats: 4, shape: "round", tw: 0.8, td: 0.8 };
const cat = (t: string): ItemDef => BY[t] ?? custom;
const block = CAT.find((c) => !c.seats && c.shape !== "round" && c.shape !== "square" && c.w !== c.d)!;
let nid = 1;
const put = (type: string, x: number, z: number, r = 0, extra: Partial<Placed> = {}): Placed => ({ id: nid++, type, x, z, r, ...extra });
const room = (): Layout => ({ room: { w: 8, d: 10, h: 3.2, door: 0 }, palette: "matcha", warmth: 0.5, items: [], boh: defaultBoh(), windows: [] });

describe("footprints", () => {
  it("stretches width and depth", () => {
    expect(dims(put(block.type, 0, 0, 0, { sx: 2, sz: 0.5 }), cat)).toEqual({ w: block.w * 2, d: block.d * 0.5 });
  });
  it("swaps half-sizes when turned 90°", () => {
    const a = footprint(put(block.type, 0, 0, 0), cat), b = footprint(put(block.type, 0, 0, 90), cat);
    expect(b.hw).toBeCloseTo(a.hd);
    expect(b.hd).toBeCloseTo(a.hw);
  });
  it("grows the box at 45°", () => {
    const f = footprint(put(block.type, 0, 0, 45), cat);
    expect(f.hw).toBeCloseTo(((block.w + block.d) * Math.SQRT1_2) / 2);
  });
  it("counts chair backs for custom tables and stretch for the rest", () => {
    expect(itemHeight(put("c_tab", 0, 0), cat)).toBe(0.91);
    expect(itemHeight(put(block.type, 0, 0, 0, { sy: 2 }), cat)).toBeCloseTo(block.h * 2);
  });
});

describe("findClashes", () => {
  const G = computeGeo(room(), DEF_WIN);
  it("is empty for pieces apart inside the room", () => {
    expect(findClashes([put(block.type, -2, 0), put(block.type, 2, 0)], G, cat).size).toBe(0);
  });
  it("flags both pieces when they overlap", () => {
    const a = put(block.type, 0, 0), b = put(block.type, 0.1, 0);
    expect([...findClashes([a, b], G, cat)].sort()).toEqual([a.id, b.id].sort());
  });
  it("flags a piece poking through a wall", () => {
    const a = put(block.type, 4, 0);
    expect(findClashes([a], G, cat).has(a.id)).toBe(true);
  });
  it("treats pieces that only touch as fine", () => {
    const a = put(block.type, 0, 0), b = put(block.type, block.w, 0);
    expect(findClashes([a, b], G, cat).size).toBe(0);
  });
  it("finds no clashes in the presets", () => {
    for (const E of Object.values(EXAMPLES)) {
      const L = JSON.parse(JSON.stringify(E)) as Layout;
      L.items.forEach((i, k) => (i.id = k + 1));
      expect(findClashes(L.items, computeGeo(L, DEF_WIN), cat).size, E.label).toBe(0);
    }
  });
});

describe("collides and tableChairs", () => {
  it("ignores the piece itself", () => {
    const a = put(block.type, 0, 0);
    expect(collides(a, [a], cat)).toBe(false);
    expect(collides(a, [a, put(block.type, 0, 0)], cat)).toBe(true);
  });
  it("spaces chairs evenly around a round table", () => {
    const ch = tableChairs(custom);
    expect(ch).toHaveLength(4);
    for (const [x, z] of ch) expect(Math.hypot(x, z)).toBeCloseTo(0.4 + 0.32);
  });
});
