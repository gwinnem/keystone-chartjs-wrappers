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
| Annotations | `chartjs-plugin-annotation` (later locally ported, not a dependency — see below) | `^3.1.0` | Lines, boxes, points, labels, polygons, ellipses drawn on the chart area; works with line/bar/scatter/bubble charts. |
| Data labels | `chartjs-plugin-datalabels` (later locally ported, not a dependency — see below) | `^2.2.0` | Renders a label directly on each data element. |

These are chart-instance plugins (registered via `Chart.register()`, configured
under `options.plugins.<id>`), not chart *types* — they apply across whichever
kinds the consumer uses them with. The wrapper's job is to (a) make registering
them a one-line opt-in per framework, and (b) surface typed `options.plugins.*`
shapes for each, rather than leaving consumers to hand-type against the plugins'
own (often looser) option interfaces. Seven more were added after v1
kickoff (`gradient`/`timestack`/`hierarchical`/`image-label`/
`autocolors`/`deferred`/`trendline` — see their own sections below),
bringing the real total this project ships to 10.

### Zoom/pan — later locally ported, not a dependency

`chartjs-plugin-zoom` was part of the original v1 scope decision above, and
stayed a real npm dependency for most of this project's own history — see §6
below for the Hammer.js dependency concern flagged early on, and
`docs/ZOOM_PLUGIN_PORT_PLAN.md` for the full scope analysis written before
the port started.

Later ported directly into `packages/core/src/zoomPlugin.ts`, at your
explicit request, the same way `chartjs-plugin-gradient`/`chartjs-plugin-
image-label` were — it is not, and is no longer, a real npm dependency of
this project (`hammerjs` is gone too, as a direct consequence — see below).

This port originally dropped every Hammer.js-dependent code path —
pinch-zoom, and the gesture-driven pan interaction — keeping only what
was plain DOM event handling at the time: mouse-wheel zoom,
mouse-drag-to-zoom-rectangle (with Escape-to-cancel), and the full
programmatic API (`chart.zoom()`, `chart.zoomRect()`,
`chart.zoomScale()`, `chart.resetZoom()`, `chart.pan()`,
`chart.getZoomLevel()`, `chart.getInitialScaleBounds()`,
`chart.getZoomedScaleBounds()`, `chart.isZoomedOrPanned()`,
`chart.isZoomingOrPanning()`). Pinch-zoom and interactive pan were
later added back in, at your explicit request, reimplemented directly
on the standards-based Pointer Events API
(`pointerdown`/`pointermove`/`pointerup`/`pointercancel`), which
unifies mouse/touch/pen input with no external dependency at all.
`zoom.pinch.enabled` opts into two-finger pinch-zoom; `pan.enabled`
opts into single-finger/pen drag-to-pan, honoring `pan.threshold`/
`onPanStart`/`onPanRejected`/`onPanComplete`. Mouse input is
deliberately excluded from this pointer-event path: mouse users keep
wheel-zoom and drag-to-zoom-rectangle only, with `chart.pan()` still
callable programmatically. This resolves the Hammer.js
unmaintained-dependency concern §6 originally flagged, while keeping
the original's own real feature set intact via a maintained,
dependency-free replacement instead of a permanent feature cut.

The original plugin has no mouse-only drag-to-pan mechanism at all —
`pan()` is only ever invoked from Hammer's own `handlePan()` (driven by
`Hammer.Pan()`, which recognizes both touch *and* mouse-pointer drags
identically). This port's own pointer-event-based pan is touch/pen-only
for that reason — there was no separate "mouse-drag-to-pan" code path
in the original to reproduce for mouse users in the first place.

Genuinely distinct registration shape, same as `withGradient`/
`withImageLabel`'s own local ports: never passed to a global
`Chart.register(...)` call — supplied per-chart-instance via Chart.js's own
real inline `plugins` array instead. Unlike `gradient`/`imageLabel`, `zoom`
does have real plugin-level config of its own (`pan`/`zoom` sub-objects),
merged into `options.plugins.zoom` — so `withZoom`'s own boolean-or-config-
object opt-in shape is unchanged from before the port.

### Annotations — later locally ported, not a dependency

`chartjs-plugin-annotation` was part of the original v1 scope decision
above, and stayed a real npm dependency for most of this project's own
history, alongside `zoom`/`datalabels` — see `docs/ANNOTATION_PLUGIN_PORT_PLAN.md`
for the full scope analysis written before the port started (by far the
largest, most architecturally distinct plugin in this project: seven
real annotation *types*, each its own genuine Chart.js `Element`
subclass, not merely a plugin object drawing shapes on top of the chart).

Later ported directly into `packages/core/src/plugins/annotation/`
(17 real files — a top-level orchestrator, `annotationPlugin.ts`,
mirroring the original's own real `index.js`, plus 9 shared
foundational modules — `geometry.ts`, `drawing.ts`, `callout.ts`,
`labelGeometry.ts`, `boxProperties.ts`, `scaleRange.ts`, `interaction.ts`,
`events.ts`, `hooks.ts` — and 7 real element-class files under
`elements/` — `boxAnnotation.ts`, `ellipseAnnotation.ts`,
`pointAnnotation.ts`, `polygonAnnotation.ts`, `labelAnnotation.ts`,
`doughnutLabelAnnotation.ts`, `lineAnnotation.ts`), at your explicit
request, the same way every other locally-ported plugin in this project
was — it is not, and is no longer, a real npm dependency of this
project.

By far the largest and most architecturally distinct port in this
project: (1) each of the seven annotation types (`box`, `doughnutLabel`,
`ellipse`, `label`, `line`, `point`, `polygon`) registers as a genuine
Chart.js *element* (`Chart.register(annotationTypes)` inside this
port's own `afterRegister()` hook) — the same real mechanism Chart.js's
own built-in elements (`ArcElement`, `BarElement`, …) use; (2) option
resolution goes through a faithfully-reimplemented version of Chart.js's
own internal scriptable-option-resolution machinery
(`resolveObj`/`resolveAnnotationOptions`, per-type
`defaults`/`defaultRoutes`, a real `_fallback`/`_scriptable` descriptor
chain), not a simple "spread the given config" merge the way every
other locally-ported plugin in this project has needed; (3) annotations
automatically extend a scale's own min/max to fit values that would
otherwise fall outside it (`adjustScaleRange`, hooked into
`afterDataLimits`); (4) hit-testing (click/hover) routes entirely
through Chart.js's own `beforeEvent` hook and a real, dedicated
interaction-mode resolver (`nearest`/`point`/`x`/`y`, honoring
`options.interaction.intersect`), not raw DOM events the way `zoom`'s
own port needed.

Genuinely distinct registration shape from every other plugin ported
so far: registers directly via a real, synchronous
`Chart.register(annotationPlugin)` call for the orchestrator itself
(matching `withAutocolors`'s/`withDeferred`'s own mechanism), which in
turn registers all seven real element classes via its own
`afterRegister()` hook — a second, nested real `Chart.register(...)`
call no other port in this project needs, since no other port supplies
its own real Chart.js *elements*. Has real plugin-level config of its
own to merge into `options.plugins.annotation` (matching
`withDataLabels`'s own config-merging shape) — `annotation` remains a
config-object-required opt-in, the same as before the port.

Confirmed live in a real browser after the port: the same real
line/box/label annotations the docs-site example already demonstrated
against the *dependency* version, now rendering from local, static
code — one of `keystone-chartjs-core`'s ten plugin/scale examples that
renders live on the docs site rather than source-only.

### Data labels — later locally ported, not a dependency

`chartjs-plugin-datalabels` was part of the original v1 scope decision
above, and stayed a real npm dependency for most of this project's own
history, alongside `annotation`.

Later ported directly into `packages/core/src/plugins/dataLabels/`
(six real files — `utils.ts`, `positioners.ts`, `drawing.ts`, `label.ts`,
`layout.ts`, `dataLabelsPlugin.ts` — mirroring the original's own real
module split), at your explicit request — it is not, and is no
longer, a real npm dependency of this project.

Real features found only by reading the source, not fully apparent
from the README alone: (1) real overlap detection — `display: 'auto'`
labels auto-hide via a genuine Separating Axis Theorem hit-test against
every other visible label's own rotated bounding box; (2) real
`click`/`enter`/`leave` event listeners, dispatched via a genuine
hit-test against each label's own current position, not the underlying
data element's own hit area; (3) real active-element (hover)
integration — when Chart.js's own active-elements set changes, every
label on the affected element gets its own `context.active` flag
toggled (both directions, not just "entering") and re-resolved; (4)
real support for multiple, independently-configured labels per data
point (`options.labels`), each with its own real event listeners keyed
by label name.

The original's own real `dispatchEvent()` reads `listeners[$groups.set]`
(the dataset index) then `[$groups.key]` (the label key) — meaning the
chart-wide listener registry built up across every dataset's own
`afterDatasetUpdate` call needs *three* levels of nesting (event →
dataset index → label key), one level deeper than the per-dataset
listeners each dataset's own `configureDataset()`-equivalent resolves
(event → label key).

Genuinely distinct registration shape: registers directly and
synchronously via `Chart.register(dataLabelsPlugin)` (matching
`withAutocolors`'s/`withDeferred`'s own mechanism) AND merges real
plugin-level config of its own into `options.plugins.datalabels`
(matching `withAnnotation`'s own config-merging shape) — both `annotation`
and `dataLabels` are now locally ported, leaving no plugin in this
project still needing a real dynamic `import()` to register.

Confirmed live in a real browser after the port: a bar chart with a
real label rendered directly above each bar — one of nine of this
project's plugins/scales (alongside `zoom`, `annotation`, `gradient`,
`hierarchical`, `imageLabel`, `autocolors`, `deferred`, and `trendline`)
that renders live on the docs site rather than source-only.

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

Later ported directly into `packages/core/src/gradientPlugin.ts`, at
your explicit request, the same way `chartjs-plugin-image-label` was
(see that section below) — it is not, and is no longer, a real npm
dependency of this project. The original's own real logic (per-dataset
gradient computation, legend-swatch color application, sRGB-aware color
interpolation for radar/polar-style charts) was dissected directly from
the installed package's own dist file
(`node_modules/chartjs-plugin-gradient/dist/
chartjs-plugin-gradient.esm.js`) and carried over largely unchanged,
using `afterDestroy` for teardown (the real Chart.js `Plugin` lifecycle
hook for this).

Genuinely different shape from `withZoom`/`withAnnotation`/
`withDataLabels`: this plugin has no plugin-level config of its own to
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

Confirmed live in a real browser after the port: a real bar chart
with a genuine red→yellow→green vertical gradient per bar, correctly
varying by each bar's own height — one of nine of this project's
plugins/scales (alongside `imageLabel`, `zoom`, `annotation`,
`hierarchical`, `autocolors`, `deferred`, `trendline`, and `dataLabels`)
that renders live on the docs site rather than source-only.

### Added after v1 kickoff: Timestack

| Plugin | Package | Confirmed version | Purpose |
|---|---|---|---|
| Timestack | `chartjs-scale-timestack` | `^1.0.1` | Alternative time axis, formatting time in two stacked, human-friendly rows. |

Also added later, at your explicit request, after being surveyed in
`docs/CHARTJS_AWESOME_PLUGINS.md`. Verified the same way: current
version (1.0.1), MIT license, real Chart.js v4 compatibility confirmed
directly from its own `package.json` (`peerDependencies: { "chart.js":
">=4" }`), by jkmnt.

Genuinely different registration mechanism from every other plugin
here: confirmed directly from the real package's own README
(github.com/jkmnt/chartjs-scale-timestack) — there is no exported plugin
object to pass to `Chart.register(...)` at all. The package registers
its own `timestack` scale as a side effect of being imported
(`import 'chartjs-scale-timestack';`, with no further call needed).
Like `gradient`, the `timestack` opt-in prop is boolean-only — the
scale is used via the standard `options.scales.<id>.type = 'timestack'`
mechanism, which already reaches Chart.js untouched.

Real, hard runtime dependency worth flagging: this package requires
`luxon` (confirmed from its own README: "npm install luxon chartjs-
scale-timestack") for locale-aware time formatting — a real, sizeable
added dependency, not merely optional. Confirmed Luxon itself is
actively maintained (version 3.7.2, 2 maintainers, healthy release
cadence, no open unpatched CVEs at the time of this check).

### Added after v1 kickoff: Hierarchical (later locally ported, not a dependency)

| Plugin | Package surveyed | Confirmed version at time of dissection | Purpose |
|---|---|---|---|
| Hierarchical | `chartjs-plugin-hierarchical` | `^4.4.5` | Collapsible, tree-like categorical axis. |

Also added later, at your explicit request, after being surveyed in
`docs/CHARTJS_AWESOME_PLUGINS.md`. Verified the same way: current
version (4.4.5), MIT license, 267 kB, by sgratzl — the same maintainer
already behind `@sgratzl/chartjs-chart-boxplot` in §3 above. Confirmed a
legitimate, actively maintained fork of the now-archived
`chartjs-scale-hierarchical` (that original package's own npm listing
states "Package no longer supported... There is an active fork"
pointing to this exact package).

Later ported directly into `packages/core/src/hierarchicalScale.ts`, at
your explicit request, the same way `chartjs-plugin-zoom`/`chartjs-plugin-
gradient`/`chartjs-plugin-image-label` were — it is not, and is no longer,
a real npm dependency of this project. Unlike `chartjs-scale-
timestack` (a hard, real `luxon` dependency), this package has zero
runtime dependencies of its own, confirmed directly from its own
`package.json` (`peerDependencies: { "chart.js": "^4.1.0" }`, nothing
else).

Two things bundled into one package, ported here as one cohesive
file: a real `CategoryScale` subclass (`HierarchicalScale`, its own
custom pixel/value mapping so nested tree levels get progressively
tighter spacing) plus a companion drawing/interaction plugin, dissected
directly from the installed package's own real TypeScript source
(`node_modules/chartjs-plugin-hierarchical/src/{model,utils}.ts` and
`src/{scale,plugin}/hierarchical.ts`, not the minified/bundled build
output — the package ships its own real `.ts` sources). `Chart.register(
HierarchicalScale)` alone registers both: the scale's own real, static
`afterRegister()` hook calls `registry.addPlugins(hierarchicalPlugin)`
itself, matching the original's own identical registration mechanism
exactly, just called directly and synchronously now instead of after a
dynamic `import()`.

The companion plugin draws its own expand/collapse/focus indicator
boxes directly below (or beside) the axis's own real edge, but never
participates in Chart.js's own layout/padding calculation to reserve
space for them — without a consumer manually adding enough
`layout.padding` themselves, those indicator boxes are drawn past the
canvas's own visible edge, invisible and unclickable. This matches the
original package's own real, identical behavior. See the
[Hierarchical scale example](/vue/examples/hierarchical-scale)'s own
`layout.padding.bottom` for the required consumer-side workaround.

This project's own `timestack-scale.vue` docs example needs an
`as unknown as ChartConfiguration['options']` cast to write
`type: 'timestack'`, since that third-party package's own module
augmentation is never statically imported anywhere in that file's own
compile graph (only a dynamic `import()` at runtime). Because
`hierarchicalScale.ts` is statically imported by every real consumer of
`keystone-chartjs-core` already, its own identical `declare module
'chart.js'` augmentation (`CartesianScaleTypeRegistry`,
`ControllerDatasetOptions.tree`) is picked up automatically — no cast
needed to write `options.scales.x.type = 'hierarchical'` in the docs
example.

Real, distinct tree-node data shape: confirmed directly from the
real package's own type declarations, dissected into this project's own
`HierarchicalRawLabelNode`/`HierarchicalValueNode` types (exported from
`keystone-chartjs-core`) — `data.labels`/`dataset.data` need this tree
structure (`{ label, children }` / `{ value, children }`), not the flat
arrays every other kind or plugin in this project accepts.

Confirmed live in a real browser after the port, including the real
click-to-expand/collapse/zoom-in/zoom-out interaction — one of nine of
this project's plugins/scales (alongside `zoom`, `annotation`,
`gradient`, `imageLabel`, `autocolors`, `deferred`, `trendline`, and
`dataLabels`) that renders live on the docs site rather than
source-only.

### Added after v1 kickoff: Image label (locally ported, not a dependency)

| Plugin | Package surveyed | Confirmed version at time of dissection | Purpose |
|---|---|---|---|
| Image label | `chartjs-plugin-image-label` | `1.0.10` | Draws an image (e.g. a logo/avatar) on each doughnut/pie slice. |

Also added later, at your explicit request, after being surveyed in
`docs/CHARTJS_AWESOME_PLUGINS.md`. Rather than adding this as a real npm
dependency, its own real, published source
(`node_modules/chartjs-plugin-image-label/dist/chartjs-plugin-image-
label.es.js`, v1.0.10, MIT, by Yunus Emre Kara) was dissected and ported
directly into `packages/core/src/imageLabelPlugin.ts`, at your explicit
request — it is not, and has never been, a dependency of this project.
Draws labels for every dataset on a multi-dataset doughnut, and
positions each image using Chart.js's own already-computed
`startAngle`/`endAngle`/`innerRadius`/`outerRadius` arc geometry rather
than recomputing slice angles from raw values — so image placement
stays correct under any `rotation`/`circumference` option.

Confirmed live in a real browser: this, `annotation`, `gradient`,
`zoom`, `hierarchical`, `autocolors`, `deferred`, `trendline`, and
`dataLabels` are nine of the ten plugin/scale examples on the docs site
that render live rather than source-only.

Genuinely distinct registration shape, same as `withGradient`'s and
`withZoom`'s own local ports — different from `withTimestack`/
`withHierarchical`: never passed to a global `Chart.register(...)` call.
Unlike `withTimestack`/`withHierarchical`, it's also never a real
module import at all — the plugin object (`imageLabelPlugin` in
`imageLabelPlugin.ts`) is a plain, local, statically-defined value,
supplied per-chart-instance via Chart.js's own real inline `plugins`
array (the same mechanism this project's own `plugins` prop already
exposes for custom/community plugins). `imagesList` is required — no
plain-boolean opt-in form, matching `annotation`'s own reasoning.
Doughnut/pie charts only.

### Added after v1 kickoff: Autocolors (later locally ported, not a dependency)

| Plugin | Package surveyed | Confirmed version at time of dissection | Purpose |
|---|---|---|---|
| Autocolors | `chartjs-plugin-autocolors` | `0.3.1` | Automatically assigns a distinct generated color to each dataset (or data point) that doesn't already have one set. |

Also added later, at your explicit request, after being surveyed in
`docs/CHARTJS_AWESOME_PLUGINS.md`. Verified the same way: current
version (0.3.1), MIT license, by Jukka Kurkela — the same maintainer
already behind `gradient`/`zoom` (before those two were also ported)
and 3 of the 5 chart-type extensions in §3 above. Confirmed real
Chart.js v4 compatibility directly from the real package's own README
("This plugin requires Chart.js 3.0.0 or later"), unlike `colorschemes`/
`style` — two other "Styling" candidates surveyed in the same document,
both confirmed genuinely Chart.js-v2-era with no verified v4-compatible
official release (`chartjs-plugin-colorschemes`'s own real, installed
`package.json` pins `peerDependencies: { "chart.js": ">= 2.5.0 < 3" }`
directly), so neither was implemented alongside this one.

Later ported directly into `packages/core/src/autocolorsPlugin.ts`,
at your explicit request, the same way `chartjs-plugin-zoom`/`chartjs-
plugin-gradient`/`chartjs-plugin-image-label` were — it is not, and is
no longer, a real npm dependency of this project. The original's own
real logic imports two small color-conversion utility functions
(`hsv2rgb`, `rgbString`) from a separate package, `@kurkle/color` — a
real, declared `peerDependency` of the original, not bundled into its
own dist output. Chart.js itself already depends on this exact package
for its own internal color handling, so it's already present in
`node_modules` for any real consumer of this project regardless — but
deliberately not imported directly here anyway, since doing so would
mean importing an undeclared transitive dependency under pnpm's own
strict, non-flat `node_modules` layout this monorepo already uses.
Instead, both small functions are reimplemented locally: both are
textbook, standard color-space-conversion algorithms with one
universally agreed-upon definition, not any bespoke logic of the
plugin's own. Every real piece of the plugin's own actual color-
*selection* logic (the golden-ratio-style hue-stepping generator, the
`dataset`/`data`/`label` mode branching, the "don't overwrite an
already-set color" merge behavior, `customize`/`offset`/`repeat`
config handling) is carried over unchanged.

Genuinely distinct registration shape from every other local port so
far: the only one that both (a) registers directly via a real,
synchronous `Chart.register(...)` call (matching `withHierarchical`'s
own mechanism) AND (b) has real plugin-level config of its own to merge
into `options.plugins.autocolors` (matching `withAnnotation`/
`withDataLabels`'s own config-merging shape) — `withHierarchical` has
no config to merge (a scale, not a plugin with options); `withAnnotation`
is also now locally ported, registering the same real, synchronous way.

Confirmed live in a real browser after the port: three datasets on
a line chart, each automatically assigned a distinct, generated color
with no `backgroundColor`/`borderColor` set on any of them — one of
nine of this project's plugins/scales (alongside `zoom`, `annotation`,
`gradient`, `hierarchical`, `imageLabel`, `deferred`, `trendline`, and
`dataLabels`) that renders live on the docs site rather than
source-only.

### Added after v1 kickoff: Deferred (later locally ported, not a dependency)

| Plugin | Package surveyed | Confirmed version at time of dissection | Purpose |
|---|---|---|---|
| Deferred | `chartjs-plugin-deferred` | `2.0.0` | Defers a chart's own real initial update (and its initial-render animations) until the canvas actually scrolls into the viewport. |

Also added later, at your explicit request, after being surveyed in
`docs/CHARTJS_AWESOME_PLUGINS.md`. Verified the same way: current
version (2.0.0), MIT license, by the official Chart.js team
(simonbrunel) — the same organization behind `annotation`/`datalabels`
in the original v1 scope above.

Later ported directly into `packages/core/src/plugins/deferred/
deferredPlugin.ts`, at your explicit request, the same way `chartjs-plugin-zoom`/`chartjs-
plugin-gradient`/`chartjs-plugin-image-label`/`chartjs-plugin-
hierarchical`/`chartjs-plugin-autocolors` were — it is not, and is no
longer, a real npm dependency of this project. The package ships real,
readable source (`node_modules/chartjs-plugin-deferred/src/plugin.js`,
not just a minified bundle), which was dissected and carried over
largely unchanged, using `afterDestroy` for teardown (the real Chart.js
`Plugin` lifecycle hook for this) to remove its own `scroll` event
listener(s) and clear its per-chart bookkeeping.

This plugin is scroll-event-based, not `IntersectionObserver`-based —
it walks up from the canvas's own `parentElement` chain looking for the
nearest scrollable ancestor (`overflow-x`/`overflow-y` of
`auto`/`scroll`), falling back to the whole `document` if none is
found, and listens for a real `scroll` event there, checking the
canvas's own `getBoundingClientRect()` against the viewport on every
scroll (throttled via `requestAnimationFrame`, or `delay` ms via
`setTimeout` if configured).

This port stores its own per-chart/per-element bookkeeping in two
module-level `WeakMap`s (keyed by the real chart/element object, with
entries garbage-collected automatically once the chart/element itself
is), rather than the original's own ad-hoc properties monkey-patched
directly onto the chart instance and DOM elements themselves
(`chart.$deferred`, `element.$chartjs_deferred`).

Real config defaults, confirmed directly from the installed source's
own `defaults` object, not the README's own example values (which
show `xOffset: 150, yOffset: '50%', delay: 500` as illustrative
numbers, not the plugin's own real shipped defaults): `{ xOffset: 0,
yOffset: 0, delay: 0 }` — meaning with no config at all, the chart
defers its first real update until *any* part of the canvas is inside
the viewport, with no extra delay. Accepts either `true` (apply with
the real defaults) or a config object, the same boolean-or-config-
object shape as `zoom`/`dataLabels`/`autocolors`.

Genuinely distinct registration shape from every other local port so
far, matching `withAutocolors`'s own shape exactly: registers
directly via a real, synchronous `Chart.register(...)` call (matching
`withHierarchical`'s own mechanism) AND has real plugin-level config of
its own to merge into `options.plugins.deferred` (matching
`withAnnotation`/`withDataLabels`'s own config-merging shape).

Confirmed live in a real browser after the port: a Playwright e2e
test starting the canvas below the fold (via a tall spacer element),
confirming it scrolls into view and renders real, non-blank pixels
once a real `scroll` event and the configured delay elapse — one of
nine of this project's plugins/scales (alongside `zoom`, `annotation`,
`gradient`, `hierarchical`, `imageLabel`, `autocolors`, `trendline`, and
`dataLabels`) that renders live on the docs site rather than
source-only.

### Added after v1 kickoff: Trendline (later locally ported, not a dependency)

| Plugin | Package surveyed | Confirmed version at time of dissection | Purpose |
|---|---|---|---|
| Trendline | `chartjs-plugin-trendline` | `3.2.12` | Fits and draws a real linear or exponential trend line through each dataset's own data. |

Also added later, at your explicit request, after being surveyed in
`docs/CHARTJS_AWESOME_PLUGINS.md` and fully scoped ahead of time in
`docs/TRENDLINE_PLUGIN_PLAN.md`. Verified the same way: current version
(3.2.12), MIT license, by Marcus Alsterfjord, real Chart.js v4
compatibility confirmed directly from the package's own README ("Made
for Chart.js > 4.0", tested against real Chart.js 4.4.9/4.5.0 in its
own published examples), zero runtime dependencies of its own
(confirmed directly from its own installed `package.json`).

Ported at your explicit request, specifically so
`keystone-chartjs-core` depends on nothing but `chart.js` itself —
with `annotation` also later ported (see above), this project's core
package carries zero real npm dependencies of its own beyond `chart.js`.

Later ported directly into `packages/core/src/plugins/trendline/`
(six real files — `fitters.ts`, `drawing.ts`, `label.ts`,
`accessibility.ts`, `trendlineCore.ts`, `trendlinePlugin.ts` — mirroring
the original's own real module split), at your explicit request — it
is not, and is no longer, a real npm dependency of this project. The
package ships real, readable source of its own
(`src/core/plugin.js`, `src/components/{trendline,label}.js`,
`src/utils/{baseFitter,lineFitter,exponentialFitter,drawing,
accessibility}.js`, not just a minified bundle), which was dissected
and carried over largely unchanged.

Real, undocumented features found only by reading the source —
neither the real package's own README nor its `MIGRATION.md` mentions
any of these: (1) `fillColor` on the trendline config, filling the
area between the trendline and the chart's own bottom edge; (2)
`dataset.order` — trendlines draw in ascending order, except order-`0`
datasets (Chart.js's own real default when unset), which draw *last*,
on top of every other trendline; (3) `dataset.alwaysShowTrendline` —
draws the trendline even when the dataset itself is currently hidden
via the legend; (4) a full automatic-ARIA-label system, generating a
real, descriptive `aria-label` for the chart canvas from each dataset's
own trendline config (customizable per dataset via
`accessibility.description`/`.label`); (5) real legend integration — a
`legend` sub-config on the trendline adds a real, additional legend
entry for it, via a direct patch of the chart's own real
`legend.options.labels.generateLabels`, additive to whatever Chart.js
itself already generates.

The original's own `ExponentialFitter` also tracks every real data
point and computes an R-squared `correlation()` from them, and
`generateTrendlineDescription` (a second, separate accessibility
function the original also exports) — neither is ever called by
anything in the original's own real `plugin.js`/`trendline.js`/
`label.js`. Neither was ported, to avoid carrying over dead weight
(and, for `correlation()` specifically, a real unused-state violation
under this project's own strict TypeScript config).

Genuinely distinct registration shape: like `withAnnotation`/
`withDataLabels` before this port, needs a real `Chart.register(...)`
call (confirmed directly from the real package's own README:
"Chart.register(ChartJSTrendline)") — now direct and synchronous, no
dynamic `import()` at all, matching `withAutocolors`'s/`withDeferred`'s
own mechanism. Like `gradient`, there is no plugin-level config of its
own to merge into `options.plugins.trendline` at all — its real config
lives on each *dataset* instead (`dataset.trendlineLinear`/`dataset.
trendlineExponential`), which already reaches Chart.js untouched via
this project's own `data` passthrough. `trendline` is therefore
boolean-only.

Confirmed live in a real browser after the port: a line chart with
a genuine upward trend in its data, a real `trendlineLinear` config
fitting a visibly distinct dotted red line against it — one of nine of
this project's plugins/scales (alongside `zoom`, `annotation`,
`gradient`, `hierarchical`, `imageLabel`, `autocolors`, `deferred`, and
`dataLabels`) that renders live on the docs site rather than
source-only.

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
  unmaintained for years. `chartjs-plugin-
  zoom` was later ported locally into `packages/core/src/zoomPlugin.ts` (see
  §4 above), dropping Hammer.js itself entirely — `hammerjs` and
  `@types/hammerjs` are no longer dependencies of this project at all,
  transitively or otherwise. Pinch-zoom and interactive pan, which the
  original drove through Hammer.js, were not left as a permanent
  feature cut: both were later reimplemented directly on the standards-
  based Pointer Events API instead, with no external dependency of any
  kind.
