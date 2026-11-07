// Colour swatch rows used by the item editor and the item studio.
import { SWATCHES } from "../data/catalog";

export function swatchHTML(cur: string | null | undefined, withReset = false): string {
  return SWATCHES.map((c) => `<button data-c="${c}" aria-pressed="${c === cur}" style="background:${c}" aria-label="Colour ${c}"></button>`).join("")
    + `<input type="color" aria-label="Pick any colour" value="${cur || "#c2416b"}">`
    + (withReset ? `<button class="btn" data-c="" style="width:auto;height:36px;min-height:36px;border-radius:10px;box-shadow:none">Palette colour</button>` : "");
}

/** onPick(colour, live): live is true while dragging the colour picker. null means "use the palette colour". */
export function bindSwatches(el: HTMLElement, onPick: (c: string | null, live: boolean) => void): void {
  for (const b of el.querySelectorAll<HTMLButtonElement>("[data-c]")) b.onclick = () => onPick(b.dataset.c || null, false);
  const ci = el.querySelector<HTMLInputElement>("input[type=color]");
  ci?.addEventListener("input", () => onPick(ci.value, true));
}
