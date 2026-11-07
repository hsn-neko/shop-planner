// Room geometry: the shaped shop floor plus an optional kitchen/storage strip.
// Rooms are unions of grid cells; walls come from the boundaries between cells of different rooms.
// Pure functions: no DOM or Three.js, so they can be unit-tested.
import { ROOM_NAMES, WK } from "../data/catalog";
import type { Axis, BBox, Boh, Cell, Geo, Layout, Opening, PlacedWindow, Room, RoomId, RoomInfo, Wall, WinLimits } from "../types";

/** wall thickness */
export const WT = 0.12;

export function defaultBoh(): Boh {
  return { mode: "none", side: "back", depth: 3.5, share: 0.6, swap: false, door: 0, hatch: true, storeDoor: false, backDoor: true };
}

type FullRoom = Required<Room>;
/** Fill in shape defaults on a room (kept on the object so later edits start from them). */
export function shapeOf(r: Room): FullRoom {
  r.shape ??= "rect";
  r.cwf ??= 0.5;
  r.cdf ??= 0.5;
  r.corner ??= "fl";
  r.cside ??= "front";
  return r as FullRoom;
}

/** Rectangles cut out of the shop floor's bounding box for L, T and U shapes. */
export function cafeCuts(room: Room): BBox[] {
  const r = shapeOf(room), w = r.w, d = r.d, cd = Math.max(0.5, Math.min(r.cdf * d, d - 1.5));
  if (r.shape === "L") {
    const cw = Math.max(0.5, Math.min(r.cwf * w, w - 1.5)), lf = r.corner[1] === "l", bk = r.corner[0] === "b";
    return [{ x0: lf ? -w / 2 : w / 2 - cw, x1: lf ? -w / 2 + cw : w / 2, z0: bk ? -d / 2 : d / 2 - cd, z1: bk ? -d / 2 + cd : d / 2 }];
  }
  const bk = r.cside === "back", z0 = bk ? -d / 2 : d / 2 - cd, z1 = bk ? -d / 2 + cd : d / 2;
  if (r.shape === "T") {
    const cw = Math.max(0.5, Math.min(r.cwf * w / 2, (w - 1.5) / 2));
    return [{ x0: -w / 2, x1: -w / 2 + cw, z0, z1 }, { x0: w / 2 - cw, x1: w / 2, z0, z1 }];
  }
  if (r.shape === "U") {
    const cw = Math.max(0.5, Math.min(r.cwf * w, w - 2));
    return [{ x0: -cw / 2, x1: cw / 2, z0, z1 }];
  }
  return [];
}

const rnd4 = (v: number) => Math.round(v * 1e4) / 1e4;
interface RoomRect extends BBox { id: RoomId }
type Label = RoomId | null;

/**
 * Work out cells, walls, doors, windows and room summaries for a layout.
 * Fills in missing defaults on the layout (back-of-house settings, a first window, window ids)
 * and clamps window widths to the limits.
 */
export function computeGeo(L: Layout, lim: WinLimits): Geo {
  const r = shapeOf(L.room), { w, d } = r, t = WT;
  L.boh ??= defaultBoh();
  const B = L.boh;
  const R: RoomRect[] = [{ id: "cafe", x0: -w / 2, x1: w / 2, z0: -d / 2, z1: d / 2 }], cuts = cafeCuts(r);
  let far: { ax: Axis; nrm: number } | null = null;
  if (B.mode !== "none") {
    const side = B.side, Lw = side === "back" ? w : d, D = B.depth + t, L2 = Lw / 2;
    const nTo = (n: number) => (side === "back" ? -d / 2 - n : side === "left" ? -w / 2 - n : w / 2 + n);
    const rect = (u0: number, u1: number, id: RoomId): RoomRect => {
      const p = nTo(0), q = nTo(D), n0 = Math.min(p, q), n1 = Math.max(p, q);
      return side === "back" ? { id, x0: u0, x1: u1, z0: n0, z1: n1 } : { id, x0: n0, x1: n1, z0: u0, z1: u1 };
    };
    if (B.mode === "kitchen") R.push(rect(-L2, L2, "kitchen"));
    else {
      const fk = !B.swap, sf = fk ? B.share : 1 - B.share, us = -L2 + sf * Lw;
      R.push(rect(-L2, us, fk ? "kitchen" : "storage"), rect(us, L2, fk ? "storage" : "kitchen"));
    }
    far = side === "back" ? { ax: "x", nrm: -1 } : { ax: "z", nrm: side === "left" ? -1 : 1 };
  }

  // grid of cells, each labelled with its room (or null outside)
  const xs = [...new Set(R.flatMap((q) => [q.x0, q.x1]).concat(cuts.flatMap((q) => [q.x0, q.x1])).map(rnd4))].sort((a, b) => a - b);
  const zs = [...new Set(R.flatMap((q) => [q.z0, q.z1]).concat(cuts.flatMap((q) => [q.z0, q.z1])).map(rnd4))].sort((a, b) => a - b);
  const nx = xs.length - 1, nz = zs.length - 1, lab: Label[][] = [];
  const X = (i: number) => xs[i] as number, Z = (j: number) => zs[j] as number;
  for (let i = 0; i < nx; i++) {
    const col: Label[] = [];
    for (let j = 0; j < nz; j++) {
      const cx = (X(i) + X(i + 1)) / 2, cz = (Z(j) + Z(j + 1)) / 2;
      const q = R.find((q) => cx > q.x0 && cx < q.x1 && cz > q.z0 && cz < q.z1);
      let id: Label = q ? q.id : null;
      if (id === "cafe" && cuts.some((c) => cx > c.x0 && cx < c.x1 && cz > c.z0 && cz < c.z1)) id = null;
      col.push(id);
    }
    lab.push(col);
  }
  const at = (i: number, j: number): Label => (i < 0 || j < 0 || i >= nx || j >= nz ? null : (lab[i]?.[j] ?? null));
  const cellAt = (x: number, z: number): Label => {
    let i = -1, j = -1;
    for (let k = 0; k < nx; k++) if (x >= X(k) && x < X(k + 1)) i = k;
    for (let k = 0; k < nz; k++) if (z >= Z(k) && z < Z(k + 1)) j = k;
    return at(i, j);
  };
  const cells: Cell[] = [];
  for (let i = 0; i < nx; i++) for (let j = 0; j < nz; j++) {
    const id = at(i, j);
    if (id) cells.push({ id, x0: X(i), x1: X(i + 1), z0: Z(j), z1: Z(j + 1) });
  }

  // walls from boundaries
  const walls: Wall[] = [], e = 1e-3;
  const mk = (ax: Axis, line: number, a: number, b: number, neg: Label, pos: Label) => {
    const W: Wall = { ax, sa: a, sb: b, neg, pos, open: [], c: line, a, b, nrm: 1, ext: false, boh: !(neg === "cafe" || pos === "cafe") };
    if (!neg || !pos) {
      W.ext = true;
      W.nrm = neg ? 1 : -1;
      W.c = line + (W.nrm * t) / 2;
      W.room = (neg || pos) as RoomId;
      // convex corners get extended so the walls meet
      const conv = (x: number) => (ax === "x" ? cellAt(x, line - e) == null && cellAt(x, line + e) == null : cellAt(line - e, x) == null && cellAt(line + e, x) == null);
      W.a = a - (conv(a - e) ? t : 0);
      W.b = b + (conv(b + e) ? t : 0);
    } else {
      // inside walls sit on the back-room side so the shop floor keeps its full size
      const sh = neg === "cafe" ? 1 : pos === "cafe" ? -1 : 0;
      W.c = line + (sh * t) / 2;
      W.a = a - t / 2;
      W.b = b + t / 2;
    }
    walls.push(W);
  };
  const SENT = "#";
  type Run = { k: number; n: Label; p: Label } | null;
  for (let j = 0; j <= nz; j++) {
    let st: Run = null;
    for (let i = 0; i <= nx; i++) {
      const n = i < nx ? at(i, j - 1) : SENT, p = i < nx ? at(i, j) : SENT, diff = i < nx && n !== p;
      if (st && (!diff || st.n !== n || st.p !== p)) { mk("x", Z(j), X(st.k), X(i), st.n, st.p); st = null; }
      if (diff && !st) st = { k: i, n: n as Label, p: p as Label };
    }
  }
  for (let i = 0; i <= nx; i++) {
    let st: Run = null;
    for (let j = 0; j <= nz; j++) {
      const n = j < nz ? at(i - 1, j) : SENT, p = j < nz ? at(i, j) : SENT, diff = j < nz && n !== p;
      if (st && (!diff || st.n !== n || st.p !== p)) { mk("z", X(i), Z(st.k), Z(j), st.n, st.p); st = null; }
      if (diff && !st) st = { k: j, n: n as Label, p: p as Label };
    }
  }

  // doors and the hatch
  const pair = (a: RoomId, b: RoomId) => walls.filter((W) => (W.neg === a && W.pos === b) || (W.neg === b && W.pos === a));
  const place = (list: Wall[], param: number, ow: number): { W: Wall; c: number } | null => {
    const iv = [...list].sort((p, q) => p.sa - q.sa).map((W) => ({ W, a: W.sa + ow / 2 + 0.15, b: W.sb - ow / 2 - 0.15 })).filter((v) => v.b >= v.a);
    if (!iv.length) return null;
    const tot = iv.reduce((s, v) => s + (v.b - v.a), 0);
    let k = ((param + 1) / 2) * tot;
    for (const v of iv) {
      if (k <= v.b - v.a + 1e-9) return { W: v.W, c: v.a + k };
      k -= v.b - v.a;
    }
    const last = iv[iv.length - 1]!;
    return { W: last.W, c: last.b };
  };
  const add = (pl: { W: Wall; c: number } | null, o: Omit<Opening, "c">): { W: Wall; o: Opening } | null => {
    if (!pl) return null;
    const op: Opening = { ...o, c: pl.c };
    pl.W.open.push(op);
    return { W: pl.W, o: op };
  };
  const swingTo = (W: Wall, id: RoomId) => (W.pos === id ? 1 : -1);

  const fronts = walls.filter((W) => W.ext && W.room === "cafe" && W.ax === "x" && W.nrm === 1);
  const fz = Math.max(...fronts.map((W) => W.c));
  const ent = add(place(fronts.filter((W) => Math.abs(W.c - fz) < 1e-6), r.door, 1.2), { w: 1.2, sill: 0, head: 2.2, kind: "entrance" });
  const entrance: Geo["entrance"] = ent ? { x: ent.o.c, z: ent.W.c - t / 2 - 0.6, W: ent.W, o: ent.o } : { x: 0, z: d / 2 - 0.6, W: null, o: null };

  const has = (id: RoomId) => R.some((q) => q.id === id);
  if (has("kitchen")) {
    let ws = pair("cafe", "kitchen"), to: RoomId = "kitchen";
    if (!ws.length && has("storage")) { ws = pair("cafe", "storage"); to = "storage"; }
    const kd = add(place(ws, B.door, 0.9), { w: 0.9, sill: 0, head: 2.1, kind: "door", role: "kdoor" });
    if (kd) kd.o.swing = swingTo(kd.W, to);
    if (B.hatch && kd && to === "kitchen") {
      const pl = place(ws, B.door >= 0 ? -1 : 1, 1.2);
      if (pl && !(pl.W === kd.W && Math.abs(pl.c - kd.o.c) < 1.15)) add(pl, { w: 1.2, sill: 0.9, head: 1.5, kind: "hatch" });
    }
    if (has("storage")) {
      const pd = add(place(pair("kitchen", "storage"), 0, 0.9), { w: 0.9, sill: 0, head: 2.1, kind: "door" });
      if (pd) pd.o.swing = swingTo(pd.W, "storage");
      if (B.storeDoor) {
        const sd = add(place(pair("cafe", "storage"), 0, 0.9), { w: 0.9, sill: 0, head: 2.1, kind: "door" });
        if (sd) sd.o.swing = swingTo(sd.W, "storage");
      }
    }
    if (B.backDoor && far) {
      const tgt: RoomId = has("storage") ? "storage" : "kitchen", f = far;
      const fw = walls.filter((W) => W.ext && W.room === tgt && W.ax === f.ax && W.nrm === f.nrm);
      if (fw.length) {
        const extreme = f.nrm > 0 ? Math.max(...fw.map((W) => W.c)) : Math.min(...fw.map((W) => W.c));
        add(place(fw.filter((W) => Math.abs(W.c - extreme) < 1e-6), 0, 1.0), { w: 1.0, sill: 0, head: 2.1, kind: "door", swing: -f.nrm, label: "Delivery door" });
      }
    }
  }

  // windows: each snaps to the nearest outside wall it fits on, and steps aside from doors
  L.windows ??= [{ x: -w / 4 - 0.3, z: d / 2, w: Math.max(0.8, Math.min(2.4, w / 2 - 1.8)), kind: "shopfront" }];
  const winRes: PlacedWindow[] = [], extW = walls.filter((W) => W.ext);
  for (const wd of L.windows) {
    wd.id ??= "w" + Math.random().toString(36).slice(2, 8);
    wd.w = Math.max(lim.wMin, Math.min(lim.wMax, wd.w));
    let best: { W: Wall; a: number; lo: number; hi: number } | null = null, bd = 1e9;
    for (const W of extW) {
      const along = W.ax === "x" ? wd.x : wd.z, perp = W.ax === "x" ? wd.z : wd.x, lo = W.sa + wd.w / 2 + 0.1, hi = W.sb - wd.w / 2 - 0.1;
      if (hi < lo) continue;
      const a = Math.max(lo, Math.min(hi, along)), dd = Math.hypot(a - along, perp - W.c);
      if (dd < bd) { bd = dd; best = { W, a, lo, hi }; }
    }
    if (!best) continue;
    const { W, lo, hi } = best;
    let a: number | null = best.a;
    for (let k = 0; k < 4 && a != null; k++) {
      const cur: number = a;
      const hit = W.open.find((o) => Math.abs(o.c - cur) < (o.w + wd.w) / 2 + 0.1);
      if (!hit) break;
      const lf = hit.c - (hit.w + wd.w) / 2 - 0.1, rt = hit.c + (hit.w + wd.w) / 2 + 0.1;
      a = lf >= lo && (Math.abs(lf - cur) <= Math.abs(rt - cur) || rt > hi) ? lf : rt <= hi ? rt : null;
    }
    if (a == null) continue;
    const ty = WK[wd.kind] ?? WK.window, top = r.h - lim.gap;
    let sl = Math.max(lim.sillMin, Math.min(lim.sillMax, wd.sill ?? ty.sill));
    const hd = Math.min(top, Math.max(sl + lim.minH, wd.head ?? ty.head));
    if (hd - sl < lim.minH) sl = Math.max(0, hd - lim.minH);
    const o: Opening = { c: a, w: wd.w, sill: sl, head: hd, kind: "window", wid: wd.id };
    W.open.push(o);
    winRes.push({ id: wd.id, W, o });
  }

  // room summaries
  const rooms: RoomInfo[] = [];
  for (const id of ["cafe", "kitchen", "storage"] as const) {
    const cs = cells.filter((c) => c.id === id);
    if (!cs.length) continue;
    const an = [...cs].sort((p, q) => p.z0 - q.z0 || p.x0 - q.x0)[0]!;
    rooms.push({
      id, name: ROOM_NAMES[id], cells: cs, ax: an.x0, az: an.z0,
      area: cs.reduce((s, c) => s + (c.x1 - c.x0) * (c.z1 - c.z0), 0),
      x0: Math.min(...cs.map((c) => c.x0)), x1: Math.max(...cs.map((c) => c.x1)),
      z0: Math.min(...cs.map((c) => c.z0)), z1: Math.max(...cs.map((c) => c.z1)),
    });
  }
  const bbox: BBox = {
    x0: Math.min(...cells.map((c) => c.x0)), x1: Math.max(...cells.map((c) => c.x1)),
    z0: Math.min(...cells.map((c) => c.z0)), z1: Math.max(...cells.map((c) => c.z1)),
  };
  const rectIn = (x0: number, x1: number, z0: number, z1: number): RoomId | null => {
    const s = new Set<Label>();
    let any = false;
    for (let i = 0; i < nx; i++) {
      if (X(i + 1) <= x0 + 0.01 || X(i) >= x1 - 0.01) continue;
      for (let j = 0; j < nz; j++) {
        if (Z(j + 1) <= z0 + 0.01 || Z(j) >= z1 - 0.01) continue;
        any = true;
        s.add(at(i, j));
      }
    }
    if (!any || x0 < X(0) - 0.01 || x1 > X(nx) + 0.01 || z0 < Z(0) - 0.01 || z1 > Z(nz) + 0.01) return null;
    return s.size === 1 && !s.has(null) ? ([...s][0] as RoomId) : null;
  };
  return { rooms, walls, cells, bbox, cellAt, rectIn, entrance, windows: winRes };
}

/** Whether a person standing at (x, z) is inside a room or passing through a doorway. */
export function canWalk(geo: Geo, x: number, z: number): boolean {
  const m = 0.22;
  if (geo.rectIn(x - m, x + m, z - m, z + m)) return true;
  return geo.walls.some((wl) => wl.open.some((o) => o.sill === 0 && o.kind !== "entrance" &&
    (wl.ax === "x"
      ? Math.abs(x - o.c) < o.w / 2 - 0.12 && Math.abs(z - wl.c) < WT / 2 + m + 0.08
      : Math.abs(z - o.c) < o.w / 2 - 0.12 && Math.abs(x - wl.c) < WT / 2 + m + 0.08)));
}
