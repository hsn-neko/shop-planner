// Rebuild the room after a change: geometry, meshes and the size/area text.
import { $, fmt } from "./dom";
import { shapeOf } from "./geometry/rooms";
import { evaluate } from "./items";
import { app, refreshGeo } from "./state";
import { buildRoomMeshes, rebuildWallMeshes } from "./three/room";
import { updateRoomSummary } from "./editor/roomEditor";
import { updateTypeNote } from "./ui/layouts";

function updateRoomText(): void {
  const { w, d } = app.L.room, sh = shapeOf(app.L.room).shape;
  $("#stSize").textContent = `${fmt(w)} × ${fmt(d)} m${sh !== "rect" ? ` · ${sh}` : ""}`;
  $("#bArea").textContent = app.geo.rooms.map((r) => `${r.name} ${Math.round(r.area)} m²`).join(" · ");
  updateRoomSummary();
  updateTypeNote();
}

/** Full rebuild: floors, walls, windows, lights. */
export function buildRoom(): void {
  refreshGeo();
  buildRoomMeshes(app.geo, app.L);
  updateRoomText();
}

/** Rebuild only walls and windows (window edits). */
export function rebuildWalls(): void {
  refreshGeo();
  rebuildWallMeshes(app.geo, app.L);
  evaluate();
  updateRoomSummary();
}
