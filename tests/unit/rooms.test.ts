import { describe, expect, it } from "vitest";
import { DEF_WIN, EXAMPLES } from "../../src/data/catalog";
import { cafeCuts, canWalk, computeGeo, defaultBoh, shapeOf, WT } from "../../src/geometry/rooms";
import type { Boh, Layout, Room, Wall } from "../../src/types";

const lim = { ...DEF_WIN };
const clone = <T>(o: T): T => JSON.parse(JSON.stringify(o)) as T;
function layout(room: Partial<Room> = {}, boh: Partial<Boh> | null = null, windows: Layout["windows"] = []): Layout {
  return { room: { w: 8, d: 10, h: 3.2, door: 0, ...room }, palette: "matcha", warmth: 0.5, items: [], boh: { ...defaultBoh(), ...(boh ?? {}) }, windows };
}
const areaOf = (L: Layout, id = "cafe") => computeGeo(L, lim).rooms.find((r) => r.id === id)?.area ?? 0;
const openings = (walls: Wall[], kind: string) => walls.flatMap((W) => W.open.filter((o) => o.kind === kind).map((o) => ({ W, o })));

describe("shapeOf", () => {
  it("fills shape defaults on the room itself", () => {
    const r: Room = { w: 8, d: 10, h: 3, door: 0 };
    const full = shapeOf(r);
    expect(full).toBe(r);
    expect(r).toMatchObject({ shape: "rect", cwf: 0.5, cdf: 0.5, corner: "fl", cside: "front" });
  });
});

describe("cafeCuts", () => {
  it("cuts nothing from a rectangle", () => {
    expect(cafeCuts({ w: 8, d: 10, h: 3, door: 0 })).toEqual([]);
  });
  it("cuts one corner for an L shape", () => {
    const [k, ...rest] = cafeCuts({ w: 8, d: 10, h: 3, door: 0, shape: "L", corner: "bl", cwf: 0.5, cdf: 0.4 });
    expect(rest).toHaveLength(0);
    expect(k).toEqual({ x0: -4, x1: 0, z0: -5, z1: -1 });
  });
  it("cuts both ends for a T shape and the middle for a U shape", () => {
    expect(cafeCuts({ w: 8, d: 10, h: 3, door: 0, shape: "T", cside: "back", cwf: 0.5, cdf: 0.5 })).toHaveLength(2);
    const [u] = cafeCuts({ w: 8, d: 10, h: 3, door: 0, shape: "U", cside: "front", cwf: 0.5, cdf: 0.5 });
    expect(u).toEqual({ x0: -2, x1: 2, z0: 0, z1: 5 });
  });
  it("always leaves at least 1.5 m of floor", () => {
    const [k] = cafeCuts({ w: 8, d: 10, h: 3, door: 0, shape: "L", cwf: 0.99, cdf: 0.99 });
    expect(k!.x1 - k!.x0).toBeCloseTo(6.5);
    expect(k!.z1 - k!.z0).toBeCloseTo(8.5);
  });
});

describe("computeGeo: rooms and walls", () => {
  it("makes a rectangle with four outside walls offset outward", () => {
    const G = computeGeo(layout(), lim);
    expect(G.rooms.map((r) => r.id)).toEqual(["cafe"]);
    expect(G.rooms[0]!.area).toBeCloseTo(80);
    expect(G.walls).toHaveLength(4);
    expect(G.walls.every((W) => W.ext)).toBe(true);
    const front = G.walls.find((W) => W.ax === "x" && W.nrm === 1)!;
    expect(front.c).toBeCloseTo(5 + WT / 2);
    // convex corners are extended so the walls meet
    expect(front.a).toBeCloseTo(-4 - WT);
    expect(front.b).toBeCloseTo(4 + WT);
    expect(G.bbox).toEqual({ x0: -4, x1: 4, z0: -5, z1: 5 });
  });

  it("removes the cut-out from the floor area for L, T and U shapes", () => {
    expect(areaOf(layout({ shape: "L", cwf: 0.5, cdf: 0.4 }))).toBeCloseTo(80 - 4 * 4);
    expect(areaOf(layout({ shape: "T", cwf: 0.5, cdf: 0.5 }))).toBeCloseTo(80 - 2 * 2 * 5);
    expect(areaOf(layout({ shape: "U", cwf: 0.5, cdf: 0.5 }))).toBeCloseTo(80 - 4 * 5);
  });

  it("gives an L shape six outside walls", () => {
    expect(computeGeo(layout({ shape: "L" }), lim).walls.filter((W) => W.ext)).toHaveLength(6);
  });

  it("adds a kitchen behind the shop with an inside wall on the kitchen side", () => {
    const G = computeGeo(layout({}, { mode: "kitchen", side: "back", depth: 3 }), lim);
    const k = G.rooms.find((r) => r.id === "kitchen")!;
    expect(k.area).toBeCloseTo(8 * (3 + WT));
    expect(k.z1).toBeCloseTo(-5);
    const inside = G.walls.filter((W) => !W.ext);
    expect(inside).toHaveLength(1);
    // shifted towards the kitchen so the shop keeps its full depth
    expect(inside[0]!.c).toBeCloseTo(-5 - WT / 2);
    expect(G.rooms.find((r) => r.id === "cafe")!.area).toBeCloseTo(80);
  });

  it("splits kitchen and storage by share, and swap flips them", () => {
    const L = layout({}, { mode: "both", side: "right", depth: 2.5, share: 0.6 });
    const G = computeGeo(L, lim);
    const k = G.rooms.find((r) => r.id === "kitchen")!, s = G.rooms.find((r) => r.id === "storage")!;
    expect(k.area / (k.area + s.area)).toBeCloseTo(0.6);
    expect(k.x0).toBeCloseTo(4);
    L.boh!.swap = true;
    const G2 = computeGeo(L, lim);
    const k2 = G2.rooms.find((r) => r.id === "kitchen")!;
    // same share, but the kitchen moves to the other end of the strip
    expect(k2.area).toBeCloseTo(k.area);
    expect(k.z0).toBeCloseTo(-5);
    expect(k2.z1).toBeCloseTo(5);
  });
});

describe("computeGeo: doors and hatch", () => {
  it("puts the entrance on the front wall and moves it with the door slider", () => {
    const mid = computeGeo(layout({ door: 0 }), lim).entrance;
    const left = computeGeo(layout({ door: -1 }), lim).entrance;
    const right = computeGeo(layout({ door: 1 }), lim).entrance;
    expect(mid.x).toBeCloseTo(0);
    expect(left.x).toBeLessThan(mid.x);
    expect(right.x).toBeGreaterThan(mid.x);
    // stays at least half its width plus a margin from the corners
    expect(right.x).toBeCloseTo(4 - 0.6 - 0.15);
    expect(mid.W!.nrm).toBe(1);
  });

  it("adds a kitchen door, a hatch and a delivery door", () => {
    const G = computeGeo(layout({}, { mode: "kitchen", side: "back", door: -0.5, hatch: true, backDoor: true }), lim);
    const doors = openings(G.walls, "door");
    expect(doors.filter(({ o }) => o.role === "kdoor")).toHaveLength(1);
    expect(doors.filter(({ o }) => o.label === "Delivery door")).toHaveLength(1);
    const hatch = openings(G.walls, "hatch");
    expect(hatch).toHaveLength(1);
    expect(hatch[0]!.o.sill).toBeCloseTo(0.9);
  });

  it("leaves out the hatch and delivery door when switched off", () => {
    const G = computeGeo(layout({}, { mode: "kitchen", hatch: false, backDoor: false }), lim);
    expect(openings(G.walls, "hatch")).toHaveLength(0);
    expect(openings(G.walls, "door")).toHaveLength(1);
  });

  it("joins kitchen and storage with a door, plus an optional shop-to-storage door", () => {
    const G = computeGeo(layout({}, { mode: "both", storeDoor: true, backDoor: false }), lim);
    expect(openings(G.walls, "door")).toHaveLength(3);
  });
});

describe("computeGeo: windows", () => {
  it("adds a shopfront window to a layout that has none yet, with an id", () => {
    const L = layout();
    delete L.windows;
    const G = computeGeo(L, lim);
    expect(L.windows).toHaveLength(1);
    expect(L.windows![0]!.kind).toBe("shopfront");
    expect(L.windows![0]!.id).toBeTruthy();
    expect(G.windows).toHaveLength(1);
  });

  it("keeps an empty window list empty", () => {
    expect(computeGeo(layout(), lim).windows).toHaveLength(0);
  });

  it("snaps a window to the nearest outside wall", () => {
    const G = computeGeo(layout({}, null, [{ id: "a", x: 3.2, z: 0.5, w: 1.5, kind: "window" }]), lim);
    const q = G.windows[0]!;
    expect(q.W.ax).toBe("z");
    expect(q.W.nrm).toBe(1);
    expect(q.o.c).toBeCloseTo(0.5);
  });

  it("steps aside from the entrance", () => {
    const G = computeGeo(layout({ door: 0 }, null, [{ id: "a", x: 0, z: 5, w: 1.5, kind: "window" }]), lim);
    const q = G.windows[0]!, e = G.entrance.o!;
    expect(Math.abs(q.o.c - e.c)).toBeGreaterThanOrEqual((e.w + q.o.w) / 2 + 0.1 - 1e-9);
  });

  it("clamps width, sill and top to the limits", () => {
    const L = layout({ h: 3 }, null, [{ id: "a", x: 0, z: -5, w: 9, kind: "window", sill: -1, head: 5 }]);
    const G = computeGeo(L, lim);
    expect(L.windows![0]!.w).toBe(lim.wMax);
    const o = G.windows[0]!.o;
    expect(o.sill).toBe(lim.sillMin);
    expect(o.head).toBeCloseTo(3 - lim.gap);
  });

  it("uses the type's preset height when no custom height is set", () => {
    const o = computeGeo(layout({}, null, [{ id: "a", x: 0, z: -5, w: 1, kind: "high" }]), lim).windows[0]!.o;
    expect(o.head - o.sill).toBeGreaterThanOrEqual(lim.minH);
    expect(o.sill).toBeGreaterThan(1);
  });

  it("drops a window that fits on no wall", () => {
    const G = computeGeo(layout({ w: 4, d: 4 }, null, [{ id: "a", x: 0, z: 2, w: 4, kind: "window" }]), { ...lim, wMax: 10 });
    expect(G.windows).toHaveLength(0);
  });
});

describe("cellAt, rectIn and canWalk", () => {
  // front-left corner cut away: x -4..0, z 0..5
  const G = computeGeo(layout({ shape: "L", corner: "fl", cwf: 0.5, cdf: 0.5 }, { mode: "kitchen", side: "back", depth: 3 }), lim);
  it("labels points by room", () => {
    expect(G.cellAt(-2, -2)).toBe("cafe");
    expect(G.cellAt(-2, 2)).toBeNull(); // the cut-out corner
    expect(G.cellAt(0, -6)).toBe("kitchen");
    expect(G.cellAt(20, 0)).toBeNull();
  });
  it("finds the single room a rectangle lies in", () => {
    expect(G.rectIn(-3, -1, -3, -1)).toBe("cafe");
    expect(G.rectIn(-1, 1, -6, -4)).toBeNull(); // straddles the kitchen wall
    expect(G.rectIn(-3, -1, 1, 3)).toBeNull(); // inside the cut-out
    expect(G.rectIn(-5, -3, 0, 1)).toBeNull(); // pokes outside
  });
  it("lets a walker pass through doors but not walls", () => {
    expect(canWalk(G, -2, -2)).toBe(true);
    const kd = G.walls.flatMap((W) => W.open.filter((o) => o.role === "kdoor").map((o) => ({ W, o })))[0]!;
    expect(canWalk(G, kd.o.c, kd.W.c)).toBe(true);
    expect(canWalk(G, -2, 2)).toBe(false);
  });
});

describe("presets", () => {
  it.each(Object.keys(EXAMPLES))("preset %s builds without lost windows", (k) => {
    const L = clone(EXAMPLES[k as keyof typeof EXAMPLES]);
    const G = computeGeo(L, lim);
    expect(G.rooms.length).toBeGreaterThan(0);
    expect(G.windows).toHaveLength(L.windows!.length);
  });
});
