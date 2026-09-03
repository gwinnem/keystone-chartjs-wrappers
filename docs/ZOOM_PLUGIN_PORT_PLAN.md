# Zoom Plugin Local-Port Plan

Companion to `CHARTJS_ANALYSIS.md` §4 and `IMPLEMENTATION_PLAN.md` item #16
(the `imageLabel` local port, whose pattern this plan follows). **Not yet
started** — written to capture the real scope/decisions found while
scoping this out, so the work can be picked up later without re-deriving
any of it.

## Why this exists

At the user's explicit request: port `chartjs-plugin-zoom` directly into
`packages/core/src/`, the same way `chartjs-plugin-image-label` was
ported into `imageLabelPlugin.ts` — real source dissected from the
installed package, fixing any real bugs found along the way, avoiding
the docs-site dynamic-import hydration gap (item #4 in
`IMPLEMENTATION_PLAN.md`) since local code has no `import()` for that gap
to apply to.

## Scope comparison — why this is a much bigger undertaking than imageLabel

Real source pulled and read directly from
`packages/core/node_modules/chartjs-plugin-zoom/dist/
chartjs-plugin-zoom.esm.js` (v2.2.0, MIT) before writing this plan — not
guessed at.

| | `imageLabelPlugin.ts` (done) | `chartjs-plugin-zoom` (this plan) |
|---|---|---|
| Lines of source | ~90 | ~500 |
| State | one module-level `Map` (`loadedImages`) | per-chart `WeakMap` state (drag start/end, pan deltas, Hammer manager instances, zoom-level bookkeeping) |
| DOM events | none — pure `afterDraw` hook | real `addEventListener`/`removeEventListener` calls: `wheel`, `mousedown`, `mousemove`, `mouseup`, `keydown` (on both the canvas and `window.document`) |
| Public API surface | none | attaches real, callable methods directly onto the live Chart.js instance: `chart.pan()`, `chart.zoom()`, `chart.zoomRect()`, `chart.zoomScale()`, `chart.resetZoom()`, `chart.getZoomLevel()`, `chart.getInitialScaleBounds()`, `chart.getZoomedScaleBounds()`, `chart.isZoomedOrPanned()`, `chart.isZoomingOrPanning()` |
| Chart.js plugin hooks used | `afterDraw` only | `start`, `beforeEvent`, `beforeUpdate`, `beforeDatasetsDraw`, `afterDatasetsDraw`, `beforeDraw`, `afterDraw`, `stop` — 8 real lifecycle hooks, not 1 |
| External dependency | none | **`hammerjs`**, for pinch-gesture recognition |
| Per-scale-type math | none | distinct zoom/pan functions per scale type (`category`, `logarithmic`, `default`/linear, `timeseries`) — real, non-trivial math (log-scale zoom range, category-scale integer stepping, linear-scale delta computation) |

## Open decision — needs your call before implementation starts

**What to do about `hammerjs`.** Confirmed directly from the source:
Hammer.js is used *only* for pinch-gesture recognition (`startHammer`/
`stopHammer`/`handlePinch`/`startPan`/`handlePan`/`endPan` — the last
three because Hammer's own `Pan` recognizer is also used for
touch-drag-panning, not just pinch). Mouse-wheel zoom and
mouse-drag-to-zoom/pan are both plain DOM event handling with **no**
Hammer.js involvement at all.

Three real options, not yet decided:

1. **Port mouse-wheel + mouse-drag only, drop touch (pinch AND touch-pan)
   entirely.** Sidesteps the exact unmaintained-dependency concern
   `CHARTJS_ANALYSIS.md` §6 already flags for this package (Hammer.js:
   no release in years, non-ESM warnings under modern bundlers, a real
   open upstream issue). Recommended default unless touch support is a
   real requirement.
2. **Port everything, keep `hammerjs` as a real dependency.** Full
   parity including pinch and touch-pan, but keeps the one dependency
   this whole porting exercise is otherwise designed to eliminate for
   `imageLabel`-style plugins. Would need `hammerjs` added to
   `packages/core/package.json` (it already isn't a dependency of core
   today — only of the now-to-be-removed `chartjs-plugin-zoom` npm
   package itself).
3. **Port mouse-wheel + mouse-drag, document the touch gap explicitly**
   — same code as #1, but make sure docs/examples don't imply full
   parity, so nobody's surprised on a touch device.

**This plan assumes option 1/3 (no Hammer.js) going forward** for the
step-by-step below, since that was the direction discussed — confirm or
override before starting.

## Step-by-step plan (mirrors the imageLabel port's own real structure)

1. **Dissect the real source** (already done for this plan — see the
   scope table above) and confirm the exact mouse-wheel/drag-only
   subset to port: `wheel()`, `wheelPreconditions()`, `mouseDown()`,
   `mouseMove()`, `mouseUp()`, `keyDown()`, `zoomStart()`,
   `getPointPosition()`, `computeDragRect()`, `applyAspectRatio()`,
   `applyMinMaxProps()`, `getRelativePoints()`, `addListeners()`,
   `removeListeners()`, `addHandler()`/`removeHandler()`, `draw()` (the
   drag-rectangle overlay), plus all the scale-math helpers
   (`zoom()`, `pan()`, `zoomRect()`, `zoomScale()`, `resetZoom()`,
   `getZoomLevel()`, `isZoomedOrPanned()`, `isZoomingOrPanning()`,
   `getInitialScaleBounds()`, `getZoomedScaleBounds()`, and every
   per-scale-type `zoomFunctions`/`panFunctions`/`zoomRectFunctions`
   entry). Excluded under option 1/3: `startHammer`, `stopHammer`,
   `handlePinch`, `startPan`, `handlePan`, `endPan`, `createEnabler`,
   `pinchAxes`, `hammerOptionsChanged`, and the `hammers` WeakMap.
2. **New file**: `packages/core/src/zoomPlugin.ts`, mirroring
   `imageLabelPlugin.ts`'s own structure — a header comment stating the
   real source version ported from, the Hammer.js/touch decision made
   and why, and the real registration shape (a plain, local `Plugin`
   object, not passed to `Chart.register(...)`, supplied via the inline
   `plugins` array — same shape as `imageLabelPlugin`).
3. **`types.ts`**: `ZoomPluginOptions` already exists but is
   deliberately loose (`{ pan?: Record<string, unknown>; zoom?:
   Record<string, unknown> }`) — decide whether to keep it loose
   (matching the "full plugin-specific typing is Phase 5 scope" pattern
   already established for `annotation`/`dataLabels`) or model it
   precisely now that the real shape is fully known from the dissected
   source (unlike `imageLabelPluginOptions`, which was modeled precisely
   from the start since its surface is small). Leaning loose-for-now,
   consistent with the existing pattern, but worth a real decision here
   too rather than defaulting silently.
4. **`plugins.ts`**: rewrite `withZoom` to match `withImageLabel`'s own
   shape — no more dynamic `import()`/`Chart.register()`, instead
   `Promise<{ options, plugin }>` returning the local `zoomPlugin` object
   from the new file, for the caller to merge into the inline `plugins`
   array. **Real, deliberate exception to note explicitly when this
   happens**: this changes `withZoom`'s own public return type
   (currently `Promise<Options>`, matching every other still-dependency-
   based helper) — `useChartController.ts`'s own `resolveOptionsAndPlugins()`
   would need the identical `effectivePlugins` merge-and-cache treatment
   already built for `imageLabel` (including the same reference-stability
   bug that was found and fixed for `imageLabel` — watch for it
   recurring here, don't re-introduce it).
5. **Core unit tests**: split the same way `imageLabel`'s were —
   `plugins.spec.ts` covers `withZoom`'s own thin wrapper; a new,
   dedicated `tests/unit/zoomPlugin.spec.ts` covers the real logic
   (wheel-zoom math, drag-rect computation, per-scale-type zoom/pan
   functions) directly, with a fully mocked `chart`/`ctx`/DOM event
   objects — expect this tier to be substantially larger than
   `imageLabelPlugin.spec.ts`'s own 5 tests, given the real scope
   difference above.
6. **`stryker.config.mjs`**: add `src/zoomPlugin.ts` to `mutate`,
   matching `imageLabelPlugin.ts`'s own addition.
7. **Vue component tests**: `Chart.spec.ts`'s existing `zoom` prop tests
   (boolean/config-object form) need re-checking against the new
   `{ options, plugin }` return shape, the same way `imageLabel`'s own
   tests were added — not a full rewrite, since the prop's own public
   contract (`zoom?: ZoomPluginOptions | boolean`) doesn't change.
8. **e2e**: the existing `zoom-plugin.spec.ts`/`zoom-plugin-fixture.ts`
   already exercise real wheel/drag interaction against the *dependency*
   version — re-run against the ported version to confirm behavioral
   parity for whatever subset (wheel/drag) was ported. If touch/pinch is
   dropped (option 1/3), decide whether to keep, adjust, or remove any
   existing pinch-specific test expectations (need to check whether any
   exist first — not confirmed either way in this plan).
9. **`package.json`**: remove `chartjs-plugin-zoom` (and `hammerjs`, if
   option 1/3) from `packages/core/package.json`'s own `dependencies`.
10. **Docs**: same set `imageLabel`'s port touched —
    `docs/CHARTJS_ANALYSIS.md` §4 (new "Added after v1 kickoff" note, or
    an update to the existing zoom entry marking it "locally ported, not
    a dependency"), `docs/core/api/plugins.md`, `vue/api/plugins.md`
    (already stale for `imageLabel` too — worth fixing both gaps in the
    same pass), the `zoom-plugin.mdx` docs-site example page (likely
    flips to `live={true}` the same way `image-label-plugin.mdx` did,
    once confirmed live in a real browser — including the same class of
    real bugs that surfaced getting `image-label-plugin.mdx` live:
    missing slot content, `server.fs.allow`, sizing options — check for
    all three proactively this time rather than rediscovering them),
    and `docs/IMPLEMENTATION_PLAN.md`'s own "Current status & open
    issues" (a new numbered item, matching #16's own structure).

## Real risks/unknowns worth flagging before starting

- **Event-listener cleanup on destroy**: the real plugin's own `stop()`
  hook calls `removeListeners(chart)` — needs confirming this still gets
  called correctly by Chart.js's own plugin lifecycle when
  `controller.ts`'s `destroy()`/a type-change recreate tears down a
  chart instance. Likely fine (Chart.js calls every registered/supplied
  plugin's own `stop()` automatically on `chart.destroy()`), but not
  independently confirmed yet for the inline-plugin-array supply
  mechanism specifically (as opposed to `Chart.register()`-based
  plugins, which is what the original dependency used).
- **`chart.pan()`/`chart.zoom()`/etc. method attachment**: these are
  real, callable methods the plugin's own `start()` hook attaches
  directly onto the live Chart.js instance. Confirm this still works
  correctly when supplied via the inline `plugins` array rather than
  `Chart.register()` — expected to, since `start()` is a real Chart.js
  plugin hook regardless of registration mechanism, but genuinely
  unconfirmed until tried.
- **Per-scale-type math correctness**: the log-scale/category-scale
  zoom math is real, non-trivial numerical logic (not just event
  wiring) — deserves the same level of dedicated, direct unit testing
  `imageLabelPlugin.spec.ts` gave the position-math functions, not just
  wheel/drag event-flow tests.
