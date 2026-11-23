# Shop Planner

An interior planning sandbox for a shop: a cafe or bakery, a retail boutique, a bookshop or gift shop, or a mixed shop that combines them. Built with [Vite](https://vite.dev) and strict TypeScript on top of Three.js r128 (MIT licence). The Bricolage Grotesque and Figtree fonts (SIL Open Font License) are bundled into the build, so visitors make no requests to other sites. It runs in any modern browser on phone, tablet and desktop.

**Live:** https://hsn-neko.github.io/shop-planner/ (deployed from `main`)

## What it does
- Shop types: cafe / bakery, retail boutique, bookshop / gift shop, and mixed shop (counts everything; its back rooms default to Kitchen + Stockroom; presets Book café and Concept store). You pick the type when you start a layout (blank or one of the type's two presets) and it stays fixed. It sets the back-room names, what the header counts (seats, display fixtures or metres of shelving) and which furniture and palettes are listed first. Every piece and palette works in every type.
- Floor areas (every type): rectangles of shop floor drawn in the room editor, each with a name, a kind (Café counts seats, Books shelving, Retail fixtures, General nothing), its own floor finish (terrazzo, checker or hexagon tiles, polished concrete, light oak, dark walnut, herringbone, grey or green carpet, rug) and optional low dividers (half-height wall, planter box or low bookcase) with a 1.2 m opening you can slide. Areas can't overlap; rectangles that share a name count as one area. Dividers act like walls for clashes and walking. Each area's size and count shows in the inventory and on the 2D plan.
- Views: 3D (orbit), 2D floor plan, walk-through from the entrance.
- Room editor: drag handles to resize walls, shape the L/T/U cut-out, set back-room depth and the split between the two back rooms, and slide the entrance and back-room door.
- Windows: add them to any outside wall; in the room editor's 3D view drag their edges to set width, sill and top, or drag their ends in the 2D plan. Window, shopfront and high presets.
- Settings (gear in the header): window limits (sill range, smallest height, gap below ceiling, width range) and the snap step; back-room names you add, offered for any layout's back rooms. Saved per browser.
- Shop shape: rectangle, L, T or U; width, depth, ceiling, entrance position.
- Back rooms: none, one or two on the back, left or right wall, with hatch (pass-through outside cafes), door and delivery door options. Each can be renamed from the names list (Kitchen, Storage, Stockroom, Staff room, Office, Workroom, plus your own).
- Inventory: 44 built-in pieces (cafe counters, seating and kitchen; retail rails, shelving bays, fitting rooms; bookcases, displays and a children's corner; shared back-room storage and details). The layout's own type comes first; other types' pieces fold away below. Plus custom items from the item studio (parts, blocks or tables, with 1.7 m and 1.1 m scale figures).
- Layouts: blank or preset starts, rename, delete, up to 30 saved versions per layout, undo.
- Checks: live counts for the shop type and clash detection.
- Works without 3D: if a browser has WebGL turned off, the planner opens in the 2D plan with 3D and Walk greyed out.

## Code layout
```
index.html            page markup; loads src/main.ts
src/
  main.ts             start-up wiring
  types.ts            shared types (layouts, rooms, walls, windows, store)
  state.ts            app state, saving, undo
  data/catalog.ts     furniture catalogue, palettes, presets, window types
  data/shopTypes.ts   shop types: room names, counts, defaults (unit-tested)
  data/finishes.ts    floor finishes for areas
  data/sanitize.ts    checks saved data before use (unit-tested)
  geometry/           pure room, floor-area and footprint maths (unit-tested, no DOM)
  three/              renderer, scene, furniture and room meshes
  plan/plan.ts        2D floor plan drawing and pointer handling
  editor/roomEditor.ts room editor (2D handles, 3D window drags) and Settings
  editor/areaEditor.ts floor-area handles and panel
  ui/                 panels: tabs, inventory, layouts, room controls, selection, studio
  views.ts            3D / plan / walk views and the render loop
  styles.css, fonts/
tests/
  unit/               Vitest tests for src/geometry, floor areas and shop types
  e2e/                Playwright smoke and security tests against the production build
  live/               checks against the published site (run by CI after each deploy)
```

## Data
Layouts, versions and custom items are stored in the browser's localStorage (key `shop-planner-v1`), so each browser and device keeps its own copy. Plans from the old Dessert Cafe Planner (key `dessert-cafe-planner-v1`) aren't carried over. The GitHub Pages site has a different origin from the claude.ai artifact, so plans made in one don't appear in the other.

Saved data is treated as untrusted. On load, `src/data/sanitize.ts` rebuilds it from an allow-list: unknown fields are dropped, unknown shop types, palettes and area kinds fall back to defaults, numbers are clamped to their ranges, ids must be plain, colours must be `#hex`, and list lengths are capped. Values that go into HTML are escaped as well. Saved versions are checked the same way when they're restored.

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
`.github/workflows/ci.yml` runs on every push and pull request, and weekly on Mondays:

1. **Checks**: `npm audit` (fails on high or critical advisories), typecheck, unit tests, the Pages build and the single-file build.
2. **Test**: Playwright smoke tests in Chromium, Firefox and WebKit (Safari's engine), plus Pixel 7 and iPhone 14 phone emulation, against the production build. They check that the page loads with no script errors and nothing from other sites, the 3D, 2D plan and walk views switch, placed furniture survives a reload, the room editor adds, edits and removes windows and resizes the shop, new layouts start from a chosen shop type, back rooms take names added in Settings, mixed layouts split the floor into areas whose dividers clash with furniture, and the page falls back to the 2D plan when WebGL is unavailable. Headless Firefox is asked for software WebGL; where it has none, the view test checks the 2D fallback instead.
   **Security tests** (`tests/e2e/security.spec.ts`) seed the browser storage with hostile data (script in colours, ids and names; `__proto__` and other built-in names; unknown kinds; impossible numbers; tens of thousands of items) and check that no markup is injected and the app still starts. They also check the Content Security Policy is set, that using every view and editor triggers no violation, and that an injected inline script is blocked.
3. **Deploy**: when everything passes on a push to `main`, `dist/` is published to GitHub Pages.
4. **Live check**: after each deploy, and in the weekly run, `tests/live` checks the published site still sends its Content Security Policy, loads nothing from other sites and starts without errors.

`.github/workflows/security.yml` runs on every push and pull request, and weekly:
- **CodeQL** scans the TypeScript and the workflow files (security-extended queries); results appear under Security → Code scanning.
- **Dependency review** blocks a pull request that adds a dependency with a known moderate or worse vulnerability.
- **Secret scan**: the open-source gitleaks binary, checked against its published SHA-256, scans the whole git history. Reviewed false positives go in `.gitleaksignore` with a reason.
- **Workflow lint**: zizmor checks the workflows for risky patterns.

Dependabot (`.github/dependabot.yml`) opens weekly update pull requests for npm packages and for the pinned actions, waiting 7 days after each release.

Workflow actions are pinned to exact commits, with the version in a comment beside each. Checkouts don't keep the GitHub token (`persist-credentials: false`), and each job gets only the permissions it needs.

The Pages build sets a Content Security Policy in a `<meta>` tag (see `vite.config.ts`): scripts, styles, fonts and images only from the site itself, no inline scripts, no plugins. The single-file artifact build inlines its script, so it doesn't carry this policy.

One-time setup: **Settings → Pages → Build and deployment → Source: GitHub Actions.**

## Ideas for next rounds
Export/import layouts between devices, budget tally, customer flow line, floor-plan image tracing, entrance on any wall.
