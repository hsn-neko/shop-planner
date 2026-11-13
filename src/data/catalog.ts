import type { ItemDef, Layout, Palette, Placed, WinLimits, WindowKind } from "../types";

export const PALETTES: Record<string, Palette> = {
  pistachio: { name: "Pistachio terrazzo", note: "Soft green, playful", floor: "terrazzo", f1: "#ebe5da", chips: ["#9fbf8f", "#e7b9a8", "#c9c1b2"], wall: "#dfe9d6", accent: "#86a872", wood: "#d2ad83", up: "#f1d9c8" },
  strawberry: { name: "Strawberry milk", note: "Pastel, photogenic", floor: "checker", f1: "#ffffff", f2: "#f4cfd3", wall: "#fbe8e6", accent: "#e3879a", wood: "#ecd3b6", up: "#f7c6cf" },
  matcha: { name: "Matcha minimal", note: "Japanese, calm oak", floor: "wood", f1: "#d9bf98", f2: "#cfb38a", wall: "#f1ede5", accent: "#5f7356", wood: "#bf9466", up: "#e3dccd" },
  noir: { name: "Parisian noir", note: "Moody, brass details", floor: "checker", f1: "#f2efe9", f2: "#1f1f1f", wall: "#2e3b3a", accent: "#b9965b", wood: "#5c3d2c", up: "#7a2f3a" },
};

export const SWATCHES = ["#e3879a", "#f2b880", "#f6e27a", "#9fc48d", "#6fb3b8", "#7c8fd1", "#b48ad6", "#8a5a44", "#2f2f2f", "#f4f1ea"];

const K = { grp: "Kitchen", zone: "kitchen" } as const;
const S = { grp: "Storage", zone: "storage" } as const;

/** Built-in pieces. w = width (x), d = depth (z), h = height. */
export const CAT: ItemDef[] = [
  { type: "display", h: 1.39, name: "Pastry display", grp: "Counter zone", w: 1.8, d: 0.75, seats: 0, stretch: true, front: true },
  { type: "counter", h: 1.22, name: "Service counter", grp: "Counter zone", w: 2.4, d: 0.7, seats: 0, stretch: true, front: true },
  { type: "espresso", h: 1.36, name: "Espresso station", grp: "Counter zone", w: 1.4, d: 0.65, seats: 0, stretch: true, front: true },
  { type: "gelato", h: 1.15, name: "Gelato freezer", grp: "Counter zone", w: 1.6, d: 0.85, seats: 0, stretch: true, front: true },
  { type: "fridge", h: 1.95, name: "Grab-and-go fridge", grp: "Counter zone", w: 1.0, d: 0.65, seats: 0, stretch: true, front: true },
  { type: "two", h: 0.91, name: "Two-top table", grp: "Seating", w: 1.4, d: 0.8, seats: 2 },
  { type: "four", h: 0.91, name: "Four-top table", grp: "Seating", w: 1.6, d: 1.6, seats: 4 },
  { type: "booth", h: 1.1, name: "Booth", grp: "Seating", w: 1.8, d: 1.5, seats: 4 },
  { type: "ledge", h: 1.05, name: "Window ledge + stools", grp: "Seating", w: 2.0, d: 0.6, seats: 3, stretch: true },
  { type: "sofa", h: 0.87, name: "Sofa corner", grp: "Seating", w: 2.0, d: 1.6, seats: 3 },
  { type: "prep", h: 0.9, name: "Prep table", ...K, col: "#b9c0c6", w: 1.5, d: 0.7, seats: 0, stretch: true, front: true },
  { type: "deckoven", h: 1.6, name: "Deck oven", ...K, col: "#8c9196", w: 1.3, d: 1.0, seats: 0, front: true },
  { type: "convoven", h: 1.58, name: "Convection oven", ...K, col: "#8c9196", w: 0.9, d: 0.85, seats: 0, front: true },
  { type: "hob", h: 0.88, name: "Induction hob", ...K, col: "#6f7378", w: 0.8, d: 0.75, seats: 0, front: true },
  { type: "mixer", h: 1.26, name: "Planetary mixer", ...K, col: "#d6d0c8", w: 0.6, d: 0.75, seats: 0, front: true },
  { type: "sink", h: 1.15, name: "Double sink", ...K, col: "#b9c0c6", w: 1.4, d: 0.7, seats: 0, stretch: true, front: true },
  { type: "handsink", h: 1.08, name: "Hand-wash basin", ...K, col: "#b9c0c6", w: 0.5, d: 0.4, seats: 0, front: true },
  { type: "dish", h: 0.85, name: "Dishwasher", ...K, col: "#b9c0c6", w: 0.6, d: 0.65, seats: 0, front: true },
  { type: "kfridge", h: 2.0, name: "Upright fridge", ...K, col: "#a7aeb4", w: 1.4, d: 0.8, seats: 0, stretch: true, front: true },
  { type: "blast", h: 1.85, name: "Blast chiller", ...K, col: "#a7aeb4", w: 0.8, d: 0.8, seats: 0, front: true },
  { type: "dshelf", h: 1.8, name: "Dry-store shelving", ...S, col: "#d9c2a3", w: 1.2, d: 0.5, seats: 0, stretch: true, front: true },
  { type: "walkin", h: 2.3, name: "Walk-in cooler", ...S, col: "#cfd8de", w: 2.4, d: 2.0, seats: 0, stretch: true, front: true },
  { type: "cfreezer", h: 0.87, name: "Chest freezer", ...S, col: "#e4e6e8", w: 1.3, d: 0.7, seats: 0, stretch: true, front: true },
  { type: "bins", h: 0.7, name: "Ingredient bins", ...S, col: "#f2b880", w: 0.9, d: 0.5, seats: 0 },
  { type: "mopsink", h: 0.9, name: "Mop sink", ...S, col: "#a9adb1", w: 0.6, d: 0.6, seats: 0 },
  { type: "lockers", h: 1.8, name: "Staff lockers", ...S, col: "#7f93a8", w: 0.9, d: 0.5, seats: 0, stretch: true, front: true },
  { type: "plant", h: 1.07, name: "Potted plant", grp: "Details", w: 0.5, d: 0.5, seats: 0 },
  { type: "menu", h: 1.25, name: "Menu board", grp: "Details", w: 0.7, d: 0.5, seats: 0 },
];
export const BY: Record<string, ItemDef> = Object.fromEntries(CAT.map((c) => [c.type, c]));

/* ---------- Starter layouts ---------- */
const it = (type: string, x: number, z: number, r = 0): Placed => ({ id: 0, type, x, z, r });
export const EXAMPLES: Record<"A" | "B" | "C", Layout> = {
  A: {
    label: "Cosy dine-in", room: { w: 8, d: 10, h: 3.2, door: 0.1 }, palette: "pistachio", warmth: 0.6,
    items: [
      it("counter", -0.6, -4.4), it("espresso", 1.8, -4.6), it("display", -0.6, -3.3), it("gelato", -3.0, -4.3),
      it("fridge", 3.4, -3.2, -90), it("booth", -3.0, 0, 90), it("booth", -3.0, 2.2, 90),
      it("two", 0.2, -0.8), it("two", 0.2, 1.2), it("four", 2.4, 0.2), it("sofa", 2.8, 2.7),
      it("ledge", -2.4, 4.6), it("plant", 3.6, -1.6), it("plant", -3.65, 4.0), it("menu", 1.6, 4.2),
      it("prep", 1.6, -6.9), it("deckoven", 3.3, -8.0), it("sink", 0.3, -8.2), it("mixer", 2.2, -8.2), it("kfridge", 3.55, -6.6, 90), it("handsink", 1.3, -5.35, 180),
      it("dshelf", -3.75, -7.6, 270), it("dshelf", -3.75, -6.2, 270), it("cfreezer", -2.6, -5.5, 180), it("bins", -1.35, -8.3),
    ],
    boh: { mode: "both", side: "back", depth: 3.5, share: 0.6, swap: true, door: 1, hatch: true, storeDoor: false, backDoor: true },
    windows: [{ x: -2.3, z: 5, w: 2.2, kind: "shopfront" }, { x: 2.6, z: 5, w: 1.6, kind: "shopfront" }, { x: 4, z: 0.6, w: 1.6, kind: "window" }, { x: 1.6, z: -8.6, w: 1.2, kind: "high" }],
  },
  B: {
    label: "Grab-and-go", room: { w: 6, d: 8, h: 3, door: 0.35 }, palette: "strawberry", warmth: 0.45,
    items: [
      it("counter", 0, -3.4), it("espresso", 2.1, -3.6), it("display", 0, -2.3), it("fridge", -2.4, -3.4),
      it("gelato", -2.2, -1.8), it("ledge", -2.6, 0.8, 90), it("ledge", 2.6, 0.8, -90), it("ledge", -1.7, 3.65),
      it("plant", 2.6, -1.4), it("menu", 0.6, -0.9),
      it("prep", 4.9, 0.5, 90), it("sink", 5.25, 2.6, 90), it("kfridge", 5.2, -1.2, 90), it("convoven", 5.15, -3.3, 90), it("handsink", 3.45, -1.0, 270),
    ],
    boh: { mode: "kitchen", side: "right", depth: 2.5, share: 0.6, swap: false, door: -0.765, hatch: false, storeDoor: false, backDoor: false },
    windows: [{ x: -1.6, z: 4, w: 1.6, kind: "shopfront" }, { x: -3, z: 0.8, w: 2, kind: "window" }],
  },
  C: { label: "Blank", room: { w: 8, d: 10, h: 3.2, door: 0 }, palette: "matcha", warmth: 0.5, items: [] },
};

/* ---------- Windows ---------- */
export const WK: Record<WindowKind, { name: string; sill: number; head: number }> = {
  window: { name: "Window", sill: 0.9, head: 2.1 },
  shopfront: { name: "Shopfront glazing", sill: 0.3, head: 2.7 },
  high: { name: "High window", sill: 1.7, head: 2.3 },
};
export const DEF_WIN: WinLimits = { sillMin: 0, sillMax: 2.4, minH: 0.3, gap: 0.2, wMin: 0.5, wMax: 4, step: 0.05 };

export const ROOM_NAMES = { cafe: "Cafe", kitchen: "Kitchen", storage: "Storage" } as const;
