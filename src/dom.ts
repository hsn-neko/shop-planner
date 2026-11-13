// Small DOM and formatting helpers.

/** The first element matching a selector. Throws if it's missing, since every id here is in index.html. */
export function $<T extends HTMLElement = HTMLElement>(sel: string): T {
  const el = document.querySelector<T>(sel);
  if (!el) throw new Error(`Missing element ${sel}`);
  return el;
}
export const $$ = <T extends HTMLElement = HTMLElement>(sel: string, root: ParentNode = document): T[] => [...root.querySelectorAll<T>(sel)];
export const $in = <T extends HTMLInputElement = HTMLInputElement>(sel: string): T => $<T>(sel);
export const $btn = (sel: string): HTMLButtonElement => $<HTMLButtonElement>(sel);

export const isDesk = (): boolean => matchMedia("(min-width:880px)").matches;
export const isWide = (): boolean => matchMedia("(min-width:1180px)").matches;

/** Metres rounded to 2 decimals, without trailing zeros. */
export const fmt = (n: number): string => (Math.round(n * 100) / 100).toString();

export const esc = (s: unknown): string =>
  String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string);

export const clone = <T>(o: T): T => JSON.parse(JSON.stringify(o)) as T;
export const clampV = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));
export const r1 = (v: number): number => Math.round(v * 10) / 10;

/** Rounded rectangle path (falls back to a plain rectangle on older canvases). */
export function rr(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  c.beginPath();
  if (c.roundRect) c.roundRect(x, y, w, h, r);
  else c.rect(x, y, w, h);
}

/** Colour tokens read from the CSS theme, for canvas drawing. */
export const TK = { fg: "", muted: "", line: "", accent: "", warn: "", panel: "", stage: "", paper: "" };
export function readTokens(): void {
  const cs = getComputedStyle(document.documentElement);
  for (const k of Object.keys(TK) as (keyof typeof TK)[]) TK[k] = cs.getPropertyValue("--" + k).trim();
}
