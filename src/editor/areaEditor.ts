// Floor areas in the room editor: handles on the 2D plan and the area panel.
import { FINISHES } from "../data/finishes";
import { typeOf } from "../data/shopTypes";
import { $, $$, $in, esc, fmt, rr, TK } from "../dom";
import {
  AREA_KINDS, AREA_NAME_SUGGESTIONS, areaCountText, areaFits, areaSize, areaSummaries, DIVIDERS, gapAt, gapCentre, pushTowards, SIDE_NAMES, SIDES, sideLine,
} from "../geometry/areas";
import { app, cat, pushUndo, save } from "../state";
import type { Area, AreaKind, BBox, DividerKind, Side } from "../types";
import { w2s, type PlanTarget } from "../plan/plan";

export type AreaDrag = "amove" | "aedge" | "agap";
export interface AreaHandle {
  id: string;
  x: number;
  z: number;
  drag: AreaDrag;
  aid: string;
  key?: keyof BBox;
  side?: Side;
  tip: () => string;
}
interface DragState {
  h: AreaHandle;
  a0: BBox;
  X0: number;
  Z0: number;
}

let sel: string | null = null;
let onChange: () => void = () => {};
export const areaSel = (): string | null => sel;
const areas = (): Area[] => (app.L.areas ??= []);
const find = (id: string | null): Area | undefined => areas().find((a) => a.id === id);
const snap = (v: number) => Math.round(v / 0.05) * 0.05;
const box = (a: BBox): BBox => ({ x0: a.x0, x1: a.x1, z0: a.z0, z1: a.z1 });
const onShopFloor = (b: BBox) => app.geo.rectIn(b.x0 + 1e-4, b.x1 - 1e-4, b.z0 + 1e-4, b.z1 - 1e-4) === "cafe";
const fits = (id: string) => (b: BBox) => areaFits(b, id, areas(), onShopFloor);

export function selectArea(id: string | null): void {
  sel = id;
  renderAreaPanel();
}

/** Handles: a move handle on every area; edge and opening handles on the selected one. */
export function areaHandles(): AreaHandle[] {
  const H: AreaHandle[] = [];
  for (const a of areas()) {
    const nm = () => `${a.name || "Area"} · ${fmt(a.x1 - a.x0)} × ${fmt(a.z1 - a.z0)} m`;
    H.push({ id: "am:" + a.id, aid: a.id, drag: "amove", x: (a.x0 + a.x1) / 2, z: (a.z0 + a.z1) / 2, tip: nm });
    if (a.id !== sel) continue;
    for (const s of SIDES) {
      const L = sideLine(a, s), d = a.div?.[s], g = d ? gapCentre(a, s, d) : null;
      // keep the edge handle off the opening: middle of the longer piece of divider beside it
      let at = (L.a + L.b) / 2;
      if (g != null) at = g - L.a > L.b - g ? (L.a + g - 0.6) / 2 : (g + 0.6 + L.b) / 2;
      const key: keyof BBox = s === "n" ? "z0" : s === "s" ? "z1" : s === "w" ? "x0" : "x1";
      H.push({ id: `ae:${a.id}:${s}`, aid: a.id, drag: "aedge", key, side: s, x: L.ax === "x" ? at : L.c, z: L.ax === "x" ? L.c : at, tip: nm });
      if (g != null) H.push({ id: `ag:${a.id}:${s}`, aid: a.id, drag: "agap", side: s, x: L.ax === "x" ? g : L.c, z: L.ax === "x" ? L.c : g, tip: () => `${SIDE_NAMES[s]} opening, 1.2 m` });
    }
  }
  return H;
}

/** The selected area's outline, drawn under the handles. */
export function drawAreaSelection(T: PlanTarget): void {
  const a = find(sel);
  if (!a) return;
  const c = T.ctx, [x0, y0] = w2s(T, a.x0, a.z0), [x1, y1] = w2s(T, a.x1, a.z1);
  c.save();
  c.strokeStyle = TK.accent;
  c.lineWidth = 3;
  c.strokeRect(x0, y0, x1 - x0, y1 - y0);
  c.restore();
}

/** Draw one area handle at screen point (px, py). */
export function drawAreaHandle(c: CanvasRenderingContext2D, h: AreaHandle, big: boolean): void {
  c.lineWidth = 2;
  c.strokeStyle = TK.paper;
  if (h.drag === "amove") {
    const z = big ? 20 : 17;
    c.fillStyle = h.aid === sel ? TK.accent : TK.fg;
    rr(c, -z / 2, -z / 2, z, z, 5);
    c.fill();
    c.stroke();
    c.strokeStyle = TK.paper;
    c.lineWidth = 1.4;
    c.beginPath();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      c.moveTo(0, 0);
      c.lineTo(dx * 5.5, dy * 5.5);
    }
    c.stroke();
  } else if (h.drag === "aedge") {
    const v = h.key === "x0" || h.key === "x1", sc = big ? 1.15 : 1, bw = (v ? 10 : 28) * sc, bh = (v ? 28 : 10) * sc;
    c.fillStyle = TK.paper;
    rr(c, -bw / 2, -bh / 2, bw, bh, 5);
    c.fill();
    c.strokeStyle = TK.accent;
    c.lineWidth = 2.5;
    c.stroke();
  } else {
    c.fillStyle = TK.paper;
    c.beginPath();
    c.arc(0, 0, big ? 8 : 6.5, 0, 7);
    c.fill();
    c.strokeStyle = "#6f9a5a";
    c.lineWidth = 3;
    c.stroke();
  }
}

export function startAreaDrag(h: AreaHandle, X: number, Z: number): DragState | null {
  const a = find(h.aid);
  if (!a) return null;
  if (sel !== a.id) selectArea(a.id);
  return { h, a0: box(a), X0: X, Z0: Z };
}
/** Move, resize or slide an opening; areas push against the walls and each other. */
export function dragArea(D: DragState, X: number, Z: number): void {
  const a = find(D.h.aid);
  if (!a) return;
  const h = D.h;
  if (h.drag === "agap" && h.side) {
    const d = a.div?.[h.side];
    if (d) {
      const L = sideLine(a, h.side);
      d.gap = gapAt(a, h.side, L.ax === "x" ? X : Z);
    }
    return;
  }
  const to = { ...D.a0 };
  if (h.drag === "amove") {
    const dx = snap(X - D.X0), dz = snap(Z - D.Z0);
    to.x0 += dx;
    to.x1 += dx;
    to.z0 += dz;
    to.z1 += dz;
  } else if (h.key) to[h.key] = snap(h.key[0] === "x" ? X : Z);
  Object.assign(a, pushTowards(box(a), to, fits(a.id)));
}

/** A free spot for a new area: the largest of a few sizes that fits, near the middle of the shop floor. */
function freeSpot(): BBox | null {
  const r = app.L.room, cells = app.geo.cells.filter((c) => c.id === "cafe");
  const cands: [number, number][] = [];
  for (const c of cells)
    for (let x = Math.ceil(c.x0 * 2) / 2; x <= c.x1; x += 0.5) for (let z = Math.ceil(c.z0 * 2) / 2; z <= c.z1; z += 0.5) cands.push([x, z]);
  cands.sort((p, q) => Math.hypot(p[0], p[1] - r.d / 6) - Math.hypot(q[0], q[1] - r.d / 6));
  for (const [w, d] of [[3, 3], [2.5, 2.5], [2, 2], [1.5, 1.5], [1, 1]] as const)
    for (const [x, z] of cands) {
      const b = { x0: x - w / 2, x1: x + w / 2, z0: z - d / 2, z1: z + d / 2 };
      if (fits("")(b)) return b;
    }
  return null;
}
function uniqueName(base: string): string {
  const names = areas().map((a) => a.name.trim().toLowerCase());
  let n = 1, name = base;
  while (names.includes(name.toLowerCase())) name = `${base} ${++n}`;
  return name;
}
function addArea(): void {
  const spot = freeSpot();
  if (!spot) {
    $("#aHelp").textContent = "There's no free shop floor left for a new area. Make an area smaller or delete one first.";
    return;
  }
  const t = typeOf(app.L), used = new Set(areas().map((a) => a.kind));
  const kind: AreaKind = t === "mixed" ? ((["cafe", "books", "retail"] as AreaKind[]).find((k) => !used.has(k)) ?? "general") : t;
  pushUndo();
  const a: Area = { id: "a" + Date.now().toString(36), name: uniqueName(AREA_KINDS[kind].name), kind, finish: "layout", ...spot };
  areas().push(a);
  selectArea(a.id);
  onChange();
  save();
}

/** Rectangles that share this area's name: they count as one area and share its kind and floor. */
const sameName = (a: Area) => areas().filter((o) => o.name.trim().toLowerCase() === a.name.trim().toLowerCase());

export function renderAreaPanel(): void {
  const list = areas();
  $("#aChips").innerHTML = list.map((a) => `<button data-asel="${esc(a.id)}" aria-pressed="${a.id === sel}">${esc(a.name || "Area")}</button>`).join("");
  for (const b of $$<HTMLButtonElement>("[data-asel]")) b.onclick = () => selectArea(b.dataset.asel === sel ? null : b.dataset.asel!);
  const a = find(sel);
  $("#aPanel").hidden = !a;
  $("#aHelp").hidden = !!a;
  if (!a) {
    sel = null;
    return;
  }
  $("#aTitle").textContent = `${fmt(a.x1 - a.x0)} × ${fmt(a.z1 - a.z0)} m · ${fmt(areaSize(a))} m²`;
  const nm = $in("#aName");
  if (document.activeElement !== nm) nm.value = a.name;
  $("#aNameList").innerHTML = [...new Set([...AREA_NAME_SUGGESTIONS, ...list.map((o) => o.name)])].map((n) => `<option value="${esc(n)}"></option>`).join("");
  for (const b of $$("#aKind button")) b.setAttribute("aria-pressed", String(b.dataset.v === a.kind));
  const grp = sameName(a), g = areaSummaries(app.L, cat).find((q) => q.ids.includes(a.id));
  const ct = g ? areaCountText(g) : "";
  $("#aKindNote").textContent = `${AREA_KINDS[a.kind].name} areas ${AREA_KINDS[a.kind].note}.${grp.length > 1 ? ` ${grp.length} rectangles are named “${a.name}”, so they count as one area.` : ""}`;
  const groups = ["Hard", "Wood", "Soft"] as const;
  $("#aFinish").innerHTML = `<option value="layout"${a.finish === "layout" ? " selected" : ""}>Same as layout</option>` +
    groups.map((gr) => `<optgroup label="${gr}">` + Object.entries(FINISHES).filter(([, f]) => f.grp === gr).map(([k, f]) => `<option value="${k}"${k === a.finish ? " selected" : ""}>${f.name}</option>`).join("") + "</optgroup>").join("");
  $("#aDivs").innerHTML = SIDES.map((s) => {
    const d = a.div?.[s];
    return `<div class="adiv"><span>${SIDE_NAMES[s]}</span><select data-dkind="${s}" aria-label="${SIDE_NAMES[s]} divider"><option value="">None</option>${(Object.keys(DIVIDERS) as DividerKind[]).map((k) => `<option value="${k}"${d?.kind === k ? " selected" : ""}>${DIVIDERS[k].name}</option>`).join("")}</select>` +
      (d ? `<label class="op"><input type="checkbox" data-dgap="${s}"${d.gap != null ? " checked" : ""}> Opening</label>` + (d.gap != null ? `<input type="range" min="-1" max="1" step="0.05" value="${d.gap}" data-dpos="${s}" aria-label="${SIDE_NAMES[s]} opening position">` : "") : "<span></span>") + "</div>";
  }).join("");
  $("#aNote").textContent = g ? `${g.name}: ${fmt(g.size)} m²${ct ? ` · ${ct}` : ""} · ${g.pieces} piece${g.pieces === 1 ? "" : "s"}` : "";
}

export function initAreaPanel(changed: () => void): void {
  onChange = () => {
    changed();
    renderAreaPanel();
  };
  const edit = (fn: (a: Area) => void) => {
    const a = find(sel);
    if (!a) return;
    pushUndo();
    fn(a);
    onChange();
    save();
  };
  $("#aAdd").onclick = addArea;
  $("#aDel").onclick = () => edit((a) => {
    app.L.areas = areas().filter((o) => o.id !== a.id);
    sel = null;
  });
  // kind and floor apply to every rectangle with this name
  for (const b of $$<HTMLButtonElement>("#aKind button")) b.onclick = () => edit((a) => {
    for (const o of sameName(a)) o.kind = b.dataset.v as AreaKind;
  });
  $<HTMLSelectElement>("#aFinish").addEventListener("change", (e) => edit((a) => {
    for (const o of sameName(a)) o.finish = (e.target as HTMLSelectElement).value;
  }));
  const nm = $in("#aName");
  nm.addEventListener("change", () => edit((a) => {
    a.name = nm.value.trim().replace(/\s+/g, " ").slice(0, 30) || a.name;
    // joining another area by name takes on its kind and floor
    const other = sameName(a).find((o) => o !== a);
    if (other) {
      a.kind = other.kind;
      a.finish = other.finish;
    }
  }));
  nm.addEventListener("keydown", (e) => {
    if (e.key === "Enter") nm.blur();
  });
  const divs = $("#aDivs");
  divs.addEventListener("change", (e) => {
    const t = e.target as HTMLInputElement | HTMLSelectElement, ds = t.dataset;
    if (ds.dkind) edit((a) => {
      const s = ds.dkind as Side, div = (a.div ??= {});
      if (!t.value) delete div[s];
      else div[s] = { kind: t.value as DividerKind, gap: div[s]?.gap === undefined ? 0 : div[s]!.gap };
    });
    else if (ds.dgap) edit((a) => {
      const d = a.div?.[ds.dgap as Side];
      if (d) d.gap = (t as HTMLInputElement).checked ? 0 : null;
    });
    else if (ds.dpos) save();
  });
  let armed = true;
  divs.addEventListener("input", (e) => {
    const t = e.target as HTMLInputElement, s = t.dataset.dpos as Side | undefined, a = find(sel);
    if (!s || !a?.div?.[s]) return;
    if (armed) {
      pushUndo();
      armed = false;
    }
    a.div[s]!.gap = parseFloat(t.value);
    changed();
  });
  divs.addEventListener("change", () => (armed = true));
}
