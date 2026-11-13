// The selected piece: bottom bar, the Item tab and its editor.
import { BY } from "../data/catalog";
import { $, $btn, esc, fmt, isDesk } from "../dom";
import { buildItem, clampX, clampZ, dimsOf, evaluate, getSel, meshes, refreshItem, removeItemMesh, select, updateMeta } from "../items";
import { app, cat, newId, pushUndo, save, snap } from "../state";
import { focusOn } from "../views";
import { hideHint } from "./hint";
import { openStudio } from "./studio";
import { bindSwatches, swatchHTML } from "./swatches";
import { setTab } from "./tabs";

export function showSel(): void {
  const i = getSel(), bar = $("#selbar"), tab = $('[data-tab="item"]');
  if (!i || app.mode === "walk") {
    bar.hidden = true;
    tab.hidden = true;
    if (app.curTab === "item") setTab(isDesk() ? "room" : null);
    return;
  }
  updateMeta(i);
  bar.hidden = false;
  tab.hidden = false;
  hideHint();
  if (app.curTab === "item") renderItemPane();
}

export function renderItemPane(): void {
  const i = getSel(), el = $("#itemPane");
  if (!i) {
    el.innerHTML = "";
    return;
  }
  const c = cat(i.type), custom = !BY[i.type], block = custom && c.shape === "block", cur = i.color || c.color || null, dm = dimsOf(i);
  let h = `<div class="label">${esc(c.name)}</div>
  <div class="group" id="eColour"><div class="label" style="margin-top:8px">Colour</div><div class="swatches" id="eSw">${swatchHTML(cur, true)}</div>
  <p class="note">Changes the main colour of this piece only: upholstery, chairs or counter front.</p></div>`;
  if (custom) h += `<button class="btn" id="eStudio" style="width:100%;margin-bottom:12px">Edit design in item studio</button>`;
  if (c.stretch || block) {
    h += `<div class="group"><div class="label">Size</div>
    <div class="row"><label for="eW">Width</label><input type="range" id="eW" min="${fmt(Math.max(0.3, c.w * 0.4))}" max="${fmt(c.w * 3)}" step="0.05" value="${fmt(dm.w)}"><output id="eoW"></output></div>`;
    if (block) h += `<div class="row"><label for="eD">Depth</label><input type="range" id="eD" min="0.2" max="${fmt(Math.max(3, c.d * 3))}" step="0.05" value="${fmt(dm.d)}"><output id="eoD"></output></div>
    <div class="row"><label for="eH">Height</label><input type="range" id="eH" min="0.2" max="2.8" step="0.05" value="${fmt(c.h * (i.sy || 1))}"><output id="eoH"></output></div>`;
    h += `</div>`;
  } else h += `<p class="note">This piece has a fixed size. To design a different shape, use the item studio from the inventory.</p>`;
  h += `<div class="actions" style="margin-top:8px"><button class="btn" id="eRot">Rotate 45°</button><button class="btn" id="eDone">Done</button></div>`;
  el.innerHTML = h;
  if (c.shape === "parts") $("#eColour").hidden = true;
  if (custom) $("#eStudio").onclick = () => openStudio(i.type);
  let liveArmed = false;
  bindSwatches($("#eSw"), (col, live) => {
    if (!live || !liveArmed) {
      pushUndo();
      liveArmed = live;
    }
    i.color = col;
    refreshItem(i);
    save();
    if (!live) renderItemPane();
  });
  const slider = (id: string, key: "sx" | "sy" | "sz", base: number) => {
    const e = el.querySelector<HTMLInputElement>("#" + id);
    if (!e) return;
    const o = $("#eo" + id.slice(1)), show = () => (o.textContent = fmt(+e.value) + " m");
    show();
    e.addEventListener("pointerdown", pushUndo);
    e.addEventListener("keydown", pushUndo);
    e.addEventListener("input", () => {
      i[key] = +e.value / base;
      show();
      refreshItem(i);
      updateMeta(i);
    });
    e.addEventListener("change", save);
  };
  slider("eW", "sx", c.w);
  slider("eD", "sz", c.d);
  slider("eH", "sy", c.h || 1);
  $("#eRot").onclick = () => $btn("#bRot").click();
  $("#eDone").onclick = () => {
    select(null);
    setTab(isDesk() ? "room" : null);
  };
}

export function initSelection(): void {
  $("#bRot").onclick = () => {
    const i = getSel();
    if (!i) return;
    pushUndo();
    i.r = (i.r + 45) % 360;
    meshes.get(i.id)?.rotation.set(0, (-i.r * Math.PI) / 180, 0);
    evaluate();
    save();
  };
  $("#bDel").onclick = () => {
    const i = getSel();
    if (!i) return;
    pushUndo();
    app.L.items = app.L.items.filter((x) => x !== i);
    removeItemMesh(i.id);
    select(null);
    save();
  };
  $("#bDup").onclick = () => {
    const i = getSel();
    if (!i) return;
    pushUndo();
    const n = { ...i, id: newId(), x: snap(clampX(i.x + 0.6)), z: snap(clampZ(i.z + 0.6)) };
    app.L.items.push(n);
    buildItem(n);
    select(n.id);
    save();
  };
  $("#bEdit").onclick = () => setTab("item");
  // tap the clash chip to step through clashing pieces
  $("#stClash").onclick = () => {
    const ids = [...app.clashSet];
    if (!ids.length) return;
    const id = ids[(ids.indexOf(app.selected ?? -1) + 1) % ids.length]!;
    select(id);
    const i = getSel();
    if (i) focusOn(i.x, i.z);
  };
}
