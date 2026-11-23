// Checks saved data before the app uses it. Browser storage (and, later, imported files) can hold anything,
// so every value is rebuilt from an allow-list: known keys and kinds, finite numbers in range, plain ids and #hex colours.
// Anything else is dropped or replaced by a default. Pure functions, no DOM, so they can be unit-tested.
import { BY, DEF_WIN, PALETTES, WK } from "./catalog";
import { FINISHES } from "./finishes";
import { SHOP_TYPES } from "./shopTypes";
import { AREA_KINDS, DIVIDERS, SIDES } from "../geometry/areas";
import type {
  Area, Boh, CustomShape, Divider, ItemDef, Layout, Part, Placed, Room, ShopType, Side, Store, Version, WindowDef, WinLimits,
} from "../types";

/** Caps that keep a hostile file from freezing the tab. Far above anything the app makes. */
export const LIMITS = { layouts: 200, items: 1000, windows: 100, areas: 100, custom: 500, parts: 200, versions: 30, roomNames: 100, seen: 200, versionData: 1_000_000 };

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === "object" && v !== null && !Array.isArray(v);
const own = (o: object, k: string): boolean => Object.prototype.hasOwnProperty.call(o, k);
/** A key of a lookup table, own keys only, so "__proto__" or "constructor" never match. */
const keyOf = <T extends object>(table: T, v: unknown): v is keyof T & string => typeof v === "string" && own(table, v);
const pick = <T extends string>(table: object, v: unknown, def: T): T => (keyOf(table, v) ? (v as T) : def);
const oneOf = <T extends string>(list: readonly T[], v: unknown, def: T): T => (list.includes(v as T) ? (v as T) : def);

/** Ids are plain: letters, digits, _ and -, at most 40 long, and never a name every object already has ("__proto__", "toString"…). */
export const isId = (v: unknown): v is string => typeof v === "string" && /^[A-Za-z0-9_-]{1,40}$/.test(v) && !(v in Object.prototype) && v !== "prototype";
/** Colours are #rgb or #rrggbb, the only forms the app writes. */
export const isColor = (v: unknown): v is string => typeof v === "string" && /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i.test(v);

/** A finite number clamped to lo..hi, or def. */
export function num(v: unknown, lo: number, hi: number, def: number): number {
  return typeof v === "number" && Number.isFinite(v) ? Math.min(hi, Math.max(lo, v)) : def;
}
const int = (v: unknown, lo: number, hi: number, def: number): number => Math.round(num(v, lo, hi, def));
/** Text, trimmed to max characters, with control characters removed. */
export function text(v: unknown, max: number, def = ""): string {
  if (typeof v !== "string") return def;
  // eslint-disable-next-line no-control-regex
  return v.replace(/[\u0000-\u001f\u007f]/g, "").slice(0, max);
}
const bool = (v: unknown, def: boolean): boolean => (typeof v === "boolean" ? v : def);
const arr = (v: unknown, max: number): unknown[] => (Array.isArray(v) ? v.slice(0, max) : []);
const optNum = (v: unknown, lo: number, hi: number): number | undefined => (typeof v === "number" && Number.isFinite(v) ? num(v, lo, hi, lo) : undefined);

let fresh = 0;
const newId = (p: string): string => p + Date.now().toString(36) + (fresh++).toString(36);

/** Coordinates: the largest room is 20 m plus an 8 m back room, so ±50 m is plenty. */
const XY = 50;
const SHAPES = ["rect", "L", "T", "U"] as const;
const CORNERS = ["bl", "br", "fl", "fr"] as const;
const CUSTOM_SHAPES: readonly CustomShape[] = ["block", "round", "square", "parts"];

function room(v: unknown): Room {
  const o = isObj(v) ? v : {};
  const r: Room = { w: num(o.w, 4, 20, 8), d: num(o.d, 4, 20, 10), h: num(o.h, 2.6, 4.5, 3.2), door: num(o.door, -1, 1, 0) };
  if (o.shape !== undefined) r.shape = oneOf(SHAPES, o.shape, "rect");
  if (o.cwf !== undefined) r.cwf = num(o.cwf, 0.15, 0.85, 0.5);
  if (o.cdf !== undefined) r.cdf = num(o.cdf, 0.15, 0.85, 0.5);
  if (o.corner !== undefined) r.corner = oneOf(CORNERS, o.corner, "fl");
  if (o.cside !== undefined) r.cside = oneOf(["back", "front"] as const, o.cside, "front");
  return r;
}

function boh(v: unknown): Boh | undefined {
  if (!isObj(v)) return undefined;
  return {
    mode: oneOf(["none", "kitchen", "both"] as const, v.mode, "none"),
    side: oneOf(["back", "left", "right"] as const, v.side, "back"),
    depth: num(v.depth, 1.5, 8, 3.5),
    share: num(v.share, 0.2, 0.8, 0.6),
    swap: bool(v.swap, false),
    door: num(v.door, -1, 1, 0),
    hatch: bool(v.hatch, true),
    storeDoor: bool(v.storeDoor, false),
    backDoor: bool(v.backDoor, true),
  };
}

function placed(v: unknown): Placed | null {
  if (!isObj(v) || !isId(v.type)) return null;
  const p: Placed = { id: 0, type: v.type, x: num(v.x, -XY, XY, 0), z: num(v.z, -XY, XY, 0), r: num(v.r, -720, 720, 0) };
  for (const k of ["sx", "sy", "sz"] as const) {
    const s = optNum(v[k], 0.05, 20);
    if (s !== undefined) p[k] = s;
  }
  if (isColor(v.color)) p.color = v.color;
  return p;
}

function win(v: unknown): WindowDef | null {
  if (!isObj(v)) return null;
  const w: WindowDef = { id: isId(v.id) ? v.id : newId("w"), x: num(v.x, -XY, XY, 0), z: num(v.z, -XY, XY, 0), w: num(v.w, 0.1, 10, 1.2), kind: pick(WK, v.kind, "window") };
  const sill = optNum(v.sill, 0, 5), head = optNum(v.head, 0, 5);
  if (sill !== undefined) w.sill = sill;
  if (head !== undefined) w.head = head;
  return w;
}

function area(v: unknown): Area | null {
  if (!isObj(v)) return null;
  const x0 = num(v.x0, -XY, XY, NaN), x1 = num(v.x1, -XY, XY, NaN), z0 = num(v.z0, -XY, XY, NaN), z1 = num(v.z1, -XY, XY, NaN);
  if (![x0, x1, z0, z1].every(Number.isFinite) || x1 <= x0 || z1 <= z0) return null;
  const a: Area = {
    id: isId(v.id) ? v.id : newId("a"), name: text(v.name, 40), kind: pick(AREA_KINDS, v.kind, "general"),
    finish: v.finish === "layout" ? "layout" : pick(FINISHES, v.finish, "layout"), x0, x1, z0, z1,
  };
  if (isObj(v.div)) {
    const div: Partial<Record<Side, Divider>> = {};
    for (const s of SIDES) {
      const d = v.div[s];
      if (isObj(d) && keyOf(DIVIDERS, d.kind)) div[s] = { kind: d.kind, gap: d.gap === null ? null : num(d.gap, -1, 1, 0) };
    }
    a.div = div;
  }
  return a;
}

/** One layout: unknown fields are dropped, unknown kinds fall back to defaults. Returns null if it isn't a layout at all. */
export function sanitizeLayout(v: unknown): Layout | null {
  if (!isObj(v)) return null;
  const type: ShopType | undefined = v.type === undefined ? undefined : pick(SHOP_TYPES, v.type, "cafe");
  const L: Layout = {
    room: room(v.room),
    palette: pick(PALETTES, v.palette, SHOP_TYPES[type ?? "cafe"].palette),
    warmth: num(v.warmth, 0, 1, 0.5),
    items: arr(v.items, LIMITS.items).map(placed).filter((p): p is Placed => p !== null),
  };
  if (type) L.type = type;
  if (typeof v.label === "string") L.label = text(v.label, 40);
  if (isObj(v.names)) {
    L.names = {};
    if (typeof v.names.kitchen === "string") L.names.kitchen = text(v.names.kitchen, 40);
    if (typeof v.names.storage === "string") L.names.storage = text(v.names.storage, 40);
  }
  const b = boh(v.boh);
  if (b) L.boh = b;
  if (Array.isArray(v.windows)) L.windows = arr(v.windows, LIMITS.windows).map(win).filter((w): w is WindowDef => w !== null);
  if (Array.isArray(v.areas)) L.areas = arr(v.areas, LIMITS.areas).map(area).filter((a): a is Area => a !== null);
  return L;
}

function part(v: unknown): Part | null {
  if (!isObj(v)) return null;
  return {
    k: oneOf(["box", "cyl"] as const, v.k, "box"),
    w: num(v.w, 0.01, 10, 0.5), h: num(v.h, 0.01, 10, 0.5), d: num(v.d, 0.01, 10, 0.5),
    x: num(v.x, -10, 10, 0), y: num(v.y, 0, 10, 0), z: num(v.z, -10, 10, 0),
    color: isColor(v.color) ? v.color : "#999999",
  };
}

/** A custom item from the studio. Its type must be a plain id and can't shadow a built-in piece. */
export function sanitizeCustom(v: unknown): ItemDef | null {
  if (!isObj(v) || !isId(v.type) || own(BY, v.type)) return null;
  const c: ItemDef = {
    type: v.type, name: text(v.name, 32, "My item") || "My item", shape: oneOf(CUSTOM_SHAPES, v.shape, "block"),
    w: num(v.w, 0.05, 20, 1), d: num(v.d, 0.05, 20, 1), h: num(v.h, 0.01, 10, 1), seats: int(v.seats, 0, 20, 0),
  };
  if (isColor(v.color)) c.color = v.color;
  const tw = optNum(v.tw, 0.1, 10), td = optNum(v.td, 0.1, 10), ox = optNum(v.ox, -10, 10), oz = optNum(v.oz, -10, 10);
  if (tw !== undefined) c.tw = tw;
  if (td !== undefined) c.td = td;
  if (ox !== undefined) c.ox = ox;
  if (oz !== undefined) c.oz = oz;
  if (c.shape === "parts") {
    c.parts = arr(v.parts, LIMITS.parts).map(part).filter((p): p is Part => p !== null);
    if (!c.parts.length) c.parts = [{ k: "box", w: 0.5, h: 0.5, d: 0.5, x: 0, y: 0, z: 0, color: "#999999" }];
  }
  if ((c.shape === "round" || c.shape === "square") && (c.tw === undefined || c.td === undefined)) {
    c.tw = c.tw ?? 0.8;
    c.td = c.td ?? 0.8;
  }
  return c;
}

function version(v: unknown): Version | null {
  if (!isObj(v) || typeof v.data !== "string" || v.data.length > LIMITS.versionData) return null;
  const out: Version = {
    id: isId(v.id) ? v.id : newId("v"), name: text(v.name, 40, "Version") || "Version", time: num(v.time, 0, 8.64e15, 0),
    count: int(v.count, 0, LIMITS.items, 0), seats: int(v.seats, 0, 1e6, 0), data: v.data,
  };
  if (typeof v.sum === "string") out.sum = text(v.sum, 120);
  return out;
}

/** Parses a saved version's layout. Returns null when it doesn't hold a usable layout. */
export function parseVersionData(data: string): Layout | null {
  try {
    return sanitizeLayout(JSON.parse(data));
  } catch {
    return null;
  }
}

function winLimits(v: unknown): WinLimits {
  const o = isObj(v) ? v : {};
  const w: WinLimits = {
    sillMin: num(o.sillMin, 0, 2.5, DEF_WIN.sillMin), sillMax: num(o.sillMax, 0, 3, DEF_WIN.sillMax), minH: num(o.minH, 0.1, 2, DEF_WIN.minH),
    gap: num(o.gap, 0, 1, DEF_WIN.gap), wMin: num(o.wMin, 0, 3, DEF_WIN.wMin), wMax: num(o.wMax, 0, 10, DEF_WIN.wMax),
    step: [0.01, 0.05, 0.1].includes(o.step as number) ? (o.step as number) : DEF_WIN.step,
  };
  if (w.sillMax < w.sillMin) w.sillMax = w.sillMin;
  if (w.wMax < w.wMin) w.wMax = w.wMin;
  return w;
}

/**
 * The whole saved store. Returns null if the value isn't a store, so the app starts fresh.
 * Missing slots for preset keys are filled in later by the app, as before.
 */
export function sanitizeStore(v: unknown): Partial<Store> | null {
  if (!isObj(v) || !isObj(v.slots)) return null;
  const slots: Record<string, Layout> = Object.create(null) as Record<string, Layout>;
  let n = 0;
  for (const k of Object.keys(v.slots)) {
    if (n >= LIMITS.layouts) break;
    const L = isId(k) ? sanitizeLayout(v.slots[k]) : null;
    if (L) {
      slots[k] = L;
      n++;
    }
  }
  const order = [...new Set(arr(v.order, LIMITS.layouts).filter(isId))];
  const custom: ItemDef[] = [];
  const types = new Set<string>();
  for (const c of arr(v.custom, LIMITS.custom).map(sanitizeCustom)) {
    if (c && !types.has(c.type)) {
      types.add(c.type);
      custom.push(c);
    }
  }
  const seen: Record<string, boolean> = {};
  if (isObj(v.seen)) for (const k of Object.keys(v.seen).slice(0, LIMITS.seen)) if (isId(k) && typeof v.seen[k] === "boolean") seen[k] = v.seen[k] as boolean;
  const versions: Record<string, Version[]> = Object.create(null) as Record<string, Version[]>;
  if (isObj(v.versions)) {
    for (const k of Object.keys(v.versions)) {
      if (!own(slots, k)) continue;
      const list = arr(v.versions[k], LIMITS.versions).map(version).filter((x): x is Version => x !== null);
      if (list.length) versions[k] = list;
    }
  }
  const settings = isObj(v.settings) ? v.settings : {};
  const roomNames = [...new Set(arr(settings.roomNames, LIMITS.roomNames).map((s) => text(s, 40).trim()).filter(Boolean))];
  return {
    active: isId(v.active) ? v.active : "A",
    slots, order, custom, seen, versions,
    settings: { win: winLimits(settings.win), roomNames },
  };
}
