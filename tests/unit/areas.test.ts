import { describe, expect, it } from "vitest";
import { BY, DEF_WIN, EXAMPLES } from "../../src/data/catalog";
import { countText, hatchName, SHOP_TYPES } from "../../src/data/shopTypes";
import {
  areaCountText, areaFits, areaSummaries, clipAreas, dividerRects, gapAt, gapCentre, GAP, pushTowards,
} from "../../src/geometry/areas";
import { findClashes } from "../../src/geometry/items";
import { canWalk, computeGeo } from "../../src/geometry/rooms";
import type { Area, BBox, Layout, Placed } from "../../src/types";

const cat = (t: string) => BY[t]!;
const area = (id: string, b: BBox, extra: Partial<Area> = {}): Area => ({ id, name: id, kind: "general", finish: "layout", ...b, ...extra });
const room = (areas: Area[], items: Placed[] = []): Layout => ({ type: "mixed", room: { w: 8, d: 10, h: 3.2, door: 0 }, palette: "matcha", warmth: 0.5, items, areas, windows: [] });
let nid = 1;
const put = (type: string, x: number, z: number): Placed => ({ id: nid++, type, x, z, r: 0 });

describe("dividers", () => {
  const A = area("a", { x0: -4, x1: 4, z0: 0, z1: 5 }, { div: { n: { kind: "wall", gap: 0 } } });
  it("splits a side around a 1.2 m opening", () => {
    const d = dividerRects([A]);
    expect(d).toHaveLength(2);
    expect(d[0]!.x1).toBeCloseTo(-GAP / 2);
    expect(d[1]!.x0).toBeCloseTo(GAP / 2);
    expect(d[0]!.z0).toBeCloseTo(-0.06);
    expect(d[0]!.h).toBe(1.1);
  });
  it("runs the whole side with no opening", () => {
    expect(dividerRects([{ ...A, div: { w: { kind: "planter", gap: null } } }])).toEqual([expect.objectContaining({ z0: 0, z1: 5, x0: -4.2, x1: -3.8, kind: "planter" })]);
  });
  it("slides the opening along the side, and back from a position", () => {
    expect(gapCentre(A, "n", { kind: "wall", gap: 1 })).toBeCloseTo(4 - GAP / 2);
    expect(gapCentre(A, "n", { kind: "wall", gap: -1 })).toBeCloseTo(-4 + GAP / 2);
    expect(gapAt(A, "n", 1.7)).toBeCloseTo(0.5);
    expect(gapAt(A, "n", 99)).toBe(1);
  });
  it("blocks furniture and walking like a wall", () => {
    const L = room([A], [put("plant", 2, 0), put("plant", 2, 2)]);
    const G = computeGeo(L, DEF_WIN);
    expect([...findClashes(L.items, G, cat)]).toEqual([L.items[0]!.id]);
    expect(canWalk(G, 2, 0)).toBe(false);
    expect(canWalk(G, 0, 0)).toBe(true); // through the opening
  });
});

describe("placing areas", () => {
  const onFloor = (b: BBox) => b.x0 >= -4 && b.x1 <= 4 && b.z0 >= -5 && b.z1 <= 5;
  const others = [area("b", { x0: 0, x1: 4, z0: -5, z1: 5 })];
  it("needs 1 m each way, the shop floor and no overlap", () => {
    expect(areaFits({ x0: -3, x1: -1, z0: 0, z1: 2 }, "a", others, onFloor)).toBe(true);
    expect(areaFits({ x0: -3, x1: -2.5, z0: 0, z1: 2 }, "a", others, onFloor)).toBe(false);
    expect(areaFits({ x0: -5, x1: -1, z0: 0, z1: 2 }, "a", others, onFloor)).toBe(false);
    expect(areaFits({ x0: -3, x1: 0.5, z0: 0, z1: 2 }, "a", others, onFloor)).toBe(false);
    expect(areaFits({ x0: -3, x1: 0, z0: 0, z1: 2 }, "a", others, onFloor)).toBe(true); // touching is fine
  });
  it("pushes against another area's edge and slides along it", () => {
    const ok = (b: BBox) => areaFits(b, "a", others, onFloor);
    const r = pushTowards({ x0: -3, x1: -1, z0: 0, z1: 2 }, { x0: 0, x1: 2, z0: 1, z1: 3 }, ok);
    expect(r.x1).toBeCloseTo(0);
    expect(r.x0).toBeCloseTo(-2);
    expect(r.z0).toBeCloseTo(1);
  });
  it("stops at the walls", () => {
    const ok = (b: BBox) => areaFits(b, "a", others, onFloor);
    expect(pushTowards({ x0: -3, x1: -1, z0: 0, z1: 2 }, { x0: -9, x1: -7, z0: 0, z1: 2 }, ok).x0).toBeCloseTo(-4);
  });
  it("clips areas to a smaller shop floor, never below 1 m", () => {
    const a = [area("a", { x0: -4, x1: 4, z0: 3, z1: 5 })];
    expect(clipAreas(a, { x0: -3, x1: 3, z0: -4, z1: 4 })).toBe(true);
    expect(a[0]).toMatchObject({ x0: -3, x1: 3, z0: 3, z1: 4 });
  });
});

describe("area counts", () => {
  it("groups rectangles by name and counts pieces by their centre", () => {
    const L = room([
      area("c1", { x0: -4, x1: 0, z0: -5, z1: 0 }, { name: "Café", kind: "cafe" }),
      area("c2", { x0: -4, x1: 0, z0: 0, z1: 2 }, { name: "café ", kind: "cafe" }),
      area("b", { x0: 0, x1: 4, z0: -5, z1: 5 }, { name: "Books", kind: "books" }),
    ], [put("four", -2, -2), put("two", -2, 1), put("bookcase", 2, 0), put("dblshelf", 2, 3), put("plant", -2, 4)]);
    const g = areaSummaries(L, cat);
    expect(g.map((q) => q.name)).toEqual(["Café", "Books"]);
    expect(g[0]).toMatchObject({ ids: ["c1", "c2"], size: 28, seats: 6, pieces: 2 });
    expect(areaCountText(g[0]!)).toBe("6 seats");
    expect(areaCountText(g[1]!)).toBe("3.4 m shelving");
  });
});

describe("mixed shops", () => {
  it("counts everything that isn't zero", () => {
    expect(countText(room([], [put("two", 0, 0), put("rail", 1, 1)]), cat)).toBe("2 seats · 1 fixture");
    expect(countText(room([]), cat)).toBe("Nothing counted yet");
  });
  it("calls the opening a serving hatch only when the first back room is a kitchen", () => {
    expect(hatchName(room([]))).toBe("Serving hatch");
    expect(hatchName({ ...room([]), names: { kitchen: "Stockroom" } })).toBe("Pass-through");
    expect(hatchName({ ...room([]), type: "books" })).toBe("Pass-through");
  });
  it.each(SHOP_TYPES.mixed.presets)("preset %s has valid, non-overlapping areas and no clashes", (k) => {
    const L = JSON.parse(JSON.stringify(EXAMPLES[k])) as Layout;
    L.items.forEach((i, n) => (i.id = n + 1));
    const G = computeGeo(L, DEF_WIN);
    const onFloor = (b: BBox) => G.rectIn(b.x0 + 1e-4, b.x1 - 1e-4, b.z0 + 1e-4, b.z1 - 1e-4) === "cafe";
    for (const a of L.areas!) expect(areaFits(a, a.id, L.areas!, onFloor)).toBe(true);
    expect(findClashes(L.items, G, cat).size).toBe(0);
    expect(areaSummaries(L, cat)).toHaveLength(2);
  });
});
