// The settings panel's tabs (Rooms, Style, Layouts, Item): a sheet on phones, a side panel on desktop.
import { $, $$, isDesk } from "../dom";
import { app, type Tab } from "../state";
import { renderItemPane } from "./selection";

const TITLES: Record<Tab, string> = { room: "Rooms", style: "Look and feel", layouts: "Layouts", item: "Edit item" };

export function setTab(next: Tab | null): void {
  const t: Tab | null = next === null && isDesk() ? "room" : next;
  app.curTab = t;
  $("#panel").dataset.open = t ? "true" : "false";
  for (const b of $$("[data-tab]")) b.setAttribute("aria-selected", String(b.dataset.tab === t));
  for (const p of $$("[data-pane]")) p.hidden = p.dataset.pane !== t;
  if (t) {
    $("#sheetTitle").textContent = TITLES[t];
    if (t === "item") renderItemPane();
  }
}

export function initTabs(): void {
  for (const b of $$("[data-tab]")) b.onclick = () => {
    const t = b.dataset.tab as Tab;
    setTab(app.curTab === t && !isDesk() ? null : t);
  };
  $("#bClose").onclick = () => setTab(null);
  matchMedia("(min-width:880px)").addEventListener("change", () => {
    if (isDesk() && !app.curTab) setTab("room");
  });
}
