// 3D models for built-in pieces and custom items. Every model faces +z (the customer side).
import { tableChairs } from "../geometry/items";
import type { ItemDef, Palette } from "../types";
import { box, cyl, M, THREE } from "./core";

type G = THREE.Object3D;
type Builder = (g: G, p: Palette) => void;

function chair(g: G, p: Palette, x: number, z: number, rot: number): void {
  const c = new THREE.Group(), m = M(p.accent), leg = M(0x3a3330, { metalness: 0.4, roughness: 0.4 });
  cyl(c, 0.02, 0.02, 0.44, leg, 0, 0, 0, 8);
  box(c, 0.42, 0.05, 0.42, m, 0, 0.44, 0);
  box(c, 0.42, 0.42, 0.05, m, 0, 0.49, -0.19);
  c.position.set(x, 0, z);
  c.rotation.y = rot;
  g.add(c);
}
function stool(g: G, p: Palette, x: number, z: number): void {
  cyl(g, 0.025, 0.025, 0.72, M(0x3a3330, { metalness: 0.4, roughness: 0.4 }), x, 0, z, 8);
  cyl(g, 0.18, 0.18, 0.05, M(p.wood), x, 0.72, z);
}
const glass = (opacity: number) => M(0xdbeef3, { transparent: true, opacity, roughness: 0.05 });
const STEEL = () => M(0xc9cdd1, { metalness: 0.6, roughness: 0.32 });
const DARK = () => M(0x2e2e30, { roughness: 0.5 });
const WHITE = () => M(0xf1f1ef, { roughness: 0.6 });
function legs(g: G, w: number, d: number, h: number, r = 0.025): void {
  for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) cyl(g, r, r, h, STEEL(), a * (w / 2 - 0.05), 0, b * (d / 2 - 0.05), 8);
}

export const BUILD: Record<string, Builder> = {
  display(g, p) {
    box(g, 1.8, 0.9, 0.75, M(p.wood), 0, 0, 0);
    box(g, 1.8, 0.04, 0.75, M(0xf3f0ea), 0, 0.9, 0);
    box(g, 1.76, 0.45, 0.71, glass(0.28), 0, 0.94, 0);
    ["#f2a7b6", "#7b4a3a", "#f5e2b8", "#b6d39c", "#e9c46a"].forEach((c, i) => cyl(g, 0.12, 0.12, 0.12, M(c), -0.68 + i * 0.34, 0.94, 0.05));
  },
  counter(g, p) {
    box(g, 2.4, 0.95, 0.7, M(p.accent), 0, 0, 0);
    box(g, 2.46, 0.05, 0.76, M(p.wood), 0, 0.95, 0);
    box(g, 0.32, 0.22, 0.26, M(0x2b2b2b), 0.75, 1.0, 0);
    box(g, 0.3, 0.02, 0.3, M(0xffffff), -0.6, 1.0, 0.1);
  },
  espresso(g, p) {
    box(g, 1.4, 0.9, 0.65, M(p.wood), 0, 0, 0);
    box(g, 1.42, 0.04, 0.67, M(0xe9e6e0), 0, 0.9, 0);
    box(g, 0.7, 0.42, 0.48, M(0xc9ccd0, { metalness: 0.7, roughness: 0.25 }), -0.2, 0.94, 0);
    cyl(g, 0.08, 0.1, 0.45, M(0x2b2b2b), 0.45, 0.94, 0);
  },
  gelato(g, p) {
    box(g, 1.6, 0.8, 0.85, M(0xf6f4f0), 0, 0, 0);
    box(g, 1.6, 0.05, 0.85, M(p.accent), 0, 0.8, 0);
    ["#f7c5d0", "#c6e2b5", "#fff1c1", "#7a4b3a", "#c7b8ea", "#ffd6a5"].forEach((c, i) => box(g, 0.22, 0.06, 0.32, M(c), -0.6 + i * 0.24, 0.85, 0.05));
    box(g, 1.56, 0.3, 0.81, glass(0.25), 0, 0.85, 0);
  },
  fridge(g) {
    box(g, 1.0, 1.95, 0.65, M(0x3a3a3c, { metalness: 0.5, roughness: 0.4 }), 0, 0, 0);
    box(g, 0.9, 1.6, 0.02, glass(0.35), 0, 0.2, 0.33);
    const cols = ["#f2a7b6", "#b6d39c", "#f5e2b8", "#9ed0e6"];
    for (let r = 0; r < 4; r++) for (let i = 0; i < 4; i++) box(g, 0.16, 0.18, 0.2, M(cols[(r + i) % 4]!), -0.33 + i * 0.22, 0.3 + r * 0.38, 0.08);
  },
  two(g, p) {
    cyl(g, 0.03, 0.03, 0.72, M(0x3a3330), 0, 0, 0, 8);
    cyl(g, 0.35, 0.35, 0.04, M(p.wood), 0, 0.72, 0, 28);
    chair(g, p, -0.52, 0, Math.PI / 2);
    chair(g, p, 0.52, 0, -Math.PI / 2);
  },
  four(g, p) {
    cyl(g, 0.04, 0.04, 0.72, M(0x3a3330), 0, 0, 0, 8);
    box(g, 0.85, 0.04, 0.85, M(p.wood), 0, 0.72, 0);
    chair(g, p, 0, -0.62, 0);
    chair(g, p, 0, 0.62, Math.PI);
    chair(g, p, -0.62, 0, Math.PI / 2);
    chair(g, p, 0.62, 0, -Math.PI / 2);
  },
  booth(g, p) {
    const up = M(p.up), wd = M(p.wood);
    for (const s of [-1, 1]) {
      box(g, 1.8, 0.45, 0.5, wd, 0, 0, s * 0.5);
      box(g, 1.8, 0.08, 0.5, up, 0, 0.45, s * 0.5);
      box(g, 1.8, 0.6, 0.12, up, 0, 0.5, s * 0.69);
    }
    box(g, 1.4, 0.04, 0.55, M(p.wood), 0, 0.72, 0);
    cyl(g, 0.04, 0.04, 0.72, M(0x3a3330), 0, 0, 0, 8);
  },
  ledge(g, p) {
    box(g, 2.0, 0.05, 0.35, M(p.wood), 0, 1.0, -0.12);
    box(g, 0.05, 1.0, 0.05, M(0x3a3330), -0.9, 0, -0.2);
    box(g, 0.05, 1.0, 0.05, M(0x3a3330), 0.9, 0, -0.2);
    for (const x of [-0.65, 0, 0.65]) stool(g, p, x, 0.12);
  },
  sofa(g, p) {
    const up = M(p.up);
    box(g, 2.0, 0.42, 0.8, up, 0, 0, -0.4);
    box(g, 2.0, 0.45, 0.18, up, 0, 0.42, -0.71);
    box(g, 0.18, 0.25, 0.8, up, -0.91, 0.42, -0.4);
    box(g, 0.18, 0.25, 0.8, up, 0.91, 0.42, -0.4);
    cyl(g, 0.35, 0.35, 0.42, M(p.wood), 0, 0, 0.4, 28);
  },
  plant(g) {
    cyl(g, 0.18, 0.14, 0.4, M(0xe9e2d6), 0, 0, 0);
    const leaf = new THREE.Mesh(new THREE.IcosahedronGeometry(0.32, 1), M(0x6f9a5a, { flatShading: true }));
    leaf.position.set(0, 0.75, 0);
    leaf.castShadow = true;
    g.add(leaf);
  },
  menu(g, p) {
    box(g, 0.6, 1.1, 0.05, M(0x2c2c2c), 0, 0.15, -0.05);
    box(g, 0.04, 0.15, 0.3, M(p.wood), -0.25, 0, 0);
    box(g, 0.04, 0.15, 0.3, M(p.wood), 0.25, 0, 0);
    box(g, 0.5, 0.9, 0.01, M(0x3d3d3d), 0, 0.25, -0.02);
  },
  /* kitchen */
  prep(g) {
    legs(g, 1.5, 0.7, 0.86);
    box(g, 1.5, 0.04, 0.7, STEEL(), 0, 0.86, 0);
    box(g, 1.42, 0.03, 0.62, STEEL(), 0, 0.2, 0);
  },
  deckoven(g) {
    legs(g, 1.3, 1.0, 0.45, 0.035);
    box(g, 1.3, 1.15, 1.0, STEEL(), 0, 0.45, 0);
    for (let k = 0; k < 3; k++) {
      box(g, 1.0, 0.22, 0.02, M(0x3b2a22, { roughness: 0.3 }), -0.08, 0.55 + k * 0.36, 0.5);
      box(g, 0.9, 0.03, 0.04, DARK(), -0.08, 0.79 + k * 0.36, 0.52);
    }
    box(g, 0.18, 1.0, 0.02, DARK(), 0.52, 0.52, 0.5);
  },
  convoven(g) {
    legs(g, 0.9, 0.85, 0.6);
    box(g, 0.86, 0.03, 0.8, STEEL(), 0, 0.6, 0);
    box(g, 0.9, 0.95, 0.85, STEEL(), 0, 0.63, 0);
    box(g, 0.6, 0.7, 0.02, DARK(), -0.08, 0.76, 0.43);
    box(g, 0.16, 0.7, 0.02, M(0x1c1c1c), 0.33, 0.76, 0.43);
  },
  hob(g) {
    box(g, 0.8, 0.86, 0.75, STEEL(), 0, 0, 0);
    box(g, 0.72, 0.02, 0.62, M(0x111111, { roughness: 0.15 }), 0, 0.86, 0);
    for (const [x, z] of [[-0.17, -0.13], [0.17, -0.13], [-0.17, 0.15], [0.17, 0.15]] as const) cyl(g, 0.1, 0.1, 0.004, M(0x555555), x, 0.88, z, 24);
  },
  mixer(g) {
    const m = M(0xdedad4, { roughness: 0.5 });
    box(g, 0.6, 0.12, 0.75, m, 0, 0, 0);
    box(g, 0.3, 1.05, 0.28, m, 0, 0.12, -0.22);
    box(g, 0.32, 0.26, 0.6, m, 0, 1.0, -0.02);
    cyl(g, 0.21, 0.17, 0.32, STEEL(), 0, 0.5, 0.12, 24);
  },
  sink(g) {
    box(g, 1.4, 0.86, 0.7, STEEL(), 0, 0, 0);
    box(g, 1.4, 0.04, 0.7, STEEL(), 0, 0.86, 0);
    for (const x of [-0.33, 0.33]) box(g, 0.52, 0.01, 0.46, M(0x7d8287, { metalness: 0.6, roughness: 0.4 }), x, 0.9, 0.03);
    box(g, 1.4, 0.25, 0.04, STEEL(), 0, 0.9, -0.33);
    cyl(g, 0.015, 0.015, 0.35, STEEL(), 0, 0.9, -0.24, 8);
    box(g, 0.03, 0.03, 0.2, STEEL(), 0, 1.22, -0.15);
  },
  handsink(g) {
    box(g, 0.5, 0.22, 0.4, STEEL(), 0, 0.68, 0);
    box(g, 0.4, 0.01, 0.3, M(0x7d8287), 0, 0.9, 0.02);
    cyl(g, 0.03, 0.03, 0.68, STEEL(), 0, 0, -0.12, 8);
    cyl(g, 0.012, 0.012, 0.18, STEEL(), 0, 0.9, -0.15, 8);
  },
  dish(g) {
    box(g, 0.6, 0.85, 0.65, STEEL(), 0, 0, 0);
    box(g, 0.5, 0.04, 0.02, DARK(), 0, 0.72, 0.33);
  },
  kfridge(g) {
    box(g, 1.4, 2.0, 0.8, STEEL(), 0, 0, 0);
    box(g, 0.01, 1.75, 0.02, DARK(), 0, 0.05, 0.41);
    for (const x of [-0.06, 0.06]) box(g, 0.03, 0.5, 0.04, DARK(), x, 1.0, 0.42);
    box(g, 1.4, 0.18, 0.02, DARK(), 0, 1.8, 0.41);
  },
  blast(g) {
    box(g, 0.8, 1.85, 0.8, STEEL(), 0, 0, 0);
    box(g, 0.7, 0.12, 0.02, DARK(), 0, 1.65, 0.41);
    box(g, 0.04, 0.6, 0.04, DARK(), 0.3, 0.9, 0.42);
  },
  /* storage */
  dshelf(g) {
    for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) box(g, 0.03, 1.8, 0.03, STEEL(), a * 0.585, 0, b * 0.235);
    const cols = ["#e8d5b5", "#c9a27e", "#f1e7d0", "#d9c2a3", "#efe3cf"];
    for (let k = 0; k < 5; k++) {
      box(g, 1.2, 0.02, 0.5, STEEL(), 0, 0.15 + k * 0.4, 0);
      if (k < 4) for (let j = 0; j < 3; j++) box(g, 0.3, 0.22 + 0.06 * ((k + j) % 2), 0.36, M(cols[(k * 3 + j) % 5]!), -0.38 + j * 0.38, 0.17 + k * 0.4, 0);
    }
  },
  walkin(g) {
    box(g, 2.4, 2.3, 2.0, M(0xe7ebee, { roughness: 0.5 }), 0, 0, 0);
    box(g, 0.9, 2.0, 0.04, M(0xd5dbe0, { roughness: 0.4 }), 0.5, 0.05, 1.0);
    box(g, 0.05, 0.35, 0.06, STEEL(), 0.12, 1.0, 1.04);
    box(g, 0.3, 0.12, 0.02, M(0x2a3b2d), 0.5, 2.1, 1.03);
  },
  cfreezer(g) {
    box(g, 1.3, 0.85, 0.7, WHITE(), 0, 0, 0);
    box(g, 1.32, 0.02, 0.72, M(0xcfd3d6), 0, 0.85, 0);
    box(g, 0.3, 0.04, 0.03, DARK(), 0, 0.78, 0.36);
  },
  bins(g) {
    box(g, 0.9, 0.1, 0.5, DARK(), 0, 0.02, 0);
    ["#e3879a", "#f2b880", "#9fc48d"].forEach((lid, k) => {
      const x = -0.3 + k * 0.3;
      box(g, 0.27, 0.55, 0.45, M(0xf2f2ef), x, 0.12, 0);
      box(g, 0.28, 0.03, 0.46, M(lid), x, 0.67, 0);
    });
  },
  mopsink(g) {
    box(g, 0.6, 0.3, 0.6, M(0xa9adb1, { roughness: 0.7 }), 0, 0, 0);
    box(g, 0.5, 0.01, 0.5, M(0x6d7277), 0, 0.3, 0);
    cyl(g, 0.015, 0.015, 0.6, STEEL(), 0, 0.3, -0.27, 8);
  },
  lockers(g) {
    box(g, 0.9, 1.8, 0.5, M(0x7f93a8, { roughness: 0.6 }), 0, 0, 0);
    for (const x of [-0.15, 0.15]) box(g, 0.006, 1.7, 0.01, DARK(), x, 0.05, 0.255);
    for (const x of [-0.2, 0.1, 0.4]) box(g, 0.03, 0.12, 0.02, M(0xdddddd), x, 0.95, 0.26);
  },
};

/** Model a custom item: parts, a block, or a table with chairs. */
export function buildCustom(g: G, p: Palette, c: ItemDef): void {
  if (c.shape === "parts") {
    (c.parts ?? []).forEach((q, idx) => {
      const mat = M(q.color);
      let m: THREE.Mesh;
      if (q.k === "cyl") {
        m = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1, 32), mat);
        m.scale.set(q.w, q.h, q.d);
      } else m = new THREE.Mesh(new THREE.BoxGeometry(q.w, q.h, q.d), mat);
      m.position.set(q.x - (c.ox ?? 0), q.y + q.h / 2, q.z - (c.oz ?? 0));
      m.castShadow = m.receiveShadow = true;
      m.userData.part = idx;
      g.add(m);
    });
    return;
  }
  if (c.shape === "block") {
    box(g, c.w, c.h, c.d, M(p.accent), 0, 0, 0);
    box(g, c.w + 0.02, 0.03, c.d + 0.02, M(p.wood), 0, c.h, 0);
    return;
  }
  const tw = c.tw ?? 0.8, td = c.td ?? 0.8;
  cyl(g, 0.04, 0.04, 0.72, M(0x3a3330), 0, 0, 0, 8);
  if (c.shape === "round") {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.04, 36), M(p.wood));
    m.scale.set(tw, 1, td);
    m.position.y = 0.74;
    m.castShadow = true;
    g.add(m);
  } else box(g, tw, 0.04, td, M(p.wood), 0, 0.72, 0);
  for (const [x, z, r] of tableChairs(c)) chair(g, p, x, z, r);
}
