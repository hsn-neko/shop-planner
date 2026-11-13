import type { ItemDef, Layout, Palette, Placed, WinLimits, WindowKind } from "../types";

export const PALETTES: Record<string, Palette> = {
  /* cafe / bakery */
  pistachio: { kind: "cafe", name: "Pistachio terrazzo", note: "Soft green, playful", floor: "terrazzo", f1: "#ebe5da", chips: ["#9fbf8f", "#e7b9a8", "#c9c1b2"], wall: "#dfe9d6", accent: "#86a872", wood: "#d2ad83", up: "#f1d9c8" },
  strawberry: { kind: "cafe", name: "Strawberry milk", note: "Pastel, photogenic", floor: "checker", f1: "#ffffff", f2: "#f4cfd3", wall: "#fbe8e6", accent: "#e3879a", wood: "#ecd3b6", up: "#f7c6cf" },
  matcha: { kind: "cafe", name: "Matcha minimal", note: "Japanese, calm oak", floor: "wood", f1: "#d9bf98", f2: "#cfb38a", wall: "#f1ede5", accent: "#5f7356", wood: "#bf9466", up: "#e3dccd" },
  noir: { kind: "cafe", name: "Parisian noir", note: "Moody, brass details", floor: "checker", f1: "#f2efe9", f2: "#1f1f1f", wall: "#2e3b3a", accent: "#b9965b", wood: "#5c3d2c", up: "#7a2f3a" },
  /* retail boutique */
  gallery: { kind: "retail", name: "Gallery white", note: "Bright, lets stock stand out", floor: "terrazzo", f1: "#eceae6", chips: ["#d6d3ce", "#c4c0ba", "#f7f6f3"], wall: "#f7f6f3", accent: "#2f2f2f", wood: "#d8cbb8", up: "#e6e1da" },
  concrete: { kind: "retail", name: "Warm concrete", note: "Industrial, rust accents", floor: "terrazzo", f1: "#c9c2b9", chips: ["#b8b0a6", "#d6d0c8", "#a9a196"], wall: "#e8e1d8", accent: "#b5764f", wood: "#8c6a4f", up: "#c99a7c" },
  blush: { kind: "retail", name: "Blush & brass", note: "Soft pink, polished", floor: "terrazzo", f1: "#f3e6e1", chips: ["#e8b9b0", "#d9b77c", "#f8f1ee"], wall: "#f2d9d3", accent: "#b9965b", wood: "#e7cbb7", up: "#e8b9b0" },
  charcoal: { kind: "retail", name: "Charcoal & oak", note: "Dark walls, warm wood", floor: "wood", f1: "#b88e62", f2: "#ad845a", wall: "#3a3a3c", accent: "#c9a46a", wood: "#a8794d", up: "#5a5a5e" },
  /* bookshop / gift shop */
  library: { kind: "books", name: "Library green", note: "Deep green, dark wood", floor: "wood", f1: "#8a6040", f2: "#7d5638", wall: "#2f4a3c", accent: "#c9a46a", wood: "#6b4429", up: "#8f3b2f" },
  scandi: { kind: "books", name: "Scandi birch", note: "Pale wood, airy", floor: "wood", f1: "#e2cfae", f2: "#d8c3a0", wall: "#f4f1ea", accent: "#6f8fa6", wood: "#d9bf98", up: "#c9d6df" },
  kraft: { kind: "books", name: "Kraft & ink", note: "Brown paper, navy", floor: "wood", f1: "#c8a77d", f2: "#bf9d72", wall: "#e9dcc5", accent: "#23395b", wood: "#a9825a", up: "#c7a46c" },
  nursery: { kind: "books", name: "Nursery pastel", note: "Gentle, for young readers", floor: "checker", f1: "#fdf7ee", f2: "#d9ecf2", wall: "#f6ede0", accent: "#8fb8c9", wood: "#e8cfae", up: "#f4c9b8" },
};

export const SWATCHES = ["#e3879a", "#f2b880", "#f6e27a", "#9fc48d", "#6fb3b8", "#7c8fd1", "#b48ad6", "#8a5a44", "#2f2f2f", "#f4f1ea"];

const CA = { kind: "cafe" } as const;
const K = { grp: "Kitchen", zone: "kitchen", kind: "cafe" } as const;
const S = { grp: "Back-room storage", zone: "storage" } as const;
const RF = { grp: "Fixtures", kind: "retail", fix: 1 } as const;
const RS = { grp: "Fitting and service", kind: "retail" } as const;
const BS = { grp: "Shelving", kind: "books" } as const;
const BD = { grp: "Tables and reading", kind: "books" } as const;

/** Built-in pieces. w = width (x), d = depth (z), h = height. Every piece works in every shop type. */
export const CAT: ItemDef[] = [
  /* cafe / bakery */
  { type: "display", h: 1.39, name: "Pastry display", grp: "Counter zone", ...CA, w: 1.8, d: 0.75, seats: 0, stretch: true, front: true },
  { type: "counter", h: 1.22, name: "Service counter", grp: "Counter zone", ...CA, w: 2.4, d: 0.7, seats: 0, stretch: true, front: true },
  { type: "espresso", h: 1.36, name: "Espresso station", grp: "Counter zone", ...CA, w: 1.4, d: 0.65, seats: 0, stretch: true, front: true },
  { type: "gelato", h: 1.15, name: "Gelato freezer", grp: "Counter zone", ...CA, w: 1.6, d: 0.85, seats: 0, stretch: true, front: true },
  { type: "fridge", h: 1.95, name: "Grab-and-go fridge", grp: "Counter zone", ...CA, w: 1.0, d: 0.65, seats: 0, stretch: true, front: true },
  { type: "two", h: 0.91, name: "Two-top table", grp: "Seating", ...CA, w: 1.4, d: 0.8, seats: 2 },
  { type: "four", h: 0.91, name: "Four-top table", grp: "Seating", ...CA, w: 1.6, d: 1.6, seats: 4 },
  { type: "booth", h: 1.1, name: "Booth", grp: "Seating", ...CA, w: 1.8, d: 1.5, seats: 4 },
  { type: "ledge", h: 1.05, name: "Window ledge + stools", grp: "Seating", ...CA, w: 2.0, d: 0.6, seats: 3, stretch: true },
  { type: "sofa", h: 0.87, name: "Sofa corner", grp: "Seating", ...CA, w: 2.0, d: 1.6, seats: 3 },
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
  /* retail boutique */
  { type: "rail", h: 1.6, name: "Clothing rail (single)", ...RF, w: 1.2, d: 0.5, seats: 0, stretch: true },
  { type: "rail2", h: 1.6, name: "Clothing rail (double-sided)", ...RF, w: 1.5, d: 0.6, seats: 0, stretch: true },
  { type: "wallbay", h: 2.2, name: "Wall shelving bay", ...RF, w: 1.0, d: 0.45, seats: 0, stretch: true, front: true },
  { type: "nest", h: 0.8, name: "Nesting display tables", ...RF, w: 1.6, d: 0.9, seats: 0 },
  { type: "cabinet", h: 1.8, name: "Glass display cabinet", ...RF, w: 1.0, d: 0.5, seats: 0, stretch: true, front: true },
  { type: "shoes", h: 1.0, name: "Shoe display steps", ...RF, w: 1.2, d: 0.6, seats: 0, stretch: true, front: true },
  { type: "mannequin", h: 1.8, name: "Mannequin", ...RF, w: 0.5, d: 0.5, seats: 0, front: true },
  { type: "accspin", h: 1.6, name: "Accessories spinner", ...RF, w: 0.6, d: 0.6, seats: 0 },
  { type: "fitting", h: 2.2, name: "Fitting room", ...RS, w: 1.2, d: 1.2, seats: 0, front: true },
  { type: "mirror", h: 1.8, name: "Full-length mirror", ...RS, w: 0.6, d: 0.3, seats: 0, front: true },
  { type: "cashdesk", h: 1.0, name: "Cash desk", ...RS, w: 1.6, d: 0.7, seats: 0, stretch: true, front: true },
  { type: "bench", h: 0.45, name: "Bench / ottoman", ...RS, w: 1.2, d: 0.45, seats: 0, stretch: true },
  { type: "plinth", h: 0.4, name: "Window display plinth", ...RS, w: 1.2, d: 0.8, seats: 0, stretch: true },
  /* bookshop / gift shop */
  { type: "bookcase", h: 2.1, name: "Wall bookcase", ...BS, shelf: 1, w: 1.0, d: 0.35, seats: 0, stretch: true, front: true },
  { type: "lowcase", h: 1.0, name: "Low bookcase", ...BS, shelf: 1, w: 1.2, d: 0.35, seats: 0, stretch: true, front: true },
  { type: "dblshelf", h: 1.5, name: "Double-sided shelving", ...BS, shelf: 2, w: 1.2, d: 0.6, seats: 0, stretch: true },
  { type: "bookspin", h: 1.7, name: "Spinner rack (books or cards)", ...BS, shelf: 1, w: 0.6, d: 0.6, seats: 0 },
  { type: "cardrack", h: 1.8, name: "Greeting-card wall rack", ...BS, shelf: 1, w: 1.2, d: 0.3, seats: 0, stretch: true, front: true },
  { type: "ladder", h: 2.1, name: "Rolling library ladder", ...BS, w: 0.5, d: 0.6, seats: 0 },
  { type: "booktable", h: 0.75, name: "Display table", ...BD, w: 1.4, d: 0.9, seats: 0, stretch: true },
  { type: "kids", h: 0.6, name: "Children's corner (book boxes + mat)", ...BD, w: 2.0, d: 2.0, seats: 0 },
  { type: "armchair", h: 0.9, name: "Reading armchair + side table", ...BD, w: 1.2, d: 0.9, seats: 0, front: true },
  { type: "cashctr", h: 1.0, name: "Cash counter", ...BD, w: 1.6, d: 0.7, seats: 0, stretch: true, front: true },
  { type: "giftcube", h: 0.9, name: "Gift display cube", ...BD, w: 0.8, d: 0.8, seats: 0 },
  /* shared: back rooms and details */
  { type: "dshelf", h: 1.8, name: "Storage shelving", ...S, col: "#d9c2a3", w: 1.2, d: 0.5, seats: 0, stretch: true, front: true },
  { type: "walkin", h: 2.3, name: "Walk-in cooler", ...S, col: "#cfd8de", w: 2.4, d: 2.0, seats: 0, stretch: true, front: true },
  { type: "cfreezer", h: 0.87, name: "Chest freezer", ...S, col: "#e4e6e8", w: 1.3, d: 0.7, seats: 0, stretch: true, front: true },
  { type: "bins", h: 0.7, name: "Stock bins", ...S, col: "#f2b880", w: 0.9, d: 0.5, seats: 0 },
  { type: "mopsink", h: 0.9, name: "Mop sink", ...S, col: "#a9adb1", w: 0.6, d: 0.6, seats: 0 },
  { type: "lockers", h: 1.8, name: "Staff lockers", ...S, col: "#7f93a8", w: 0.9, d: 0.5, seats: 0, stretch: true, front: true },
  { type: "plant", h: 1.07, name: "Potted plant", grp: "Details", w: 0.5, d: 0.5, seats: 0 },
  { type: "menu", h: 1.25, name: "Sign board", grp: "Details", w: 0.7, d: 0.5, seats: 0 },
];
export const BY: Record<string, ItemDef> = Object.fromEntries(CAT.map((c) => [c.type, c]));

/* ---------- Starter layouts ---------- */
const it = (type: string, x: number, z: number, r = 0): Placed => ({ id: 0, type, x, z, r });
/** Starter layouts by key; SHOP_TYPES lists which belong to each type. "C" is the old blank start, kept so first-run storage has three layouts. */
export const EXAMPLES: Record<string, Layout> = {
  A: {
    label: "Cosy dine-in", type: "cafe", room: { w: 8, d: 10, h: 3.2, door: 0.1 }, palette: "pistachio", warmth: 0.6,
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
    label: "Grab-and-go", type: "cafe", room: { w: 6, d: 8, h: 3, door: 0.35 }, palette: "strawberry", warmth: 0.45,
    items: [
      it("counter", 0, -3.4), it("espresso", 2.1, -3.6), it("display", 0, -2.3), it("fridge", -2.4, -3.4),
      it("gelato", -2.2, -1.8), it("ledge", -2.6, 0.8, 90), it("ledge", 2.6, 0.8, -90), it("ledge", -1.7, 3.65),
      it("plant", 2.6, -1.4), it("menu", 0.6, -0.9),
      it("prep", 4.9, 0.5, 90), it("sink", 5.25, 2.6, 90), it("kfridge", 5.2, -1.2, 90), it("convoven", 5.15, -3.3, 90), it("handsink", 3.45, -1.0, 270),
    ],
    boh: { mode: "kitchen", side: "right", depth: 2.5, share: 0.6, swap: false, door: -0.765, hatch: false, storeDoor: false, backDoor: false },
    windows: [{ x: -1.6, z: 4, w: 1.6, kind: "shopfront" }, { x: -3, z: 0.8, w: 2, kind: "window" }],
  },
  C: { label: "Blank", type: "cafe", room: { w: 8, d: 10, h: 3.2, door: 0 }, palette: "matcha", warmth: 0.5, items: [] },
  /* retail boutique */
  R1: {
    label: "Boutique classic", type: "retail", room: { w: 7, d: 10, h: 3.2, door: 0 }, palette: "gallery", warmth: 0.5,
    items: [
      it("wallbay", -3.27, -2.5, 90), it("wallbay", -3.27, -1.5, 90), it("wallbay", -3.27, -0.5, 90), it("wallbay", -3.27, 0.5, 90),
      it("wallbay", 3.27, -3.5, -90), it("wallbay", 3.27, -2.5, -90), it("wallbay", 3.27, -1.5, -90), it("wallbay", 3.27, -0.5, -90),
      it("rail2", -1.0, -0.4, 90), it("rail2", 1.0, -0.4, 90), it("rail", 0, 1.6),
      it("fitting", -2.85, -4.38), it("fitting", -1.6, -4.38), it("mirror", 1.6, -4.8), it("bench", -2.2, -3.2),
      it("shoes", -3.2, 1.6, 90), it("cabinet", 3.25, 1.5, -90), it("accspin", 1.6, 2.4),
      it("cashdesk", 2.3, 3.7), it("mannequin", -2.6, 3.2), it("mannequin", -1.9, 3.2), it("plinth", -2.3, 4.5), it("plinth", 2.3, 4.5), it("plant", -3.1, 2.8),
      it("dshelf", -3.15, -6.1, 90), it("dshelf", -3.15, -7.3, 90), it("bins", -1.8, -7.8), it("lockers", 3.25, -6.0, -90), it("bench", 2.0, -6.4), it("mopsink", 1.05, -7.8),
    ],
    boh: { mode: "both", side: "back", depth: 3, share: 0.6, swap: false, door: 0.85, hatch: false, storeDoor: false, backDoor: true },
    windows: [{ x: -2.3, z: 5, w: 1.8, kind: "shopfront" }, { x: 2.3, z: 5, w: 1.8, kind: "shopfront" }],
  },
  R2: {
    label: "Open concept", type: "retail", room: { w: 9, d: 8, h: 3.4, door: 0 }, palette: "concrete", warmth: 0.45,
    items: [
      it("nest", -1.3, -0.6), it("nest", 1.3, -0.6), it("nest", 0, 1.2),
      it("rail", -4.2, -1.5, 90), it("rail", -4.2, 0.3, 90), it("rail", -4.2, 2.1, 90),
      it("rail", -2.5, -3.7), it("rail", -1.0, -3.7), it("rail", 0.5, -3.7), it("wallbay", 2.0, -3.77), it("wallbay", 3.0, -3.77),
      it("rail", 4.2, 0.9, -90), it("cabinet", 4.2, 2.5, -90),
      it("fitting", -3.8, -3.3), it("mirror", -4.35, -2.4, 90),
      it("cashdesk", 2.4, 2.6), it("plinth", -3.0, 3.55), it("plinth", -1.6, 3.55), it("mannequin", 3.6, 3.6), it("plant", 1.6, 3.65),
      it("dshelf", 6.65, 1.2, -90), it("dshelf", 6.65, 2.6, -90), it("bins", 5.4, 3.65), it("lockers", 6.75, -1.0, -90),
    ],
    boh: { mode: "kitchen", side: "right", depth: 2.5, share: 0.6, swap: false, door: -0.7, hatch: false, storeDoor: false, backDoor: false },
    windows: [{ x: -2.4, z: 4, w: 2.2, kind: "shopfront" }, { x: 2.4, z: 4, w: 2.2, kind: "shopfront" }, { x: -4.5, z: 0.3, w: 1.6, kind: "high" }],
  },
  /* bookshop / gift shop */
  K1: {
    label: "Neighbourhood bookshop", type: "books", room: { w: 8, d: 12, h: 3.2, door: 0 }, palette: "library", warmth: 0.65,
    items: [
      it("bookcase", -3.82, -5.0, 90), it("bookcase", -3.82, -4.0, 90), it("bookcase", -3.82, -3.0, 90), it("bookcase", -3.82, -2.0, 90),
      it("bookcase", -3.82, -1.0, 90), it("bookcase", -3.82, 0.0, 90), it("bookcase", -3.82, 1.0, 90), it("bookcase", -3.82, 2.0, 90),
      it("bookcase", 3.82, -5.0, -90), it("bookcase", 3.82, -4.0, -90), it("bookcase", 3.82, -3.0, -90), it("bookcase", 3.82, -2.0, -90),
      it("bookcase", 3.82, -1.0, -90), it("bookcase", -2.5, -5.82), it("bookcase", -1.5, -5.82), it("ladder", -3.35, -0.5, 90),
      it("dblshelf", -1.5, -3.0, 90), it("dblshelf", -1.5, -1.6, 90), it("dblshelf", 0.5, -3.0, 90), it("dblshelf", 0.5, -1.6, 90),
      it("kids", 2.4, 1.2), it("armchair", -2.3, 2.3, 90), it("armchair", -2.3, 0.7, 90), it("booktable", 0, 2.0),
      it("cashctr", 2.5, 4.8), it("bookspin", -1.6, 4.6), it("lowcase", 3.4, 3.4, -90), it("plant", -3.6, 5.5), it("menu", -1.2, 5.6),
      it("dshelf", -3.15, -7.2, 90), it("dshelf", -3.15, -8.4, 90), it("dshelf", -1.6, -8.85), it("bins", -0.3, -8.8), it("booktable", 2.3, -7.8), it("lockers", 3.55, -6.5, -90),
    ],
    boh: { mode: "both", side: "back", depth: 3, share: 0.55, swap: false, door: 0.75, hatch: false, storeDoor: false, backDoor: true },
    windows: [{ x: -2.4, z: 6, w: 2.2, kind: "shopfront" }, { x: 2.4, z: 6, w: 2.2, kind: "shopfront" }],
  },
  K2: {
    label: "Gift & stationery", type: "books", room: { w: 6, d: 9, h: 3, door: 0.3 }, palette: "kraft", warmth: 0.55,
    items: [
      it("booktable", -1.2, 2.6), it("giftcube", 1.2, 2.8), it("giftcube", 0.9, 1.4), it("booktable", -0.6, 0.6),
      it("cardrack", 2.85, -1.0, -90), it("cardrack", 2.85, 0.4, -90), it("bookspin", 0.2, -1.4), it("bookspin", -1.1, -1.4),
      it("lowcase", -1.8, -4.32), it("lowcase", -0.5, -4.32), it("lowcase", 0.8, -4.32), it("lowcase", 2.1, -4.32),
      it("cashctr", -1.8, 3.9), it("plant", 2.6, 4.1), it("menu", 2.5, 2.0, -90),
      it("dshelf", -5.15, -2.6, 90), it("dshelf", -5.15, -1.2, 90), it("dshelf", -5.15, 0.2, 90), it("bins", -4.0, 3.9),
    ],
    boh: { mode: "kitchen", side: "left", depth: 2.5, share: 0.6, swap: false, door: 0.4, hatch: false, storeDoor: false, backDoor: true },
    windows: [{ x: -1.5, z: 4.5, w: 1.8, kind: "shopfront" }, { x: 2.0, z: 4.5, w: 1.4, kind: "shopfront" }],
  },
};

/* ---------- Windows ---------- */
export const WK: Record<WindowKind, { name: string; sill: number; head: number }> = {
  window: { name: "Window", sill: 0.9, head: 2.1 },
  shopfront: { name: "Shopfront glazing", sill: 0.3, head: 2.7 },
  high: { name: "High window", sill: 1.7, head: 2.3 },
};
export const DEF_WIN: WinLimits = { sillMin: 0, sillMax: 2.4, minH: 0.3, gap: 0.2, wMin: 0.5, wMax: 4, step: 0.05 };


