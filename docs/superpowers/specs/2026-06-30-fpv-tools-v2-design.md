# FPV Tools V2 — Design Spec
**Date:** 2026-06-30  
**Status:** Approved  
**Scope:** Build Planner (multi-build CRUD + tracker), Flight Time Calculator, canvas visualizations for existing tools, mobile UX pass

---

## 1. Overview

Four workstreams delivered in one implementation plan:

| Workstream | New files | Touches existing |
|---|---|---|
| A — Build Planner | `src/core/builds/`, `src/components/builds/`, `src/app/views/Build*.vue` | `router.ts`, `App.vue`, `seo.ts`, i18n |
| B — Flight Time Calculator | `src/core/flighttime/`, `src/components/flighttime/`, `src/app/views/FlightTimeView.vue` | `router.ts`, `App.vue`, `seo.ts`, i18n |
| C — Canvas viz upgrades | `src/components/power/pack-viz.ts`, `src/components/motors/motor-gauge.ts`, `src/components/rf/rf-range-viz.ts`, `src/components/tilt/tilt-viz.ts` | `pack-calculator.ts`, `motor-calculator.ts`, `link-budget.ts`, `tilt-calculator.ts` |
| D — Mobile UX pass | — | All Lit components + `App.vue` |

---

## 2. Data Model

All types live in `src/core/builds/types.ts`.

```ts
type StockStatus = 'in' | 'out' | 'check'
type ItemCategory = 'Airframe' | 'Ground Station' | 'Power' | 'Consumables' | 'QOL'

interface BuildItem {
  id: string
  name: string
  cat: ItemCategory
  price: number           // NZD
  confirmed: boolean      // price confirmed on a live product page
  store: string           // key into storesMeta
  url: string             // primary buy link
  stock: StockStatus
  verified: boolean       // link loaded and confirmed this session
  backups: { label: string; url: string }[]
  note: string            // default note (overridable per-user)
}

interface ChecklistItem {
  text: string
  phase: 'Bench' | 'Setup' | 'Field'
}

interface StoreMeta {
  url: string
  ship: string
  hue: number             // hue for the store colour dot
}

interface BuildMeta {
  slug: string            // URL-safe, e.g. '7-lr-fpv'
  name: string
  description: string
  createdAt: number       // Unix ms
  updatedAt: number
}

interface BuildDefinition {
  meta: BuildMeta
  items: BuildItem[]
  checklist: ChecklistItem[]
  firmware: { name: string; url: string }[]
  refs: { name: string; url: string }[]
  storesMeta: Record<string, StoreMeta>
  catOrder: ItemCategory[]
  storeOrder: string[]
}

interface BuildUserState {
  bought: Record<string, boolean>   // item.id → checked
  notes: Record<string, string>     // item.id → override note
  checks: Record<number, boolean>   // checklist index → checked
}

interface PersistedBuild {
  definition: BuildDefinition
  userState: BuildUserState
}
```

**Storage**

- localStorage key: `fpv-builds-v1`
- Value: `Record<slug, PersistedBuild>`
- On first load: if key absent or slug `7-lr-fpv` absent, seed from `src/core/builds/seed-7lr.ts`
- `definition` and `userState` are stored together but the seeded build's definition can be reset independently of `userState`

---

## 3. Seeded Build — 7" Long-Range FPV (`7-lr-fpv`)

File: `src/core/builds/seed-7lr.ts`

Seeded from the React build tracker data. Exact items (21 total):

| id | name | cat | price NZD | store | stock |
|---|---|---|---|---|---|
| frame | iFlight AOS 7 V5 Frame Kit | Airframe | 210 | iFlight direct | check |
| motors | iFlight XING 2806.5 1300KV ×4 | Airframe | 205.20 | Hobby Station | check |
| fcesc | SpeedyBee F405 V4 BLS 55A Stack | Airframe | 139.99 | KiwiQuads | in |
| caps | Capacitors 50V 470uF ×2 | Airframe | 8.00 | AliExpress | check |
| vtx | Walksnail Avatar HD Pro Kit V2 | Airframe | 315.00 | KiwiQuads | check |
| rx | RadioMaster DBR4 Dual-Band ELRS | Airframe | 55.00 | KiwiQuads | check |
| gps | TBS M10Q GPS Glonass | Airframe | 45.00 | KiwiQuads | check |
| buzzer | VIFLY Finder V2 Buzzer | Airframe | 35.00 | KiwiQuads | check |
| coating | Kotking Conformal Coating | Consumables | 18.00 | KiwiQuads | check |
| radio | RadioMaster GX12 Gemini-X | Ground Station | 400.00 | KiwiQuads | check |
| goggles | Walksnail Avatar HD Goggles X | Ground Station | 747.00 | KiwiQuads | check |
| gogbatt | GNB 2S 3000mAh Goggle Battery | Ground Station | 30.00 | KiwiQuads | check |
| charger | HOTA D6 Pro 325W Dual Charger | Ground Station | 200.00 | KiwiQuads | check |
| props | Gemfan Flash 7040 ×5 sets | Airframe | 34.95 | Killa Drones | check |
| smoke | TBS Smoke Stopper | Consumables | 13.50 | Killa Drones | check |
| cells | Molicel P42A 21700 ×6 (6S pack) | Power | 60.00 | AliExpress | check |
| lipo | 6S LiPo 1300–1500mAh (tuning) | Power | 60.00 | KiwiQuads | check |
| loctite | Loctite Blue 243 Threadlocker | Consumables | 12.00 | Hardware store | check |
| bits | XT60 connectors + battery straps | Consumables | 25.00 | AliExpress | check |
| radiocells | 18650 cells ×2 (GX12 radio) | Ground Station | 20.00 | KiwiQuads | check |
| sim | VelociDrone Simulator | QOL | 30.00 | Digital | check |

**Motor note** (appended to `motors` item note): *"Motor library lists maxCurrentA: 42A. Some sources quote 34A continuous at 6S with 7040 props — verify against your batch's dyno sheet. The SpeedyBee 55A ESC has headroom at either figure, but confirm before sustained WOT runs."*

Total seeded build: **NZD ~$2,458.64**

---

## 4. Routes & SEO

```
/build                       BuildGalleryView        "Build Planner | FPV Tools"
/build/:slug                 redirect → /build/:slug/store
/build/:slug/store           BuildDetailView         "{Name} — Store Guide | FPV Tools"
  (child)                    BuildStoreTab
/build/:slug/items           BuildDetailView         "{Name} — Parts List | FPV Tools"
  (child)                    BuildItemsTab
/build/:slug/check           BuildDetailView         "{Name} — Build Checklist | FPV Tools"
  (child)                    BuildChecklistTab
/build/:slug/links           BuildDetailView         "{Name} — Firmware & Links | FPV Tools"
  (child)                    BuildLinksTab
/flighttime                  FlightTimeView          "Flight Time Calculator | FPV Tools"
```

Vue Router config: `/build/:slug` is a named route with `children` array. `BuildDetailView` renders `<router-view />` inside its tab content area. The redirect from `/build/:slug` to `/build/:slug/store` is handled via `redirect: to => ({ path: \`/build/${to.params.slug}/store\` })`. SEO meta for child routes is set in `router.beforeEach` by reading the active child route name alongside the build name resolved from localStorage.

`seo.ts` updated with keys for each new route. Dynamic titles for build detail routes are set in `BuildDetailView` after the slug resolves.

Nav order (App.vue): PID · Power · Motors · RF · **Build** · Convert · Blackbox · Tilt · Diff · **Flight Time**

---

## 5. Workstream A — Build Planner

### 5.1 File structure

```
src/core/builds/
  types.ts
  seed-7lr.ts
  storage.ts          // load/save/seed helpers using useLocalStorage

src/components/builds/
  build-progress.ts   // Lit canvas: arc gauge + budget bar + category dots
  build-item-row.ts   // Lit: single item row (checkbox, note edit, links)
  build-item-form.ts  // Lit: add/edit item form (all fields)
  build-checklist.ts  // Lit: checklist tab content
  build-links.ts      // Lit: firmware & refs tab content

src/app/views/
  BuildGalleryView.vue
  BuildDetailView.vue      // shell: sticky header + budget card + tab nav + <router-view>
  BuildStoreTab.vue        // child route: /build/:slug/store
  BuildItemsTab.vue        // child route: /build/:slug/items
  BuildChecklistTab.vue    // child route: /build/:slug/check
  BuildLinksTab.vue        // child route: /build/:slug/links
```

### 5.2 Build Gallery (`/build`)

- Page heading + "+ New Build" button
- "+ New Build" expands an inline form (no modal): name (required), description, optional "Duplicate from" select. Slug auto-generated from name (lowercase, hyphens). On save: create entry in localStorage, navigate to `/build/:slug/store`.
- Build cards: name, description, item count, total / spent / remaining, progress bar, last-updated. Actions: **Open** (router-link), **Duplicate** (copy definition + empty userState), **Export JSON** (triggers download of `{slug}.fpv-build.json`), **Delete** (inline confirm row replaces actions: "Delete this build? [Confirm] [Cancel]" — no `window.confirm()`).
- Seeded `7-lr-fpv` card has a "Seeded" badge and a **Reset definition** action (restores items/checklist/firmware/refs to seed values; does not touch userState).
- Import: a secondary "+ Import JSON" button on the gallery page accepts a `.fpv-build.json` file via `<input type="file">` and merges/overwrites that slug.

### 5.3 Build Detail View (`/build/:slug/*`)

**Sticky header** (stays visible while scrolling):
- Back arrow → `/build`
- Build name — click to edit inline (input replaces text, save on blur or Enter, cancel on Esc, 44px min-height)
- Description — same inline edit pattern

**Budget summary card** — below sticky header, not sticky:
- `<build-progress>` canvas (arc gauge left, budget bars right on desktop; stacked on mobile)
- Three stat cells: Build Total / Spent / Remaining (same layout as React component)
- Legend row: confirmed dot · estimate dot

**Tab nav** — four `<router-link>` items (Store / Items / Checklist / Links). Horizontal scroll on mobile. Active tab: `--fpv-primary` bottom border on the link, no background fill (matches existing nav style).

**`<router-view />`** renders the active tab content below.

### 5.4 Tab: Store (`/build/:slug/store`)

One card per store (order from `storeOrder`). Each store card:
- Header: coloured dot + store name + shipping note + subtotal + "N/M done"
- "Open [store] →" link button
- List of `<build-item-row>` for that store's items
- Card border turns `--fpv-primary` when all items in that store are ticked

`<build-item-row>` internals:
- Checkbox (44px touch) → toggles `bought[id]`
- Item name (strikethrough when bought) + price + confirmed dot
- Stock badge + verified badge
- Note (default or user override) — collapsed by default, shown when non-empty
- Action row: "Buy at {store} →" + backup links + "Edit note" + "Delete"
- Edit note: expands `<textarea>` with Save / Cancel inline. Save writes to `notes[id]`. Cancel discards.
- Delete: replaces action row with "Remove from build? [Confirm] [Cancel]" inline

### 5.5 Tab: Items (`/build/:slug/items`)

Items grouped by category. Each category section:
- Collapsible header: category name + subtotal + item count + chevron
- List of `<build-item-row>` (same component as Store tab)
- At bottom of each category: "+ Add item" button expands `<build-item-form>`

`<build-item-form>` fields (all in a single stacked form, no steps):
- Name (text, required)
- Category (select)
- Price NZD (number)
- Primary store (text) + URL (url input)
- Stock status (segmented control: In / Check / Out)
- Price confirmed (toggle)
- Link verified (toggle)
- Note (textarea)
- Backup links: up to 3, each row is Label + URL + "×" remove button; "+ Add backup" appends a row
- Save / Cancel buttons

Edit existing item: clicking "Edit item" on a row replaces the row with the same `<build-item-form>` pre-filled.

### 5.6 Tab: Checklist (`/build/:slug/check`)

- Each checklist row: checkbox (44px) + text + phase badge
- Click phase badge cycles Bench → Setup → Field → Bench
- Edit text: click text to edit inline (same blur/Enter/Esc pattern)
- Delete: "×" button right-aligned, with inline confirm
- "+ Add check" at bottom expands: text input + phase selector + Save/Cancel
- "Reset ticks" button clears `checks` only (not item data)
- NZ legal callout at bottom — fixed, not editable

### 5.7 Tab: Links (`/build/:slug/links`)

Two cards: Firmware and References. Each link row:
- Name + "→" link (opens in new tab, `rel="noopener noreferrer"`)
- Edit: name + URL inline edit with Save/Cancel
- Delete: inline confirm
- "+ Add link" at bottom of each card: name + URL + Save/Cancel

---

## 6. Workstream B — Flight Time Calculator (`/flighttime`)

### 6.1 File structure

```
src/core/flighttime/
  types.ts
  calculate.ts

src/components/flighttime/
  flight-time-canvas.ts   // Lit canvas: discharge curve + time markers
  flight-time-calculator.ts  // Lit: inputs + outputs + canvas

src/app/views/
  FlightTimeView.vue
```

### 6.2 Core calculation (`src/core/flighttime/calculate.ts`)

Pure functions, no DOM.

```ts
interface FlightTimeInput {
  chemistry: 'lipo' | 'liion'
  cellCount: number
  parallelCount: number
  capacityPerCellMah: number
  usablePct: number         // 0–1, default 0.8 for li-ion, 0.85 for lipo
  hoverEfficiencyGPerW: number   // from motor calc
  totalHoverCurrentA: number     // from motor calc
  auwG: number
  cruiseThrottlePct: number // 0–1, fraction of hover throttle
  cruiseSpeedKmh: number
  reservePct: number        // 0–1, default 0.2
}

interface FlightTimeResult {
  usableCapacityMah: number
  hoverCurrentA: number
  cruiseCurrentA: number     // scales as throttle^1.5 (same model as motor calc)
  hoverTimeMin: number
  cruiseTimeMin: number
  maxRangeKm: number
  reserveCapacityMah: number
  packDischargeC: number     // C-rate at hover — warn if > cell max
}
```

### 6.3 "Send to Flight Time" integration

A **"→ Flight Time"** link button appears in the results panel of `<motor-calculator>`, below the motor gauge canvas, visible only when a valid result exists. Clicking it dispatches a `fly-time-export` custom event (`bubbles: true, composed: true`) with detail `{ hoverEfficiencyGPerW, totalHoverCurrentA, auwG }`. `MotorsView.vue` listens for this event and navigates to `/flighttime?s=<base64>` with those three values encoded via `useUrlState`. `FlightTimeView` reads `route.query.s` on mount and pre-fills the matching inputs, then clears the query param so the URL stays clean.

### 6.4 Canvas (`<flight-time-canvas>`)

- X axis: time in minutes (0 → hoverTimeMin + 20% headroom)
- Y axis: pack voltage (chemistry-appropriate: 3.0–4.2V per cell for LiPo, 2.8–4.2V for Li-ion)
- Three shaded zones: hover (blue-tinted), cruise (primary-tinted), reserve (crosshatched with `--fpv-border`)
- Smooth voltage drop curve (linear approximation, good enough for planning)
- Three vertical marker lines with canvas-rendered badges: "Hover Xmin", "Cruise Xmin", "Reserve"
- Dirty-flag driven, redraws on any input change

---

## 7. Workstream C — Canvas Visualizations for Existing Tools

All new Lit canvas components follow the identical pattern from `fpv-scope` and `fpv-quad-preview-3d`:
- `firstUpdated()` → get canvas ref, ResizeObserver, start rAF loop
- `updated()` → set `_dirty = true`
- `_loop()` → rAF, draw only when dirty
- `_resize()` → DPR scaling
- `_draw()` → resolve CSS tokens via `getComputedStyle`, draw

### 7.1 `<pack-viz>` (added to `pack-calculator.ts`)

Properties: `@property cellCount`, `parallelCount`, `voltagePerCell`, `dischargePct`

Draws:
- Cell grid: S rows × P cols, each cell a rounded rect, colour lerped green→yellow→red by `dischargePct`
- Voltage label inside each cell
- Discharge curve below grid: voltage vs. capacity, Catmull-Rom smooth, vertical cursor at current `dischargePct`

### 7.2 `<motor-gauge>` (added to `motor-calculator.ts`)

Properties: `@property thrustToWeight`, `motorMaxCurrentA`, `motorCount`, `escRatedA`

Draws two side-by-side arc dials:
- Left: T:W (0–4 range). Target zone 2–3× in `--fpv-success` tint.
- Right: current headroom. Total peak = `motorMaxCurrentA × motorCount`. ESC rated = `escRatedA`. If total > 0.85 × ESC → arc fills `--fpv-error`, label "Check ESC headroom".

ESC rating input added to motor calculator form. The 2806.5 1300KV entry notes the rating discrepancy inline below the canvas.

### 7.3 `<rf-range-viz>` (added to `link-budget.ts`)

Properties: `@property primaryRangeKm`, `primaryMarginDb`, `secondaryRangeKm?`, `secondaryMarginDb?`, `dualLink`

Draws:
- Filled circle for primary link range, colour by margin (green/amber/red)
- If `dualLink`: second concentric circle for secondary link in `--fpv-accent`
- Scale bar at bottom-left
- Legend: link name + colour dot + range + margin

RF view gets a "Dual link" toggle that shows a second set of inputs (ELRS already present; second set for Walksnail 5.8GHz). Both computed simultaneously, both circles drawn.

### 7.4 `<tilt-viz>` (added to `tilt-calculator.ts`)

Properties: `@property tiltDeg`, `fovDeg`

Draws:
- Side-profile quad silhouette (two arms + body, ~40px wide)
- Camera rectangle rotated by `tiltDeg`
- Horizon line
- Arc showing tilt angle with label
- FOV cone from camera centre

---

## 8. Workstream D — Mobile UX Pass

### Touch targets
All interactive elements in all Lit components: `min-height: 44px; min-width: 44px`. Applied via a shared CSS snippet added to `tokenStyles` as an opt-in class `.touch-target`.

### Layout breakpoints audit
Each existing Lit component checked for:
- Missing `@media (max-width: 600px)` on two-column grids
- Inputs/selects/sliders without adequate tap area
- Overflow on small viewports (text truncation vs. wrap)

Specific fixes identified:
- `pid-controls.ts`: gain input group is a tight 3-column grid — collapses to 1-col at 480px
- `motor-calculator.ts`: result grid 2-col → 1-col at 480px
- `link-budget.ts`: two-panel layout → 1-col at 600px
- `bbl-dropzone.ts`: drop target needs min-height 120px on mobile

### Canvas touch
`fpv-scope`: already has pinch-zoom + drag-pan — no changes needed.
New canvas components (`pack-viz`, `motor-gauge`, `rf-range-viz`, `tilt-viz`, `flight-time-canvas`, `build-progress`): tap shows crosshair tooltip using the same touch handler pattern from `fpv-scope` (single touch = hover equivalent).

### Nav
`/build` and `/flighttime` added to `App.vue` nav links. At 10 links the nav wraps on medium screens — apply `font-size: 13px` on the `.nav-links a` elements below 900px to keep single-row before hamburger kicks in at 768px.

---

## 9. Implementation Order

1. `src/core/builds/types.ts` + `seed-7lr.ts` + `storage.ts`
2. `BuildGalleryView.vue` + `BuildDetailView.vue` + child tab views + router/nav/SEO wiring
3. `<build-progress>` canvas component
4. `<build-item-row>`, `<build-item-form>`, `<build-checklist>`, `<build-links>` Lit components
5. `src/core/flighttime/` + `FlightTimeView.vue` + `<flight-time-calculator>` + `<flight-time-canvas>`
6. Canvas upgrades: `<pack-viz>`, `<motor-gauge>`, `<rf-range-viz>`, `<tilt-viz>` — wired into existing tool components
7. Mobile UX pass: breakpoint audit + touch target fixes across all components
8. i18n: add keys for all new UI strings in `en` (and matching keys in other locales)
9. SEO: update `seo.ts` with new route keys

---

## 10. Out of Scope

- Backend / cloud sync (builds are localStorage-only)
- User accounts / auth
- Multi-user collaboration
- Offline PWA / service worker
- WebGL (all canvas is Canvas 2D)
- Removing or redesigning existing tools (only additive changes)
