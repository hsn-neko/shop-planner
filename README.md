# Dessert Cafe Planner

An interior planning sandbox for a dessert cafe. `index.html` is the whole app: one self-contained page that loads Three.js r128 from cdnjs and jsDelivr. It runs in any modern browser on phone, tablet and desktop.

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

## Data
Layouts, versions and custom items are stored in the browser's localStorage (key `dessert-cafe-planner-v1`), so each browser and device keeps its own copy. The GitHub Pages site has a different origin from the claude.ai artifact, so plans made there don't carry over.

## Develop
```bash
npm ci
npm start                    # http://localhost:4173
npx playwright install       # first time only
npm test                     # all browsers
npx playwright test --project=chromium
```

## CI/CD
`.github/workflows/ci.yml` runs on every push and pull request:

1. **Test**: Playwright smoke tests in Chromium, Firefox and WebKit (Safari's engine), plus Pixel 7 and iPhone 14 phone emulation. They check that the page loads with no script errors, the 3D, 2D plan and walk views switch, placed furniture survives a reload, and the page falls back to the 2D plan when WebGL is unavailable. Headless Firefox is asked for software WebGL; where it has none, the view test checks the 2D fallback instead. Three.js is served from the pinned npm package during tests so CDN outages don't fail the build.
2. **Deploy**: when every browser passes on `main`, `index.html` is published to GitHub Pages.

One-time setup: **Settings → Pages → Build and deployment → Source: GitHub Actions.**

## Ideas for next rounds
Export/import layouts between devices, budget tally, customer flow line, floor-plan image tracing, entrance on any wall.
