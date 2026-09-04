# Chart.js Coverage Analysis

Source: https://www.chartjs.org/ and its docs (fetched during scoping, Sept 2026).
Version pins below were verified via npm/GitHub on Sept 2026 (see §3–4, §6) —
this document is the factual basis for `IMPLEMENTATION_PLAN.md` and for the
version numbers each package's `package.json` should carry; it inventories
what Chart.js (and its ecosystem) actually provides, so the plan's phases map
to real controllers/plugins rather than assumption.

## 1. Chart.js itself

- Current stable: **4.5.1** — confirmed via npm (`npm view chart.js version`
  equivalent search), matching what `keystone-grid` already depends on and
  what every package.json in this repo already pins (`^4.5.1`). No action
  needed.
- Renders to `<canvas>` (not SVG) — performant for large datasets, but means no
  DOM-based styling of individual chart elements; all styling goes through the
  Chart.js config object.
- Ships built-in TypeScript typings — the core package can build its `ChartKind`
  union and config types directly against `chart.js`'s own types rather than
  hand-rolling them.
- Tree-shakeable: importing `Chart` and calling `Chart.register(...)` with only
  the controllers/elements/scales/plugins actually used keeps bundles small.
  This is the reason the core's `CHART_TYPE_REGISTRY` design registers lazily
  (on first use of a given `type`) rather than eagerly registering every
  built-in and every extension on import.

## 2. Built-in chart types (8) — no extra package required

| Kind | Controller | Notes |
|---|---|---|
| `bar` | `BarController` | Horizontal via `indexAxis: 'y'`, not a separate kind. |
| `line` | `LineController` | Area charts are a `line` (or `radar`) dataset with `fill` set — not a distinct controller. |
| `bubble` | `BubbleController` | 3-value datapoints (x, y, r). |
| `scatter` | `ScatterController` | Effectively a `line` controller with `showLine: false`. |
| `doughnut` | `DoughnutController` | Shares a controller family with `pie` (`cutout: 0` = pie). |
| `pie` | `PieController` | See above. |
| `polarArea` | `PolarAreaController` | |
| `radar` | `RadarController` | |

Two compositional features ride on top of these rather than adding new kinds:
- **Mixed charts** — each *dataset* sets its own `type` (e.g. bar + line on one
  canvas). The wrapper's `type` prop covers the chart-level default; per-dataset
  overrides need to pass through in `data.datasets[].type`, which the current
  `Chart.vue` / `Chart.tsx` / `KeystoneChartComponent` placeholders don't yet
  special-case — flagged in the implementation plan's Phase 2 acceptance
  criteria.
- **Area charts** — no `area` kind exists; it's `line`/`radar` + `fill`.

## 3. Ecosystem extensions in scope for v1 (verified current versions)

| Kind(s) | Package | Confirmed version | Chart.js compat | Maintenance | Registration |
|---|---|---|---|---|---|
| `candlestick`, `ohlc` | `chartjs-chart-financial` | `^0.2.1` | `^4.0.0` (peer) | Low-frequency (last release ~5 months ago at check time); flagged "inactive" by dependency scanners, but its most recent release was specifically a Chart.js v4 upgrade, and it has no known v4-breaking issues | Lazy, on first `type="candlestick"`/`"ohlc"` |
| `boxplot`, `violin` | `@sgratzl/chartjs-chart-boxplot` | `^4.4.5` | v3–v4 | Actively maintained (release ~2 months old at check time); this is the maintained fork — the original `chartjs-chart-box-and-violin-plot` is archived and points here | Lazy |
| `matrix` | `chartjs-chart-matrix` | `^3.0.5` | v3.7+, v4+ | Actively maintained by `kurkle` (a core Chart.js maintainer); release ~1 month old at check time | Lazy |
| `sankey` | `chartjs-chart-sankey` | `^0.15.0` | Modern Chart.js (no IE11) | Actively maintained by `kurkle`; release ~3 weeks old at check time | Lazy |
| `treemap` | `chartjs-chart-treemap` | `^4.2.0` | v3.8+, v4+ | Actively maintained by `kurkle`; release ~1 week old at check time | Lazy |

Each is a separate npm dependency, not bundled into `chart.js` core — the
`CHART_TYPE_REGISTRY` map in `packages/core/src/registry.ts` already encodes
which package backs which kind. **Action for Phase 1 build-out:** update the
placeholder version ranges in `packages/vue|react|angular/package.json` (and
`packages/core/package.json`, once it depends on these directly) to the
confirmed versions above. Three of the five (matrix, sankey, treemap) share a
single maintainer (`kurkle`) — worth knowing as a concentration-of-maintenance
risk, though all three are presently active.

## 4. Official interaction plugins in scope for v1 (verified current versions)

| Plugin | Package | Confirmed version | Purpose |
|---|---|---|---|
| Zoom/pan | `chartjs-plugin-zoom` (later locally ported, not a dependency — see below) | `2.2.0` | Mouse-wheel/pinch zoom, drag pan. |
| Annotations | `chartjs-plugin-annotation` | `^3.1.0` | Lines, boxes, points, labels, polygons, ellipses drawn on the chart area; works with line/bar/scatter/bubble charts. |
| Data labels | `chartjs-plugin-datalabels` | `^2.2.0` | Renders a label directly on each data element. |

These are chart-instance plugins (registered via `Chart.register()`, configured
under `options.plugins.<id>`), not chart *types* — they apply across whichever
kinds the consumer uses them with. The wrapper's job is to (a) make registering
them a one-line opt-in per framework, and (b) surface typed `options.plugins.*`
shapes for each, rather than leaving consumers to hand-type against the plugins'
own (often looser) option interfaces.

### Zoom/pan — later locally ported, not a dependency

`chartjs-plugin-zoom` was part of the original v1 scope decision above, and
stayed a real npm dependency for most of this project's own history — see §6
below for the Hammer.js dependency concern flagged early on, and
`docs/ZOOM_PLUGIN_PORT_PLAN.md` for the full scope analysis written before
the port started.

**Later ported directly into `packages/core/src/zoomPlugin.ts`, at your
explicit request, the same way `chartjs-plugin-gradient`/`chartjs-plugin-
image-label` were** — it is not, and is no longer, a real npm dependency of
this project (`hammerjs` is gone too, as a direct consequence — see below).

**A real, deliberate scope decision, made explicitly rather than
silently, later revisited**: this port originally dropped every
Hammer.js-dependent code path — pinch-zoom, and the gesture-driven pan
interaction — keeping only what was plain DOM event handling at the
time: mouse-wheel zoom, mouse-drag-to-zoom-rectangle (with
Escape-to-cancel), and the full programmatic API (`chart.zoom()`,
`chart.zoomRect()`, `chart.zoomScale()`, `chart.resetZoom()`,
`chart.pan()`, `chart.getZoomLevel()`, `chart.getInitialScaleBounds()`,
`chart.getZoomedScaleBounds()`, `chart.isZoomedOrPanned()`,
`chart.isZoomingOrPanning()`). **Pinch-zoom and interactive pan were
later added back in, at your explicit request, reimplemented directly
on the standards-based Pointer Events API
(`pointerdown`/`pointermove`/`pointerup`/`pointercancel`)** — which
unifies mouse/touch/pen input with no external dependency at all —
rather than staying dropped. `zoom.pinch.enabled` opts into two-finger
pinch-zoom; `pan.enabled` opts into single-finger/pen drag-to-pan,
honoring `pan.threshold`/`onPanStart`/`onPanRejected`/`onPanComplete`
(previously dead configuration with no gesture to apply to — now
genuinely functional). Mouse input is deliberately excluded from this
pointer-event path: mouse users keep wheel-zoom and drag-to-zoom-
rectangle only, with `chart.pan()` still callable programmatically.
This resolves the exact Hammer.js unmaintained-dependency concern §6
originally flagged as an open question — it's no longer open — while
keeping the original's own real feature set intact via a maintained,
dependency-free replacement instead of a permanent feature cut.

**A real, honest finding from dissecting the original source, not
assumed from the port plan's own earlier (slightly imprecise)
summary**: the original plugin has no mouse-only drag-to-pan mechanism
at all — `pan()` is only ever invoked from Hammer's own `handlePan()`
(driven by `Hammer.Pan()`, which recognizes both touch *and*
mouse-pointer drags identically). This port's own pointer-event-based
pan is touch/pen-only for that reason, not an arbitrary new
limitation — there was no separate "mouse-drag-to-pan" code path in the
original to reproduce for mouse users in the first place.

**Two real bugs found and fixed in the port itself, not the original
package** — confirmed via failing tests during the port, not assumed: (1) an
earlier draft used `enabledScales.length ? enabledScales :
liveScales(chart)` to mirror the original's own `enabledScales ||
chart.scales` — but an empty array is truthy in JavaScript, so the original
never actually falls back at all; the `.length`-based version zoomed every
scale whenever none matched the enabled directions, instead of zooming none.
(2) an earlier draft coerced a genuinely-possibly-`undefined` pixel-to-value
result to `NaN` for type-safety reasons, which silently made the original's
own real `logarithmicZoomRange` early-return branch (for an out-of-range
pixel) permanently unreachable.

**Genuinely distinct registration shape, same as `withGradient`/
`withImageLabel`'s own local ports**: never passed to a global
`Chart.register(...)` call — supplied per-chart-instance via Chart.js's own
real inline `plugins` array instead. Unlike `gradient`/`imageLabel`, `zoom`
does have real plugin-level config of its own (`pan`/`zoom` sub-objects),
merged into `options.plugins.zoom` — so `withZoom`'s own boolean-or-config-
object opt-in shape is unchanged from before the port.

**Full verification via 93+ dedicated unit tests**, each exercising real DOM
event dispatch (`mousedown`/`mousemove`/`mouseup`/`wheel`/`keydown`/
`pointerdown`/`pointermove`/`pointerup`) against a real jsdom `<canvas>`
element, achieving 100% statement and 97%+ branch coverage on the ported
file — confirmed via a real `test:coverage` run, not assumed. One
genuinely untestable gap, documented in code rather than forced: jsdom
has no `setPointerCapture` on `Element.prototype` at all, so the "real
capture happens" branch of that optional-chained call can only ever be
exercised in a real browser.

### Added after v1 kickoff: Gradient (later locally ported, not a dependency)

| Plugin | Package surveyed | Confirmed version at time of dissection | Purpose |
|---|---|---|---|
| Gradient | `chartjs-plugin-gradient` | `0.6.1` | Per-dataset color gradients, keyed by axis position (`axis: 'y'`/`'x'`). |

Not part of the original v1 scope decision above — added later, at your
explicit request, after being surveyed in `docs/CHARTJS_AWESOME_PLUGINS.md`.
Originally verified and added the same way as the 3 plugins above: MIT
license, real Chart.js v4 compatibility confirmed directly from the
package's own release notes ("v0.6.0: Add compatibility to Chart.js
version 4"), maintained by Jukka Kurkela — the same person who maintains
Chart.js core itself, and 3 of the 5 extension packages in §3.

**Later ported directly into `packages/core/src/gradientPlugin.ts`, at
your explicit request, the same way `chartjs-plugin-image-label` was
(see that section below)** — it is not, and is no longer, a real npm
dependency of this project. Confirmed a faithful port, not a
reimplementation from scratch: the original's own real logic (per-dataset
gradient computation, legend-swatch color application, sRGB-aware color
interpolation for radar/polar-style charts) was dissected directly from
the installed package's own dist file
(`node_modules/chartjs-plugin-gradient/dist/
chartjs-plugin-gradient.esm.js`) and carried over largely unchanged.

**One real bug found and fixed during the port**: the original names
its teardown hook `destroy`, but Chart.js's own real `Plugin` interface
has no such hook at all — confirmed directly against `chart.js`'s own
installed type declarations (`dist/types/index.d.ts`). The real
lifecycle hooks for chart teardown are `beforeDestroy`/`afterDestroy`;
a hook name Chart.js's own plugin system doesn't recognize is simply
never invoked, so the original's own `destroy` handler — whose only job
is deleting this plugin's own per-chart state entry — likely never
actually ran in real Chart.js, silently leaking one entry per destroyed
chart for as long as the plugin's own module stayed loaded. Renamed to
`afterDestroy` in the port, the correct real hook name.

**Genuinely different shape from `withZoom`/`withAnnotation`/
`withDataLabels`**: this plugin has no plugin-level config of its own to
merge into `options.plugins.gradient` — confirmed directly from the
original package's own README (github.com/kurkle/chartjs-plugin-
gradient). Its real config lives on each *dataset* instead
(`dataset.gradient = { backgroundColor: {...}, borderColor: {...} }`),
which already reaches Chart.js untouched via this project's own `data`
passthrough. This means the `gradient` opt-in prop is boolean-only
(no config to carry), unlike `zoom`/`dataLabels`
(boolean-or-config-object) or `annotation` (config-object required). As
of the port, it's also never passed to a global `Chart.register(...)`
call at all — supplied per-chart-instance via Chart.js's own real inline
`plugins` array instead, the same mechanism `imageLabel` uses.

**Confirmed live in a real browser after the port**: a real bar chart
with a genuine red→yellow→green vertical gradient per bar, correctly
varying by each bar's own height — one of three of this project's
plugins/scales (alongside `imageLabel` and, later, `zoom`) that renders
live on the docs site rather than source-only, for the identical reason:
local, static code has no dynamic `import()` for the docs-site hydration
gap (item #4 in `docs/IMPLEMENTATION_PLAN.md`) to apply to.

### Added after v1 kickoff: Timestack

| Plugin | Package | Confirmed version | Purpose |
|---|---|---|---|
| Timestack | `chartjs-scale-timestack` | `^1.0.1` | Alternative time axis, formatting time in two stacked, human-friendly rows. |

Also added later, at your explicit request, after being surveyed in
`docs/CHARTJS_AWESOME_PLUGINS.md`. Verified the same way: current
version (1.0.1), MIT license, real Chart.js v4 compatibility confirmed
directly from its own `package.json` (`peerDependencies: { "chart.js":
">=4" }`), by jkmnt.

**Genuinely different registration mechanism from every other plugin
here**: confirmed directly from the real package's own README
(github.com/jkmnt/chartjs-scale-timestack) — there is no exported plugin
object to pass to `Chart.register(...)` at all. The package registers
its own `timestack` scale as a side effect of being imported
(`import 'chartjs-scale-timestack';`, with no further call needed).
Like `gradient`, the `timestack` opt-in prop is boolean-only — the
scale is used via the standard `options.scales.<id>.type = 'timestack'`
mechanism, which already reaches Chart.js untouched.

**Real, hard runtime dependency worth flagging**: this package requires
`luxon` (confirmed from its own README: "npm install luxon chartjs-
scale-timestack") for locale-aware time formatting — a real, sizeable
added dependency, not merely optional. Confirmed Luxon itself is
actively maintained (version 3.7.2, 2 maintainers, healthy release
cadence, no open unpatched CVEs at the time of this check) — a real
dependency-weight cost, but not the same maintenance-risk concern
already flagged for `chartjs-plugin-zoom`'s own Hammer.js dependency in
§6 below.

### Added after v1 kickoff: Hierarchical

| Plugin | Package | Confirmed version | Purpose |
|---|---|---|---|
| Hierarchical | `chartjs-plugin-hierarchical` | `^4.4.5` | Collapsible, tree-like categorical axis. |

Also added later, at your explicit request, after being surveyed in
`docs/CHARTJS_AWESOME_PLUGINS.md`. Verified the same way: current
version (4.4.5), MIT license, 267 kB, by sgratzl — the same maintainer
already behind `@sgratzl/chartjs-chart-boxplot` in §3 above, a known,
trusted maintainer within this project already. Confirmed a legitimate,
actively maintained fork of the now-archived `chartjs-scale-hierarchical`
(that original package's own npm listing states "Package no longer
supported... There is an active fork" pointing to this exact package).

**A third, distinct registration shape**: confirmed directly from the
real package's own README (github.com/sgratzl/chartjs-plugin-
hierarchical) — its ESM build is genuinely tree-shakeable with no side
effects, so it needs `import { HierarchicalScale } from 'chartjs-
plugin-hierarchical'; Chart.register(HierarchicalScale);` — a real
named export requiring an explicit `Chart.register(...)` call, unlike
`gradient`'s default export or `timestack`'s side-effect-only import.
The `hierarchical` opt-in prop is still boolean-only like the other
two, though, since it has no plugin-level config of its own either.

**Real, distinct tree-node data shape**: confirmed directly from the
real package's own type declarations — `data.labels`/`dataset.data`
need this scale's own `ILabelNode`/`IValueNode` tree structure
(`{ label, children }` / `{ value, children }`), not the flat arrays
every other kind or plugin in this project accepts.

### Added after v1 kickoff: Image label (locally ported, not a dependency)

| Plugin | Package surveyed | Confirmed version at time of dissection | Purpose |
|---|---|---|---|
| Image label | `chartjs-plugin-image-label` | `1.0.10` | Draws an image (e.g. a logo/avatar) on each doughnut/pie slice. |

Also added later, at your explicit request, after being surveyed in
`docs/CHARTJS_AWESOME_PLUGINS.md`. **Genuinely different from every
other entry in this section**: rather than adding this as a real npm
dependency, its own real, published source
(`node_modules/chartjs-plugin-image-label/dist/chartjs-plugin-image-
label.es.js`, v1.0.10, MIT, by Yunus Emre Kara) was dissected and ported
directly into `packages/core/src/imageLabelPlugin.ts`, at your explicit
request — it is not, and has never been, a dependency of this project.

**Two real bugs in the original, fixed during the port rather than
carried over verbatim**: (1) the original only ever read
`chart.data.datasets[0].data`, silently drawing nothing for any
additional ring on a multi-dataset doughnut; the port iterates every
dataset. (2) the original recomputed each slice's angular span from raw
data values (`value / total * 2π`, always starting at a hardcoded
`-π/2`), which silently mispositioned images under any non-default
`rotation`/`circumference` option, since it never read Chart.js's own
computed state at all; the port reads each arc's own real, already-
computed `startAngle`/`endAngle`/`innerRadius`/`outerRadius` (confirmed
exact property names from `chart.js`'s own installed type declarations,
`dist/elements/element.arc.d.ts`) instead.

**Why this one, like `gradient`'s own later port, never hit the
docs-site dynamic-import hydration gap** (see "Current status & open
issues" item #4 in `docs/IMPLEMENTATION_PLAN.md`): that gap is
specifically about a dynamic `import()` of an external package failing
to resolve when the importing file is served from outside the docs
site's own project root. Because this plugin is local, static code with
no `import()` at all—exactly like the 8 built-in chart types—there is
nothing for that gap to apply to. Confirmed live in a real browser, not
assumed: this, `gradient`, and, later, `zoom` are the only three of the
seven plugin/scale examples on the docs site that render live rather
than source-only.

**Genuinely distinct registration shape, same as `withGradient`’s and
`withZoom`’s own local ports — different from `withTimestack`/
`withHierarchical`**:
never passed to a global `Chart.register(...)` call. Unlike
`withTimestack`/`withHierarchical`, it's also never a real module import
at all — the plugin object (`imageLabelPlugin` in `imageLabelPlugin.ts`)
is a plain, local, statically-defined value, supplied per-chart-instance
via Chart.js's own real inline `plugins` array (the same mechanism this
project's own `plugins` prop already exposes for custom/community
plugins). `imagesList` is required — no plain-boolean opt-in form,
matching `annotation`'s own reasoning. Doughnut/pie charts only.

## 5. What's explicitly out of scope for v1

- Chart types/plugins not listed above (e.g. `chartjs-plugin-streaming`,
  funnel/wordcloud community packages) — can be added the same way later via
  the same `CHART_TYPE_REGISTRY` pattern, but weren't part of the agreed v1
  scope.
- SSR/server-side chart rendering (`chart.js` + `canvas` package on Node) —
  not requested; the wrapper targets client-rendered `<canvas>` only.
- A themed default palette beyond what each framework example demonstrates —
  Chart.js already ships a built-in Colors plugin (zero-config default
  palette) as of v4; the wrapper should not fight that default silently.

## 6. Open questions — resolved

All items previously open here have been checked directly against npm/GitHub,
or resolved by a later decision:

- **Extension package versions** (§3) — verified and pinned above. No longer
  open; update the placeholder ranges in each package's `package.json`
  accordingly at the start of Phase 1/5.
- **`chartjs-plugin-zoom`'s Hammer.js dependency** — originally confirmed as
  a hard, non-optional runtime `dependency` in the plugin's own
  `package.json` (`hammerjs: ^2.0.8`, plus `@types/hammerjs`), not merely a
  peer or optional gesture-recognition add-on, with a real, open upstream
  issue (chartjs/chartjs-plugin-zoom#938) flagging Hammer.js itself as
  unmaintained for years. **Resolved, not just decided**: `chartjs-plugin-
  zoom` was later ported locally into `packages/core/src/zoomPlugin.ts` (see
  §4 above), dropping Hammer.js itself entirely — `hammerjs` and
  `@types/hammerjs` are no longer dependencies of this project at all,
  transitively or otherwise. Pinch-zoom and interactive pan, which the
  original drove through Hammer.js, were **not** left as a permanent
  feature cut: both were later reimplemented directly on the standards-
  based Pointer Events API instead, with no external dependency of any
  kind. The "minimal runtime dependencies" claim about `packages/core` no
  longer needs the scoping caveat this section originally called for.
