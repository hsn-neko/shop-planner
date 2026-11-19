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
const METAL = () => M(0x3a3330, { metalness: 0.5, roughness: 0.4 });
const MIRROR = () => M(0xdfe8ec, { metalness: 0.9, roughness: 0.06 });
/** Small seeded random numbers, so a model looks the same every time it's built. */
function rng(seed: number): () => number {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}
const BOOK = ["#8f3b2f", "#23395b", "#c9a46a", "#5f7356", "#e3879a", "#f2e6cf", "#2f2f2f", "#6fb3b8", "#b5764f", "#7c8fd1"];
/** A row of book spines from x0 to x1 on a shelf at height y, spines facing +z (or -z with face < 0). */
function books(g: G, x0: number, x1: number, y: number, z: number, depth: number, hmax: number, seed: number): void {
  const r = rng(seed);
  for (let x = x0; x < x1 - 0.04; ) {
    const w = Math.min(x1 - x, 0.06 + r() * 0.14), h = hmax * (0.72 + r() * 0.28);
    box(g, w - 0.006, h, depth, M(BOOK[Math.floor(r() * BOOK.length)]!), x + w / 2, y, z);
    x += w + (r() < 0.15 ? 0.05 : 0);
  }
}
/** Garments hanging from a bar: thin coloured blocks along x. */
function garments(g: G, p: Palette, x0: number, x1: number, z: number, depth: number, seed: number): void {
  const cols = [p.accent, p.up, "#e9e4dc", "#6d7d8f", p.wood, "#2f2f2f", "#c7b8ea"], r = rng(seed);
  for (let x = x0; x <= x1 + 1e-6; x += 0.1) {
    const h = 0.6 + r() * 0.35;
    box(g, 0.05, h, depth, M(cols[Math.floor(r() * cols.length)]!), x, 1.5 - h, z);
  }
}
/** A plain open shelf unit: sides, back and shelves in wood. */
function shelves(g: G, w: number, d: number, h: number, levels: number[], mat: THREE.Material, back = true): void {
  for (const sx of [-1, 1]) box(g, 0.03, h, d, mat, sx * (w / 2 - 0.015), 0, 0);
  if (back) box(g, w, h, 0.02, mat, 0, 0, -d / 2 + 0.01);
  for (const y of levels) box(g, w - 0.06, 0.03, d, mat, 0, y, 0);
  box(g, w, 0.03, d, mat, 0, h - 0.03, 0);
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
  /* retail boutique */
  rail(g, p) {
    const m = METAL();
    for (const x of [-0.58, 0.58]) {
      box(g, 0.03, 1.6, 0.03, m, x, 0, 0);
      box(g, 0.04, 0.03, 0.5, m, x, 0, 0);
    }
    box(g, 1.2, 0.03, 0.03, m, 0, 1.55, 0);
    garments(g, p, -0.48, 0.48, 0, 0.4, 3);
  },
  rail2(g, p) {
    const m = METAL();
    for (const x of [-0.73, 0.73]) {
      box(g, 0.03, 1.6, 0.03, m, x, 0, 0);
      box(g, 0.04, 0.03, 0.6, m, x, 0, 0);
      box(g, 0.03, 0.03, 0.34, m, x, 1.55, 0);
    }
    for (const z of [-0.16, 0.16]) {
      box(g, 1.5, 0.03, 0.03, m, 0, 1.55, z);
      garments(g, p, -0.62, 0.62, z, 0.26, z > 0 ? 5 : 9);
    }
  },
  wallbay(g, p) {
    const wd = M(p.wood);
    shelves(g, 1.0, 0.45, 2.2, [0.1, 0.55, 1.0, 1.45, 1.9], wd);
    const cols = [p.accent, p.up, "#e9e4dc", "#6d7d8f", "#2f2f2f"], r = rng(4);
    for (const y of [0.13, 0.58, 1.03, 1.48])
      for (const x of [-0.3, 0, 0.3]) {
        const n = 2 + Math.floor(r() * 3);
        box(g, 0.24, 0.06 * n, 0.3, M(cols[Math.floor(r() * cols.length)]!), x, y, 0.03);
      }
  },
  nest(g, p) {
    const wd = M(p.wood);
    box(g, 1.1, 0.04, 0.9, wd, -0.25, 0.76, 0);
    for (const [x, z] of [[-0.77, -0.42], [0.27, -0.42], [-0.77, 0.42], [0.27, 0.42]] as const) box(g, 0.04, 0.76, 0.04, wd, x, 0, z);
    box(g, 0.75, 0.04, 0.7, wd, 0.42, 0.51, 0.08);
    for (const [x, z] of [[0.08, -0.24], [0.76, -0.24], [0.08, 0.4], [0.76, 0.4]] as const) box(g, 0.035, 0.51, 0.035, wd, x, 0, z);
    for (const [x, c] of [[-0.55, p.accent], [-0.15, "#e9e4dc"], [0.2, p.up]] as const) box(g, 0.3, 0.1, 0.35, M(c), x, 0.8, -0.1);
    box(g, 0.32, 0.08, 0.3, M("#6d7d8f"), 0.5, 0.55, 0.1);
  },
  cabinet(g, p) {
    box(g, 1.0, 0.4, 0.5, M(p.wood), 0, 0, 0);
    box(g, 0.98, 1.36, 0.48, glass(0.22), 0, 0.4, 0);
    box(g, 1.0, 0.04, 0.5, M(p.wood), 0, 1.76, 0);
    for (const y of [0.85, 1.3]) box(g, 0.94, 0.012, 0.44, glass(0.4), 0, y, 0);
    ["#c9a46a", p.accent, "#dfe8ec", p.up, "#2f2f2f", "#c9a46a"].forEach((c, k) => box(g, 0.12, 0.1, 0.12, M(c, { metalness: k % 2 ? 0 : 0.5, roughness: 0.3 }), -0.3 + (k % 3) * 0.3, k < 3 ? 0.42 : 0.87, 0));
  },
  shoes(g, p) {
    const wd = M(p.wood);
    box(g, 1.2, 0.33, 0.6, wd, 0, 0, 0);
    box(g, 1.2, 0.33, 0.4, wd, 0, 0.33, -0.1);
    box(g, 1.2, 0.34, 0.2, wd, 0, 0.66, -0.2);
    const cols = [p.accent, "#2f2f2f", "#e9e4dc", "#8a5a44"];
    for (const [y, z] of [[0.33, 0.2], [0.66, 0.0], [1.0, -0.2]] as const)
      for (let k = 0; k < 3; k++) box(g, 0.1, 0.09, 0.26, M(cols[(k + Math.round(y * 3)) % 4]!), -0.4 + k * 0.4, y, z);
  },
  mannequin(g, p) {
    const m = M(0xeeeae4, { roughness: 0.4 });
    cyl(g, 0.2, 0.22, 0.03, METAL(), 0, 0, 0, 24);
    cyl(g, 0.015, 0.015, 0.5, METAL(), 0, 0.03, 0, 8);
    cyl(g, 0.12, 0.24, 0.6, M(p.accent), 0, 0.5, 0, 24);
    cyl(g, 0.16, 0.12, 0.45, m, 0, 1.08, 0, 20);
    cyl(g, 0.04, 0.04, 0.1, m, 0, 1.53, 0, 10);
    const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 2), m);
    head.position.set(0, 1.7, 0);
    head.castShadow = true;
    g.add(head);
  },
  accspin(g, p) {
    cyl(g, 0.25, 0.28, 0.04, METAL(), 0, 0, 0, 24);
    cyl(g, 0.02, 0.02, 1.56, METAL(), 0, 0.04, 0, 8);
    const cols = [p.accent, p.up, "#2f2f2f", "#c9a46a", "#6d7d8f"];
    [0.6, 1.0, 1.4].forEach((y, t) => {
      box(g, 0.56, 0.02, 0.02, METAL(), 0, y, 0);
      box(g, 0.02, 0.02, 0.56, METAL(), 0, y, 0);
      for (const [x, z] of [[0.25, 0], [-0.25, 0], [0, 0.25], [0, -0.25]] as const) box(g, 0.08, 0.2, 0.08, M(cols[(t + Math.abs(x * 8) + z * 4 + 5) % 5 | 0]!), x, y - 0.22, z);
    });
  },
  fitting(g, p) {
    const wall = M(p.wall), wd = M(p.wood);
    box(g, 1.2, 2.2, 0.05, wall, 0, 0, -0.575);
    for (const sx of [-1, 1]) box(g, 0.05, 2.2, 1.2, wall, sx * 0.575, 0, 0);
    box(g, 1.2, 0.04, 0.04, METAL(), 0, 2.12, 0.56);
    box(g, 0.55, 1.95, 0.04, M(p.up), -0.3, 0.12, 0.56);
    box(g, 0.45, 1.2, 0.02, MIRROR(), 0, 0.5, -0.54);
    box(g, 0.4, 0.45, 0.3, wd, 0.3, 0, -0.35);
  },
  mirror(g, p) {
    box(g, 0.6, 1.8, 0.05, M(p.wood), 0, 0, -0.08);
    box(g, 0.52, 1.7, 0.01, MIRROR(), 0, 0.05, -0.05);
    box(g, 0.6, 0.03, 0.3, M(p.wood), 0, 0, 0);
  },
  cashdesk(g, p) {
    box(g, 1.6, 0.95, 0.7, M(p.accent), 0, 0, 0);
    box(g, 1.64, 0.05, 0.74, M(p.wood), 0, 0.95, 0);
    box(g, 0.32, 0.22, 0.04, DARK(), 0.4, 1.0, -0.15);
    box(g, 0.08, 0.04, 0.14, DARK(), 0.05, 1.0, -0.05);
    box(g, 0.3, 0.12, 0.2, M(0xe9e2d6), -0.5, 1.0, -0.1);
  },
  bench(g, p) {
    for (const [x, z] of [[-0.55, -0.17], [0.55, -0.17], [-0.55, 0.17], [0.55, 0.17]] as const) box(g, 0.04, 0.33, 0.04, M(p.wood), x, 0, z);
    box(g, 1.2, 0.12, 0.45, M(p.up), 0, 0.33, 0);
  },
  plinth(g, p) {
    box(g, 1.2, 0.38, 0.8, WHITE(), 0, 0, 0);
    box(g, 1.22, 0.02, 0.82, M(p.wood), 0, 0.38, 0);
    cyl(g, 0.08, 0.1, 0.3, M(p.accent), -0.3, 0.4, 0);
    box(g, 0.3, 0.12, 0.25, M(p.up), 0.25, 0.4, 0.05);
  },
  /* bookshop / gift shop */
  bookcase(g, p) {
    const wd = M(p.wood), lv = [0.08, 0.48, 0.88, 1.28, 1.68];
    shelves(g, 1.0, 0.35, 2.1, lv, wd);
    lv.forEach((y, k) => books(g, -0.46, 0.46, y + 0.03, 0.02, 0.24, 0.32, 11 + k));
  },
  lowcase(g, p) {
    const wd = M(p.wood);
    shelves(g, 1.2, 0.35, 1.0, [0.06, 0.5], wd);
    books(g, -0.56, 0.56, 0.09, 0.02, 0.24, 0.34, 21);
    books(g, -0.56, 0.56, 0.53, 0.02, 0.24, 0.34, 22);
    for (const [x, c] of [[-0.35, p.accent], [0.05, "#f2e6cf"], [0.4, "#23395b"]] as const) box(g, 0.22, 0.03, 0.28, M(c), x, 1.0, 0);
  },
  dblshelf(g, p) {
    const wd = M(p.wood), lv = [0.06, 0.42, 0.78, 1.14];
    box(g, 1.2, 1.5, 0.03, wd, 0, 0, 0);
    for (const sx of [-1, 1]) box(g, 0.03, 1.5, 0.6, wd, sx * 0.585, 0, 0);
    box(g, 1.2, 0.03, 0.6, wd, 0, 1.47, 0);
    lv.forEach((y, k) => {
      box(g, 1.14, 0.03, 0.6, wd, 0, y, 0);
      books(g, -0.55, 0.55, y + 0.03, 0.15, 0.22, 0.3, 31 + k);
      books(g, -0.55, 0.55, y + 0.03, -0.15, 0.22, 0.3, 41 + k);
    });
  },
  bookspin(g) {
    cyl(g, 0.26, 0.28, 0.05, METAL(), 0, 0, 0, 24);
    cyl(g, 0.02, 0.02, 1.65, METAL(), 0, 0.05, 0, 8);
    const r = rng(51);
    for (let t = 0; t < 4; t++) {
      const y = 0.3 + t * 0.34;
      box(g, 0.42, 0.3, 0.42, METAL(), 0, y, 0);
      for (const [x, z, ry] of [[0, 0.22, 0], [0, -0.22, 0], [0.22, 0, 1], [-0.22, 0, 1]] as const) {
        const c = M(BOOK[Math.floor(r() * BOOK.length)]!);
        if (ry) box(g, 0.02, 0.24, 0.32, c, x, y + 0.03, z);
        else box(g, 0.32, 0.24, 0.02, c, x, y + 0.03, z);
      }
    }
  },
  cardrack(g, p) {
    box(g, 1.2, 1.8, 0.04, M(p.wood), 0, 0, -0.13);
    const r = rng(61), cols = ["#f2e6cf", "#e3879a", "#9fc48d", "#f6e27a", "#7c8fd1", "#ffffff", "#f2b880"];
    for (let row = 0; row < 5; row++) {
      const y = 0.25 + row * 0.3;
      box(g, 1.14, 0.02, 0.12, M(p.wood), 0, y, -0.06);
      for (let k = 0; k < 6; k++) box(g, 0.15, 0.2, 0.015, M(cols[Math.floor(r() * cols.length)]!), -0.47 + k * 0.188, y + 0.02, -0.05);
    }
  },
  ladder(g, p) {
    const L = new THREE.Group(), wd = M(p.wood);
    for (const x of [-0.21, 0.21]) box(L, 0.045, 2.15, 0.045, wd, x, 0, 0);
    for (let y = 0.3; y < 2.1; y += 0.3) box(L, 0.42, 0.03, 0.06, wd, 0, y, 0);
    L.rotation.x = -0.258;
    L.position.z = 0.27;
    g.add(L);
    for (const x of [-0.21, 0.21]) cyl(g, 0.035, 0.035, 0.03, DARK(), x, 0, 0.27, 12);
    box(g, 0.5, 0.025, 0.025, METAL(), 0, 2.06, -0.28);
  },
  booktable(g, p) {
    const wd = M(p.wood);
    box(g, 1.4, 0.04, 0.9, wd, 0, 0.71, 0);
    for (const [x, z] of [[-0.64, -0.39], [0.64, -0.39], [-0.64, 0.39], [0.64, 0.39]] as const) box(g, 0.05, 0.71, 0.05, wd, x, 0, z);
    const r = rng(71);
    for (const [x, z] of [[-0.45, -0.2], [-0.1, -0.2], [0.25, -0.2], [-0.45, 0.2], [-0.1, 0.2], [0.25, 0.2], [0.52, 0]] as const) {
      const n = 1 + Math.floor(r() * 4);
      box(g, 0.22, 0.035 * n, 0.3, M(BOOK[Math.floor(r() * BOOK.length)]!), x, 0.75, z);
    }
  },
  kids(g, p) {
    const mat = new THREE.Mesh(new THREE.CylinderGeometry(0.98, 0.98, 0.02, 40), M(p.up));
    mat.position.y = 0.01;
    mat.receiveShadow = true;
    g.add(mat);
    for (const [x, z, c] of [[-0.5, -0.65, p.accent], [0.2, -0.7, "#f6e27a"]] as const) {
      box(g, 0.6, 0.35, 0.45, M(c), x, 0.02, z);
      books(g, x - 0.27, x + 0.27, 0.37, z, 0.3, 0.2, Math.round(x * 10 + 90));
    }
    for (const [x, z, c] of [[-0.45, 0.35, "#9fc48d"], [0.1, 0.55, "#7c8fd1"], [0.55, 0.15, "#f2b880"]] as const) cyl(g, 0.18, 0.2, 0.22, M(c), x, 0.02, z, 20);
    box(g, 0.3, 0.02, 0.22, M("#f2e6cf"), 0.15, 0.03, 0.05);
  },
  armchair(g, p) {
    const up = M(p.up);
    box(g, 0.85, 0.42, 0.8, up, -0.17, 0, 0.03);
    box(g, 0.85, 0.5, 0.16, up, -0.17, 0.42, -0.3);
    for (const sx of [-1, 1]) box(g, 0.14, 0.22, 0.8, up, -0.17 + sx * 0.355, 0.42, 0.03);
    cyl(g, 0.17, 0.17, 0.03, M(p.wood), 0.43, 0.52, 0, 24);
    cyl(g, 0.025, 0.025, 0.52, M(p.wood), 0.43, 0, 0, 8);
    box(g, 0.2, 0.04, 0.26, M(p.accent), 0.43, 0.55, 0);
  },
  cashctr(g, p) {
    box(g, 1.6, 0.95, 0.7, M(p.wood), 0, 0, 0);
    box(g, 1.64, 0.05, 0.74, M(p.accent), 0, 0.95, 0);
    box(g, 0.32, 0.22, 0.04, DARK(), 0.45, 1.0, -0.15);
    books(g, -0.7, -0.2, 1.0, 0, 0.18, 0.22, 81);
  },
  giftcube(g, p) {
    box(g, 0.8, 0.45, 0.8, WHITE(), 0, 0, 0);
    box(g, 0.55, 0.45, 0.55, M(p.accent), 0.08, 0.45, -0.08);
    for (const [x, z, s, c] of [[-0.25, 0.25, 0.14, p.up], [0.2, 0.28, 0.1, "#f6e27a"], [0.1, -0.1, 0.12, "#f2e6cf"]] as const) box(g, s, s, s, M(c), x, x > 0 && z < 0 ? 0.9 : 0.45, z);
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
