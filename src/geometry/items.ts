// Footprints and clash checks for placed pieces. Pure: no DOM or Three.js.
import type { Geo, ItemDef, Placed } from "../types";

export type Lookup = (type: string) => ItemDef;

/** Width and depth of a placed piece after stretching. */
export function dims(i: Placed, cat: Lookup): { w: number; d: number } {
  const c = cat(i.type);
  return { w: c.w * (i.sx || 1), d: c.d * (i.sz || 1) };
}

/** Half-width and half-depth of the piece's axis-aligned bounding box at its rotation. */
export function footprint(i: Placed, cat: Lookup): { hw: number; hd: number } {
  const { w, d } = dims(i, cat), a = (i.r * Math.PI) / 180, cs = Math.abs(Math.cos(a)), sn = Math.abs(Math.sin(a));
  return { hw: (w * cs + d * sn) / 2, hd: (w * sn + d * cs) / 2 };
}

/** Height of a placed piece; tables count their chair backs. */
export function itemHeight(i: Placed, cat: Lookup): number {
  const c = cat(i.type);
  return c.shape === "round" || c.shape === "square" ? 0.91 : (c.h || 0.5) * (i.sy || 1);
}

/** Ids of pieces that overlap another piece, poke out of every room, or straddle a wall. */
export function findClashes(items: Placed[], geo: Geo, cat: Lookup): Set<number> {
  const bad = new Set<number>(), e = 0.01;
  const fp = items.map((i) => ({ i, ...footprint(i, cat) }));
  for (const a of fp) if (!geo.rectIn(a.i.x - a.hw + e, a.i.x + a.hw - e, a.i.z - a.hd + e, a.i.z + a.hd - e)) bad.add(a.i.id);
  for (let x = 0; x < fp.length; x++)
    for (let y = x + 1; y < fp.length; y++) {
      const a = fp[x]!, b = fp[y]!;
      if (Math.abs(a.i.x - b.i.x) < a.hw + b.hw - 0.01 && Math.abs(a.i.z - b.i.z) < a.hd + b.hd - 0.01) {
        bad.add(a.i.id);
        bad.add(b.i.id);
      }
    }
  return bad;
}

/** Whether a piece overlaps any other piece (used to find a free spot for new pieces). */
export function collides(n: Placed, items: Placed[], cat: Lookup): boolean {
  const a = footprint(n, cat);
  return items.some((o) => {
    if (o === n) return false;
    const b = footprint(o, cat);
    return Math.abs(n.x - o.x) < a.hw + b.hw && Math.abs(n.z - o.z) < a.hd + b.hd;
  });
}

/** Seat positions around a custom round or square table: [x, z, rotation]. */
export function tableChairs(c: ItemDef): [number, number, number][] {
  const out: [number, number, number][] = [], tw = c.tw ?? 0.8, td = c.td ?? 0.8;
  for (let k = 0; k < c.seats; k++) {
    const a = (k / c.seats) * Math.PI * 2 + (c.shape === "square" && c.seats === 4 ? Math.PI / 4 : 0);
    let x = Math.sin(a) * (tw / 2 + 0.32), z = -Math.cos(a) * (td / 2 + 0.32);
    if (c.shape === "square") {
      const s = Math.max(Math.abs(Math.sin(a)) / (tw / 2 + 0.32), Math.abs(Math.cos(a)) / (td / 2 + 0.32));
      x = Math.sin(a) / s;
      z = -Math.cos(a) / s;
    }
    out.push([x, z, Math.atan2(-x, -z)]);
  }
  return out;
}
