// App state shared by every module: the saved store, the open layout, its geometry and view state.
import { BY, DEF_WIN, EXAMPLES } from "./data/catalog";
import { clone } from "./dom";
import { computeGeo } from "./geometry/rooms";
import type { Geo, ItemDef, Layout, Store, WinLimits } from "./types";

/** Browser storage key. Shop Planner starts fresh; it doesn't read the old cafe planner's data. */
export const STORAGE_KEY = "shop-planner-v1";

export type Mode = "3d" | "plan" | "walk";
export type Tab = "room" | "style" | "layouts" | "item";

let nextId = 1;
export const newId = (): number => nextId++;
export function withIds(L: Layout): Layout {
  for (const i of L.items) i.id = newId();
  return L;
}

function loadStore(): Store {
  let saved: Partial<Store> | null = null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) saved = JSON.parse(raw) as Partial<Store>;
  } catch {
    saved = null;
  }
  const s: Store = {
    active: "A", slots: {}, order: [], custom: [], seen: {}, versions: {}, settings: { win: { ...DEF_WIN } },
    ...(saved && saved.slots ? saved : {}),
  } as Store;
  if (!Array.isArray(s.custom)) s.custom = [];
  if (!s.seen || typeof s.seen !== "object") s.seen = {};
  if (!s.versions || typeof s.versions !== "object") s.versions = {};
  if (!s.settings || typeof s.settings !== "object") s.settings = { win: { ...DEF_WIN } };
  s.settings.win = { ...DEF_WIN, ...(s.settings.win ?? {}) };
  if (!Array.isArray(s.order) || !s.order.length) s.order = Object.keys(s.slots).length ? Object.keys(s.slots) : ["A", "B", "C"];
  for (const k of s.order) {
    if (!s.slots[k]) s.slots[k] = clone(EXAMPLES[k as keyof typeof EXAMPLES] ?? EXAMPLES.C);
    withIds(s.slots[k]!);
  }
  s.order = s.order.filter((k) => s.slots[k]);
  if (!s.slots[s.active]) s.active = s.order[0]!;
  return s;
}

const store = loadStore();

export const app = {
  store,
  /** the open layout */
  L: store.slots[store.active]!,
  geo: null as unknown as Geo,
  mode: "3d" as Mode,
  selected: null as number | null,
  clashSet: new Set<number>(),
  curTab: null as Tab | null,
  /** the stage has been measured once */
  sized: false,
  studioOpen: false,
  roomEdOpen: false,
  has3d: true,
};

export const WS = (): WinLimits => app.store.settings.win;
/** Snap a length to the window snap step from Settings. */
export const snapW = (v: number): number => Math.round(Math.round(v / WS().step) * WS().step * 1e4) / 1e4;
/** Furniture snaps to 5 cm. */
export const snap = (v: number): number => Math.round(v / 0.05) * 0.05;

export function refreshGeo(): Geo {
  app.geo = computeGeo(app.L, WS());
  return app.geo;
}

const REMOVED: ItemDef = { type: "?", name: "Removed item", w: 0.5, d: 0.5, h: 0.5, seats: 0, shape: "block", color: "#999999" };
/** A built-in or custom item definition by type. */
export function cat(t: string): ItemDef {
  return BY[t] ?? app.store.custom.find((c) => c.type === t) ?? { ...REMOVED, type: t };
}
export const seatsOf = (L: Layout): number => L.items.reduce((n, i) => n + (cat(i.type).seats || 0), 0);

let saveT: ReturnType<typeof setTimeout> | undefined;
export function save(): void {
  clearTimeout(saveT);
  saveT = setTimeout(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(app.store));
    } catch {
      /* storage blocked or full: keep working without saving */
    }
  }, 250);
}

/* ---------- Undo ---------- */
const undoStack: { slot: string; data: string }[] = [];
let onUndoAvailable: (on: boolean) => void = () => {};
let onLayoutRestored: () => void = () => {};
export function bindUndo(available: (on: boolean) => void, restored: () => void): void {
  onUndoAvailable = available;
  onLayoutRestored = restored;
}
export function pushUndo(): void {
  undoStack.push({ slot: app.store.active, data: JSON.stringify(app.L) });
  if (undoStack.length > 60) undoStack.shift();
  onUndoAvailable(true);
}
export function undo(): void {
  let u = undoStack.pop();
  while (u && !app.store.order.includes(u.slot)) u = undoStack.pop();
  if (!u) {
    onUndoAvailable(false);
    return;
  }
  app.store.slots[u.slot] = JSON.parse(u.data) as Layout;
  if (u.slot === app.store.active) {
    app.L = app.store.slots[u.slot]!;
    app.selected = null;
    onLayoutRestored();
  }
  onUndoAvailable(undoStack.length > 0);
  save();
}
