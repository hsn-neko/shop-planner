// Shop Planner: start-up wiring.
import "./styles.css";
import { $, $btn, isDesk, readTokens } from "./dom";
import { initRoomEditor } from "./editor/roomEditor";
import { rebuildItems } from "./items";
import { buildRoom } from "./roomView";
import { app, bindUndo, undo } from "./state";
import { gl } from "./three/core";
import { flashHint, tip } from "./ui/hint";
import { initInventory, renderCatalog } from "./ui/inventory";
import { initLayouts, loadSlot, renderPalettes } from "./ui/layouts";
import { initRoomControls, syncRoomInputs } from "./ui/roomControls";
import { initSelection, showSel } from "./ui/selection";
import { initStudio } from "./ui/studio";
import { initTabs, setTab } from "./ui/tabs";
import { applyLight, initViews, setMode, startLoop } from "./views";

readTokens();
app.has3d = gl.ok;

initViews();
initTabs();
initInventory();
initSelection();
initLayouts();
initRoomControls();
initStudio();
initRoomEditor();

const bUndo = $btn("#bUndo");
bUndo.onclick = undo;
bindUndo(
  (on) => (bUndo.disabled = !on),
  () => {
    syncRoomInputs();
    renderPalettes();
    buildRoom();
    rebuildItems();
    applyLight();
    showSel();
  },
);

renderCatalog();
setTab(isDesk() ? "room" : null);
loadSlot(app.store.active);
startLoop();
setMode("3d");

document.documentElement.dataset.webgl = app.has3d ? "on" : "off";
if (!app.has3d) {
  const why = "3D needs WebGL, which this browser has turned off";
  for (const q of ["#v3d", "#vWalk", '#reSeg [data-v="3d"]']) {
    const b = $btn(q);
    b.disabled = true;
    b.title = why;
  }
  const n = document.createElement("div");
  n.className = "no3d";
  n.textContent = "The 3D preview needs WebGL, which this browser has turned off. Your item still saves and shows on the 2D plan.";
  $("#sView").appendChild(n);
  setTimeout(() => flashHint("3D isn't available in this browser, so the planner opened in the 2D plan.", 9000), 700);
}
setTimeout(() => tip("intro", "Drag furniture to move it. Drag the floor to look around, pinch to zoom."), 600);
