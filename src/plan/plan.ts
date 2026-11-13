// The 2D floor plan: drawing (shared with the room editor) and the main plan's pointer handling.
import { BY } from "../data/catalog";
import { fmt, rr, TK } from "../dom";
import { tableChairs } from "../geometry/items";
import { defaultBoh, shapeOf, WT } from "../geometry/rooms";
import { dimsOf, heightOf, itemColor, moveTo, select } from "../items";
import { app, cat, pushUndo, save } from "../state";
import type { Placed } from "../types";
import { hideHint } from "../ui/hint";

export interface PlanView {
  /** pixels per metre */
  s: number;
  cx: number;
  cz: number;
  /** the viewer has panned or zoomed, so don't refit on resize */
  user: boolean;
}
/** A canvas the plan is drawn on, with its view and size in CSS pixels. */
export interface PlanTarget {
  ctx: CanvasRenderingContext2D;
  V: PlanView;
  W: number;
  H: number;
  /** fade the furniture (room editor) */
  ghost: boolean;
}

export const w2s = (t: PlanTarget, x: number, z: number): [number, number] => [t.W / 2 + (x - t.V.cx) * t.V.s, t.H / 2 + (z - t.V.cz) * t.V.s];
export const s2w = (t: PlanTarget, px: number, py: number): [number, number] => [(px - t.W / 2) / t.V.s + t.V.cx, (py - t.H / 2) / t.V.s + t.V.cz];

function label(c: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, weight: number, color: string, align: CanvasTextAlign = "center"): void {
  c.font = `${weight} ${size}px Figtree, system-ui, sans-serif`;
  c.textAlign = align;
  c.textBaseline = "middle";
  c.lineWidth = 3;
  c.strokeStyle = TK.paper;
  c.lineJoin = "round";
  c.strokeText(text, x, y);
  c.fillStyle = color;
  c.fillText(text, x, y);
}

/** A plan symbol for one piece, drawn in metres around its centre. */
function drawSymbol(c: CanvasRenderingContext2D, i: Placed, state: "bad" | "sel" | null, s: number): void {
  const ct = cat(i.type), w = ct.w, d = ct.d, col = itemColor(i), lw = 1 / s;
  const fillDetail = () => {
    c.fillStyle = TK.paper;
    c.fill();
    c.lineWidth = 1.2 * lw;
    c.strokeStyle = TK.fg;
    c.stroke();
  };
  const outline = (width = lw) => {
    c.fillStyle = col;
    c.fill();
    c.lineWidth = width;
    c.strokeStyle = TK.fg;
    c.stroke();
  };
  // footprint
  c.globalAlpha = 0.28;
  rr(c, -w / 2, -d / 2, w, d, 0.05);
  c.fillStyle = col;
  c.fill();
  c.globalAlpha = 1;
  c.lineWidth = lw;
  c.strokeStyle = TK.muted;
  c.setLineDash(ct.seats ? [4 * lw, 3 * lw] : []);
  rr(c, -w / 2, -d / 2, w, d, 0.05);
  c.stroke();
  c.setLineDash([]);
  const chair = (x: number, z: number, r: number) => {
    c.save();
    c.translate(x, z);
    c.rotate(-r);
    rr(c, -0.21, -0.21, 0.42, 0.42, 0.06);
    outline();
    c.fillRect(-0.21, -0.23, 0.42, 0.06);
    c.restore();
  };
  const t = i.type;
  if (t === "two") {
    chair(-0.52, 0, Math.PI / 2);
    chair(0.52, 0, -Math.PI / 2);
    c.beginPath();
    c.arc(0, 0, 0.35, 0, 7);
    fillDetail();
  } else if (t === "four") {
    chair(0, -0.62, 0);
    chair(0, 0.62, Math.PI);
    chair(-0.62, 0, Math.PI / 2);
    chair(0.62, 0, -Math.PI / 2);
    rr(c, -0.425, -0.425, 0.85, 0.85, 0.03);
    fillDetail();
  } else if (t === "booth") {
    for (const sg of [-1, 1]) {
      rr(c, -0.9, sg * 0.5 - 0.25, 1.8, 0.5, 0.06);
      outline();
    }
    rr(c, -0.7, -0.275, 1.4, 0.55, 0.03);
    fillDetail();
  } else if (t === "sofa") {
    rr(c, -1, -0.8, 2, 0.8, 0.08);
    outline();
    c.beginPath();
    c.arc(0, 0.4, 0.35, 0, 7);
    fillDetail();
  } else if (t === "ledge") {
    rr(c, -1, -0.3, 2, 0.35, 0.02);
    fillDetail();
    for (const x of [-0.65, 0, 0.65]) {
      c.beginPath();
      c.arc(x, 0.12, 0.18, 0, 7);
      outline();
    }
  } else if (t === "plant") {
    c.beginPath();
    c.arc(0, 0, 0.25, 0, 7);
    outline();
  } else if (!BY[t] && (ct.shape === "round" || ct.shape === "square")) {
    for (const [x, z, r] of tableChairs(ct)) chair(x, z, r);
    const tw = ct.tw ?? 0.8, td = ct.td ?? 0.8;
    if (ct.shape === "round") {
      c.beginPath();
      c.ellipse(0, 0, tw / 2, td / 2, 0, 0, 7);
    } else rr(c, -tw / 2, -td / 2, tw, td, 0.03);
    fillDetail();
  } else if (ct.shape === "parts") {
    for (const q of [...(ct.parts ?? [])].sort((a, b) => a.y + a.h - (b.y + b.h))) {
      c.save();
      c.translate(q.x - (ct.ox ?? 0), q.z - (ct.oz ?? 0));
      if (q.k === "cyl") {
        c.beginPath();
        c.ellipse(0, 0, q.w / 2, q.d / 2, 0, 0, 7);
      } else rr(c, -q.w / 2, -q.d / 2, q.w, q.d, 0.01);
      c.globalAlpha = 0.8;
      c.fillStyle = q.color;
      c.fill();
      c.globalAlpha = 1;
      c.lineWidth = lw;
      c.strokeStyle = TK.fg;
      c.stroke();
      c.restore();
    }
  } else {
    rr(c, -w / 2, -d / 2, w, d, 0.04);
    c.globalAlpha = 0.6;
    c.fillStyle = col;
    c.fill();
    c.globalAlpha = 1;
    c.lineWidth = 1.4 * lw;
    c.strokeStyle = TK.fg;
    c.stroke();
    if (ct.front) {
      c.lineWidth = 3.5 * lw;
      c.beginPath();
      c.moveTo(-w / 2 + 0.04, d / 2);
      c.lineTo(w / 2 - 0.04, d / 2);
      c.stroke();
    }
  }
  if (state) {
    c.lineWidth = 2.5 * lw;
    c.strokeStyle = state === "bad" ? TK.warn : TK.accent;
    rr(c, -w / 2 - 0.05, -d / 2 - 0.05, w + 0.1, d + 0.1, 0.08);
    c.stroke();
  }
}

/** Draw rooms, walls, openings, dimensions and furniture onto a plan target. */
export function drawPlan(T: PlanTarget): void {
  const c = T.ctx, dpr = Math.min(devicePixelRatio, 2), geo = app.geo, L = app.L;
  const P = (x: number, z: number) => w2s(T, x, z);
  c.setTransform(dpr, 0, 0, dpr, 0, 0);
  c.fillStyle = TK.stage;
  c.fillRect(0, 0, T.W, T.H);
  const { w, d } = L.room, s = T.V.s, t = Math.max(3, WT * s), B = L.boh ?? defaultBoh();
  // floors and a 0.5 m grid per cell; back rooms get a light tint
  for (const r of geo.cells) {
    const [x0, y0] = P(r.x0, r.z0), rw = (r.x1 - r.x0) * s, rd = (r.z1 - r.z0) * s;
    c.fillStyle = TK.paper;
    c.fillRect(x0, y0, rw + 0.5, rd + 0.5);
    if (r.id !== "cafe") {
      c.fillStyle = TK.line;
      c.globalAlpha = r.id === "kitchen" ? 0.45 : 0.28;
      c.fillRect(x0, y0, rw + 0.5, rd + 0.5);
      c.globalAlpha = 1;
    }
    c.save();
    c.beginPath();
    c.rect(x0, y0, rw, rd);
    c.clip();
    c.strokeStyle = TK.line;
    c.lineWidth = 1;
    for (let x = Math.ceil(r.x0 * 2) / 2; x <= r.x1 + 1e-6; x += 0.5) {
      const [px] = P(x, 0);
      c.globalAlpha = Math.abs(x - Math.round(x)) < 1e-6 ? 1 : 0.55;
      c.beginPath();
      c.moveTo(px, y0);
      c.lineTo(px, y0 + rd);
      c.stroke();
    }
    for (let z = Math.ceil(r.z0 * 2) / 2; z <= r.z1 + 1e-6; z += 0.5) {
      const [, py] = P(0, z);
      c.globalAlpha = Math.abs(z - Math.round(z)) < 1e-6 ? 1 : 0.55;
      c.beginPath();
      c.moveTo(x0, py);
      c.lineTo(x0 + rw, py);
      c.stroke();
    }
    c.restore();
    c.globalAlpha = 1;
  }
  // walls with gaps for openings
  c.fillStyle = TK.fg;
  for (const wl of geo.walls) {
    let cur = wl.a;
    const seg = (a: number, b: number) => {
      if (b - a <= 0) return;
      if (wl.ax === "x") {
        const [p0, py] = P(a, wl.c), [p1] = P(b, wl.c);
        c.fillRect(p0, py - t / 2, p1 - p0, t);
      } else {
        const [px, q0] = P(wl.c, a), [, q1] = P(wl.c, b);
        c.fillRect(px - t / 2, q0, t, q1 - q0);
      }
    };
    for (const o of [...wl.open].sort((p, q) => p.c - q.c)) {
      seg(cur, o.c - o.w / 2);
      cur = o.c + o.w / 2;
    }
    seg(cur, wl.b);
  }
  // doors, hatch, windows and their labels
  const swingArc = (hx: number, hy: number, R: number, aAlong: number, aLeaf: number) => {
    let a1 = aLeaf, a2 = aAlong;
    while (a2 - a1 > Math.PI) a2 -= 2 * Math.PI;
    while (a1 - a2 > Math.PI) a1 -= 2 * Math.PI;
    c.strokeStyle = TK.muted;
    c.lineWidth = 1;
    c.setLineDash([4, 3]);
    c.beginPath();
    c.arc(hx, hy, R, Math.min(a1, a2), Math.max(a1, a2));
    c.stroke();
    c.setLineDash([]);
    c.strokeStyle = TK.fg;
    c.lineWidth = 1.5;
    c.beginPath();
    c.moveTo(hx, hy);
    c.lineTo(hx + Math.cos(aLeaf) * R, hy + Math.sin(aLeaf) * R);
    c.stroke();
  };
  for (const wl of geo.walls) for (const o of wl.open) {
    const at = (v: number) => (wl.ax === "x" ? P(v, wl.c) : P(wl.c, v));
    const [ax, ay] = at(o.c - o.w / 2), [bx, by] = at(o.c + o.w / 2), mx = (ax + bx) / 2, my = (ay + by) / 2;
    const aAlong = wl.ax === "x" ? 0 : Math.PI / 2;
    const nAng = (sg: number) => (wl.ax === "x" ? (sg > 0 ? Math.PI / 2 : -Math.PI / 2) : sg > 0 ? 0 : Math.PI);
    const off = (sg: number, px: number): [number, number] => (wl.ax === "x" ? [mx, my + sg * px] : [mx + sg * px, my]);
    if (o.kind === "window") {
      c.fillStyle = TK.paper;
      c.strokeStyle = TK.fg;
      c.lineWidth = 1;
      if (wl.ax === "x") {
        c.fillRect(ax, ay - t / 2, bx - ax, t);
        c.strokeRect(ax, ay - t / 2, bx - ax, t);
      } else {
        c.fillRect(ax - t / 2, ay, t, by - ay);
        c.strokeRect(ax - t / 2, ay, t, by - ay);
      }
      c.strokeStyle = "#4f9fcb";
      c.lineWidth = 2;
      c.beginPath();
      c.moveTo(ax, ay);
      c.lineTo(bx, by);
      c.stroke();
    } else if (o.kind === "hatch") {
      c.strokeStyle = TK.fg;
      c.lineWidth = 1;
      c.beginPath();
      if (wl.ax === "x") {
        c.moveTo(ax, ay - t / 2); c.lineTo(bx, by - t / 2); c.moveTo(ax, ay + t / 2); c.lineTo(bx, by + t / 2);
      } else {
        c.moveTo(ax - t / 2, ay); c.lineTo(bx - t / 2, by); c.moveTo(ax + t / 2, ay); c.lineTo(bx + t / 2, by);
      }
      c.stroke();
      const [lx, ly] = off(wl.pos === "cafe" ? 1 : -1, t / 2 + (wl.ax === "z" ? 24 : 9));
      label(c, o.label ?? "Hatch", lx, ly, 10.5, 600, TK.muted);
    } else if (o.kind === "entrance") {
      const R = (o.w / 2) * s;
      swingArc(ax, ay, R, aAlong, nAng(-wl.nrm));
      swingArc(bx, by, R, aAlong + Math.PI, nAng(-wl.nrm));
      const [lx, ly] = off(wl.nrm, t / 2 + 12);
      label(c, "Entrance", lx, ly, 11, 600, TK.muted);
    } else {
      swingArc(ax, ay, o.w * s, aAlong, nAng(o.swing ?? 1));
      if (o.label) {
        const [lx, ly] = off(wl.nrm, t / 2 + (wl.ax === "z" ? 44 : 12));
        label(c, o.label, lx, ly, 10.5, 600, TK.muted);
      }
    }
  }
  // overall shop dimensions
  const [cx0, cy0] = P(-w / 2, -d / 2), [cx1, cy1] = P(w / 2, d / 2);
  c.strokeStyle = TK.muted;
  c.lineWidth = 1;
  const dy = cy1 + t + 30;
  c.beginPath();
  c.moveTo(cx0, dy); c.lineTo(cx1, dy); c.moveTo(cx0, dy - 4); c.lineTo(cx0, dy + 4); c.moveTo(cx1, dy - 4); c.lineTo(cx1, dy + 4);
  c.stroke();
  label(c, `${fmt(w)} m`, (cx0 + cx1) / 2, dy, 12, 600, TK.fg);
  const ddx = B.mode !== "none" && B.side === "left" ? cx1 + t + 14 : cx0 - t - 14;
  c.beginPath();
  c.moveTo(ddx, cy0); c.lineTo(ddx, cy1); c.moveTo(ddx - 4, cy0); c.lineTo(ddx + 4, cy0); c.moveTo(ddx - 4, cy1); c.lineTo(ddx + 4, cy1);
  c.stroke();
  c.save();
  c.translate(ddx, (cy0 + cy1) / 2);
  c.rotate(-Math.PI / 2);
  label(c, `${fmt(d)} m`, 0, 0, 12, 600, TK.fg);
  c.restore();
  // furniture
  const labels: { i: Placed; px: number; py: number }[] = [];
  for (const i of L.items) {
    const [px, py] = P(i.x, i.z);
    c.save();
    c.translate(px, py);
    c.rotate((i.r * Math.PI) / 180);
    c.scale(s * (i.sx || 1), s * (i.sz || 1));
    drawSymbol(c, i, app.clashSet.has(i.id) ? "bad" : app.selected === i.id ? "sel" : null, s);
    c.restore();
    const dm = dimsOf(i);
    if (Math.min(dm.w, dm.d) * s >= 26 || app.selected === i.id) labels.push({ i, px, py });
  }
  if (T.ghost) {
    c.fillStyle = TK.paper;
    c.globalAlpha = 0.6;
    for (const r of geo.cells) {
      const [x0, y0] = P(r.x0, r.z0);
      c.fillRect(x0, y0, (r.x1 - r.x0) * s, (r.z1 - r.z0) * s);
    }
    c.globalAlpha = 1;
  } else for (const { i, px, py } of labels) {
    const ct = cat(i.type), sel = app.selected === i.id, dm = dimsOf(i);
    label(c, ct.name.length > 18 && !sel ? ct.name.slice(0, 16) + "…" : ct.name, px, py - (sel ? 7 : 0), 11.5, 600, TK.fg);
    if (sel) label(c, `${fmt(dm.w)} × ${fmt(dm.d)} m · ${fmt(heightOf(i))} m tall${ct.seats ? ` · ${ct.seats} seats` : ""}`, px, py + 8, 10.5, 500, TK.muted);
  }
  // room names and areas, drawn over furniture so they stay readable
  if (geo.rooms.length > 1 || shapeOf(L.room).shape !== "rect") for (const r of geo.rooms) {
    const [x0, y0] = P(r.ax, r.az);
    if ((r.x1 - r.x0) * s < 80) continue;
    const txt = `${r.name} · ${Math.round(r.area)} m²`;
    c.font = "700 11px Figtree, system-ui, sans-serif";
    const tw = c.measureText(txt).width;
    c.fillStyle = TK.paper;
    c.globalAlpha = 0.92;
    rr(c, x0 + 3, y0 + 3, tw + 10, 17, 5);
    c.fill();
    c.globalAlpha = 1;
    label(c, txt, x0 + 8, y0 + 11.5, 11, 700, TK.fg, "left");
  }
  // 1 m scale bar
  if (app.selected == null) {
    const by = T.H - 18;
    c.fillStyle = TK.fg;
    c.fillRect(16, by, s, 3);
    label(c, "1 m", 16 + s / 2, by - 9, 10.5, 600, TK.fg);
  }
}

/** Fit all rooms in view, leaving room for the floating buttons at the top. */
export function fitPlanTarget(T: PlanTarget, top = 60, margin = 40): void {
  const b = app.geo.bbox, w = b.x1 - b.x0, d = b.z1 - b.z0;
  T.V.s = Math.max(8, Math.min((T.W - margin) / (w + 1.8), (T.H - margin - top) / (d + 2.6)));
  T.V.cx = (b.x0 + b.x1) / 2;
  T.V.cz = (b.z0 + b.z1) / 2 + 0.35 - top / 2 / T.V.s;
  T.V.user = false;
}

/* ---------- The main 2D plan view ---------- */
export const planCanvas = document.createElement("canvas");
planCanvas.setAttribute("aria-label", "2D floor plan");
planCanvas.hidden = true;
const ctx = planCanvas.getContext("2d");
if (!ctx) throw new Error("2D canvas unavailable");
export const mainPlan: PlanTarget = { ctx, V: { s: 40, cx: 0, cz: 0, user: false }, W: 1, H: 1, ghost: false };
export const fitPlan = (): void => fitPlanTarget(mainPlan);

function hitPlan(x: number, z: number): Placed | null {
  const items = app.L.items;
  for (let k = items.length - 1; k >= 0; k--) {
    const i = items[k]!, dm = dimsOf(i), a = (i.r * Math.PI) / 180, dx = x - i.x, dz = z - i.z;
    const lx = dx * Math.cos(a) + dz * Math.sin(a), lz = -dx * Math.sin(a) + dz * Math.cos(a);
    if (Math.abs(lx) <= dm.w / 2 + 0.05 && Math.abs(lz) <= dm.d / 2 + 0.05) return i;
  }
  return null;
}

type Pt = [number, number];
export function initPlanPointer(): void {
  const pc = planCanvas, V = mainPlan.V, ptrs = new Map<number, Pt>();
  let pdrag: { i: Placed; ox: number; oz: number; moved: boolean } | null = null;
  let pan: { p: Pt; cx: number; cz: number } | null = null;
  let pinch: { d0: number; s0: number; w: Pt } | null = null;
  let pdown: Pt | null = null;
  const local = (e: PointerEvent | WheelEvent): Pt => {
    const r = pc.getBoundingClientRect();
    return [e.clientX - r.left, e.clientY - r.top];
  };
  const two = (): [Pt, Pt] => [...ptrs.values()] as [Pt, Pt];
  pc.addEventListener("pointerdown", (e) => {
    hideHint();
    const p = local(e);
    ptrs.set(e.pointerId, p);
    pc.setPointerCapture(e.pointerId);
    if (ptrs.size === 2) {
      const [a, b] = two(), mid: Pt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      pinch = { d0: Math.hypot(a[0] - b[0], a[1] - b[1]), s0: V.s, w: s2w(mainPlan, ...mid) };
      if (pdrag?.moved) save();
      pdrag = null;
      pan = null;
      return;
    }
    pdown = p;
    const [x, z] = s2w(mainPlan, ...p), hit = hitPlan(x, z);
    if (hit) {
      select(hit.id);
      pdrag = { i: hit, ox: hit.x - x, oz: hit.z - z, moved: false };
    } else pan = { p, cx: V.cx, cz: V.cz };
  });
  pc.addEventListener("pointermove", (e) => {
    if (!ptrs.has(e.pointerId)) return;
    const p = local(e);
    ptrs.set(e.pointerId, p);
    if (pinch && ptrs.size >= 2) {
      const [a, b] = two(), mid: Pt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      V.user = true;
      V.s = Math.max(8, Math.min(320, (pinch.s0 * Math.hypot(a[0] - b[0], a[1] - b[1])) / pinch.d0));
      V.cx = pinch.w[0] - (mid[0] - mainPlan.W / 2) / V.s;
      V.cz = pinch.w[1] - (mid[1] - mainPlan.H / 2) / V.s;
      return;
    }
    if (pdrag) {
      if (!pdrag.moved) {
        if (pdown && Math.hypot(p[0] - pdown[0], p[1] - pdown[1]) < 4) return;
        pushUndo();
        pdrag.moved = true;
      }
      const [x, z] = s2w(mainPlan, ...p);
      moveTo(pdrag.i, x + pdrag.ox, z + pdrag.oz);
    } else if (pan) {
      if (Math.hypot(p[0] - pan.p[0], p[1] - pan.p[1]) > 4) V.user = true;
      V.cx = pan.cx - (p[0] - pan.p[0]) / V.s;
      V.cz = pan.cz - (p[1] - pan.p[1]) / V.s;
    }
  });
  const up = (e: PointerEvent) => {
    const p = ptrs.get(e.pointerId);
    ptrs.delete(e.pointerId);
    if (ptrs.size < 2) pinch = null;
    if (pdrag) {
      if (pdrag.moved) save();
      pdrag = null;
    } else if (pan && p && pdown && Math.hypot(p[0] - pdown[0], p[1] - pdown[1]) < 6) select(null);
    pan = null;
    if (ptrs.size === 1) pan = { p: [...ptrs.values()][0]!, cx: V.cx, cz: V.cz };
  };
  pc.addEventListener("pointerup", up);
  pc.addEventListener("pointercancel", up);
  pc.addEventListener("wheel", (e) => {
    e.preventDefault();
    V.user = true;
    const p = local(e), wpt = s2w(mainPlan, ...p);
    V.s = Math.max(8, Math.min(320, V.s * Math.exp(-e.deltaY * 0.0015)));
    V.cx = wpt[0] - (p[0] - mainPlan.W / 2) / V.s;
    V.cz = wpt[1] - (p[1] - mainPlan.H / 2) / V.s;
  }, { passive: false });
}
