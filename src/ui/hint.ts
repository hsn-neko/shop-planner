// The small message strip at the bottom of the stage.
import { $ } from "../dom";
import { app, save } from "../state";

let hintT: ReturnType<typeof setTimeout> | undefined;
export function hideHint(): void {
  $("#hint").classList.add("gone");
}
/** Show a confirmation or notice for a few seconds. */
export function flashHint(text: string, ms = 3500): void {
  const h = $("#hint");
  h.textContent = text;
  h.classList.remove("gone");
  clearTimeout(hintT);
  hintT = setTimeout(hideHint, ms);
}
/** Tutorial tips show once per browser. */
export function tip(key: string, text: string): void {
  if (app.store.seen[key]) return;
  app.store.seen[key] = true;
  save();
  flashHint(text, 5000);
}
