# DataLabels Plugin Local-Port Plan

Companion to `CHARTJS_ANALYSIS.md` §4 and `docs/ANNOTATION_PLUGIN_PORT_PLAN.md`
(the port plan whose structure this one follows). **Not yet started** —
written to capture the real scope/decisions found while scoping this
out, so the work can be picked up later without re-deriving any of it.

## Why this exists

At the user's explicit request: port `chartjs-plugin-datalabels`
directly into `packages/core/src/`, the same way `chartjs-plugin-zoom`/
`chartjs-plugin-gradient`/`chartjs-plugin-image-label`/`chartjs-plugin-
hierarchical`/`chartjs-plugin-autocolors`/`chartjs-plugin-deferred` were
— real source dissected from the actual package (confirmed real `src/`
files exist on GitHub — `src/plugin.js`, `src/label.js`,
`src/positioners.js`, `src/utils.js`, and at least one more file
handling label-collision lookups, not yet fully enumerated — see "Real
risks/unknowns" below), fixing any real bugs found along the way,
avoiding the docs-site dynamic-import hydration gap (item #4 in
`IMPLEMENTATION_PLAN.md`) since local code has no `import()` for that
gap to apply to.

## Scope comparison — bigger than every port so far except `annotation`

Real, confirmed facts pulled directly from the actual GitHub
repository and the real installed `dist` output (`packages/core/
node_modules/chartjs-plugin-datalabels/dist/chartjs-plugin-datalabels.esm.js`,
32 KB) before writing this plan — not guessed at:

| | `deferredPlugin.ts` (done) | `chartjs-plugin-datalabels` (this plan) |
|---|---|---|
| Real dist size | small (the original source itself is ~150 lines) | **32 KB** — bigger than `gradient`/`imageLabel`/`autocolors`, smaller than `zoom` (56 KB) or `annotation` (91 KB) |
| File count | 1 real source file | **at least 4 real files, confirmed from GitHub**: `src/plugin.js` (main orchestrator, lifecycle hooks), `src/label.js` (per-label geometry: bounding-rect computation, scale-origin resolution, drawing), `src/positioners.js` (per-Chart.js-element-type anchor-point resolution — arc/bar/point each need their own real positioning math), `src/utils.js` (shared helpers, including a `rasterize` function) — plus at least one more file handling label-collision/hover hit-testing (referenced as `layout.lookup(...)` in `plugin.js`, not yet confirmed by filename) |
| Registration mechanism | local `Chart.register(deferredPlugin)` (this project's own port) | **must be registered explicitly, the same as `annotation`** — confirmed directly from the real package's own docs: "Since version 1.x, this plugin no longer registers itself automatically" |
| Per-chart state | two module-level `WeakMap`s (this project's own port, replacing the original's ad-hoc properties) | **the original uses the identical ad-hoc-property pattern already improved once in this project**: a real, confirmed `chart[EXPANDO_KEY]` property attached directly to the live chart instance (holding `._labels`, `._listeners`, `._hovered`, `._dirty`), the same class of pattern this project's own `deferredPlugin.ts` port already replaced with module-level `WeakMap`s — a real, ready-made improvement to apply here too, not a new judgment call |
| Real interaction system | none (a visibility-only plugin) | **real `enter`/`leave`/`click` callbacks per label**, confirmed via `plugin.js`'s own `handleMoveEvents`/`dispatchMoveEvents`/`dispatchEvent` functions — hit-tests via a `layout.lookup(...)` call against the currently-laid-out label positions on `mousemove`/`mouseout`, dispatching `enter`/`leave` transitions and setting a `_dirty` flag to trigger a redraw. Simpler than `annotation`'s own per-type `inRange` geometry (one shared lookup mechanism, not one hit-test per element type), but still a real, non-trivial feature no simpler port (`gradient`, `imageLabel`, `autocolors`) has needed |
| Real positioning system | n/a | **distinct anchor-resolution math per Chart.js element type** — confirmed via `src/positioners.js`'s own existence and `label.js`'s own `getScaleOrigin()` (reading `context.chart.getDatasetMeta(...).vScale`, branching on whether the scale has a real `xCenter`/`yCenter` — i.e. a radial scale — versus a linear one via `getBasePixel()`). Arc elements (pie/doughnut/polarArea), bar elements, and point elements (line/radar/bubble/scatter) each need their own real positioner, not a single shared formula |
| Multiple labels per element | n/a | a real, documented feature (`options.plugins.datalabels.labels`, a dictionary of named sub-configs each merged over the chart/dataset-level config) — a genuine multiplicity this project's own `DataLabelsPluginOptions` type (currently `Record<string, unknown>`, deliberately loose) doesn't yet model precisely |
| External dependency | none | confirmed none — only a real `chart.js` peer dependency, the same as every plugin ported so far |

## Real, confirmed bug class already found twice — check for it here too

**Not yet confirmed present or absent** (unlike `annotation`'s
already-confirmed `destroy`-hook bug) — this plan flags it as the
**first, concrete thing to check** once `src/plugin.js` is read in
full: does this package also use a bare `destroy` hook name instead of
Chart.js's real `beforeDestroy`/`afterDestroy`? Both `gradientPlugin.ts`
and `deferredPlugin.ts`'s own ports found and fixed exactly this bug,
independently, in two unrelated packages by two different sets of
maintainers — worth checking as a standing habit for every future port
in this project, not assuming it's present just because it was found
twice before.

## Open decisions — need your call before implementation starts

1. **`DataLabelsPluginOptions` typing.** Currently deliberately loose
   (`Record<string, unknown>`, matching the "full plugin-specific
   typing is Phase 5 scope" pattern used for `annotation` too). The real
   `labels` sub-config dictionary (multiple named labels per element) is
   a genuine structural feature worth modeling precisely if this port
   also tackles typing — the same open question `annotation`'s own
   plan raised for `AnnotationPluginOptions`, not yet decided for either.
2. **Scope of the interaction system.** The real `enter`/`leave`/`click`
   callback support is a genuine feature, not incidental — worth
   confirming it's wanted (rather than silently ported) before writing
   `handleMoveEvents`-equivalent code, the same as `annotation`'s own
   plan flagged for its scale-range auto-adjustment behavior.

## Step-by-step plan (mirrors the annotation port plan's own multi-file structure)

1. **Dissect the real source in full** — this plan pulled partial,
   real content from `src/plugin.js` and `src/label.js` directly (via
   Code Climate's own source mirror, which reflects the real GitHub
   source) but has **not yet** read `src/positioners.js`/`src/utils.js`
   in full, nor confirmed the real filename of the label-collision/
   layout-lookup module referenced as `layout.lookup(...)` — that full
   read is real, required work before writing any port code, the same
   rigor every prior port used.
2. **New files, one per real file, not one giant file** — mirror the
   original's own real split, the same reasoning `annotation`'s own
   plan already applied: `packages/core/src/plugins/dataLabels/` with
   `plugin.ts` (orchestrator), `label.ts`, `positioners.ts`, `utils.ts`,
   and whichever real file handles layout/collision lookup once
   confirmed by step 1. A header comment on the orchestrator file
   should state the real source version ported from, whether the
   `destroy`-hook bug was found (per the section above), and the
   `EXPANDO_KEY`-to-`WeakMap` improvement made (matching every prior
   port's own header-comment convention).
3. **`types.ts`**: resolve open decision #1 above before writing this
   step for real.
4. **`plugins.ts`**: rewrite `withDataLabels` to register directly via
   a real, synchronous `Chart.register(...)` call (matching this
   project's own `withHierarchical`/`withAutocolors`/`withDeferred`
   registration shape) — no more dynamic `import()`/`mod.default ??
   mod` fallback. Config still merges into `options.plugins.datalabels`,
   unchanged from today's real shape.
5. **Core unit tests**: split per real file —
   `tests/unit/dataLabelsPlugin/{plugin,label,positioners,utils}.spec.ts`
   (plus whichever file step 1 confirms for layout/collision), each
   covering its own file's real logic directly, plus `plugins.spec.ts`'s
   own `withDataLabels` describe block updated for the new registration
   shape. Expect this tier to land between `hierarchicalScale.spec.ts`'s
   own 87 tests and `zoomPlugin.spec.ts`'s own 194, given the real scope
   comparison above (bigger than `hierarchical`'s single-scale-type
   math, smaller than `zoom`'s full DOM-event surface or `annotation`'s
   six real element types).
6. **`stryker.config.mjs`**: add every new file under
   `src/plugins/dataLabels/` to `mutate`.
7. **Vue component tests**: `Chart.spec.ts`'s existing `dataLabels`
   prop tests need re-checking against the new registration mechanism —
   the prop's own public contract (`dataLabels?: DataLabelsPluginOptions
   | boolean`) is unchanged.
8. **e2e**: the existing `data-labels-plugin.spec.ts`/fixture already
   exercise real rendering against the *dependency* version — re-run
   against the ported version to confirm parity, then flip
   `data-labels-plugin.mdx` from `live={false}` to `live={true}` once
   confirmed live in a real browser.
9. **`package.json`**: remove `chartjs-plugin-datalabels` from
   `packages/core/package.json`'s own `dependencies` once the port is
   confirmed working end-to-end. This would leave `annotation` (if not
   also ported by then) as the only remaining real dependency-based
   official plugin.
10. **Docs**: `CHARTJS_ANALYSIS.md` §4 (a new "Added after v1 kickoff:
    Data labels (later locally ported...)" section, matching every
    prior port's own section structure), `CHARTJS_AWESOME_PLUGINS.md`
    (update its own "still-dependency-based plugins" count),
    `docs/site/.../vue/api/plugins.md` (rewrite the "Data labels"
    section for the port, update every "one of N live plugins"
    cross-reference), `IMPLEMENTATION_PLAN.md` (a new numbered item),
    and the CHANGELOG/README files' own plugin lists and
    dependency-vs-port counts.

## Real risks/unknowns worth flagging before starting

- **The layout/collision-lookup file's real name and full logic aren't
  confirmed yet** — `plugin.js`'s own `handleMoveEvents` calls
  `layout.lookup(expando._labels, event)`, implying a real, separate
  `layout` module (likely `src/layout.js`, not yet directly read) that
  computes the actual laid-out label positions and supports point-based
  lookup against them — this is probably where the real overlap-
  avoidance/box-fitting logic the plugin is known for actually lives,
  and needs its own full read before this plan's own file-split (step 2
  above) can be considered final.
- **`getScaleOrigin()`'s own radial-vs-linear scale branching**
  (confirmed from the real `label.js` source pulled above) is a genuine
  Chart.js-internals-aware piece of logic — confirming it still behaves
  correctly against this project's own pinned Chart.js version needs
  real testing, not just a type-level check.
- **Given the real scope confirmed above, this port sits meaningfully
  between `hierarchical`/`gradient`-sized work and `annotation`-sized
  work** — a real, bounded effort, but still larger than every port
  this project has completed except `zoom` and (once done)
  `annotation`.
