// Floor areas: named rectangles of shop floor with their own kind, finish and low dividers.
// Pure maths, no DOM, so it can be unit-tested.
import type { Area, AreaKind, BBox, Divider, DividerKind, DividerRect, ItemDef, Layout, Placed, Side } from "../types";
import { dims } from "./items";

export const GAP = 1.2;
export const MIN_SIDE = 1;

export const AREA_KINDS: Record<AreaKind, { name: string; note: string }> = {
  cafe: { name: "Café", note: "count seats" },
  books: { name: "Books", note: "count metres of shelving" },
  retail: { name: "Retail", note: "count display fixtures" },
  general: { name: "General", note: "have no count" },
};
export const AREA_NAME_SUGGESTIONS = ["Café", "Books", "Retail", "Kids corner", "Lounge", "Gift corner", "Queue", "Entrance"];

export const DIVIDERS: Record<DividerKind, { name: string; h: number; t: number }> = {
  wall: { name: "Half-height wall", h: 1.1, t: 0.12 },
  planter: { name: "Planter box", h: 0.9, t: 0.4 },
  bookcase: { name: "Low bookcase", h: 1.0, t: 0.35 },
};
export const SIDES: Side[] = ["n", "s", "w", "e"];
export const SIDE_NAMES: Record<Side, string> = { n: "Back", s: "Front", w: "Left", e: "Right" };

export const areaSize = (a: BBox): number => (a.x1 - a.x0) * (a.z1 - a.z0);
const overlaps = (a: BBox, b: BBox, e = 1e-6): boolean => a.x0 < b.x1 - e && b.x0 < a.x1 - e && a.z0 < b.z1 - e && b.z0 < a.z1 - e;

/** One side of an area as a line: along x (n/s) or z (w/e), from a to b at c. */
export function sideLine(a: BBox, s: Side): { ax: "x" | "z"; c: number; a: number; b: number } {
  if (s === "n" || s === "s") return { ax: "x", c: s === "n" ? a.z0 : a.z1, a: a.x0, b: a.x1 };
  return { ax: "z", c: s === "w" ? a.x0 : a.x1, a: a.z0, b: a.z1 };
}
/** Centre of a divider's opening along its side, or null when it has none or the side is too short for one. */
export function gapCentre(a: BBox, s: Side, d: Divider): number | null {
  const L = sideLine(a, s), len = L.b - L.a;
  if (d.gap == null || len < GAP + 0.2) return null;
  return (L.a + L.b) / 2 + Math.max(-1, Math.min(1, d.gap)) * (len / 2 - GAP / 2);
}
/** The gap parameter that puts an opening's centre at `along`. */
export function gapAt(a: BBox, s: Side, along: number): number {
  const L = sideLine(a, s), half = (L.b - L.a) / 2 - GAP / 2;
  if (half <= 0) return 0;
  return Math.round(Math.max(-1, Math.min(1, (along - (L.a + L.b) / 2) / half)) * 100) / 100;
}

/** The boxes a layout's dividers stand as: each side split around its opening. */
export function dividerRects(areas: Area[] | undefined): DividerRect[] {
  const out: DividerRect[] = [];
  for (const A of areas ?? [])
    for (const s of SIDES) {
      const d = A.div?.[s];
      if (!d) continue;
      const L = sideLine(A, s), D = DIVIDERS[d.kind], g = gapCentre(A, s, d);
      const spans: [number, number][] = g == null ? [[L.a, L.b]] : [[L.a, g - GAP / 2], [g + GAP / 2, L.b]];
      for (const [p, q] of spans) {
        if (q - p < 0.1) continue;
        const r = L.ax === "x" ? { x0: p, x1: q, z0: L.c - D.t / 2, z1: L.c + D.t / 2 } : { x0: L.c - D.t / 2, x1: L.c + D.t / 2, z0: p, z1: q };
        out.push({ ...r, kind: d.kind, h: D.h, ax: L.ax, area: A.id, side: s });
      }
    }
  return out;
}

/** An area is valid when it is at least 1 m each way, lies on the shop floor and overlaps no other area. */
export function areaFits(a: BBox, id: string, areas: Area[], onShopFloor: (b: BBox) => boolean): boolean {
  if (a.x1 - a.x0 < MIN_SIDE - 1e-6 || a.z1 - a.z0 < MIN_SIDE - 1e-6) return false;
  if (!onShopFloor(a)) return false;
  return !areas.some((o) => o.id !== id && overlaps(a, o));
}

/**
 * Move from `from` towards `to` as far as `ok` allows: areas push against each other's edges and the walls.
 * Each coordinate is tried on its own, so an area can slide along an edge it meets.
 */
export function pushTowards(from: BBox, to: BBox, ok: (b: BBox) => boolean, snap = 0.05): BBox {
  let cur = { ...from };
  const keys: (keyof BBox)[][] = [["x0", "x1"], ["z0", "z1"]];
  for (const pair of keys) {
    const cand = { ...cur };
    for (const k of pair) cand[k] = to[k];
    if (ok(cand)) {
      cur = cand;
      continue;
    }
    let lo = 0, hi = 1;
    for (let i = 0; i < 20; i++) {
      const m = (lo + hi) / 2, t = { ...cur };
      for (const k of pair) t[k] = cur[k] + (to[k] - cur[k]) * m;
      if (ok(t)) lo = m;
      else hi = m;
    }
    const t = { ...cur };
    for (const k of pair) t[k] = cur[k] + (to[k] - cur[k]) * lo;
    // snap to the grid where that still fits; otherwise keep the exact edge it met
    for (const k of pair) {
      const r = Math.round(Math.round(t[k] / snap) * snap * 1000) / 1000;
      if (ok({ ...t, [k]: r })) t[k] = r;
    }
    if (ok(t)) cur = t;
  }
  return cur;
}

/** The area under a point, if any. */
export const areaAt = (areas: Area[] | undefined, x: number, z: number): Area | undefined =>
  (areas ?? []).find((a) => x >= a.x0 && x <= a.x1 && z >= a.z0 && z <= a.z1);

const key = (n: string) => n.trim().toLowerCase();
export interface AreaSummary {
  name: string;
  kind: AreaKind;
  ids: string[];
  size: number;
  pieces: number;
  seats: number;
  shelving: number;
  fixtures: number;
}
/** Areas grouped by name (rectangles sharing a name count as one), with the pieces whose centre lies in them. */
export function areaSummaries(L: Layout, cat: (t: string) => ItemDef): AreaSummary[] {
  const groups = new Map<string, AreaSummary>();
  for (const a of L.areas ?? []) {
    const k = key(a.name) || a.id;
    const g = groups.get(k) ?? { name: a.name.trim() || "Unnamed area", kind: a.kind, ids: [], size: 0, pieces: 0, seats: 0, shelving: 0, fixtures: 0 };
    g.ids.push(a.id);
    g.size += areaSize(a);
    groups.set(k, g);
  }
  for (const i of L.items as Placed[]) {
    const a = areaAt(L.areas, i.x, i.z);
    if (!a) continue;
    const g = groups.get(key(a.name) || a.id)!, c = cat(i.type);
    g.pieces++;
    g.seats += c.seats || 0;
    g.fixtures += c.fix || 0;
    if (c.shelf) g.shelving += c.shelf * dims(i, cat).w;
  }
  for (const g of groups.values()) {
    g.size = Math.round(g.size * 10) / 10;
    g.shelving = Math.round(g.shelving * 10) / 10;
  }
  return [...groups.values()];
}
/** "12 seats", "8.4 m shelving", "5 fixtures", or "" for a General area. */
export function areaCountText(g: AreaSummary): string {
  const n = (v: number, one: string, many: string) => `${v} ${v === 1 ? one : many}`;
  if (g.kind === "cafe") return n(g.seats, "seat", "seats");
  if (g.kind === "books") return `${String(g.shelving).replace(/\.0$/, "")} m shelving`;
  if (g.kind === "retail") return n(g.fixtures, "fixture", "fixtures");
  return "";
}

/** Keep areas on the shop floor after the room changes: clip each to the shop floor's outer bounds, never below 1 m. */
export function clipAreas(areas: Area[] | undefined, floor: BBox): boolean {
  let changed = false;
  for (const a of areas ?? []) {
    const n = { x0: Math.max(a.x0, floor.x0), x1: Math.min(a.x1, floor.x1), z0: Math.max(a.z0, floor.z0), z1: Math.min(a.z1, floor.z1) };
    if (n.x1 - n.x0 < MIN_SIDE) [n.x0, n.x1] = a.x1 - a.x0 < MIN_SIDE ? [a.x0, a.x1] : a.x0 < floor.x0 ? [floor.x0, floor.x0 + MIN_SIDE] : [floor.x1 - MIN_SIDE, floor.x1];
    if (n.z1 - n.z0 < MIN_SIDE) [n.z0, n.z1] = a.z1 - a.z0 < MIN_SIDE ? [a.z0, a.z1] : a.z0 < floor.z0 ? [floor.z0, floor.z0 + MIN_SIDE] : [floor.z1 - MIN_SIDE, floor.z1];
    if (n.x0 !== a.x0 || n.x1 !== a.x1 || n.z0 !== a.z0 || n.z1 !== a.z1) {
      Object.assign(a, n);
      changed = true;
    }
  }
  return changed;
}
