// The main stage: 3D orbit view, 2D plan, walk-through, pointer handling and the render loop.
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { $, $btn, readTokens, TK } from "./dom";
import { canWalk } from "./geometry/rooms";
import { evaluate, getSel, moveTo, select, updateEmpty } from "./items";
import { drawPlan, fitPlan, initPlanPointer, mainPlan, planCanvas } from "./plan/plan";
import { app, pushUndo, save, undo, type Mode } from "./state";
import { camera, hemi, itemsG, renderer, scene, sun, THREE } from "./three/core";
import { walls } from "./three/room";
import { render3dEditor, drawRoomEditor, editorMode } from "./editor/roomEditor";
import { renderStudio } from "./ui/studio";
import { hideHint, tip } from "./ui/hint";
import { showSel } from "./ui/selection";

const cv = renderer.domElement;
export let controls: OrbitControls;
const keys = new Set<string>();
let yaw = 0, pitch = -0.05;
const clock = new THREE.Clock();

export function viewCenter(): { x: number; z: number } {
  return app.mode === "plan" ? { x: mainPlan.V.cx, z: mainPlan.V.cz } : { x: controls.target.x, z: controls.target.z };
}
/** Pan the current view to a point. */
export function focusOn(x: number, z: number): void {
  if (app.mode === "plan") {
    mainPlan.V.cx = x;
    mainPlan.V.cz = z;
  } else if (app.mode === "3d") {
    const off = camera.position.clone().sub(controls.target);
    controls.target.set(x, 0, z);
    camera.position.copy(controls.target).add(off);
  }
}

export function fitView(): void {
  if (app.mode === "plan") {
    fitPlan();
    return;
  }
  const b = app.geo.bbox, w = b.x1 - b.x0, d = b.z1 - b.z0, cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
  const s = Math.max(w, d), k = camera.aspect < 0.8 ? 1.6 : 1;
  camera.position.set(cx + s * 0.7 * k, s * 1.0 * k, cz + s * 1.15 * k);
  controls.target.set(cx, 0, cz);
  controls.update();
}

export function setMode(next: Mode): void {
  const m: Mode = app.has3d ? next : "plan";
  const prev = app.mode;
  app.mode = m;
  for (const [k, id] of [["3d", "v3d"], ["plan", "vPlan"], ["walk", "vWalk"]] as const) $("#" + id).setAttribute("aria-pressed", String(k === m));
  $("#walkpad").hidden = m !== "walk";
  $("#bFit").hidden = m === "walk";
  updateEmpty();
  planCanvas.hidden = m !== "plan";
  cv.style.visibility = m === "plan" ? "hidden" : "visible";
  if (m === "walk") {
    controls.enabled = false;
    app.selected = null;
    showSel();
    evaluate();
    camera.position.set(app.geo.entrance.x, 1.6, app.geo.entrance.z);
    yaw = 0;
    pitch = -0.08;
    camera.fov = 65;
    camera.updateProjectionMatrix();
    tip("walk", "Drag to look around. Use the arrows to walk.");
  } else {
    controls.enabled = m === "3d";
    camera.fov = 50;
    camera.updateProjectionMatrix();
    if (m === "plan" && prev !== "plan") fitPlan();
    if (m === "3d" && prev === "walk") fitView();
    showSel();
    if (prev !== m && m === "plan") tip("plan", "2D plan: drag pieces to place them. Drag the floor to pan, pinch to zoom.");
  }
}

/* ---------- 3D pointer: select and drag (registered before OrbitControls) ---------- */
function init3dPointer(): void {
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(), plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), hitP = new THREE.Vector3();
  let drag: { i: NonNullable<ReturnType<typeof getSel>>; ox: number; oz: number; moved: boolean } | null = null;
  let down: { x: number; y: number } | null = null, look: { x: number; y: number } | null = null;
  const setNDC = (e: PointerEvent) => {
    const r = cv.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
  };
  const hitItem = (): number | null => {
    for (const h of ray.intersectObjects(itemsG.children, true)) {
      if (!h.object.visible || h.object === h.object.parent?.userData.ring) continue;
      let o: THREE.Object3D | null = h.object;
      while (o && o.userData.id == null) o = o.parent;
      if (o) return o.userData.id as number;
    }
    return null;
  };
  cv.addEventListener("pointerdown", (e) => {
    hideHint();
    down = { x: e.clientX, y: e.clientY };
    if (app.mode === "walk") {
      look = { x: e.clientX, y: e.clientY };
      return;
    }
    if (!e.isPrimary) return;
    setNDC(e);
    const id = hitItem();
    if (id != null) {
      const i = app.L.items.find((q) => q.id === id);
      if (!i) return;
      select(id);
      ray.ray.intersectPlane(plane, hitP);
      drag = { i, ox: i.x - hitP.x, oz: i.z - hitP.z, moved: false };
      controls.enabled = false;
      cv.setPointerCapture(e.pointerId);
    }
  });
  cv.addEventListener("pointermove", (e) => {
    if (app.mode === "walk" && look) {
      yaw -= (e.clientX - look.x) * 0.005;
      pitch = Math.max(-1, Math.min(1, pitch - (e.clientY - look.y) * 0.004));
      look = { x: e.clientX, y: e.clientY };
      return;
    }
    if (!drag) return;
    setNDC(e);
    if (!ray.ray.intersectPlane(plane, hitP)) return;
    if (!drag.moved) {
      if (down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 4) return;
      pushUndo();
      drag.moved = true;
    }
    moveTo(drag.i, hitP.x + drag.ox, hitP.z + drag.oz);
  });
  const up = (e: PointerEvent) => {
    look = null;
    if (drag) {
      controls.enabled = app.mode === "3d";
      if (drag.moved) save();
      drag = null;
      down = null;
      return;
    }
    if (app.mode === "3d" && down && Math.hypot(e.clientX - down.x, e.clientY - down.y) < 6) {
      setNDC(e);
      if (hitItem() == null) select(null);
    }
    down = null;
  };
  cv.addEventListener("pointerup", up);
  cv.addEventListener("pointercancel", up);
}

function initKeys(): void {
  addEventListener("keydown", (e) => {
    const tag = (e.target as HTMLElement | null)?.tagName ?? "";
    if (/INPUT|SELECT/.test(tag) || app.studioOpen) return;
    const k = e.key.toLowerCase();
    keys.add(k);
    if ((e.ctrlKey || e.metaKey) && k === "z") {
      e.preventDefault();
      undo();
      return;
    }
    if (app.mode !== "walk" && app.selected != null) {
      if (k === "r") $btn("#bRot").click();
      if (k === "delete" || k === "backspace") $btn("#bDel").click();
    }
  });
  addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
  addEventListener("blur", () => keys.clear());
  for (const b of document.querySelectorAll<HTMLButtonElement>(".walkpad button")) {
    const k = "pad-" + (b.dataset.k ?? "");
    b.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      keys.add(k);
    });
    for (const ev of ["pointerup", "pointerleave", "pointercancel"]) b.addEventListener(ev, () => keys.delete(k));
    b.addEventListener("contextmenu", (e) => e.preventDefault());
  }
}

/* ---------- Render loop ---------- */
function frame(): void {
  requestAnimationFrame(frame);
  if (app.roomEdOpen) {
    if (editorMode() === "3d") render3dEditor();
    else drawRoomEditor();
    return;
  }
  if (app.studioOpen) {
    renderStudio();
    return;
  }
  const dt = Math.min(clock.getDelta(), 0.05);
  if (app.mode === "plan") {
    drawPlan(mainPlan);
    return;
  }
  if (app.mode === "walk") {
    const on = (...ks: string[]) => ks.some((k) => keys.has(k));
    const f = (on("w", "arrowup", "pad-f") ? 1 : 0) - (on("s", "arrowdown", "pad-b") ? 1 : 0);
    const t = (on("a", "arrowleft", "pad-l") ? 1 : 0) - (on("d", "arrowright", "pad-r") ? 1 : 0);
    yaw += t * 1.6 * dt;
    const nx = camera.position.x - Math.sin(yaw) * f * 1.4 * dt, nz = camera.position.z - Math.cos(yaw) * f * 1.4 * dt;
    if (canWalk(app.geo, nx, camera.position.z)) camera.position.x = nx;
    if (canWalk(app.geo, camera.position.x, nz)) camera.position.z = nz;
    camera.rotation.set(pitch, yaw, 0, "YXZ");
  } else controls.update();
  // dollhouse view: outside walls facing the camera and all inside walls are cut down
  for (const W of walls) {
    let cut = false;
    if (app.mode === "3d") {
      if (!W.wl.ext) cut = true;
      else {
        const cp = W.wl.ax === "x" ? camera.position.z : camera.position.x;
        cut = W.wl.nrm * (cp - W.wl.c) > 0;
      }
    }
    W.full.visible = !cut;
    W.cut.visible = cut;
  }
  renderer.render(scene, camera);
}
/** Reset the frame timer after an overlay closes so walking doesn't jump. */
export const resetClock = (): void => void clock.getDelta();

function resize(): void {
  const stage = $("#stage"), r = stage.getBoundingClientRect();
  if (!r.width || !r.height) return;
  renderer.setSize(r.width, r.height, false);
  camera.aspect = r.width / r.height;
  camera.updateProjectionMatrix();
  const dpr = Math.min(devicePixelRatio, 2);
  mainPlan.W = r.width;
  mainPlan.H = r.height;
  planCanvas.width = Math.round(r.width * dpr);
  planCanvas.height = Math.round(r.height * dpr);
  if (!app.sized) {
    fitView();
    fitPlan();
    app.sized = true;
  } else if (!mainPlan.V.user) fitPlan();
}

/* ---------- Lighting and theme ---------- */
const stageColour = () => new THREE.Color(TK.stage || "#efe8e4");
const themeListeners: (() => void)[] = [];
export const onTheme = (fn: () => void): void => void themeListeners.push(fn);
export function applyLight(): void {
  readTokens();
  const k = app.L.warmth, c = new THREE.Color(0xdfe9ff).lerp(new THREE.Color(0xffd8a8), k);
  sun.color.copy(c);
  hemi.color.copy(c);
  scene.background = stageColour();
  $("#oWarm").textContent = k < 0.34 ? "Cool" : k < 0.67 ? "Neutral" : "Warm";
  for (const fn of themeListeners) fn();
}

export function initViews(): void {
  const stage = $("#stage");
  stage.prepend(cv);
  stage.insertBefore(planCanvas, cv.nextSibling);
  init3dPointer();
  controls = new OrbitControls(camera, cv);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI / 2.1;
  controls.minDistance = 2.5;
  controls.maxDistance = 45;
  controls.screenSpacePanning = false;
  initPlanPointer();
  initKeys();
  $("#v3d").onclick = () => setMode("3d");
  $("#vPlan").onclick = () => setMode("plan");
  $("#vWalk").onclick = () => setMode("walk");
  $("#bFit").onclick = fitView;
  new ResizeObserver(resize).observe(stage);
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", applyLight);
  new MutationObserver(applyLight).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
}
export function startLoop(): void {
  resize();
  frame();
}
