// Layouts (new, switch, rename, delete), saved versions, palettes and the empty-room bar.
import { EXAMPLES, PALETTES } from "../data/catalog";
import { $, $$, $in, clone, esc, fmt, isDesk, isWide } from "../dom";
import { rebuildItems, select, updateEmpty } from "../items";
import { fitPlan } from "../plan/plan";
import { buildRoom } from "../roomView";
import { roomName, SHOP_TYPES, TYPE_ORDER, typeOf } from "../data/shopTypes";
import { app, countsLabel, pushUndo, save, seatsOf, withIds } from "../state";
import type { Layout, ShopType } from "../types";
import { applyLight, fitView, setMode } from "../views";
import { openRoomEditor } from "../editor/roomEditor";
import { flashHint } from "./hint";
import { openInv, renderCatalog } from "./inventory";
import { syncRoomInputs } from "./roomControls";
import { showSel } from "./selection";
import { setTab } from "./tabs";

/** All palettes, this layout's type first, each type under its own small heading. */
export function renderPalettes(): void {
  const own = typeOf(app.L), order = [own, ...TYPE_ORDER.filter((t) => t !== own)];
  const btn = ([k, p]: [string, (typeof PALETTES)[string]]) =>
    `<button data-pal="${k}" aria-pressed="${k === app.L.palette}"><div class="sw"><i style="background:${p.f1}"></i><i style="background:${p.wall}"></i><i style="background:${p.accent}"></i><i style="background:${p.wood}"></i></div>${p.name}<small>${p.note}</small></button>`;
  $("#pal").innerHTML = order.map((t) => `<div class="palgrp">${SHOP_TYPES[t].name}</div>` + Object.entries(PALETTES).filter(([, p]) => p.kind === t).map(btn).join("")).join("");
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
    return `<button data-slot="${k}" aria-pressed="${k === s.active}">${esc(L.label || "Untitled")}<small>${SHOP_TYPES[typeOf(L)].name} · ${L.items.length} pieces · ${countsLabel(L)}</small><small>${fmt(L.room.w)} × ${fmt(L.room.d)} m${nv ? ` · ${nv} version${nv > 1 ? "s" : ""}` : ""}</small></button>`;
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
  renderCatalog();
  buildRoom();
  rebuildItems();
  applyLight();
  showSel();
  fitView();
  if (app.sized) fitPlan();
  $in("#lName").value = app.L.label || "";
  updateTypeNote();
  vArmed = null;
  renderVersions();
  save();
}

/** "Retail boutique · Stockroom and Staff room": the type and the back rooms this layout actually has. */
export function updateTypeNote(): void {
  const L = app.L, mode = L.boh?.mode ?? "none";
  const rooms = mode === "none" ? "no back rooms" : mode === "kitchen" ? roomName(L, "kitchen") : `${roomName(L, "kitchen")} and ${roomName(L, "storage")}`;
  $("#lType").textContent = `${SHOP_TYPES[typeOf(L)].name} · ${rooms}`;
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
  el.innerHTML = list.map((v) => `<div class="vrow"><div style="min-width:0"><b>${esc(v.name)}</b><small>${stamp(v.time)} · ${v.count} pieces · ${v.sum ?? `${v.seats} seats`}</small></div>
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

/* ---------- Starting a new layout: pick the shop type, then blank or one of its presets ---------- */
let startType: ShopType | null = null;
function renderStarts(): void {
  const el = $("#starts");
  if (!startType) {
    el.innerHTML = TYPE_ORDER.map((t) => `<button data-stype="${t}"><b>${SHOP_TYPES[t].name}</b><small>${SHOP_TYPES[t].note}</small></button>`).join("") +
      `<p class="note" style="margin:2px 0 0;grid-column:1/-1">The shop type is set when a layout is made and can't be changed later. Every piece of furniture still works in every type.</p>`;
    for (const b of $$<HTMLButtonElement>("[data-stype]", el)) b.onclick = () => {
      startType = b.dataset.stype as ShopType;
      renderStarts();
      el.querySelector<HTMLButtonElement>("[data-new]")?.focus();
    };
    return;
  }
  const T = SHOP_TYPES[startType];
  el.innerHTML = `<div class="stype"><b>${T.name}</b><button class="rm" id="startBack">Other shop types</button></div>
    <button data-new="blank" class="blank"><b>Blank room</b><small>Empty 8 × 10 m ${T.name.toLowerCase()} to build from scratch</small></button>` +
    T.presets.map((k) => {
      const E = EXAMPLES[k]!, B = E.boh;
      const back = B && B.mode !== "none" ? ` · with ${B.mode === "both" ? T.back.join(" and ").toLowerCase() : T.back[0].toLowerCase()}` : "";
      return `<button data-new="${k}"><b>${esc(E.label ?? "Preset")}</b><small>Preset · ${fmt(E.room.w)} × ${fmt(E.room.d)} m · ${E.items.length} pieces · ${countsLabel(E)}${back}</small></button>`;
    }).join("");
  $("#startBack").onclick = () => {
    startType = null;
    renderStarts();
    el.querySelector<HTMLButtonElement>("[data-stype]")?.focus();
  };
  for (const b of $$<HTMLButtonElement>("[data-new]", el)) b.onclick = () => {
    const k = b.dataset.new!, type = startType!;
    if (k === "blank") {
      createLayout({ type, room: { w: 8, d: 10, h: 3.2, door: 0 }, palette: T.palette, warmth: 0.5, items: [] }, `Blank ${T.name.split(" / ")[0]!.toLowerCase()}`);
      openRoomEditor();
      flashHint(`New blank ${T.name.toLowerCase()} layout created.`);
    } else {
      const E = EXAMPLES[k]!;
      createLayout(clone(E), E.label ?? "Layout");
      if (!isDesk()) setTab(null);
      flashHint(`Started from the ${E.label} preset.`);
    }
    startType = null;
    renderStarts();
  };
}

export function initLayouts(): void {
  renderStarts();
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
    list.unshift({ id: "v" + Date.now().toString(36), name: vn, time: Date.now(), count: app.L.items.length, seats: seatsOf(app.L), sum: countsLabel(app.L), data: JSON.stringify(snapL) });
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
