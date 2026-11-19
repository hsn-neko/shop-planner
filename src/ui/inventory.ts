// The inventory: every piece you can add, with counts of what's placed.
import { BY, CAT } from "../data/catalog";
import { $, $$, esc, fmt, isWide } from "../dom";
import { addItem, getSel, rebuildItems, select } from "../items";
import { SHOP_TYPES, TYPE_ORDER, typeOf } from "../data/shopTypes";
import { app, countsLabel, pushUndo, save } from "../state";
import type { ItemDef, ShopType } from "../types";
import { focusOn, setMode } from "../views";
import { showSel } from "./selection";
import { openStudio } from "./studio";

export function openInv(on: boolean): void {
  $("#inv").classList.toggle("open", on);
  $("#scrim").hidden = !on || isWide();
}

function symSVG(c: ItemDef): string {
  const col = c.color || c.col || (c.type === "plant" ? "#6f9a5a" : "var(--accent)"), sw = 'stroke="currentColor" stroke-width="1.3"';
  if (c.seats || c.shape === "round" || c.shape === "square")
    return `<svg class="sym" viewBox="0 0 20 20" fill="none"><rect x="2" y="7" width="4" height="6" rx="1" fill="${col}" ${sw}/><rect x="14" y="7" width="4" height="6" rx="1" fill="${col}" ${sw}/><circle cx="10" cy="10" r="3.5" ${sw}/></svg>`;
  if (c.type === "plant") return `<svg class="sym" viewBox="0 0 20 20"><circle cx="10" cy="10" r="6" fill="${col}" stroke="currentColor" stroke-width="1.3"/></svg>`;
  return `<svg class="sym" viewBox="0 0 20 20" fill="none"><rect x="2" y="6" width="16" height="8" rx="1.5" fill="${col}" fill-opacity=".55" ${sw}/>${c.front ? '<path d="M3 14h14" stroke="currentColor" stroke-width="2.6"/>' : ""}</svg>`;
}

const OWN = "Your items";
let armed: string | null = null;
/** other types' sections the user has opened, kept open across re-renders */
const opened = new Set<ShopType>();

function row(c: ItemDef): string {
  return `<div class="irow">${symSVG(c)}<div style="min-width:0"><div class="nm">${esc(c.name)}</div><div class="meta">${fmt(c.w)} × ${fmt(c.d)} m${c.seats ? ` · ${c.seats} seats` : ""}${c.fix ? " · display fixture" : ""}${c.shelf ? ` · ${fmt(c.shelf * c.w)} m shelving` : ""}</div>${c.grp === OWN ? `<button class="rm" data-edit="${c.type}">Edit in studio</button> · <button class="rm${armed === c.type ? " armed" : ""}" data-rm="${c.type}">${armed === c.type ? "Tap again to remove everywhere" : "Remove"}</button>` : ""}</div>
     <button class="cnt" data-find="${c.type}" aria-label="Find placed ${esc(c.name)}">×0</button><button class="add" data-add="${c.type}" aria-label="Add ${esc(c.name)}">+</button></div>`;
}
function groups(list: ItemDef[]): string {
  const names = [...new Set(list.map((c) => c.grp ?? ""))];
  return names.map((g) => `<div class="grp"><span>${g}</span><span data-gcount="${g}"></span></div>` + list.filter((c) => (c.grp ?? "") === g).map(row).join("")).join("");
}

/** Your items, then this layout's own type, then shared pieces; other types' pieces fold away below. */
export function renderCatalog(): void {
  const el = $("#catalog"), own = typeOf(app.L);
  const custom: ItemDef[] = app.store.custom.map((c) => ({ ...c, grp: OWN }));
  const others = TYPE_ORDER.filter((t) => t !== own);
  el.innerHTML = groups([...custom, ...CAT.filter((c) => c.kind === own), ...CAT.filter((c) => !c.kind)]) +
    others.map((t) => `<details class="fold" data-fold="${t}"${opened.has(t) ? " open" : ""}><summary>${SHOP_TYPES[t].name} pieces <small data-fcount="${t}"></small></summary>${groups(CAT.filter((c) => c.kind === t))}</details>`).join("");
  for (const d of $$<HTMLDetailsElement>("[data-fold]", el)) d.addEventListener("toggle", () => {
    const t = d.dataset.fold as ShopType;
    if (d.open) opened.add(t);
    else opened.delete(t);
  });
  for (const b of $$<HTMLButtonElement>("[data-add]", el)) b.onclick = () => {
    if (app.mode === "walk") setMode("3d");
    addItem(b.dataset.add!);
  };
  for (const b of $$<HTMLButtonElement>("[data-find]", el)) b.onclick = () => {
    const list = app.L.items.filter((i) => i.type === b.dataset.find);
    if (!list.length) return;
    if (app.mode === "walk") setMode("3d");
    const n = list[(list.findIndex((i) => i.id === app.selected) + 1) % list.length]!;
    select(n.id);
    focusOn(n.x, n.z);
    if (!isWide()) openInv(false);
  };
  for (const b of $$<HTMLButtonElement>("[data-edit]", el)) b.onclick = () => openStudio(b.dataset.edit!);
  for (const b of $$<HTMLButtonElement>("[data-rm]", el)) b.onclick = () => {
    const t = b.dataset.rm!;
    if (armed !== t) {
      armed = t;
      renderCatalog();
      setTimeout(() => {
        if (armed === t) {
          armed = null;
          renderCatalog();
        }
      }, 3000);
      return;
    }
    armed = null;
    pushUndo();
    app.store.custom = app.store.custom.filter((c) => c.type !== t);
    for (const s of Object.values(app.store.slots)) s.items = s.items.filter((i) => i.type !== t);
    if (!getSel()) app.selected = null;
    rebuildItems();
    showSel();
    renderCatalog();
    save();
  };
  updateCounts();
}

export function updateCounts(): void {
  const n: Record<string, number> = {}, g: Record<string, number> = {}, f: Record<string, number> = {};
  for (const i of app.L.items) {
    n[i.type] = (n[i.type] ?? 0) + 1;
    const c = BY[i.type], grp = c ? (c.grp ?? "") : OWN;
    g[grp] = (g[grp] ?? 0) + 1;
    if (c?.kind) f[c.kind] = (f[c.kind] ?? 0) + 1;
  }
  for (const b of $$<HTMLButtonElement>("[data-find]")) {
    const v = n[b.dataset.find!] ?? 0;
    b.textContent = "×" + v;
    b.classList.toggle("has", v > 0);
    b.disabled = !v;
  }
  for (const s of $$("[data-gcount]")) {
    const v = g[s.dataset.gcount!];
    s.textContent = v ? `${v} placed` : "";
  }
  for (const s of $$("[data-fcount]")) {
    const v = f[s.dataset.fcount!];
    s.textContent = v ? `· ${v} placed` : "";
  }
  $("#invSum").textContent = `${app.L.items.length} pieces placed · ${countsLabel(app.L)}`;
}

export function initInventory(): void {
  $("#bInv").onclick = () => openInv(true);
  $("#bInvClose").onclick = () => openInv(false);
  $("#scrim").onclick = () => openInv(false);
  matchMedia("(min-width:1180px)").addEventListener("change", () => openInv(false));
  $("#bMaker").onclick = () => openStudio(null);
}
