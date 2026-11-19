// Room controls in the room editor's side panel: size, shape, kitchen/storage, lighting warmth.
import { $, $$, $in, esc, fmt } from "../dom";
import { roomName, roomNameChoices, SHOP_TYPES, typeOf } from "../data/shopTypes";
import { cafeCuts, defaultBoh, shapeOf } from "../geometry/rooms";
import { evaluate } from "../items";
import { fitPlan } from "../plan/plan";
import { buildRoom } from "../roomView";
import { app, pushUndo, save } from "../state";
import type { Boh, BohMode, BohSide, Corner, Room, Shape } from "../types";
import { applyLight, fitView } from "../views";

/** Wire a slider so one drag is one undo step. */
function slider(el: HTMLInputElement, onInput: (v: number) => void): void {
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
    save();
  });
  el.addEventListener("input", () => {
    arm();
    onInput(parseFloat(el.value));
  });
}
const pressed = (sel: string, v: string) => {
  for (const b of $$(sel)) b.setAttribute("aria-pressed", String(b.dataset.v === v));
};

export function syncShape(): void {
  const r = shapeOf(app.L.room);
  pressed("#rShape button", r.shape);
  $("#cutOpts").hidden = r.shape === "rect";
  $("#rCorner").hidden = r.shape !== "L";
  $("#rCside").hidden = !(r.shape === "T" || r.shape === "U");
  $("#cutLbl").textContent = r.shape === "L" ? "Cut-out corner" : r.shape === "T" ? "Narrow end" : "Cut-out side";
  pressed("#rCorner button", r.corner);
  pressed("#rCside button", r.cside);
  $in("#rCw").value = String(r.cwf);
  $in("#rCd").value = String(r.cdf);
  const k = cafeCuts(r)[0];
  if (k) {
    $("#oCw").textContent = fmt(k.x1 - k.x0) + " m";
    $("#oCd").textContent = fmt(k.z1 - k.z0) + " m";
  }
}

export function syncBoh(): void {
  const B = (app.L.boh ??= defaultBoh());
  pressed("#bMode button", B.mode);
  pressed("#bSide button", B.side);
  $("#bohOpts").hidden = B.mode === "none";
  $("#bShareRow").hidden = B.mode !== "both";
  $("#bStoreDoorL").hidden = B.mode !== "both";
  $("#bSwap").hidden = B.mode !== "both";
  $in("#bDepth").value = String(B.depth);
  $("#obDepth").textContent = fmt(B.depth) + " m";
  $in("#bShare").value = String(B.share);
  $("#obShare").textContent = Math.round(B.share * 100) + "%";
  $in("#bDoor").value = String(B.door);
  const sideWall = B.side !== "back";
  $("#obDoor").textContent = B.door < -0.33 ? (sideWall ? "Back" : "Left") : B.door > 0.33 ? (sideWall ? "Front" : "Right") : "Middle";
  $in("#bHatch").checked = B.hatch;
  $in("#bStoreDoor").checked = B.storeDoor;
  $in("#bBackDoor").checked = B.backDoor;
  syncNames();
}

/** Labels that name the back rooms follow this layout's names. */
function syncNames(): void {
  const L = app.L, n1 = roomName(L, "kitchen"), n2 = roomName(L, "storage"), lo = (t: string) => t.toLowerCase();
  const [none, one, two] = $$("#bMode button");
  none!.textContent = "None";
  one!.textContent = n1;
  two!.textContent = `${n1} + ${lo(n2)}`;
  $("#tShare").textContent = `${n1} size`;
  $("#tDoor").textContent = `${n1} door`;
  $("#tHatch").textContent = SHOP_TYPES[typeOf(L)].hatch;
  $("#tStoreDoor").textContent = `Shop door to ${lo(n2)}`;
  $("#bSwap").textContent = `Swap ${lo(n1)} and ${lo(n2)}`;
  const opts = roomNameChoices(app.store.settings.roomNames);
  for (const [id, cur] of [["#bName1", n1], ["#bName2", n2]] as const) {
    const sel = $<HTMLSelectElement>(id), list = opts.includes(cur) ? opts : [cur, ...opts];
    sel.innerHTML = list.map((o) => `<option${o === cur ? " selected" : ""}>${esc(o)}</option>`).join("");
  }
  const both = (L.boh?.mode ?? "none") === "both";
  $("#bName2").hidden = $("#bName2L").hidden = !both;
}

export function syncRoomInputs(): void {
  syncBoh();
  syncShape();
  const r = app.L.room;
  $in("#rW").value = String(r.w);
  $in("#rD").value = String(r.d);
  $in("#rH").value = String(r.h);
  $in("#rDoor").value = String(r.door);
  $in("#rWarm").value = String(app.L.warmth);
  $("#oW").textContent = fmt(r.w) + " m";
  $("#oD").textContent = fmt(r.d) + " m";
  $("#oH").textContent = fmt(r.h) + " m";
  $("#oDoor").textContent = r.door < -0.33 ? "Left" : r.door > 0.33 ? "Right" : "Centre";
}

function refit(): void {
  fitView();
  if (app.sized) fitPlan();
}

export function initRoomControls(): void {
  for (const [id, k] of [["#rW", "w"], ["#rD", "d"], ["#rH", "h"], ["#rDoor", "door"]] as const)
    slider($in(id), (v) => {
      app.L.room[k] = v;
      syncRoomInputs();
      buildRoom();
      evaluate();
    });
  $in("#rWarm").addEventListener("input", () => {
    app.L.warmth = parseFloat($in("#rWarm").value);
    applyLight();
    save();
  });

  const shapeChange = (fn: (r: Required<Room>) => void) => {
    pushUndo();
    fn(shapeOf(app.L.room));
    syncShape();
    buildRoom();
    evaluate();
    refit();
    save();
  };
  for (const b of $$<HTMLButtonElement>("#rShape button")) b.onclick = () => {
    if (shapeOf(app.L.room).shape !== b.dataset.v) shapeChange((r) => (r.shape = b.dataset.v as Shape));
  };
  for (const b of $$<HTMLButtonElement>("#rCorner button")) b.onclick = () => shapeChange((r) => (r.corner = b.dataset.v as Corner));
  for (const b of $$<HTMLButtonElement>("#rCside button")) b.onclick = () => shapeChange((r) => (r.cside = b.dataset.v as "back" | "front"));
  for (const [id, k] of [["#rCw", "cwf"], ["#rCd", "cdf"]] as const)
    slider($in(id), (v) => {
      shapeOf(app.L.room)[k] = v;
      syncShape();
      buildRoom();
      evaluate();
    });

  const bohChange = (fn: (B: Boh) => void, doRefit = false) => {
    pushUndo();
    fn((app.L.boh ??= defaultBoh()));
    syncBoh();
    buildRoom();
    evaluate();
    if (doRefit) refit();
    save();
  };
  for (const b of $$<HTMLButtonElement>("#bMode button")) b.onclick = () => {
    if (app.L.boh?.mode !== b.dataset.v) bohChange((B) => (B.mode = b.dataset.v as BohMode), true);
  };
  for (const b of $$<HTMLButtonElement>("#bSide button")) b.onclick = () => {
    if (app.L.boh?.side !== b.dataset.v) bohChange((B) => (B.side = b.dataset.v as BohSide), true);
  };
  for (const [id, k] of [["#bHatch", "hatch"], ["#bStoreDoor", "storeDoor"], ["#bBackDoor", "backDoor"]] as const) {
    const el = $in(id);
    el.addEventListener("change", () => bohChange((B) => (B[k] = el.checked)));
  }
  $("#bSwap").onclick = () => bohChange((B) => (B.swap = !B.swap));
  // back-room names: the type's default is stored as "no rename"
  for (const [id, k, d] of [["#bName1", "kitchen", 0], ["#bName2", "storage", 1]] as const) {
    const sel = $<HTMLSelectElement>(id);
    sel.addEventListener("change", () => {
      pushUndo();
      const names = (app.L.names ??= {});
      if (sel.value === SHOP_TYPES[typeOf(app.L)].back[d]) delete names[k];
      else names[k] = sel.value;
      if (!names.kitchen && !names.storage) delete app.L.names;
      syncBoh();
      buildRoom();
      evaluate();
      save();
    });
  }
  for (const [id, k] of [["#bDepth", "depth"], ["#bShare", "share"], ["#bDoor", "door"]] as const)
    slider($in(id), (v) => {
      (app.L.boh ??= defaultBoh())[k] = v;
      syncBoh();
      buildRoom();
      evaluate();
    });
}
