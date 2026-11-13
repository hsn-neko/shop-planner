// The room editor: its own screen with a 2D plan you resize by dragging handles,
// a 3D view for dragging window edges, a window panel, and the app-wide Settings page.
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { DEF_WIN, WK } from "../data/catalog";
import { roomName, roomNameChoices } from "../data/shopTypes";
import { $, $$, $in, clampV, clone, esc, fmt, r1, rr, TK } from "../dom";
import { cafeCuts, computeGeo, defaultBoh, shapeOf, WT } from "../geometry/rooms";
import { evaluate, footprintOf, rebuildItems } from "../items";
import { drawPlan, fitPlan, type PlanTarget, s2w, w2s } from "../plan/plan";
import { buildRoom, rebuildWalls } from "../roomView";
import { app, pushUndo, refreshGeo, save, snap, snapW, undo, WS } from "../state";
import { itemsG, makeRenderer, roomG, scene, setupRenderer, THREE } from "../three/core";
import { walls } from "../three/room";
import type { Boh, Layout, PlacedWindow, Placed, Room, RoomId, Wall, WindowDef, WindowKind, WinLimits } from "../types";
import { openInv } from "../ui/inventory";
import { syncRoomInputs } from "../ui/roomControls";
import { showSel } from "../ui/selection";
import { applyLight, fitView, resetClock, setMode } from "../views";

type EdMode = "2d" | "3d";
type DragKind = "x" | "z" | "pt" | "win" | "wend" | "door";
interface Handle {
  id: string;
  x: number;
  z: number;
  drag: DragKind;
  /** which way the wall moves for wR/wL/dF/dB */
  s?: number;
  dark?: boolean;
  wid?: string;
  end?: number;
  W?: Wall;
  tip: () => string;
}
interface DragState {
  h: Handle;
  p0: [number, number];
  room: Room;
  boh: Boh;
  cx: number;
  cz: number;
  /** line of the far outside wall of the back rooms */
  farC: number;
  win0: { a0: number; b0: number } | null;
  wins: { wd: WindowDef; x: number; z: number; W: Wall | undefined }[];
  items: { i: Placed; x: number; z: number; rm: RoomId | null }[];
}

let reView: HTMLElement, reCv: HTMLCanvasElement;
const T2: PlanTarget = { ctx: null as unknown as CanvasRenderingContext2D, V: { s: 40, cx: 0, cz: 0, user: false }, W: 1, H: 1, ghost: true };
let reMode: EdMode = "2d";
let reDrag: DragState | null = null, reHover: string | null = null, handles: Handle[] = [];
let rePan: { p: [number, number]; cx: number; cz: number } | null = null;
let rePinch: { d0: number; s0: number; w: [number, number] } | null = null;
const rePtrs = new Map<number, [number, number]>();
let reWinSel: string | null = null;

const L = (): Layout => app.L;
const boh = (): Boh => (app.L.boh ??= defaultBoh());
const wins = (): WindowDef[] => (app.L.windows ??= []);
const geoNow = () => computeGeo(app.L, WS());

export const editorMode = (): EdMode => reMode;

/* ---------- 2D plan with handles ---------- */
function reFit(): void {
  const b = app.geo.bbox, w = b.x1 - b.x0, d = b.z1 - b.z0, V = T2.V;
  V.s = Math.max(8, Math.min((T2.W - 60) / (w + 2), (T2.H - 60) / (d + 2.8)));
  V.cx = (b.x0 + b.x1) / 2;
  V.cz = (b.z0 + b.z1) / 2 + 0.35;
  V.user = false;
}
function reSize(): void {
  const r = reView.getBoundingClientRect();
  if (!r.width || !r.height) return;
  const dpr = Math.min(devicePixelRatio, 2);
  T2.W = r.width;
  T2.H = r.height;
  reCv.width = Math.round(r.width * dpr);
  reCv.height = Math.round(r.height * dpr);
  if (!T2.V.user && app.geo) reFit();
}

/** Handle position on a cafe side: middle of the longest stretch of that wall without a door or hatch. */
function segMid(axis: "x" | "z", line: number): number {
  const G = app.geo;
  const cs = G.cells.filter((c) => c.id === "cafe" && (axis === "x" ? Math.abs((line > 0 ? c.x1 : c.x0) - line) < 1e-6 : Math.abs((line > 0 ? c.z1 : c.z0) - line) < 1e-6));
  if (!cs.length) return 0;
  const lo = axis === "x" ? Math.min(...cs.map((c) => c.z0)) : Math.min(...cs.map((c) => c.x0));
  const hi = axis === "x" ? Math.max(...cs.map((c) => c.z1)) : Math.max(...cs.map((c) => c.x1));
  const wallAx = axis === "x" ? "z" : "x", ops: [number, number][] = [];
  for (const W of G.walls) if (W.ax === wallAx && Math.abs(W.c - line) < WT) for (const o of W.open) ops.push([o.c - o.w / 2 - 0.35, o.c + o.w / 2 + 0.35]);
  ops.sort((a, b) => a[0] - b[0]);
  let best: [number, number] = [lo, hi], bl = -1, cur = lo;
  for (const [a, b] of [...ops, [hi, hi] as [number, number]]) {
    const e = Math.min(a, hi);
    if (e - cur > bl) {
      bl = e - cur;
      best = [cur, e];
    }
    cur = Math.max(cur, b);
  }
  return (best[0] + best[1]) / 2;
}

function roomHandles(): Handle[] {
  const G = app.geo, r = shapeOf(L().room), { w, d } = r, B = boh(), H: Handle[] = [];
  const wt = () => `Width ${fmt(L().room.w)} m`, dt = () => `Depth ${fmt(L().room.d)} m`;
  H.push(
    { id: "wR", x: w / 2, z: segMid("x", w / 2), drag: "x", s: 1, tip: wt },
    { id: "wL", x: -w / 2, z: segMid("x", -w / 2), drag: "x", s: -1, tip: wt },
    { id: "dF", x: segMid("z", d / 2), z: d / 2, drag: "z", s: 1, tip: dt },
    { id: "dB", x: segMid("z", -d / 2), z: -d / 2, drag: "z", s: -1, tip: dt },
  );
  const k = cafeCuts(r)[0];
  if (k) {
    const bk = r.shape === "L" ? r.corner[0] === "b" : r.cside === "back";
    const x = r.shape === "L" ? (r.corner[1] === "l" ? k.x1 : k.x0) : k.x1;
    H.push({ id: "cut", x, z: bk ? k.z1 : k.z0, drag: "pt", tip: () => {
      const q = cafeCuts(L().room)[0];
      return q ? `Cut-out ${fmt(q.x1 - q.x0)} × ${fmt(q.z1 - q.z0)} m` : "";
    } });
  }
  if (B.mode !== "none") {
    const bs = G.rooms.filter((q) => q.id !== "cafe");
    if (bs.length) {
      const bx0 = Math.min(...bs.map((q) => q.x0)), bx1 = Math.max(...bs.map((q) => q.x1));
      const bz0 = Math.min(...bs.map((q) => q.z0)), bz1 = Math.max(...bs.map((q) => q.z1));
      const n1 = () => roomName(L(), "kitchen"), n2 = () => roomName(L(), "storage").toLowerCase();
      const tt = () => `${n1()} ${boh().mode === "both" ? `and ${n2()} ` : ""}${fmt(boh().depth)} m deep`;
      if (B.side === "back") H.push({ id: "bd", x: (bx0 + bx1) / 2, z: bz0, drag: "z", dark: true, tip: tt });
      else H.push({ id: "bd", x: B.side === "left" ? bx0 : bx1, z: (bz0 + bz1) / 2, drag: "x", dark: true, tip: tt });
      const ki = G.rooms.find((q) => q.id === "kitchen"), st = G.rooms.find((q) => q.id === "storage");
      if (B.mode === "both" && ki && st) {
        const stt = () => `${n1()} ${Math.round(boh().share * 100)}% · ${n2()} ${100 - Math.round(boh().share * 100)}%`;
        if (B.side === "back") H.push({ id: "split", x: ki.x1 <= st.x0 + 1e-6 ? ki.x1 : ki.x0, z: (bz0 + bz1) / 2, drag: "x", dark: true, tip: stt });
        else H.push({ id: "split", x: (bx0 + bx1) / 2, z: ki.z1 <= st.z0 + 1e-6 ? ki.z1 : ki.z0, drag: "z", dark: true, tip: stt });
      }
    }
  }
  for (const { id, W, o } of G.windows)
    H.push({ id: "win:" + id, wid: id, x: W.ax === "x" ? o.c : W.c, z: W.ax === "x" ? W.c : o.c, drag: "win", tip: () => {
      const wd = wins().find((q) => q.id === id);
      return wd ? `${WK[wd.kind].name} ${fmt(wd.w)} m` : "";
    } });
  const sq = reWinSel ? G.windows.find((q) => q.id === reWinSel) : undefined;
  if (sq)
    for (const end of [-1, 1]) {
      const al = sq.o.c + (end * sq.o.w) / 2;
      H.push({ id: "wend" + end, wid: sq.id, end, x: sq.W.ax === "x" ? al : sq.W.c, z: sq.W.ax === "x" ? sq.W.c : al, drag: "wend", W: sq.W, tip: () => `Width ${fmt(sq.o.w)} m` });
    }
  const E = G.entrance;
  if (E.o && E.W) H.push({ id: "ent", x: E.o.c, z: E.W.c, drag: "door", tip: () => "Entrance" });
  for (const W of G.walls)
    for (const o of W.open)
      if (o.role === "kdoor") H.push({ id: "kd", x: W.ax === "x" ? o.c : W.c, z: W.ax === "x" ? W.c : o.c, drag: "door", W, tip: () => `${roomName(L(), "kitchen")} door` });
  return H;
}

function tipLabel(c: CanvasRenderingContext2D, txt: string, px: number, py: number, maxW: number): void {
  c.font = "700 12px Figtree, system-ui, sans-serif";
  const tw = c.measureText(txt).width;
  const x = Math.max(6, Math.min(maxW - tw - 22, px - tw / 2 - 8)), y = Math.max(6, py - 38);
  c.fillStyle = TK.fg;
  rr(c, x, y, tw + 16, 22, 6);
  c.fill();
  c.fillStyle = TK.paper;
  c.textAlign = "left";
  c.textBaseline = "middle";
  c.fillText(txt, x + 8, y + 11.5);
}

function drawHandles(): void {
  const c = T2.ctx;
  handles = roomHandles();
  let tip: [string, number, number] | null = null;
  for (const h of handles) {
    const [px, py] = w2s(T2, h.x, h.z), act = reDrag?.h.id === h.id, hov = !reDrag && reHover === h.id, big = act || hov;
    c.save();
    c.translate(px, py);
    const fill = h.dark ? TK.fg : TK.accent;
    c.lineWidth = 2;
    c.strokeStyle = TK.paper;
    if (h.drag === "wend") {
      c.fillStyle = TK.accent;
      c.beginPath();
      c.arc(0, 0, big ? 8 : 6.5, 0, 7);
      c.fill();
      c.stroke();
    } else if (h.drag === "win") {
      const z = big ? 17 : 14;
      if (reWinSel === h.wid) {
        c.fillStyle = TK.accent;
        rr(c, -z / 2 - 4, -z / 2 - 4, z + 8, z + 8, 7);
        c.fill();
      }
      c.fillStyle = "#4f9fcb";
      rr(c, -z / 2, -z / 2, z, z, 4);
      c.fill();
      c.stroke();
      c.strokeStyle = TK.paper;
      c.lineWidth = 1.2;
      c.beginPath();
      c.moveTo(-z / 2 + 3, 0);
      c.lineTo(z / 2 - 3, 0);
      c.moveTo(0, -z / 2 + 3);
      c.lineTo(0, z / 2 - 3);
      c.stroke();
    } else if (h.drag === "x" || h.drag === "z") {
      const v = h.drag === "x", sc = big ? 1.15 : 1, bw = (v ? 12 : 34) * sc, bh = (v ? 34 : 12) * sc;
      c.fillStyle = fill;
      rr(c, -bw / 2, -bh / 2, bw, bh, 6);
      c.fill();
      c.stroke();
      c.strokeStyle = TK.paper;
      c.lineWidth = 1.2;
      c.beginPath();
      for (const o of [-5, 0, 5]) {
        if (v) {
          c.moveTo(-3, o);
          c.lineTo(3, o);
        } else {
          c.moveTo(o, -3);
          c.lineTo(o, 3);
        }
      }
      c.stroke();
    } else if (h.drag === "pt") {
      c.fillStyle = fill;
      c.beginPath();
      c.arc(0, 0, big ? 11 : 9, 0, 7);
      c.fill();
      c.stroke();
    } else {
      c.fillStyle = TK.paper;
      c.beginPath();
      c.arc(0, 0, big ? 9 : 7, 0, 7);
      c.fill();
      c.lineWidth = 3;
      c.strokeStyle = TK.accent;
      c.stroke();
    }
    c.restore();
    if (big) tip = [h.tip(), px, py];
  }
  if (tip) tipLabel(c, tip[0], tip[1], tip[2], T2.W);
}

export function drawRoomEditor(): void {
  drawPlan(T2);
  drawHandles();
}

/** Find the parameter p in -1..1 where f(p) reaches target (f rises with p). */
function bsearch(f: (p: number) => number, target: number): number {
  let lo = -1, hi = 1;
  for (let k = 0; k < 22; k++) {
    const m = (lo + hi) / 2;
    if (f(m) < target) lo = m;
    else hi = m;
  }
  const v = Math.round(((lo + hi) / 2) * 100) / 100;
  f(v);
  return v;
}

/** Widest a window can grow from its fixed end before meeting a door, another window or the wall end. */
function roomTo(W: Wall, fixed: number, dir: number, wid: string | undefined): number {
  let lim = dir > 0 ? W.sb - 0.1 : W.sa + 0.1;
  for (const o of W.open) {
    if (o.wid === wid) continue;
    const a = o.c - o.w / 2 - 0.1, b = o.c + o.w / 2 + 0.1;
    if (dir > 0 && a >= fixed - 1e-6) lim = Math.min(lim, a);
    if (dir < 0 && b <= fixed + 1e-6) lim = Math.max(lim, b);
  }
  return Math.abs(lim - fixed);
}
function setAlong(wd: WindowDef, W: Wall, c: number): void {
  if (W.ax === "x") {
    wd.x = c;
    wd.z = W.c;
  } else {
    wd.z = c;
    wd.x = W.c;
  }
}
/** New width for a window whose `end` (-1/+1) is dragged to `al`; the other end stays at a0/b0. */
function resizeWindow(wd: WindowDef, W: Wall, end: number, wid: string, a0: number, b0: number, al: number): void {
  const S = WS(), fx = end > 0 ? a0 : b0, cap = Math.floor(roomTo(W, fx, end, wid) / S.step) * S.step;
  const w = clampV(snapW(end > 0 ? al - a0 : b0 - al), S.wMin, Math.max(S.wMin, Math.min(S.wMax, cap)));
  wd.w = w;
  setAlong(wd, W, end > 0 ? a0 + w / 2 : b0 - w / 2);
}

function applyDrag(D: DragState, X: number, Z: number, p: [number, number]): void {
  const h = D.h, r = shapeOf(L().room), B = boh();
  if (h.id === "wR" || h.id === "wL" || h.id === "dF" || h.id === "dB") {
    const ax = h.drag as "x" | "z", s = h.s!, key = ax === "x" ? "w" : "d", v0 = D.room[key];
    // measured in screen distance: the view recentres while dragging, so world coordinates under the pointer shift
    const v = clampV(r1(v0 + (s * (ax === "x" ? p[0] - D.p0[0] : p[1] - D.p0[1])) / T2.V.s), 4, 20), dl = v - v0;
    r[key] = v;
    const edgeSide = ax === "x" ? (s > 0 ? "right" : "left") : s > 0 ? "front" : "back";
    // the opposite wall stays put; furniture keeps its distance to it, and kitchen/storage pieces travel with the moving wall
    for (const o of D.items) {
      const withEdge = B.mode !== "none" && B.side === edgeSide && (o.rm === "kitchen" || o.rm === "storage");
      const sh = ((withEdge ? s : -s) * dl) / 2;
      if (ax === "x") o.i.x = o.x + sh;
      else o.i.z = o.z + sh;
    }
    // kitchen/storage divider keeps its distance to the wall that stays put
    if (B.mode === "both" && ((B.side === "back" && ax === "x") || (B.side !== "back" && ax === "z"))) {
      const sf0 = D.boh.swap ? 1 - D.boh.share : D.boh.share, sf = s > 0 ? (sf0 * v0) / v : 1 - ((1 - sf0) * v0) / v;
      B.share = clampV(B.swap ? 1 - sf : sf, 0.2, 0.8);
    }
    const eLine = s * (v0 / 2 + WT / 2), pAx = ax === "x" ? "z" : "x";
    for (const o of D.wins) {
      const W = o.W;
      if (!W) continue;
      if (W.ax === pAx && W.nrm === s && Math.abs(W.c - eLine) < 1e-3) {
        if (ax === "x") o.wd.x = (s * v) / 2;
        else o.wd.z = (s * v) / 2;
        continue;
      }
      const inB = W.room === "kitchen" || W.room === "storage", sh = ((B.mode !== "none" && B.side === edgeSide && inB ? s : -s) * dl) / 2;
      if (ax === "x") o.wd.x = o.x + sh;
      else o.wd.z = o.z + sh;
    }
    if (ax === "x") T2.V.cx = D.cx - (s * dl) / 2;
    else T2.V.cz = D.cz - (s * dl) / 2;
  } else if (h.id === "bd") {
    const edge = B.side === "back" ? -r.d / 2 : B.side === "left" ? -r.w / 2 : r.w / 2;
    const n = B.side === "back" ? edge - Z : B.side === "left" ? edge - X : X - edge;
    B.depth = clampV(r1(n - WT), 1.5, 8);
    const fAx = B.side === "back" ? "x" : "z", fN = B.side === "right" ? 1 : -1;
    const fl = B.side === "back" ? -r.d / 2 - (B.depth + WT) : B.side === "left" ? -r.w / 2 - (B.depth + WT) : r.w / 2 + B.depth + WT;
    for (const o of D.wins) {
      const W = o.W;
      if (W && W.room !== "cafe" && W.ax === fAx && W.nrm === fN && Math.abs(W.c - D.farC) < 1e-3) {
        if (fAx === "x") o.wd.z = fl;
        else o.wd.x = fl;
      }
    }
  } else if (h.drag === "win") {
    const wd = wins().find((q) => q.id === h.wid);
    if (wd) {
      wd.x = X;
      wd.z = Z;
    }
  } else if (h.drag === "wend") {
    const wd = wins().find((q) => q.id === h.wid);
    if (wd && D.win0 && h.W && h.wid) resizeWindow(wd, h.W, h.end!, h.wid, D.win0.a0, D.win0.b0, h.W.ax === "x" ? X : Z);
  } else if (h.id === "split") {
    const Lw = B.side === "back" ? r.w : r.d, u = B.side === "back" ? X : Z, sf = (u + Lw / 2) / Lw;
    B.share = clampV(Math.round((B.swap ? 1 - sf : sf) * 100) / 100, 0.2, 0.8);
  } else if (h.id === "cut") {
    const bk = r.shape === "L" ? r.corner[0] === "b" : r.cside === "back", oz = bk ? -r.d / 2 : r.d / 2;
    r.cdf = clampV(r1(Math.abs(Z - oz)) / r.d, 0.15, 0.85);
    if (r.shape === "L") {
      const ox = r.corner[1] === "l" ? -r.w / 2 : r.w / 2;
      r.cwf = clampV(r1(Math.abs(X - ox)) / r.w, 0.15, 0.85);
    } else if (r.shape === "T") r.cwf = clampV(r1(X + r.w / 2) / (r.w / 2), 0.15, 0.85);
    else r.cwf = clampV(r1(2 * Math.abs(X)) / r.w, 0.15, 0.85);
  } else if (h.id === "ent") {
    bsearch((q) => {
      r.door = q;
      return geoNow().entrance.x;
    }, X);
  } else if (h.id === "kd" && h.W) {
    const along = h.W.ax === "x" ? X : Z;
    bsearch((q) => {
      B.door = q;
      let c = 0;
      for (const W of geoNow().walls) for (const o of W.open) if (o.role === "kdoor") c = o.c;
      return c;
    }, along);
  }
  refreshGeo();
  evaluate();
  syncRoomInputs();
  updateRoomSummary();
}

function hitHandle(p: [number, number]): Handle | null {
  let best: Handle | null = null, bd = 26;
  for (const h of handles) {
    const [px, py] = w2s(T2, h.x, h.z), dd = Math.hypot(px - p[0], py - p[1]);
    if (dd < bd) {
      bd = dd;
      best = h;
    }
  }
  return best;
}

/** Store each window where it actually landed, so the next drag starts from the wall. */
function settleWindows(): void {
  const G = refreshGeo();
  for (const q of G.windows) {
    const wd = wins().find((v) => v.id === q.id);
    if (!wd) continue;
    if (q.W.ax === "x") {
      wd.x = snapW(q.o.c);
      wd.z = q.W.c;
    } else {
      wd.z = snapW(q.o.c);
      wd.x = q.W.c;
    }
  }
  refreshGeo();
}

function init2dPointer(): void {
  const local = (e: PointerEvent | WheelEvent): [number, number] => {
    const r = reCv.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };
  reCv.addEventListener("pointerdown", (e) => {
    const p = local(e), V = T2.V;
    rePtrs.set(e.pointerId, p);
    reCv.setPointerCapture(e.pointerId);
    if (rePtrs.size === 2) {
      if (reDrag) {
        reDrag = null;
        save();
      }
      rePan = null;
      const [a, b] = [...rePtrs.values()] as [[number, number], [number, number]];
      rePinch = { d0: Math.hypot(a[0] - b[0], a[1] - b[1]), s0: V.s, w: s2w(T2, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2) };
      return;
    }
    const h = hitHandle(p);
    if (h) {
      if (h.wid) {
        reWinSel = h.wid;
        renderWinPanel();
      }
      pushUndo();
      const G = app.geo, B = boh();
      const fw = G.walls.filter((W) => W.ext && W.room !== "cafe" && W.ax === (B.side === "back" ? "x" : "z") && W.nrm === (B.side === "right" ? 1 : -1));
      const q = h.wid ? G.windows.find((v) => v.id === h.wid) : undefined;
      reDrag = {
        h,
        p0: p,
        room: clone(L().room),
        boh: clone(B),
        cx: V.cx,
        cz: V.cz,
        farC: fw.length ? (B.side === "right" ? Math.max(...fw.map((W) => W.c)) : Math.min(...fw.map((W) => W.c))) : 0,
        win0: q ? { a0: q.o.c - q.o.w / 2, b0: q.o.c + q.o.w / 2 } : null,
        wins: wins().map((wd) => ({ wd, x: wd.x, z: wd.z, W: G.windows.find((v) => v.id === wd.id)?.W })),
        items: L().items.map((i) => {
          const f = footprintOf(i);
          return { i, x: i.x, z: i.z, rm: G.rectIn(i.x - f.hw, i.x + f.hw, i.z - f.hd, i.z + f.hd) ?? G.cellAt(i.x, i.z) };
        }),
      };
      reHover = h.id;
    } else {
      rePan = { p, cx: V.cx, cz: V.cz };
      if (reWinSel) {
        reWinSel = null;
        renderWinPanel();
      }
    }
  });
  reCv.addEventListener("pointermove", (e) => {
    const p = local(e), V = T2.V;
    if (rePtrs.has(e.pointerId)) rePtrs.set(e.pointerId, p);
    if (rePinch && rePtrs.size >= 2) {
      const [a, b] = [...rePtrs.values()] as [[number, number], [number, number]], mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2] as const;
      V.user = true;
      V.s = clampV((rePinch.s0 * Math.hypot(a[0] - b[0], a[1] - b[1])) / rePinch.d0, 8, 320);
      V.cx = rePinch.w[0] - (mid[0] - T2.W / 2) / V.s;
      V.cz = rePinch.w[1] - (mid[1] - T2.H / 2) / V.s;
      return;
    }
    if (reDrag) {
      const [X, Z] = s2w(T2, p[0], p[1]);
      applyDrag(reDrag, X, Z, p);
      return;
    }
    if (rePan && rePtrs.size) {
      if (Math.hypot(p[0] - rePan.p[0], p[1] - rePan.p[1]) > 4) V.user = true;
      V.cx = rePan.cx - (p[0] - rePan.p[0]) / V.s;
      V.cz = rePan.cz - (p[1] - rePan.p[1]) / V.s;
      return;
    }
    const h = hitHandle(p);
    reHover = h ? h.id : null;
    reCv.style.cursor = h ? (h.drag === "x" ? "ew-resize" : h.drag === "z" ? "ns-resize" : "grab") : "default";
  });
  const up = (e: PointerEvent) => {
    rePtrs.delete(e.pointerId);
    if (rePtrs.size < 2) rePinch = null;
    if (reDrag) {
      reDrag = null;
      for (const i of L().items) {
        i.x = snap(i.x);
        i.z = snap(i.z);
      }
      settleWindows();
      evaluate();
      renderWinPanel();
      save();
    }
    rePan = null;
  };
  reCv.addEventListener("pointerup", up);
  reCv.addEventListener("pointercancel", up);
  reCv.addEventListener("wheel", (e) => {
    e.preventDefault();
    const V = T2.V, p = local(e), wp = s2w(T2, p[0], p[1]);
    V.user = true;
    V.s = clampV(V.s * Math.exp(-e.deltaY * 0.0015), 8, 320);
    V.cx = wp[0] - (p[0] - T2.W / 2) / V.s;
    V.cz = wp[1] - (p[1] - T2.H / 2) / V.s;
  }, { passive: false });
}

/* ---------- Window panel ---------- */
function renderWinPanel(): void {
  const wd = reWinSel ? wins().find((q) => q.id === reWinSel) : undefined;
  $("#wPanel").hidden = !wd;
  $("#wHelp").hidden = !!wd;
  if (!wd) {
    reWinSel = null;
    return;
  }
  const S = WS(), q = app.geo.windows.find((v) => v.id === wd.id), ty = WK[wd.kind];
  for (const b of $$("#wKind button")) b.setAttribute("aria-pressed", String(b.dataset.v === wd.kind));
  const set = (id: string, mn: number, mx: number, v: number) => {
    const e = $in("#" + id);
    e.min = String(mn);
    e.max = String(mx);
    e.step = String(S.step);
    if (document.activeElement !== e) e.value = String(v);
    $("#o" + id).textContent = fmt(v) + " m";
  };
  set("wW", S.wMin, S.wMax, wd.w);
  if (q) {
    set("wS", S.sillMin, S.sillMax, q.o.sill);
    set("wH", S.minH, r1(L().room.h - S.gap), q.o.head);
  }
  const custom = !!q && (Math.abs(q.o.sill - ty.sill) > 1e-3 || Math.abs(q.o.head - Math.min(ty.head, L().room.h - S.gap)) > 1e-3);
  $("#wTitle").textContent = ty.name + (custom ? " (custom height)" : "");
  $("#wNote").textContent = q
    ? `${roomName(app.L, q.W.room ?? "cafe")} wall · ${fmt(q.o.head - q.o.sill)} m tall. Switch to 3D to drag its edges.`
    : "This window doesn't fit on a wall here. Make it narrower or drag it to a longer wall.";
}

function reGeo(): void {
  if (reMode === "3d") rebuildWalls();
  else {
    refreshGeo();
    evaluate();
    updateRoomSummary();
  }
  renderWinPanel();
}

/** Wire a window slider so one drag is one undo step. */
function winSlider(el: HTMLInputElement, onInput: (v: number) => boolean, onChange?: () => void): void {
  let armedU = true;
  const arm = () => {
    if (armedU) {
      pushUndo();
      armedU = false;
    }
  };
  el.addEventListener("pointerdown", arm);
  el.addEventListener("keydown", arm);
  el.addEventListener("change", () => {
    armedU = true;
    onChange?.();
    save();
  });
  el.addEventListener("input", () => {
    const v = parseFloat(el.value);
    if (!onInput(v)) return;
    arm();
    reGeo();
  });
}

function initWinPanel(): void {
  // a type button resets height to that preset and keeps the width
  for (const b of $$<HTMLButtonElement>("#wKind button")) b.onclick = () => {
    const wd = wins().find((q) => q.id === reWinSel);
    if (!wd) return;
    pushUndo();
    wd.kind = b.dataset.v as WindowKind;
    delete wd.sill;
    delete wd.head;
    reGeo();
    save();
  };
  const sel = (): [WindowDef, PlacedWindow] | null => {
    const wd = wins().find((q) => q.id === reWinSel), q = app.geo.windows.find((v) => v.id === reWinSel);
    return wd && q ? [wd, q] : null;
  };
  winSlider($in("#wS"), (v) => {
    const s = sel();
    if (!s) return false;
    s[0].sill = v;
    s[0].head = Math.max(s[1].o.head, v + WS().minH);
    return true;
  });
  winSlider($in("#wH"), (v) => {
    const s = sel();
    if (!s) return false;
    s[0].head = v;
    s[0].sill = Math.min(s[1].o.sill, v - WS().minH);
    return true;
  });
  winSlider($in("#wW"), (v) => {
    const wd = wins().find((q) => q.id === reWinSel);
    if (!wd) return false;
    wd.w = v;
    return true;
  }, settleWindows);
  $("#wDel").onclick = () => {
    pushUndo();
    L().windows = wins().filter((q) => q.id !== reWinSel);
    reWinSel = null;
    reGeo();
    save();
  };
  // a new window goes in the middle of the longest clear stretch of outside wall, cafe walls first
  $("#wAdd").onclick = () => {
    let best: { W: Wall; a: number; len: number; score: number } | null = null;
    for (const W of app.geo.walls.filter((w) => w.ext)) {
      const ops = W.open.map((o) => [o.c - o.w / 2 - 0.3, o.c + o.w / 2 + 0.3] as [number, number]).sort((a, b) => a[0] - b[0]);
      let cur = W.sa + 0.3;
      for (const [a, b] of [...ops, [W.sb - 0.3, W.sb] as [number, number]]) {
        const len = a - cur, score = len + (W.room === "cafe" ? 100 : 0);
        if (len >= 1.1 && (!best || score > best.score)) best = { W, a: (cur + a) / 2, len, score };
        cur = Math.max(cur, b);
      }
    }
    if (!best) {
      $("#wHelp").textContent = "There's no clear stretch of outside wall long enough for a window. Make a wall longer or remove a door.";
      return;
    }
    pushUndo();
    const id = "w" + Date.now().toString(36), w = Math.max(WS().wMin, Math.min(WS().wMax, 1.5, best.len - 0.2));
    wins().push(best.W.ax === "x" ? { id, x: best.a, z: best.W.c, w, kind: "window" } : { id, x: best.W.c, z: best.a, w, kind: "window" });
    reWinSel = id;
    reGeo();
    save();
  };
}

/* ---------- Room summary ---------- */
const SHAPE_NAMES = { rect: "Rectangle", L: "L-shape", T: "T-shape", U: "U-shape" } as const;
export function updateRoomSummary(): void {
  const G = app.geo;
  if (!G) return;
  const r = shapeOf(L().room), nm = SHAPE_NAMES[r.shape], dims = `${nm} · ${fmt(r.w)} × ${fmt(r.d)} m`;
  $("#rsTitle").textContent = dims;
  $("#rsArea").textContent = G.rooms.map((q) => `${q.name} ${Math.round(q.area)} m²`).join(" · ") + (G.windows.length ? ` · ${G.windows.length} window${G.windows.length > 1 ? "s" : ""}` : "");
  const ic = document.querySelector(`#rShape [data-v="${r.shape}"] svg`);
  if (ic) $("#rsIcon").innerHTML = ic.innerHTML;
  $("#reDims").textContent = dims;
}

/* ---------- 3D editor: drag window edges to resize, the middle to slide ---------- */
type Kind3 = "move" | "end" | "top" | "bottom";
interface Handle3 {
  wid: string;
  kind: Kind3;
  end: number;
  sx: number;
  sy: number;
}
interface Drag3 {
  h: Handle3;
  W: Wall;
  a0: number;
  b0: number;
  sill0: number;
  head0: number;
}
let re3: THREE.WebGLRenderer, re3cv: HTMLCanvasElement, reOv: HTMLCanvasElement, ovc: CanvasRenderingContext2D, reCtl: OrbitControls;
const reCam = new THREE.PerspectiveCamera(45, 1, 0.05, 200), reRay = new THREE.Raycaster(), reNdc = new THREE.Vector2(), occRay = new THREE.Raycaster();
let re3Drag: Drag3 | null = null, re3Hover: Handle3 | null = null, re3H: Handle3[] = [], re3Down: [number, number] | null = null;

const isVis = (o: THREE.Object3D | null): boolean => {
  while (o) {
    if (!o.visible) return false;
    o = o.parent;
  }
  return true;
};
const toWorld = (W: Wall, al: number, y: number, off: number) => (W.ax === "x" ? new THREE.Vector3(al, y, W.c + off) : new THREE.Vector3(W.c + off, y, al));
function proj(v: THREE.Vector3): [number, number] | null {
  const r = re3cv.getBoundingClientRect(), p = v.clone().project(reCam);
  if (p.z > 1 || p.z < -1) return null;
  return [((p.x + 1) / 2) * r.width, ((1 - p.y) / 2) * r.height];
}
function hit3(p: [number, number]): Handle3 | null {
  let best: Handle3 | null = null, bd = 22;
  for (const h of re3H) {
    const d = Math.hypot(h.sx - p[0], h.sy - p[1]);
    if (d < bd) {
      bd = d;
      best = h;
    }
  }
  return best;
}
function setNdc(p: [number, number]): void {
  const r = re3cv.getBoundingClientRect();
  reNdc.set((p[0] / r.width) * 2 - 1, -(p[1] / r.height) * 2 + 1);
  reRay.setFromCamera(reNdc, reCam);
}
function wallPoint(p: [number, number], W: Wall): { along: number; y: number } | null {
  setNdc(p);
  const pl = W.ax === "x" ? new THREE.Plane(new THREE.Vector3(0, 0, 1), -W.c) : new THREE.Plane(new THREE.Vector3(1, 0, 0), -W.c), v = new THREE.Vector3();
  return reRay.ray.intersectPlane(pl, v) ? { along: W.ax === "x" ? v.x : v.z, y: v.y } : null;
}
function occluded(pt: THREE.Vector3): boolean {
  const dir = pt.clone().sub(reCam.position), dist = dir.length();
  occRay.set(reCam.position, dir.normalize());
  occRay.far = dist;
  return occRay.intersectObjects([roomG, itemsG], true).some((h) => h.distance < dist - 0.15 && h.object.userData.wid == null && isVis(h.object));
}
function applyWin3(D: Drag3, wp: { along: number; y: number }): void {
  const S: WinLimits = WS(), wd = wins().find((v) => v.id === D.h.wid);
  if (!wd) return;
  const k = D.h.kind;
  if (k === "move") setAlong(wd, D.W, snapW(wp.along));
  else if (k === "end") resizeWindow(wd, D.W, D.h.end, D.h.wid, D.a0, D.b0, wp.along);
  else if (k === "bottom") {
    wd.head = D.head0;
    wd.sill = clampV(snapW(wp.y), S.sillMin, Math.min(S.sillMax, D.head0 - S.minH));
  } else {
    wd.sill = D.sill0;
    wd.head = clampV(snapW(wp.y), D.sill0 + S.minH, L().room.h - S.gap);
  }
  rebuildWalls();
  renderWinPanel();
}

function re3Size(): void {
  const r = reView.getBoundingClientRect();
  if (!r.width || !r.height) return;
  re3.setSize(r.width, r.height, false);
  reCam.aspect = r.width / r.height;
  reCam.updateProjectionMatrix();
  const dpr = Math.min(devicePixelRatio, 2);
  reOv.width = Math.round(r.width * dpr);
  reOv.height = Math.round(r.height * dpr);
}
/** Start outside the shopfront, looking at the entrance wall. */
function re3Fit(): void {
  const b = app.geo.bbox, cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2, s = Math.max(b.x1 - b.x0, b.z1 - b.z0);
  reCtl.target.set(cx, 1.3, cz + (b.z1 - cz) * 0.4);
  reCam.position.set(cx + s * 0.3, s * 0.45 + 2, b.z1 + s * 0.9 + 2);
  reCtl.update();
}
function setReMode(m: EdMode, quiet = false): void {
  reMode = m;
  for (const b of $$("#reSeg button")) b.setAttribute("aria-pressed", String(b.dataset.v === m));
  reCv.hidden = m !== "2d";
  re3cv.hidden = reOv.hidden = m !== "3d";
  $("#reBadge").textContent = m === "3d" ? "Drag a window's edges to resize it, or its middle to slide it" : "Drag the handles to resize walls and move doors";
  reHover = null;
  re3Hover = null;
  if (m === "3d" && !quiet) {
    buildRoom();
    rebuildItems();
    re3Size();
    re3Fit();
  }
}
function pill(c: CanvasRenderingContext2D, x: number, y: number, ang: number, len: number, th: number, fill: string): void {
  c.save();
  c.translate(x, y);
  c.rotate(ang);
  c.fillStyle = fill;
  c.strokeStyle = TK.paper;
  c.lineWidth = 2;
  rr(c, -len / 2, -th / 2, len, th, th / 2);
  c.fill();
  c.stroke();
  c.restore();
}
function draw3dOverlay(): void {
  const r = re3cv.getBoundingClientRect(), dpr = Math.min(devicePixelRatio, 2), c = ovc;
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.clearRect(0, 0, r.width, r.height);
  re3H = [];
  let tip: [string, number, number] | null = null;
  for (const q of app.geo.windows) {
    const W = q.W, o = q.o, cp = W.ax === "x" ? reCam.position.z : reCam.position.x, off = (cp > W.c ? 1 : -1) * (WT / 2 + 0.02), mid = (o.sill + o.head) / 2;
    const P = (al: number, y: number) => toWorld(W, al, y, off), C = P(o.c, mid);
    if (occluded(C)) continue;
    const move = proj(C), l = proj(P(o.c - o.w / 2, mid)), rt = proj(P(o.c + o.w / 2, mid)), t = proj(P(o.c, o.head)), bt = proj(P(o.c, o.sill));
    if (!move || !l || !rt) continue;
    const sel = reWinSel === q.id, ang = Math.atan2(rt[1] - l[1], rt[0] - l[0]);
    const drag = re3Drag && re3Drag.h.wid === q.id ? re3Drag.h : null, hov = re3Hover && re3Hover.wid === q.id ? re3Hover : null;
    if (sel) {
      const cs = [P(o.c - o.w / 2, o.sill), P(o.c + o.w / 2, o.sill), P(o.c + o.w / 2, o.head), P(o.c - o.w / 2, o.head)].map(proj);
      if (cs.every(Boolean)) {
        c.strokeStyle = TK.accent;
        c.lineWidth = 2;
        c.setLineDash([6, 4]);
        c.beginPath();
        cs.forEach((v, k) => (k ? c.lineTo(v![0], v![1]) : c.moveTo(v![0], v![1])));
        c.closePath();
        c.stroke();
        c.setLineDash([]);
      }
      const hs: [Kind3, number, [number, number] | null, number][] = [["end", -1, l, ang + Math.PI / 2], ["end", 1, rt, ang + Math.PI / 2], ["top", 0, t, ang], ["bottom", 0, bt, ang]];
      for (const [kind, end, v, a] of hs) {
        if (!v) continue;
        const on = (drag && drag.kind === kind && drag.end === end) || (hov && hov.kind === kind && hov.end === end);
        pill(c, v[0], v[1], a, on ? 32 : 26, on ? 12 : 10, TK.accent);
        re3H.push({ wid: q.id, kind, end, sx: v[0], sy: v[1] });
      }
    }
    const z = sel ? 16 : 13;
    c.fillStyle = "#4f9fcb";
    c.strokeStyle = TK.paper;
    c.lineWidth = 2;
    rr(c, move[0] - z / 2, move[1] - z / 2, z, z, 4);
    c.fill();
    c.stroke();
    re3H.push({ wid: q.id, kind: "move", end: 0, sx: move[0], sy: move[1] });
    const wd = wins().find((v) => v.id === q.id);
    if (wd && (drag || (hov && !re3Drag))) tip = [`${WK[wd.kind].name} · ${fmt(o.w)} m wide · sill ${fmt(o.sill)} m · top ${fmt(o.head)} m`, move[0], (t ?? move)[1]];
  }
  if (tip) {
    c.font = "700 12px Figtree, system-ui, sans-serif";
    const tw = c.measureText(tip[0]).width;
    const x = Math.max(6, Math.min(r.width - tw - 22, tip[1] - tw / 2 - 8)), y = Math.max(6, tip[2] - 40);
    c.fillStyle = TK.fg;
    rr(c, x, y, tw + 16, 22, 6);
    c.fill();
    c.fillStyle = TK.paper;
    c.textAlign = "left";
    c.textBaseline = "middle";
    c.fillText(tip[0], x + 8, y + 11.5);
  }
}
export function render3dEditor(): void {
  reCtl.update();
  for (const W of walls) {
    W.full.visible = true;
    W.cut.visible = false;
  }
  re3.render(scene, reCam);
  draw3dOverlay();
}

function init3d(): void {
  re3 = makeRenderer();
  setupRenderer(re3);
  re3cv = re3.domElement;
  re3cv.className = "re3";
  re3cv.hidden = true;
  re3cv.setAttribute("aria-label", "3D view of walls and windows");
  reView.appendChild(re3cv);
  reOv = document.createElement("canvas");
  reOv.className = "reov";
  reOv.hidden = true;
  reView.appendChild(reOv);
  ovc = reOv.getContext("2d")!;
  const local = (e: PointerEvent): [number, number] => {
    const r = re3cv.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };
  // registered before OrbitControls so a handle drag can switch orbiting off
  re3cv.addEventListener("pointerdown", (e) => {
    const p = local(e);
    re3Down = p;
    const h = hit3(p);
    if (!h) return;
    const q = app.geo.windows.find((v) => v.id === h.wid);
    if (!q) return;
    reWinSel = h.wid;
    renderWinPanel();
    pushUndo();
    re3Drag = { h, W: q.W, a0: q.o.c - q.o.w / 2, b0: q.o.c + q.o.w / 2, sill0: q.o.sill, head0: q.o.head };
    reCtl.enabled = false;
    re3cv.setPointerCapture(e.pointerId);
  });
  re3cv.addEventListener("pointermove", (e) => {
    const p = local(e);
    if (re3Drag) {
      const wp = wallPoint(p, re3Drag.W);
      if (wp) applyWin3(re3Drag, wp);
      return;
    }
    const h = hit3(p);
    re3Hover = h;
    re3cv.style.cursor = h ? (h.kind === "end" ? "ew-resize" : h.kind === "move" ? "grab" : "ns-resize") : "default";
  });
  const up = (e: PointerEvent) => {
    const p = local(e);
    if (re3Drag) {
      re3Drag = null;
      reCtl.enabled = true;
      settleWindows();
      rebuildWalls();
      renderWinPanel();
      save();
    } else if (re3Down && Math.hypot(p[0] - re3Down[0], p[1] - re3Down[1]) < 6) {
      // a tap picks the window under the pointer, or clears the selection
      setNdc(p);
      const g = reRay.intersectObjects([roomG], true).find((h) => isVis(h.object));
      reWinSel = g && g.object.userData.wid != null ? (g.object.userData.wid as string) : null;
      renderWinPanel();
    }
    re3Down = null;
  };
  re3cv.addEventListener("pointerup", up);
  re3cv.addEventListener("pointercancel", up);
  reCtl = new OrbitControls(reCam, re3cv);
  reCtl.enableDamping = true;
  reCtl.maxPolarAngle = Math.PI / 2.02;
  reCtl.minDistance = 1;
  reCtl.maxDistance = 60;
  new ResizeObserver(re3Size).observe(reView);
  for (const b of $$<HTMLButtonElement>("#reSeg button")) b.onclick = () => {
    if (reMode !== b.dataset.v) setReMode(b.dataset.v as EdMode);
  };
}

/* ---------- Open / close ---------- */
export function openRoomEditor(): void {
  if (app.mode === "walk") setMode("3d");
  reWinSel = null;
  app.roomEdOpen = true;
  $("#roomEd").hidden = false;
  openInv(false);
  app.selected = null;
  showSel();
  evaluate();
  reSize();
  reFit();
  syncRoomInputs();
  updateRoomSummary();
  renderWinPanel();
}
export function closeRoomEditor(): void {
  if (reMode === "3d") setReMode("2d", true);
  app.roomEdOpen = false;
  $("#roomEd").hidden = true;
  for (const i of L().items) {
    i.x = snap(i.x);
    i.z = snap(i.z);
  }
  buildRoom();
  rebuildItems();
  applyLight();
  fitView();
  if (app.sized) fitPlan();
  showSel();
  save();
  resetClock();
}

/* ---------- Settings page (app-wide) ---------- */
const SF = [["sSillMin", "sillMin"], ["sSillMax", "sillMax"], ["sMinH", "minH"], ["sGap", "gap"], ["sWMin", "wMin"], ["sWMax", "wMax"]] as const;
function syncSettings(): void {
  const S = WS();
  for (const [id, k] of SF) $in("#" + id).value = String(S[k]);
  for (const b of $$("#sStep button")) b.setAttribute("aria-pressed", String(Number(b.dataset.v) === S.step));
  renderNames();
}

/** How many saved layouts name a back room this. */
function nameUses(n: string): number {
  return Object.values(app.store.slots).filter((L) => L.names?.kitchen === n || L.names?.storage === n).length;
}

/** Back-room names added by the user. Built-in names are always offered and aren't listed here. */
function renderNames(): void {
  const list = app.store.settings.roomNames, el = $("#sNames");
  el.innerHTML = list.length
    ? list.map((n, k) => {
        const u = nameUses(n), used = u ? `<small>used in ${u} layout${u > 1 ? "s" : ""}</small>` : "";
        return `<span class="nchip">${esc(n)}${used}<button data-nrm="${k}" aria-label="Remove ${esc(n)}${u ? `, used in ${u} layout${u > 1 ? "s" : ""}` : ""}">✕</button></span>`;
      }).join("")
    : `<p class="note" style="margin:0">No names added yet.</p>`;
  for (const b of $$<HTMLButtonElement>("[data-nrm]", el)) b.onclick = () => {
    // layouts already using the name keep it; it just stops being offered
    list.splice(Number(b.dataset.nrm), 1);
    renderNames();
    syncRoomInputs();
    save();
  };
}
function addName(): void {
  const inp = $in("#sNameNew"), v = inp.value.trim().replace(/\s+/g, " ").slice(0, 24);
  if (!v) return;
  const all = roomNameChoices(app.store.settings.roomNames);
  if (!all.some((n) => n.toLowerCase() === v.toLowerCase())) app.store.settings.roomNames.push(v);
  inp.value = "";
  renderNames();
  syncRoomInputs();
  save();
}
function openSettings(): void {
  syncSettings();
  $("#settings").hidden = false;
  $("#setScrim").hidden = false;
  $("#sSillMin").focus();
}
function closeSettings(): void {
  $("#settings").hidden = true;
  $("#setScrim").hidden = true;
}
function applySettings(): void {
  const S = WS();
  if (S.sillMax < S.sillMin) S.sillMax = S.sillMin;
  if (S.wMax < S.wMin) S.wMax = S.wMin;
  S.minH = Math.max(0.1, S.minH);
  syncSettings();
  save();
  if (app.roomEdOpen) reGeo();
  else {
    buildRoom();
    evaluate();
  }
}
function initSettings(): void {
  for (const [id, k] of SF) {
    const el = $in("#" + id);
    el.addEventListener("change", () => {
      const v = parseFloat(el.value);
      if (isFinite(v)) WS()[k] = Math.max(0, Math.round(v * 100) / 100);
      applySettings();
    });
  }
  for (const b of $$<HTMLButtonElement>("#sStep button")) b.onclick = () => {
    WS().step = Number(b.dataset.v);
    applySettings();
  };
  $("#sReset").onclick = () => {
    app.store.settings.win = { ...DEF_WIN };
    applySettings();
  };
  $("#sNameAdd").onclick = addName;
  $in("#sNameNew").addEventListener("keydown", (e) => {
    if (e.key === "Enter") addName();
  });
  $("#bSettings").onclick = openSettings;
  $("#wLimits").onclick = openSettings;
  $("#setClose").onclick = closeSettings;
  $("#setScrim").onclick = closeSettings;
  addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !$("#settings").hidden) {
      e.stopImmediatePropagation();
      closeSettings();
    }
  }, true);
}

export function initRoomEditor(): void {
  reView = $("#reView");
  reCv = $<HTMLCanvasElement>("#reCanvas");
  T2.ctx = reCv.getContext("2d")!;
  new ResizeObserver(reSize).observe(reView);
  init2dPointer();
  initWinPanel();
  init3d();
  $("#bRoomEd").onclick = openRoomEditor;
  $("#reDone").onclick = closeRoomEditor;
  $("#reFit").onclick = reFit;
  $("#reUndo").onclick = () => {
    undo();
    reGeo();
  };
  addEventListener("keydown", (e) => {
    if (app.roomEdOpen && e.key === "Escape") closeRoomEditor();
  });
  initSettings();
}
