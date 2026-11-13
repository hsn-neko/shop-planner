# Shop Planner

An interior planning sandbox for a shop. It started as a dessert cafe planner; other kinds of shop are on the way. Built with [Vite](https://vite.dev) and strict TypeScript on top of Three.js r128 (MIT licence). The Bricolage Grotesque and Figtree fonts (SIL Open Font License) are bundled into the build, so visitors make no requests to other sites. It runs in any modern browser on phone, tablet and desktop.

**Live:** https://hsn-neko.github.io/shop-planner/ (deployed from `main`)

## What it does
- Views: 3D (orbit), 2D floor plan, walk-through from the entrance.
- Room editor: drag handles to resize walls, shape the L/T/U cut-out, set kitchen depth and the kitchen/storage split, and slide the entrance and kitchen door.
- Windows: add them to any outside wall; in the room editor's 3D view drag their edges to set width, sill and top, or drag their ends in the 2D plan. Window, shopfront and high presets.
- Settings (gear in the header): window limits (sill range, smallest height, gap below ceiling, width range) and the snap step, saved per browser.
- Shop shape: rectangle, L, T or U; width, depth, ceiling, entrance position.
- Kitchen and storage: none, kitchen, or kitchen + storage on the back, left or right wall, with hatch, storage door and delivery door options.
- Inventory: counter zone, seating, kitchen, storage and detail pieces, plus custom items from the item studio (parts, blocks or tables, with 1.7 m and 1.1 m scale figures).
- Layouts: blank or preset starts, rename, delete, up to 30 saved versions per layout, undo.
- Checks: live seat count and clash detection.
- Works without 3D: if a browser has WebGL turned off, the planner opens in the 2D plan with 3D and Walk greyed out.

## Code layout
```
index.html            page markup; loads src/main.ts
src/
  main.ts             start-up wiring
  types.ts            shared types (layouts, rooms, walls, windows, store)
  state.ts            app state, saving, undo
  data/catalog.ts     furniture catalogue, palettes, presets, window types
  geometry/           pure room and footprint maths (unit-tested, no DOM)
  three/              renderer, scene, furniture and room meshes
  plan/plan.ts        2D floor plan drawing and pointer handling
  editor/roomEditor.ts room editor (2D handles, 3D window drags) and Settings
  ui/                 panels: tabs, inventory, layouts, room controls, selection, studio
  views.ts            3D / plan / walk views and the render loop
  styles.css, fonts/
tests/
  unit/               Vitest tests for src/geometry
  e2e/                Playwright smoke tests against the production build
```

## Data
Layouts, versions and custom items are stored in the browser's localStorage (key `shop-planner-v1`), so each browser and device keeps its own copy. Plans from the old Dessert Cafe Planner (key `dessert-cafe-planner-v1`) aren't carried over. The GitHub Pages site has a different origin from the claude.ai artifact, so plans made in one don't appear in the other.

## Develop
```bash
npm ci
npm run dev                  # http://localhost:5173 with hot reload
npm run typecheck            # strict TypeScript
npm run test:unit            # Vitest
npm run build                # dist/ for GitHub Pages
npm run build:artifact       # dist-artifact/index.html, everything in one file
npx playwright install       # first time only
npm test                     # Playwright, all browsers (builds and serves on :4173)
npx playwright test --project=chromium
```

## CI/CD
`.github/workflows/ci.yml` runs on every push and pull request:

1. **Checks**: typecheck, unit tests, the Pages build and the single-file build.
2. **Test**: Playwright smoke tests in Chromium, Firefox and WebKit (Safari's engine), plus Pixel 7 and iPhone 14 phone emulation, against the production build. They check that the page loads with no script errors and nothing from other sites, the 3D, 2D plan and walk views switch, placed furniture survives a reload, the room editor adds, edits and removes windows and resizes the shop, and the page falls back to the 2D plan when WebGL is unavailable. Headless Firefox is asked for software WebGL; where it has none, the view test checks the 2D fallback instead.
3. **Deploy**: when everything passes on `main`, `dist/` is published to GitHub Pages.

Workflow actions are pinned to exact commits, with the version in a comment beside each.

One-time setup: **Settings → Pages → Build and deployment → Source: GitHub Actions.**

## Ideas for next rounds
Shop types (cafe/bakery, retail boutique, bookshop/gift shop), export/import layouts between devices, budget tally, customer flow line, floor-plan image tracing, entrance on any wall.
