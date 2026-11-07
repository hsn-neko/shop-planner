// Shared data shapes for Shop Planner. All sizes are in metres; x runs left→right, z back→front.

export type FloorKind = "terrazzo" | "checker" | "wood";
export interface Palette {
  name: string;
  note: string;
  floor: FloorKind;
  f1: string;
  f2?: string;
  chips?: string[];
  wall: string;
  accent: string;
  wood: string;
  up: string;
}

export type Zone = "kitchen" | "storage";
export type CustomShape = "block" | "round" | "square" | "parts";

/** One box or cylinder of a custom piece built in the item studio. */
export interface Part {
  k: "box" | "cyl";
  w: number;
  h: number;
  d: number;
  x: number;
  y: number;
  z: number;
  color: string;
}

/** A catalogue entry: a built-in piece or a custom item from the studio. */
export interface ItemDef {
  type: string;
  name: string;
  grp?: string;
  w: number;
  d: number;
  h: number;
  seats: number;
  /** width can be stretched in the item editor */
  stretch?: boolean;
  /** draw a thick line on the customer-facing side in the 2D plan */
  front?: boolean;
  /** room a new copy is placed in */
  zone?: Zone;
  /** plan colour for built-ins */
  col?: string;
  /** main colour for custom items */
  color?: string;
  shape?: CustomShape;
  /** table top size for custom tables */
  tw?: number;
  td?: number;
  parts?: Part[];
  /** offset of the parts' centre from the footprint centre */
  ox?: number;
  oz?: number;
}

/** A piece placed in a layout. */
export interface Placed {
  id: number;
  type: string;
  x: number;
  z: number;
  /** rotation in degrees */
  r: number;
  sx?: number;
  sy?: number;
  sz?: number;
  color?: string | null;
}

export type Shape = "rect" | "L" | "T" | "U";
export type Corner = "bl" | "br" | "fl" | "fr";
export interface Room {
  w: number;
  d: number;
  h: number;
  /** entrance position along the front wall, -1..1 */
  door: number;
  shape?: Shape;
  /** cut-out width and depth as fractions */
  cwf?: number;
  cdf?: number;
  corner?: Corner;
  cside?: "back" | "front";
}

export type BohMode = "none" | "kitchen" | "both";
export type BohSide = "back" | "left" | "right";
export interface Boh {
  mode: BohMode;
  side: BohSide;
  depth: number;
  /** kitchen share of the strip, 0.2..0.8 */
  share: number;
  swap: boolean;
  /** kitchen door position, -1..1 */
  door: number;
  hatch: boolean;
  storeDoor: boolean;
  backDoor: boolean;
}

export type WindowKind = "window" | "shopfront" | "high";
export interface WindowDef {
  id?: string;
  x: number;
  z: number;
  w: number;
  kind: WindowKind;
  sill?: number;
  head?: number;
}

export interface Layout {
  label?: string;
  room: Room;
  palette: string;
  warmth: number;
  items: Placed[];
  boh?: Boh;
  windows?: WindowDef[];
}

export interface Version {
  id: string;
  name: string;
  time: number;
  count: number;
  seats: number;
  data: string;
}

export interface WinLimits {
  sillMin: number;
  sillMax: number;
  minH: number;
  gap: number;
  wMin: number;
  wMax: number;
  step: number;
}

export interface Store {
  active: string;
  slots: Record<string, Layout>;
  order: string[];
  custom: ItemDef[];
  seen: Record<string, boolean>;
  settings: { win: WinLimits };
  versions: Record<string, Version[]>;
}

/* ---------- Geometry ---------- */
export type RoomId = "cafe" | "kitchen" | "storage";
export type Axis = "x" | "z";

export interface Cell {
  id: RoomId;
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

export type OpeningKind = "entrance" | "door" | "hatch" | "window";
export interface Opening {
  /** centre along the wall */
  c: number;
  w: number;
  sill: number;
  head: number;
  kind: OpeningKind;
  /** which side a door swings into: +1 towards larger coordinates */
  swing?: number;
  label?: string;
  role?: "kdoor";
  /** window id */
  wid?: string;
}

/** A straight wall. ax "x" runs along x at z = c; ax "z" runs along z at x = c. */
export interface Wall {
  ax: Axis;
  c: number;
  /** drawn span, including corner extensions */
  a: number;
  b: number;
  /** boundary span between rooms */
  sa: number;
  sb: number;
  /** outward direction for outside walls */
  nrm: number;
  ext: boolean;
  /** room on the smaller-coordinate side and the larger side */
  neg: RoomId | null;
  pos: RoomId | null;
  /** the room an outside wall belongs to */
  room?: RoomId;
  /** wall belongs only to kitchen/storage */
  boh: boolean;
  open: Opening[];
}

export interface RoomInfo {
  id: RoomId;
  name: string;
  area: number;
  cells: Cell[];
  /** top-left cell corner, used to place the room label */
  ax: number;
  az: number;
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

export interface BBox {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

export interface PlacedWindow {
  id: string;
  W: Wall;
  o: Opening;
}

export interface Geo {
  rooms: RoomInfo[];
  walls: Wall[];
  cells: Cell[];
  bbox: BBox;
  cellAt(x: number, z: number): RoomId | null;
  /** the single room a rectangle lies fully inside, or null */
  rectIn(x0: number, x1: number, z0: number, z1: number): RoomId | null;
  entrance: { x: number; z: number; W: Wall | null; o: Opening | null };
  windows: PlacedWindow[];
}
