// Item studio: a separate 3D workshop for designing custom pieces.
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { PALETTES, SWATCHES } from "../data/catalog";
import { $, $in, clone, esc, fmt } from "../dom";
import { addItem, rebuildItems } from "../items";
import { app, save } from "../state";
import { makeRenderer, setupRenderer, THREE } from "../three/core";
import { buildCustom } from "../three/furniture";
import type { CustomShape, ItemDef, Part } from "../types";
import { onTheme, resetClock, setMode } from "../views";
import { flashHint } from "./hint";
import { openInv, renderCatalog } from "./inventory";
import { showSel } from "./selection";
import { bindSwatches, swatchHTML } from "./swatches";

/** The piece being edited. */
interface Draft {
  type: string | null;
  name: string;
  shape: CustomShape;
  color: string;
  w: number;
  d: number;
  h: number;
  tw: number;
  td: number;
  /** seats a parts-built piece adds */
  seats: number;
  tableSeats: number;
  parts: Part[];
  sel: number;
}

const PART_SHELF = (): Part[] => [
  { k: "box", w: 0.04, h: 1.6, d: 0.4, x: -0.58, y: 0, z: 0, color: "#8a5a44" }, { k: "box", w: 0.04, h: 1.6, d: 0.4, x: 0.58, y: 0, z: 0, color: "#8a5a44" },
  { k: "box", w: 1.16, h: 0.03, d: 0.4, x: 0, y: 0.1, z: 0, color: "#f4f1ea" }, { k: "box", w: 1.16, h: 0.03, d: 0.4, x: 0, y: 0.7, z: 0, color: "#f4f1ea" },
  { k: "box", w: 1.16, h: 0.03, d: 0.4, x: 0, y: 1.3, z: 0, color: "#f4f1ea" }, { k: "cyl", w: 0.3, h: 0.12, d: 0.3, x: -0.25, y: 1.33, z: 0, color: "#e3879a" },
];
const SW0 = SWATCHES[0]!;
const newDraft = (): Draft => ({ type: null, name: "Cake shelf", shape: "parts", color: SW0, w: 1.2, d: 0.5, h: 1.0, tw: 0.8, td: 0.8, seats: 0, tableSeats: 4, parts: PART_SHELF(), sel: 0 });
const draftFrom = (c: ItemDef): Draft => ({
  type: c.type, name: c.name, shape: c.shape ?? "block", color: c.color || SW0,
  w: c.shape === "block" ? c.w : 1.2, d: c.shape === "block" ? c.d : 0.5, h: c.h || 1, tw: c.tw || 0.8, td: c.td || 0.8,
  seats: c.shape === "parts" ? c.seats || 0 : 0, tableSeats: c.shape === "round" || c.shape === "square" ? c.seats : 4,
  parts: c.parts ? clone(c.parts) : PART_SHELF(), sel: 0,
});
/** Turn a draft into a catalogue entry. Parts-built pieces get their footprint from the parts. */
function defFrom(s: Draft): ItemDef {
  const base = { type: s.type ?? "", name: (s.name.trim() || "My item").slice(0, 32), shape: s.shape };
  if (s.shape === "block") return { ...base, w: s.w, d: s.d, h: s.h, color: s.color, seats: 0 };
  if (s.shape !== "parts") return { ...base, tw: s.tw, td: s.td, seats: s.tableSeats, color: s.color, h: 0.76, w: +(s.tw + 1).toFixed(2), d: +(s.td + 1).toFixed(2) };
  let x0 = 1e9, x1 = -1e9, z0 = 1e9, z1 = -1e9, h = 0;
  for (const q of s.parts) {
    x0 = Math.min(x0, q.x - q.w / 2);
    x1 = Math.max(x1, q.x + q.w / 2);
    z0 = Math.min(z0, q.z - q.d / 2);
    z1 = Math.max(z1, q.z + q.d / 2);
    h = Math.max(h, q.y + q.h);
  }
  if (!s.parts.length) {
    x0 = z0 = -0.25;
    x1 = z1 = 0.25;
  }
  return { ...base, parts: clone(s.parts), ox: (x0 + x1) / 2, oz: (z0 + z1) / 2, w: +(x1 - x0).toFixed(2), d: +(z1 - z0).toFixed(2), h: +h.toFixed(2), seats: s.seats, color: s.parts[0]?.color || SW0 };
}

/* ---------- Scene ---------- */
const sRenderer = makeRenderer();
setupRenderer(sRenderer);
const sScene = new THREE.Scene(), sCam = new THREE.PerspectiveCamera(40, 1, 0.05, 100);
sCam.position.set(2.6, 2.2, 3.2);
sScene.add(new THREE.HemisphereLight(0xffffff, 0x8a7b70, 0.75));
const sSun = new THREE.DirectionalLight(0xfff3e2, 0.8);
sSun.position.set(3, 6, 4);
sSun.castShadow = true;
sSun.shadow.mapSize.set(1024, 1024);
Object.assign(sSun.shadow.camera, { left: -4, right: 4, top: 4, bottom: -4 });
sScene.add(sSun, new THREE.AmbientLight(0xffffff, 0.25));
const sFloor = new THREE.Mesh(new THREE.CircleGeometry(4, 48), new THREE.MeshStandardMaterial({ color: 0xf3eeea, roughness: 1 }));
sFloor.rotation.x = -Math.PI / 2;
sFloor.receiveShadow = true;
sScene.add(sFloor);
const sGrid = new THREE.GridHelper(8, 16, 0x000000, 0x000000);
const gm = sGrid.material as THREE.Material;
gm.transparent = true;
gm.opacity = 0.12;
sGrid.position.y = 0.002;
sScene.add(sGrid);

/* Screen-space labels pinned to 3D points (HTML, so they follow the theme) */
interface TagSpec { p: THREE.Vector3; text: string; cls?: string; side?: boolean }
function tagLayer(el: HTMLElement) {
  const list: { d: HTMLSpanElement; p: THREE.Vector3 | null; side: boolean }[] = [];
  return {
    set(arr: TagSpec[]) {
      while (list.length < arr.length) {
        const d = document.createElement("span");
        d.className = "stag";
        el.appendChild(d);
        list.push({ d, p: null, side: false });
      }
      list.forEach((t, k) => {
        const a = arr[k];
        if (!a) {
          t.d.hidden = true;
          t.p = null;
          return;
        }
        t.d.hidden = false;
        t.d.textContent = a.text;
        t.d.className = "stag " + (a.cls ?? "");
        t.p = a.p;
        t.side = !!a.side;
      });
    },
    update(cam: THREE.Camera, w: number, h: number) {
      const v = new THREE.Vector3();
      for (const t of list) {
        if (!t.p) continue;
        v.copy(t.p).project(cam);
        t.d.style.visibility = v.z > 1 || v.z < -1 ? "hidden" : "visible";
        t.d.style.transform = `translate(${((v.x + 1) / 2) * w}px,${((1 - v.y) / 2) * h}px) ${t.side ? "translate(7px,-50%)" : "translate(-50%,-100%)"}`;
      }
    },
  };
}
function makePerson(H: number, r: number): THREE.Group {
  const g = new THREE.Group(), pm = new THREE.MeshStandardMaterial({ color: 0xb9b2ad, roughness: 0.9 }), hr = H * 0.077;
  const body = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.85, r, H - 2 * hr, 20), pm);
  body.position.y = (H - 2 * hr) / 2;
  body.castShadow = true;
  const head = new THREE.Mesh(new THREE.SphereGeometry(hr, 20, 16), pm);
  head.position.y = H - hr;
  head.castShadow = true;
  g.add(body, head);
  sScene.add(g);
  return g;
}
const adult = makePerson(1.7, 0.2), child = makePerson(1.1, 0.14);
const sDim = new THREE.Group();
sScene.add(sDim);
/** A vertical measuring line with ticks every 0.5 m. */
function dimLine(x: number, z: number, y0: number, y1: number, tick = 0.08): THREE.LineSegments {
  const pts = [x, y0, z, x, y1, z, x - tick, y0, z, x + tick, y0, z, x - tick, y1, z, x + tick, y1, z];
  for (let y = Math.ceil((y0 + 0.01) / 0.5) * 0.5; y < y1 - 0.01; y += 0.5) pts.push(x - tick / 2, y, z, x + tick / 2, y, z);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
  const col = getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() || "#c2416b";
  return new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: col }));
}
const sItem = new THREE.Group();
sScene.add(sItem);
let sControls: OrbitControls, sTagL: ReturnType<typeof tagLayer>;
let sd: Draft = newDraft(), sHelper: THREE.BoxHelper | null = null;

function studioPreview(refit = false): void {
  const c = defFrom(sd);
  sItem.clear();
  if (sHelper) {
    sScene.remove(sHelper);
    sHelper = null;
  }
  const body = new THREE.Group();
  buildCustom(body, { ...PALETTES[app.L.palette]!, accent: c.color ?? SW0, up: c.color ?? SW0 }, c);
  sItem.add(body);
  if (sd.shape === "parts" && sd.parts[sd.sel]) {
    const m = body.children.find((o) => o.userData.part === sd.sel);
    if (m) {
      sHelper = new THREE.BoxHelper(m, 0xc2416b);
      sScene.add(sHelper);
    }
  }
  const showA = $in("#sAdult").checked, showC = $in("#sChild").checked, showH = $in("#sHeights").checked;
  adult.visible = showA;
  child.visible = showC;
  adult.position.set(-(c.w / 2 + 0.55), 0, 0);
  child.position.set(c.w / 2 + 0.7, 0, -0.15);
  // height references
  sDim.clear();
  const tags: TagSpec[] = [], tbl = c.shape === "round" || c.shape === "square", H = tbl ? 0.76 : c.h;
  if (showH) {
    const x = c.w / 2 + 0.18, z = c.d / 2 + 0.05;
    sDim.add(dimLine(x, z, 0, H));
    tags.push({ p: new THREE.Vector3(x, H, z), text: `${tbl ? "top " : ""}${fmt(H)} m`, cls: "dim", side: true });
    const q = sd.shape === "parts" ? sd.parts[sd.sel] : undefined;
    if (q) {
      const px = q.x - (c.ox ?? 0), pz = q.z - (c.oz ?? 0), top = q.y + q.h;
      if (q.y > 0.005) sDim.add(dimLine(px - q.w / 2 - 0.06, pz, 0, q.y, 0.05));
      tags.push({ p: new THREE.Vector3(px + q.w / 2, top, pz), text: q.y > 0.005 ? `${fmt(q.y)}–${fmt(top)} m` : `${fmt(top)} m`, side: true });
    }
  }
  if (showA) tags.push({ p: new THREE.Vector3(adult.position.x, 1.74, 0), text: "1.70 m", cls: "ppl" });
  if (showC) tags.push({ p: new THREE.Vector3(child.position.x, 1.14, -0.15), text: "1.10 m", cls: "ppl" });
  sTagL.set(tags);
  $("#sDims").textContent = `${fmt(c.w)} × ${fmt(c.d)} m · ${tbl ? "table top 0.76 m, seats at 0.46 m" : fmt(c.h) + " m tall"}${c.seats ? ` · ${c.seats} seats` : ""}`;
  const badge = $("#sBadge");
  badge.textContent = sd.shape === "parts" ? "Tap a part to select it" : "";
  badge.hidden = sd.shape !== "parts";
  if (refit) {
    const s = Math.max(c.w + (showA ? 1.1 : 0) + (showC ? 1.4 : 0), c.d, c.h, showA ? 1.8 : 1.2, 1);
    sControls.target.set(0, c.h / 2, 0);
    sCam.position.set(s * 1.5 + 0.6, s * 1.1 + 0.6, s * 1.9 + 0.8);
    sControls.update();
  }
}

const srow = (id: string, label: string, min: number, max: number, step: number, val: number, unit = " m") =>
  `<div class="row"><label for="${id}">${label}</label><input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${val}"><output id="${id}o">${fmt(val)}${unit}</output></div>`;
function bindRange(id: string, set: (v: number) => void, unit = " m"): void {
  const e = document.querySelector<HTMLInputElement>("#" + id);
  if (!e) return;
  e.addEventListener("input", () => {
    set(+e.value);
    $("#" + id + "o").textContent = fmt(+e.value) + unit;
    studioPreview();
  });
}

function renderStudioForm(): void {
  const f = $("#sForm"), s = sd;
  let h = `<div class="field"><label class="label" for="sName" style="margin:0">Name</label><input type="text" id="sName" maxlength="32" value="${esc(s.name)}"></div>
  <div class="label" style="margin-top:14px">Type</div>
  <div class="chooser four" id="sShape">${([["parts", "From parts"], ["block", "Block"], ["round", "Round table"], ["square", "Square table"]] as const).map(([k, n]) => `<button data-shape="${k}" aria-pressed="${s.shape === k}">${n}</button>`).join("")}</div>`;
  if (s.shape === "block")
    h += `<div class="label" style="margin-top:14px">Size</div>${srow("sW", "Width", 0.2, 4, 0.05, s.w)}${srow("sD", "Depth", 0.2, 3, 0.05, s.d)}${srow("sH", "Height", 0.1, 2.8, 0.05, s.h)}
    <div class="label" style="margin-top:10px">Colour</div><div class="swatches" id="sSw">${swatchHTML(s.color)}</div>`;
  else if (s.shape !== "parts")
    h += `<div class="label" style="margin-top:14px">Table</div>${srow("sTW", "Top width", 0.5, 2.4, 0.05, s.tw)}${srow("sTD", "Top depth", 0.5, 2.4, 0.05, s.td)}${srow("sTS", "Seats", 1, 10, 1, s.tableSeats, "")}
    <div class="label" style="margin-top:10px">Chair colour</div><div class="swatches" id="sSw">${swatchHTML(s.color)}</div>`;
  else {
    h += `<p class="note">Build the piece from boxes and cylinders. Tap a part in the preview or the list to edit it.</p>
    ${srow("sSeats", "Seats it adds", 0, 10, 1, s.seats, "")}
    <div class="label" style="margin-top:12px;display:flex;justify-content:space-between"><span>Parts (${s.parts.length})</span></div>`;
    h += s.parts.map((q, i) => i !== s.sel
      ? `<button class="part" data-psel="${i}"><i class="dot" style="background:${q.color}"></i><b>Part ${i + 1}</b><span>${q.k === "cyl" ? "Cylinder" : "Box"} · ${fmt(q.w)} × ${fmt(q.d)} × ${fmt(q.h)} m</span></button>`
      : `<div class="part sel"><div class="phead"><b>Part ${i + 1}</b><div class="chooser two" id="pKind"><button data-k="box" aria-pressed="${q.k === "box"}">Box</button><button data-k="cyl" aria-pressed="${q.k === "cyl"}">Cylinder</button></div></div>
      ${srow("pW", q.k === "cyl" ? "Diameter X" : "Width", 0.02, 3, 0.01, q.w)}${srow("pD", q.k === "cyl" ? "Diameter Z" : "Depth", 0.02, 3, 0.01, q.d)}${srow("pH", "Height", 0.01, 2.6, 0.01, q.h)}
      ${srow("pX", "Left / right", -2, 2, 0.01, q.x)}${srow("pZ", "Back / front", -2, 2, 0.01, q.z)}${srow("pY", "Lift", 0, 2.6, 0.01, q.y)}
      <div class="swatches" id="pSw" style="margin:6px 0 10px">${swatchHTML(q.color)}</div>
      <div class="actions"><button class="btn" id="pDup">Duplicate</button><button class="btn danger" id="pDel"${s.parts.length < 2 ? " disabled" : ""}>Delete part</button></div></div>`).join("");
    h += `<div class="actions" style="margin-top:10px"><button class="btn" id="pAddBox">+ Box</button><button class="btn" id="pAddCyl">+ Cylinder</button></div>`;
  }
  f.innerHTML = h;
  const nameEl = $in("#sName");
  nameEl.addEventListener("input", () => (s.name = nameEl.value));
  for (const b of f.querySelectorAll<HTMLButtonElement>("#sShape button")) b.onclick = () => {
    s.shape = b.dataset.shape as CustomShape;
    renderStudioForm();
    studioPreview(true);
  };
  const sw = f.querySelector<HTMLElement>("#sSw");
  if (sw) bindSwatches(sw, (c, live) => {
    s.color = c || SW0;
    studioPreview();
    if (!live) renderStudioForm();
  });
  bindRange("sW", (v) => (s.w = v));
  bindRange("sD", (v) => (s.d = v));
  bindRange("sH", (v) => (s.h = v));
  bindRange("sTW", (v) => (s.tw = v));
  bindRange("sTD", (v) => (s.td = v));
  bindRange("sTS", (v) => (s.tableSeats = v), "");
  bindRange("sSeats", (v) => (s.seats = v), "");
  for (const b of f.querySelectorAll<HTMLButtonElement>("[data-psel]")) b.onclick = () => {
    s.sel = +(b.dataset.psel ?? 0);
    renderStudioForm();
    studioPreview();
  };
  const q = s.parts[s.sel];
  if (s.shape === "parts" && q) {
    for (const b of f.querySelectorAll<HTMLButtonElement>("#pKind button")) b.onclick = () => {
      q.k = b.dataset.k as Part["k"];
      if (q.k === "cyl") q.d = q.w;
      renderStudioForm();
      studioPreview();
    };
    bindRange("pW", (v) => (q.w = v));
    bindRange("pD", (v) => (q.d = v));
    bindRange("pH", (v) => (q.h = v));
    bindRange("pX", (v) => (q.x = v));
    bindRange("pZ", (v) => (q.z = v));
    bindRange("pY", (v) => (q.y = v));
    bindSwatches($("#pSw"), (c, live) => {
      q.color = c || SW0;
      studioPreview();
      if (!live) renderStudioForm();
    });
    $("#pDup").onclick = () => {
      const n = clone(q);
      n.x = +(n.x + 0.1).toFixed(2);
      s.parts.splice(s.sel + 1, 0, n);
      s.sel++;
      renderStudioForm();
      studioPreview();
    };
    $("#pDel").onclick = () => {
      if (s.parts.length < 2) return;
      s.parts.splice(s.sel, 1);
      s.sel = Math.max(0, s.sel - 1);
      renderStudioForm();
      studioPreview(true);
    };
  }
  const addPart = (k: Part["k"]) => {
    s.parts.push(k === "cyl" ? { k: "cyl", w: 0.4, h: 0.75, d: 0.4, x: 0, y: 0, z: 0, color: SWATCHES[4]! } : { k: "box", w: 0.5, h: 0.5, d: 0.5, x: 0, y: 0, z: 0, color: SWATCHES[1]! });
    s.sel = s.parts.length - 1;
    renderStudioForm();
    studioPreview(true);
  };
  const ab = f.querySelector<HTMLButtonElement>("#pAddBox"), ac = f.querySelector<HTMLButtonElement>("#pAddCyl");
  if (ab) ab.onclick = () => addPart("box");
  if (ac) ac.onclick = () => addPart("cyl");
}

function sizeStudio(): void {
  const r = $("#sView").getBoundingClientRect();
  if (!r.width || !r.height) return;
  sRenderer.setSize(r.width, r.height, false);
  sCam.aspect = r.width / r.height;
  sCam.updateProjectionMatrix();
}

export function openStudio(type: string | null): void {
  const c = type ? app.store.custom.find((x) => x.type === type) : undefined;
  sd = c ? draftFrom(c) : newDraft();
  $("#sTitle").textContent = c ? `Edit “${c.name}”` : "Item studio";
  $("#sSave").textContent = c ? "Save changes" : "Save and place";
  app.studioOpen = true;
  $("#studio").hidden = false;
  openInv(false);
  sizeStudio();
  renderStudioForm();
  studioPreview(true);
}
function closeStudio(): void {
  app.studioOpen = false;
  $("#studio").hidden = true;
  resetClock();
}

export function renderStudio(): void {
  sControls.update();
  sHelper?.update();
  sRenderer.render(sScene, sCam);
  const r = $("#sView").getBoundingClientRect();
  sTagL.update(sCam, r.width, r.height);
}

export function initStudio(): void {
  const view = $("#sView");
  view.prepend(sRenderer.domElement);
  sTagL = tagLayer($("#sTags"));
  sControls = new OrbitControls(sCam, sRenderer.domElement);
  sControls.enableDamping = true;
  sControls.maxPolarAngle = Math.PI / 2.05;
  sControls.minDistance = 0.8;
  sControls.maxDistance = 14;
  new ResizeObserver(sizeStudio).observe(view);
  onTheme(() => (sScene.background = new THREE.Color(getComputedStyle(document.documentElement).getPropertyValue("--stage").trim() || "#efe8e4")));
  // tap a part to select it; labels hide while you orbit
  const cvs = sRenderer.domElement, ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  let down: { x: number; y: number } | null = null;
  cvs.addEventListener("pointerdown", (e) => {
    down = { x: e.clientX, y: e.clientY };
    $("#sTags").classList.add("moving");
  });
  for (const ev of ["pointerup", "pointercancel", "pointerleave"]) cvs.addEventListener(ev, () => setTimeout(() => $("#sTags").classList.remove("moving"), 120));
  cvs.addEventListener("pointerup", (e) => {
    if (!down || sd.shape !== "parts" || Math.hypot(e.clientX - down.x, e.clientY - down.y) > 6) return;
    const r = cvs.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, sCam);
    const h = ray.intersectObjects(sItem.children, true).find((x) => x.object.userData.part != null);
    if (h) {
      sd.sel = h.object.userData.part as number;
      renderStudioForm();
      studioPreview();
    }
  });
  for (const id of ["sAdult", "sChild", "sHeights"]) {
    const el = $in("#" + id), v = app.store.seen["scale_" + id];
    if (typeof v === "boolean") el.checked = v;
    el.addEventListener("change", () => {
      app.store.seen["scale_" + id] = el.checked;
      save();
      studioPreview();
    });
  }
  $("#sCancel").onclick = closeStudio;
  $("#sSave").onclick = () => {
    const c = defFrom(sd);
    if (sd.type) {
      const k = app.store.custom.findIndex((x) => x.type === sd.type);
      if (k >= 0) app.store.custom[k] = c;
      closeStudio();
      renderCatalog();
      rebuildItems();
      showSel();
      save();
      flashHint(`Updated “${c.name}” everywhere it's placed.`);
    } else {
      c.type = "c" + Date.now().toString(36);
      app.store.custom.push(c);
      closeStudio();
      renderCatalog();
      save();
      if (app.mode === "walk") setMode("3d");
      addItem(c.type);
      flashHint(`“${c.name}” added to your inventory.`);
    }
  };
  addEventListener("keydown", (e) => {
    if (app.studioOpen && e.key === "Escape") closeStudio();
  });
}
