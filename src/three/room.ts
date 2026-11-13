// 3D floors, walls and window glass for the current geometry.
import { PALETTES } from "../data/catalog";
import { WT } from "../geometry/rooms";
import type { Geo, Layout, Palette, RoomId, Wall } from "../types";
import { backRoomTexture, box, cyl, floorTexture, M, roomG, scene, sun, THREE } from "./core";

/** Each wall has a full-height version and a cut-down one for the dollhouse view. */
export interface WallMesh {
  wl: Wall;
  full: THREE.Group;
  cut: THREE.Group;
}
export const walls: WallMesh[] = [];

/** Wall boxes with gaps for doors, windows and the hatch, up to height H. */
function wallPieces(g: THREE.Group, wl: Wall, H: number, mat: THREE.Material): void {
  const seg = (a: number, b: number, y0: number, y1: number) => {
    if (b - a < 0.005 || y1 - y0 < 0.005) return;
    const len = b - a, mid = (a + b) / 2;
    if (wl.ax === "x") box(g, len, y1 - y0, WT, mat, mid, y0, wl.c);
    else box(g, WT, y1 - y0, len, mat, wl.c, y0, mid);
  };
  let cur = wl.a;
  for (const o of [...wl.open].sort((p, q) => p.c - q.c)) {
    const oa = o.c - o.w / 2, ob = o.c + o.w / 2;
    seg(cur, oa, 0, H);
    if (o.sill > 0) seg(oa, ob, 0, Math.min(o.sill, H));
    if (H > o.head) seg(oa, ob, o.head, H);
    cur = ob;
  }
  seg(cur, wl.b, 0, H);
}

function buildWallMeshes(geo: Geo, p: Palette, h: number): void {
  const wm = M(p.wall, { roughness: 0.9 }), bm = M(0xeceae6, { roughness: 0.9 });
  for (const wl of geo.walls) {
    const mat = wl.boh ? bm : wm, full = new THREE.Group(), cut = new THREE.Group();
    wallPieces(full, wl, h, mat);
    wallPieces(cut, wl, wl.ext ? 0.12 : 1.0, mat);
    cut.visible = false;
    roomG.add(full, cut);
    walls.push({ wl, full, cut });
  }
  const gl = M(0xbfd8e0, { transparent: true, opacity: 0.28, roughness: 0.08, metalness: 0.1 }), fr = M(0x3a3f44, { roughness: 0.5 });
  for (const { W, o } of geo.windows) {
    const g = walls[geo.walls.indexOf(W)]!.full, hh = o.head - o.sill, X = W.ax === "x";
    const part = (a: number, hgt: number, dp: number, y: number, mat: THREE.Material) => {
      const m = X ? box(g, a, hgt, dp, mat, o.c, y, W.c) : box(g, dp, hgt, a, mat, W.c, y, o.c);
      m.userData.wid = o.wid;
    };
    part(o.w, hh, 0.02, o.sill, gl);
    part(o.w, 0.04, WT + 0.08, o.sill - 0.04, fr);
    part(o.w, 0.04, WT, o.head - 0.04, fr);
    // upright bars about every 1.2 m
    const n = Math.max(1, Math.round(o.w / 1.2));
    for (let k = 1; k < n; k++) {
      const off = -o.w / 2 + (k * o.w) / n;
      const m = X ? box(g, 0.04, hh, 0.05, fr, o.c + off, o.sill, W.c) : box(g, 0.05, hh, 0.04, fr, W.c, o.sill, o.c + off);
      m.userData.wid = o.wid;
    }
  }
}

/** Rebuild only the walls (after a window edit): floors stay as they are. */
export function rebuildWallMeshes(geo: Geo, L: Layout): void {
  for (const W of walls) roomG.remove(W.full, W.cut);
  walls.length = 0;
  buildWallMeshes(geo, PALETTES[L.palette]!, L.room.h);
}

const TILE: Record<RoomId, number> = { cafe: 1.8, kitchen: 1.6, storage: 2.4 };

/** Rebuild floors, walls, the entrance mat, pendant lights and shadow bounds. */
export function buildRoomMeshes(geo: Geo, L: Layout): void {
  roomG.clear();
  walls.length = 0;
  const { w, d, h } = L.room, p = PALETTES[L.palette]!, b = geo.bbox;
  const slab = new THREE.Mesh(new THREE.PlaneGeometry(b.x1 - b.x0 + 2 * WT, b.z1 - b.z0 + 2 * WT), M(0xcfc8c1, { roughness: 1 }));
  slab.rotation.x = -Math.PI / 2;
  slab.position.set((b.x0 + b.x1) / 2, -0.004, (b.z0 + b.z1) / 2);
  slab.receiveShadow = true;
  roomG.add(slab);
  const base: Record<RoomId, THREE.CanvasTexture> = { cafe: floorTexture(p), kitchen: backRoomTexture("kitchen"), storage: backRoomTexture("storage") };
  for (const r of geo.cells) {
    const rw = r.x1 - r.x0, rd = r.z1 - r.z0, k = TILE[r.id], tex = base[r.id].clone();
    tex.needsUpdate = true;
    tex.repeat.set(rw / k, rd / k);
    // offset by position so tiles line up across cells
    tex.offset.set(r.x0 / k, -r.z1 / k);
    const f = new THREE.Mesh(new THREE.PlaneGeometry(rw, rd), M(0xffffff, { map: tex, roughness: r.id === "cafe" ? 0.6 : 0.9 }));
    f.rotation.x = -Math.PI / 2;
    f.position.set((r.x0 + r.x1) / 2, 0, (r.z0 + r.z1) / 2);
    f.receiveShadow = true;
    roomG.add(f);
  }
  buildWallMeshes(geo, p, h);
  const E = geo.entrance;
  if (E.W) {
    const mat = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.8), M(p.accent, { roughness: 1 }));
    mat.rotation.x = -Math.PI / 2;
    mat.position.set(E.x, 0.004, E.W.c - WT / 2 - 0.4);
    mat.receiveShadow = true;
    roomG.add(mat);
  }
  const lamp = M(p.accent, { emissive: new THREE.Color(0xfff1d6), emissiveIntensity: 0.25 });
  for (let i = -1; i <= 1; i++) {
    const lx = (i * w) / 4, lz = -d / 6;
    if (geo.cellAt(lx, lz) !== "cafe") continue;
    const lg = new THREE.Group();
    cyl(lg, 0.01, 0.01, h - 2.4, M(0x333333), 0, 2.4, 0);
    cyl(lg, 0.05, 0.22, 0.18, lamp, 0, 2.25, 0, 24);
    lg.position.set(lx, 0, lz);
    roomG.add(lg);
  }
  // keep shadows covering every room
  const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2, ext = Math.max(b.x1 - b.x0, b.z1 - b.z0) * 0.75 + 2;
  sun.position.set(cx + 6, 14, cz + 8);
  sun.target.position.set(cx, 0, cz);
  if (!sun.target.parent) scene.add(sun.target);
  Object.assign(sun.shadow.camera, { left: -ext, right: ext, top: ext, bottom: -ext });
  sun.shadow.camera.updateProjectionMatrix();
}
