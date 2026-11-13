// Shop types: what each one names its rooms, counts in the header and suggests first.
// Pure data and helpers, no DOM, so they can be unit-tested.
import { dims } from "../geometry/items";
import type { CountKey, ItemDef, Layout, RoomId, ShopType } from "../types";

export interface ShopTypeDef {
  name: string;
  /** one line for the type picker */
  note: string;
  /** default names of the first ("kitchen") and second ("storage") back rooms */
  back: [string, string];
  /** what the header counts */
  count: CountKey;
  /** the opening between shop floor and first back room */
  hatch: string;
  /** palette a new layout starts on */
  palette: string;
  /** starter presets, by EXAMPLES key */
  presets: string[];
}

export const SHOP_TYPES: Record<ShopType, ShopTypeDef> = {
  cafe: { name: "Cafe / bakery", note: "Counters, tables and a kitchen", back: ["Kitchen", "Storage"], count: "seats", hatch: "Serving hatch", palette: "pistachio", presets: ["A", "B"] },
  retail: { name: "Retail boutique", note: "Rails, shelving bays and fitting rooms", back: ["Stockroom", "Staff room"], count: "fixtures", hatch: "Pass-through", palette: "gallery", presets: ["R1", "R2"] },
  books: { name: "Bookshop / gift shop", note: "Bookcases, displays and a reading corner", back: ["Stockroom", "Office"], count: "shelving", hatch: "Pass-through", palette: "library", presets: ["K1", "K2"] },
};
export const TYPE_ORDER: ShopType[] = ["cafe", "retail", "books"];

/** Names offered for back rooms before any are added in Settings. */
export const BUILTIN_ROOM_NAMES = ["Kitchen", "Storage", "Stockroom", "Staff room", "Office", "Workroom"];

/** Layouts saved before shop types existed are cafes. */
export const typeOf = (L: Layout): ShopType => L.type ?? "cafe";

/** Display name of a room in this layout. */
export function roomName(L: Layout, id: RoomId): string {
  if (id === "cafe") return "Shop floor";
  const T = SHOP_TYPES[typeOf(L)];
  return id === "kitchen" ? L.names?.kitchen || T.back[0] : L.names?.storage || T.back[1];
}

/** Every back-room name to offer: built-ins, then the ones added in Settings. */
export const roomNameChoices = (added: string[]): string[] => [...new Set([...BUILTIN_ROOM_NAMES, ...added])];

export type Counts = Record<CountKey, number>;
export function countsOf(L: Layout, cat: (t: string) => ItemDef): Counts {
  const n: Counts = { seats: 0, fixtures: 0, shelving: 0 };
  for (const i of L.items) {
    const c = cat(i.type);
    n.seats += c.seats || 0;
    n.fixtures += c.fix || 0;
    if (c.shelf) n.shelving += c.shelf * dims(i, cat).w;
  }
  n.shelving = Math.round(n.shelving * 10) / 10;
  return n;
}

const UNIT: Record<CountKey, (v: number) => string> = {
  seats: (v) => `${v} seat${v === 1 ? "" : "s"}`,
  fixtures: (v) => `${v} fixture${v === 1 ? "" : "s"}`,
  shelving: (v) => `${String(v).replace(/\.0$/, "")} m shelving`,
};
/** The type's own count, then any other count that isn't zero: "18 m shelving · 6 seats". */
export function countText(L: Layout, cat: (t: string) => ItemDef): string {
  const n = countsOf(L, cat), own = SHOP_TYPES[typeOf(L)].count;
  const keys: CountKey[] = [own, ...(["seats", "fixtures", "shelving"] as CountKey[]).filter((k) => k !== own && n[k] > 0)];
  return keys.map((k) => UNIT[k](n[k])).join(" · ");
}
