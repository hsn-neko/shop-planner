// Layouts (new, switch, rename, delete), saved versions, palettes and the empty-room bar.
import { EXAMPLES, PALETTES } from "../data/catalog";
import { $, $$, $in, clone, esc, fmt, isDesk, isWide } from "../dom";
import { rebuildItems, select, updateEmpty } from "../items";
import { fitPlan } from "../plan/plan";
import { buildRoom } from "../roomView";
import { app, pushUndo, save, seatsOf, withIds } from "../state";
import type { Layout } from "../types";
import { applyLight, fitView, setMode } from "../views";
import { openRoomEditor } from "../editor/roomEditor";
import { flashHint } from "./hint";
import { openInv } from "./inventory";
import { syncRoomInputs } from "./roomControls";
import { showSel } from "./selection";
import { setTab } from "./tabs";

export function renderPalettes(): void {
  $("#pal").innerHTML = Object.entries(PALETTES).map(([k, p]) =>
    `<button data-pal="${k}" aria-pressed="${k === app.L.palette}"><div class="sw"><i style="background:${p.f1}"></i><i style="background:${p.wall}"></i><i style="background:${p.accent}"></i><i style="background:${p.wood}"></i></div>${p.name}<small>${p.note}</small></button>`).join("");
  for (const b of $$<HTMLButtonElement>("[data-pal]")) b.onclick = () => {
    if (app.L.palette === b.dataset.pal) return;
    pushUndo();
    app.L.palette = b.dataset.pal!;
    renderPalettes();
    buildRoom();
    rebuildItems();
    save();
  };
}

export function renderSlots(): void {
  const s = app.store;
  $("#slots").innerHTML = s.order.map((k) => {
    const L = s.slots[k]!, nv = (s.versions[k] ?? []).length;
    return `<button data-slot="${k}" aria-pressed="${k === s.active}">${esc(L.label || "Untitled")}<small>${L.items.length} pieces · ${seatsOf(L)} seats</small><small>${fmt(L.room.w)} × ${fmt(L.room.d)} m${nv ? ` · ${nv} version${nv > 1 ? "s" : ""}` : ""}</small></button>`;
  }).join("");
  for (const b of $$<HTMLButtonElement>("[data-slot]")) b.onclick = () => {
    if (b.dataset.slot !== s.active) loadSlot(b.dataset.slot!);
  };
  $<HTMLButtonElement>("#bDelLayout").disabled = s.order.length < 2;
}

function uniqueName(base: string): string {
  const names = app.store.order.map((k) => app.store.slots[k]?.label);
  let n = 1, name = base;
  while (names.includes(name)) name = `${base} ${++n}`;
  return name;
}
export function createLayout(data: Layout, name: string): string {
  const id = "L" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
  data.label = uniqueName(name);
  app.store.slots[id] = withIds(data);
  app.store.order.push(id);
  loadSlot(id);
  return id;
}

/** Open a layout: rebuild everything for it. */
export function loadSlot(k: string): void {
  app.store.active = k;
  app.L = app.store.slots[k]!;
  if (app.mode === "walk") setMode("3d");
  app.selected = null;
  syncRoomInputs();
  renderPalettes();
  buildRoom();
  rebuildItems();
  applyLight();
  showSel();
  fitView();
  if (app.sized) fitPlan();
  $in("#lName").value = app.L.label || "";
  vArmed = null;
  renderVersions();
  save();
}

/** A second tap within 3 seconds confirms a destructive action. */
let pending: string | null = null;
function confirmIt(key: string, fn: () => void): void {
  const msg = $("#confirmMsg");
  if (pending === key) {
    fn();
    pending = null;
    msg.hidden = true;
    return;
  }
  pending = key;
  msg.hidden = false;
  setTimeout(() => {
    if (pending === key) {
      pending = null;
      msg.hidden = true;
    }
  }, 3000);
}

/* ---------- Versions: named snapshots of one layout ---------- */
const stamp = (t: number) => new Date(t).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
let vArmed: string | null = null;
export function renderVersions(): void {
  const list = app.store.versions[app.store.active] ?? [], el = $("#vList");
  if (!list.length) {
    el.innerHTML = `<p class="vempty">No versions yet. Save one before trying a big change, so you can always go back.</p>`;
    return;
  }
  el.innerHTML = list.map((v) => `<div class="vrow"><div style="min-width:0"><b>${esc(v.name)}</b><small>${stamp(v.time)} · ${v.count} pieces · ${v.seats} seats</small></div>
    <button class="btn" data-vres="${v.id}">Restore</button><button class="btn" data-vcopy="${v.id}">Copy</button><button class="btn danger" data-vdel="${v.id}" aria-label="Delete version ${esc(v.name)}">${vArmed === v.id ? "Sure?" : "✕"}</button></div>`).join("");
  const find = (id: string | undefined) => list.find((v) => v.id === id);
  for (const b of $$<HTMLButtonElement>("[data-vres]", el)) b.onclick = () => {
    const v = find(b.dataset.vres);
    if (!v) return;
    pushUndo();
    const d = withIds(JSON.parse(v.data) as Layout);
    d.label = app.L.label;
    app.store.slots[app.store.active] = d;
    loadSlot(app.store.active);
    flashHint(`Restored “${v.name}”. Tap Undo to go back.`);
  };
  for (const b of $$<HTMLButtonElement>("[data-vcopy]", el)) b.onclick = () => {
    const v = find(b.dataset.vcopy);
    if (!v) return;
    createLayout(JSON.parse(v.data) as Layout, `${app.L.label} · ${v.name}`);
    flashHint(`Opened “${v.name}” as a new layout.`);
  };
  for (const b of $$<HTMLButtonElement>("[data-vdel]", el)) b.onclick = () => {
    const id = b.dataset.vdel!;
    if (vArmed !== id) {
      vArmed = id;
      renderVersions();
      setTimeout(() => {
        if (vArmed === id) {
          vArmed = null;
          renderVersions();
        }
      }, 3000);
      return;
    }
    vArmed = null;
    app.store.versions[app.store.active] = list.filter((v) => v.id !== id);
    renderVersions();
    renderSlots();
    save();
  };
}

export function initLayouts(): void {
  for (const b of $$<HTMLButtonElement>("[data-new]")) b.onclick = () => {
    const k = b.dataset.new!;
    if (k === "blank") {
      createLayout({ room: { w: 8, d: 10, h: 3.2, door: 0 }, palette: "matcha", warmth: 0.5, items: [] }, "Blank layout");
      openRoomEditor();
      flashHint("New blank layout created.");
    } else {
      const E = EXAMPLES[k as "A" | "B"];
      createLayout(clone(E), E.label ?? "Layout");
      if (!isDesk()) setTab(null);
      flashHint(`Started from the ${E.label} preset.`);
    }
  };
  for (const el of $$("[data-pinfo]")) {
    const E = EXAMPLES[el.dataset.pinfo as "A" | "B"];
    el.textContent = `Preset · ${E.items.length} pieces · ${seatsOf(E)} seats · with kitchen`;
  }
  const name = $in("#lName");
  name.addEventListener("input", () => {
    app.L.label = name.value;
    renderSlots();
    save();
  });
  name.addEventListener("blur", () => {
    if (!name.value.trim()) {
      app.L.label = uniqueName("Untitled");
      name.value = app.L.label;
      renderSlots();
      save();
    }
  });
  $("#bDelLayout").onclick = () => {
    if (app.store.order.length < 2) return;
    confirmIt("del", () => {
      const s = app.store, id = s.active, idx = s.order.indexOf(id);
      s.order.splice(idx, 1);
      delete s.slots[id];
      delete s.versions[id];
      loadSlot(s.order[Math.max(0, idx - 1)]!);
      flashHint("Layout deleted.");
    });
  };
  $("#bClear").onclick = () => confirmIt("clear", () => {
    pushUndo();
    app.L.items = [];
    select(null);
    rebuildItems();
    save();
  });
  const vName = $in("#vName");
  $("#bSaveV").onclick = () => {
    const s = app.store, list = (s.versions[s.active] ??= []);
    const vn = (vName.value.trim() || `Version ${list.length + 1}`).slice(0, 40);
    const snapL = clone(app.L);
    delete snapL.label;
    for (const i of snapL.items) (i as { id?: number }).id = undefined;
    list.unshift({ id: "v" + Date.now().toString(36), name: vn, time: Date.now(), count: app.L.items.length, seats: seatsOf(app.L), data: JSON.stringify(snapL) });
    if (list.length > 30) list.length = 30;
    vName.value = "";
    renderVersions();
    renderSlots();
    save();
    flashHint(`Saved version “${vn}”.`);
  };
  vName.addEventListener("keydown", (e) => {
    if (e.key === "Enter") $("#bSaveV").click();
  });
  // empty-room bar
  const dismissEmpty = () => {
    app.store.seen.empty = true;
    save();
    updateEmpty();
  };
  $("#eClose").onclick = dismissEmpty;
  $("#eRoom").onclick = () => {
    dismissEmpty();
    openRoomEditor();
  };
  $("#eItems").onclick = () => {
    dismissEmpty();
    if (isWide()) document.querySelector<HTMLButtonElement>("#catalog .add")?.focus();
    else openInv(true);
  };
}
