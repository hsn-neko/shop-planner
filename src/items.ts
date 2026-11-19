// Placed pieces: their 3D meshes, clash checks, selection and moving them.
import { PALETTES } from "./data/catalog";
import { $, fmt, isWide } from "./dom";
import { collides, dims, findClashes, footprint, itemHeight } from "./geometry/items";
import { roomName } from "./data/shopTypes";
import { app, cat, countsLabel, newId, pushUndo, save, snap } from "./state";
import { itemsG, THREE } from "./three/core";
import { BUILD, buildCustom } from "./three/furniture";
import type { Placed } from "./types";
import { flashHint } from "./ui/hint";
import { openInv, updateCounts } from "./ui/inventory";
import { renderSlots } from "./ui/layouts";
import { showSel } from "./ui/selection";
import { focusOn, viewCenter } from "./views";

interface ItemMesh extends THREE.Group {
  userData: { id: number; ring: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial> };
}
export const meshes = new Map<number, ItemMesh>();

export const getSel = (): Placed | undefined => app.L.items.find((i) => i.id === app.selected);
export const dimsOf = (i: Placed) => dims(i, cat);
export const footprintOf = (i: Placed) => footprint(i, cat);
export const heightOf = (i: Placed) => itemHeight(i, cat);
/** Colour of a piece on the 2D plan. */
export function itemColor(i: Placed): string {
  const c = cat(i.type);
  return i.color || c.color || c.col || (i.type === "plant" ? "#6f9a5a" : PALETTES[app.L.palette]!.accent);
}

export function buildItem(i: Placed): void {
  const base = PALETTES[app.L.palette]!, c = cat(i.type);
  const col = i.color || c.color;
  const p = col ? { ...base, accent: col, up: col } : base;
  const g = new THREE.Group() as ItemMesh, body = new THREE.Group();
  g.add(body);
  const build = BUILD[i.type];
  if (build) build(body, p);
  else buildCustom(body, p, c);
  body.scale.set(i.sx || 1, i.sy || 1, i.sz || 1);
  // selection / clash outline on the floor
  const ring = new THREE.Mesh(new THREE.PlaneGeometry(c.w + 0.08, c.d + 0.08), new THREE.MeshBasicMaterial({ color: 0xc2416b, transparent: true, opacity: 0.3, depthWrite: false }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.006;
  ring.scale.set(i.sx || 1, i.sz || 1, 1);
  ring.visible = false;
  g.add(ring);
  g.userData = { id: i.id, ring };
  g.position.set(i.x, 0, i.z);
  g.rotation.y = (-i.r * Math.PI) / 180;
  itemsG.add(g);
  meshes.set(i.id, g);
}
export function refreshItem(i: Placed): void {
  const g = meshes.get(i.id);
  if (g) {
    itemsG.remove(g);
    meshes.delete(i.id);
  }
  buildItem(i);
  evaluate();
}
export function rebuildItems(): void {
  itemsG.clear();
  meshes.clear();
  for (const i of app.L.items) buildItem(i);
  evaluate();
}
export function removeItemMesh(id: number): void {
  const g = meshes.get(id);
  if (g) itemsG.remove(g);
  meshes.delete(id);
}

/** Check clashes, update outlines, header counts, inventory counts and the empty-room bar. */
export function evaluate(): void {
  const bad = findClashes(app.L.items, app.geo, cat);
  meshes.forEach((g, id) => {
    const r = g.userData.ring, isBad = bad.has(id);
    r.visible = isBad || app.selected === id;
    r.material.color.set(isBad ? 0xd1462f : 0xc2416b);
    r.material.opacity = isBad ? 0.45 : 0.3;
  });
  app.clashSet = bad;
  $("#stCount").textContent = countsLabel(app.L);
  const cl = $("#stClash");
  cl.textContent = bad.size ? `${bad.size} clashing` : "No clashes";
  cl.classList.toggle("bad", bad.size > 0);
  updateCounts();
  renderSlots();
  updateEmpty();
}
export function updateEmpty(): void {
  $("#empty").hidden = app.L.items.length > 0 || app.mode === "walk" || !!app.store.seen.empty;
}

export function select(id: number | null): void {
  app.selected = id;
  showSel();
  evaluate();
}
export function updateMeta(i: Placed): void {
  const c = cat(i.type), dm = dimsOf(i);
  $("#selName").textContent = c.name;
  $("#selMeta").textContent = `· ${fmt(dm.w)} × ${fmt(dm.d)} m · ${fmt(heightOf(i))} m tall${c.seats ? ` · ${c.seats} seats` : ""}`;
}

const clampX = (v: number) => Math.max(app.geo.bbox.x0 + 0.5, Math.min(app.geo.bbox.x1 - 0.5, v));
const clampZ = (v: number) => Math.max(app.geo.bbox.z0 + 0.5, Math.min(app.geo.bbox.z1 - 0.5, v));
export { clampX, clampZ };

/** Add a new piece: into its own room (kitchen/storage pieces) or the middle of the view, nudged to a free spot. */
export function addItem(type: string): void {
  pushUndo();
  const ct = cat(type), zr = ct.zone ? app.geo.rooms.find((r) => r.id === ct.zone) : undefined;
  const t = zr ? { x: (zr.x0 + zr.x1) / 2, z: (zr.z0 + zr.z1) / 2 } : viewCenter();
  if (ct.zone && !zr) setTimeout(() => flashHint(`Add a ${roomName(app.L, ct.zone!).toLowerCase()} in the room editor to give this piece its own room.`), 50);
  const i: Placed = { id: newId(), type, x: snap(clampX(t.x)), z: snap(clampZ(t.z)), r: 0 };
  for (let k = 0; k < 40 && collides(i, app.L.items, cat); k++) {
    i.x = snap(clampX(i.x + ((k % 5) - 2) * 0.8));
    i.z = snap(clampZ(i.z + (Math.floor(k / 5) - 2) * 0.8));
  }
  app.L.items.push(i);
  buildItem(i);
  select(i.id);
  if (zr) focusOn(i.x, i.z);
  save();
  if (!isWide()) openInv(false);
}

/** Move a piece, keeping it inside the outer bounds of all rooms. */
export function moveTo(i: Placed, x: number, z: number): void {
  const f = footprintOf(i), b = app.geo.bbox;
  i.x = snap(Math.max(b.x0 + f.hw, Math.min(b.x1 - f.hw, x)));
  i.z = snap(Math.max(b.z0 + f.hd, Math.min(b.z1 - f.hd, z)));
  meshes.get(i.id)?.position.set(i.x, 0, i.z);
  evaluate();
}
