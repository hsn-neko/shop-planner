import { describe, expect, it } from "vitest";
import { BY, CAT, DEF_WIN, EXAMPLES, PALETTES } from "../../src/data/catalog";
import { BUILTIN_ROOM_NAMES, countsOf, countText, roomName, roomNameChoices, SHOP_TYPES, TYPE_ORDER, typeOf } from "../../src/data/shopTypes";
import { computeGeo } from "../../src/geometry/rooms";
import type { Layout, Placed, ShopType } from "../../src/types";

const cat = (t: string) => BY[t]!;
let nid = 1;
const put = (type: string, extra: Partial<Placed> = {}): Placed => ({ id: nid++, type, x: 0, z: 0, r: 0, ...extra });
const layout = (type: ShopType | undefined, items: Placed[] = [], extra: Partial<Layout> = {}): Layout =>
  ({ type, room: { w: 8, d: 10, h: 3.2, door: 0 }, palette: "matcha", warmth: 0.5, items, ...extra });

describe("shop types", () => {
  it("treats layouts saved before shop types as cafes", () => {
    expect(typeOf(layout(undefined))).toBe("cafe");
  });
  it("names the shop floor the same for every type", () => {
    for (const t of TYPE_ORDER) expect(roomName(layout(t), "cafe")).toBe("Shop floor");
  });
  it("uses each type's default back-room names", () => {
    expect([roomName(layout("cafe"), "kitchen"), roomName(layout("cafe"), "storage")]).toEqual(["Kitchen", "Storage"]);
    expect([roomName(layout("retail"), "kitchen"), roomName(layout("retail"), "storage")]).toEqual(["Stockroom", "Staff room"]);
    expect([roomName(layout("books"), "kitchen"), roomName(layout("books"), "storage")]).toEqual(["Stockroom", "Office"]);
  });
  it("lets a layout rename its back rooms", () => {
    const L = layout("books", [], { names: { storage: "Workroom" } });
    expect(roomName(L, "storage")).toBe("Workroom");
    expect(roomName(L, "kitchen")).toBe("Stockroom");
  });
  it("names rooms in the geometry from the layout", () => {
    const L = layout("retail", [], { boh: { mode: "both", side: "back", depth: 3, share: 0.6, swap: false, door: 0, hatch: true, storeDoor: false, backDoor: false } });
    const G = computeGeo(L, DEF_WIN);
    expect(G.rooms.map((r) => r.name)).toEqual(["Shop floor", "Stockroom", "Staff room"]);
    const hatch = G.walls.flatMap((W) => W.open).find((o) => o.kind === "hatch");
    expect(hatch?.label).toBe("Pass-through");
  });
  it("offers built-in names first, then added ones, without repeats", () => {
    expect(roomNameChoices(["Workroom", "Wrapping room"])).toEqual([...BUILTIN_ROOM_NAMES, "Wrapping room"]);
  });
});

describe("counts", () => {
  it("counts seats, display fixtures and metres of shelving", () => {
    const L = layout("books", [put("bookcase"), put("bookcase", { sx: 1.5 }), put("dblshelf"), put("bookspin"), put("rail"), put("two")]);
    expect(countsOf(L, cat)).toEqual({ seats: 2, fixtures: 1, shelving: 1 + 1.5 + 2.4 + 0.6 });
  });
  it("leads with the type's own count and adds others only when not zero", () => {
    const items = [put("bookcase"), put("two")];
    expect(countText(layout("books", items), cat)).toBe("1 m shelving · 2 seats");
    expect(countText(layout("cafe", items), cat)).toBe("2 seats · 1 m shelving");
    expect(countText(layout("retail", items), cat)).toBe("0 fixtures · 2 seats · 1 m shelving");
    expect(countText(layout("retail", [put("mannequin")]), cat)).toBe("1 fixture");
  });
  it("doesn't count fitting rooms, mirrors, desks or benches as fixtures", () => {
    expect(countsOf(layout("retail", ["fitting", "mirror", "cashdesk", "bench", "plinth"].map((t) => put(t))), cat).fixtures).toBe(0);
  });
});

describe("catalogue and presets", () => {
  it("has the spec's pieces for each type", () => {
    expect(CAT.filter((c) => c.kind === "retail")).toHaveLength(13);
    expect(CAT.filter((c) => c.kind === "books")).toHaveLength(11);
    expect(CAT.filter((c) => c.kind === "cafe")).toHaveLength(20);
  });
  it("has four palettes per type", () => {
    for (const t of TYPE_ORDER) expect(Object.values(PALETTES).filter((p) => p.kind === t)).toHaveLength(4);
  });
  it.each(TYPE_ORDER)("%s presets are of that type and start on a palette that exists", (t) => {
    expect(PALETTES[SHOP_TYPES[t].palette]).toBeDefined();
    for (const k of SHOP_TYPES[t].presets) {
      const E = EXAMPLES[k]!;
      expect(E.type).toBe(t);
      expect(PALETTES[E.palette]).toBeDefined();
      expect(E.items.every((i) => BY[i.type])).toBe(true);
    }
  });
  it("gives each new preset a non-zero headline count", () => {
    expect(countText(EXAMPLES.R1!, cat)).toMatch(/^[1-9]\d* fixtures$/);
    expect(countText(EXAMPLES.K1!, cat)).toMatch(/^[1-9][\d.]* m shelving$/);
  });
});
