import type { Plugin } from "vite";
import { defineConfig } from "vitest/config";
import { viteSingleFile } from "vite-plugin-singlefile";

// `vite build` makes the GitHub Pages site in dist/.
// `vite build --mode artifact` makes one self-contained HTML file in dist-artifact/
// (scripts, styles and fonts inlined) for the claude.ai artifact.
/**
 * Content Security Policy for the GitHub Pages site. Pages can't send headers, so it goes in a <meta> tag.
 * Only files from the site itself may run or load; nothing from other sites, no inline scripts, no plugins.
 * Inline style attributes stay allowed because the panels set widths and colours that way.
 * The single-file artifact build inlines its script, so it can't use script-src 'self' and gets no CSP here
 * (claude.ai applies its own policy to artifacts).
 */
export const CSP = [
  "default-src 'none'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "base-uri 'none'",
  "form-action 'none'",
  "object-src 'none'",
].join("; ");

const cspMeta = (): Plugin => ({
  name: "csp-meta",
  transformIndexHtml: () => [{ tag: "meta", attrs: { "http-equiv": "Content-Security-Policy", content: CSP }, injectTo: "head-prepend" }],
});

export default defineConfig(({ mode }) => ({
  base: "./",
  plugins: mode === "artifact" ? [viteSingleFile()] : [cspMeta()],
  build: {
    outDir: mode === "artifact" ? "dist-artifact" : "dist",
    assetsInlineLimit: mode === "artifact" ? 100_000_000 : 4096,
    chunkSizeWarningLimit: 900,
  },
  preview: { port: 4173, strictPort: true },
  test: { include: ["tests/unit/**/*.test.ts"], environment: "node" },
}));
