import { defineConfig } from "vitest/config";
import { viteSingleFile } from "vite-plugin-singlefile";

// `vite build` makes the GitHub Pages site in dist/.
// `vite build --mode artifact` makes one self-contained HTML file in dist-artifact/
// (scripts, styles and fonts inlined) for the claude.ai artifact.
export default defineConfig(({ mode }) => ({
  base: "./",
  plugins: mode === "artifact" ? [viteSingleFile()] : [],
  build: {
    outDir: mode === "artifact" ? "dist-artifact" : "dist",
    assetsInlineLimit: mode === "artifact" ? 100_000_000 : 4096,
    chunkSizeWarningLimit: 900,
  },
  preview: { port: 4173, strictPort: true },
  test: { include: ["tests/unit/**/*.test.ts"], environment: "node" },
}));
