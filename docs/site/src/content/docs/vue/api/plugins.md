---
title: Plugins
description: Official Chart.js plugins this package wires in as opt-in props.
---

| Plugin | Package | Purpose | Prop | Status |
|---|---|---|---|---|
| Zoom/pan | locally ported, not a dependency | Wheel-zoom, drag-to-zoom, pinch-zoom, touch/pen pan, plus a full programmatic API | `zoom` | Implemented |
| Annotations | `chartjs-plugin-annotation` | Lines, boxes, points, labels, polygons, ellipses drawn on the chart area | `annotation` | Implemented |
| Data labels | `chartjs-plugin-datalabels` | Renders a label directly on each data element | `dataLabels` | Implemented |
| Gradient | locally ported, not a dependency | Per-dataset color gradients, keyed by axis position | `gradient` | Implemented |
| Timestack | `chartjs-scale-timestack` | Alternative time axis, formatting time in two stacked, human-friendly rows | `timestack` | Implemented |
| Hierarchical | locally ported, not a dependency | Collapsible, tree-like categorical axis | `hierarchical` | Implemented |
| Image label | locally ported, not a dependency | Draws an image on each doughnut/pie slice | `imageLabel` | Implemented |
| Autocolors | locally ported, not a dependency | Automatically assigns a distinct color per dataset (or data point) | `autocolors` | Implemented |
| Deferred | locally ported, not a dependency | Defers the chart's own real initial update until the canvas scrolls into the viewport | `deferred` | Implemented |
| Trendline | locally ported, not a dependency | Fits a real linear or exponential trend line to each dataset | `trendline` | Implemented |

These are chart-instance plugins, not chart types — they apply across
whichever `type` you use them with. Each is a one-line opt-in prop on
`<Chart>` (see [Props](/vue/components/props)) rather than requiring a
manual `Chart.register()` call in consumer code — the two still-
dependency-based ones (`annotation`, `dataLabels`) are dynamically
imported and registered automatically, the first time the prop is used
(`zoom`/`gradient`/`imageLabel`/`autocolors`/`deferred`/`trendline` are
local code instead — see their own sections below).

`zoom`/`dataLabels` accept either `true` (apply with no extra config) or a
config object merged into `options.plugins.zoom`/`options.plugins.datalabels`
respectively. `annotation` has no boolean form — pass a real config object
with at least one entry under `annotations`.

```vue
<Chart type="line" :data="data" zoom dataLabels :annotation="{ annotations: { line1: { type: 'line', yMin: 50, yMax: 50 } } }" />
```

## Zoom/pan — a local port, not a dependency

`zoom` accepts either `true` or a config object merged into
`options.plugins.zoom`, same as before the port — its own config shape
is unchanged. What changed is where its logic lives: originally
`chartjs-plugin-zoom`, now ported directly into `keystone-chartjs-core`
(`src/plugins/zoom/zoomPlugin.ts`), never registered via `Chart.register(...)`,
supplied per-chart-instance via Chart.js's own inline `plugins` array
instead (the same mechanism `gradient`/`imageLabel` below use).

```vue
<Chart
  type="line"
  :data="data"
  :zoom="{
    zoom: { wheel: { enabled: true }, drag: { enabled: true }, pinch: { enabled: true } },
    pan: { enabled: true },
  }"
/>
```

**Hammer.js is gone, but pinch-zoom and interactive pan are not** — the
original drove both through Hammer.js, which is itself unmaintained
(confirmed via a real, open upstream issue). Rather than dropping these
two features along with that dependency, this port reimplements both
directly on the standards-based **Pointer Events API**
(`pointerdown`/`pointermove`/`pointerup`/`pointercancel`), which unifies
mouse/touch/pen input with no external dependency at all:

- **`zoom.pinch.enabled`** — two-finger pinch-zoom.
- **`pan.enabled`** — single-finger (or pen) drag-to-pan, honoring
  `pan.threshold` (minimum drag distance before a pan is recognized) and
  `pan.onPanStart`/`onPanRejected`/`onPanComplete` exactly as documented
  below.

**A real, honest limitation worth knowing precisely**: mouse input is
deliberately excluded from this pointer-event path entirely — mouse
users get wheel-zoom and drag-to-zoom-rectangle only, with `chart.pan()`
still callable *programmatically* (useful for a consumer's own custom
pan buttons, as the docs example below does) but no interactive
mouse-drag-to-pan gesture. This matches the original package's own real
mouse behavior, not a new limitation this port introduced: dissecting
the original's own source directly confirmed it never had a mouse-only
pan gesture either — `pan()` there was *only* ever invoked from
Hammer's own gesture recognizer, which handled touch and mouse-pointer
drags identically. There was no separate "mouse-drag-to-pan" code path
to port in the first place.

The full programmatic API is unaffected by any of this: `chart.zoom()`,
`chart.zoomRect()`, `chart.zoomScale()`, `chart.resetZoom()`,
`chart.pan()`, `chart.getZoomLevel()`, `chart.getInitialScaleBounds()`,
`chart.getZoomedScaleBounds()`, `chart.isZoomedOrPanned()`,
`chart.isZoomingOrPanning()` all work regardless of which interactive
features are enabled.

See the [Zoom plugin example](/vue/examples/zoom-plugin) for the full
version.

## Gradient — a local port, not a dependency, config lives on the dataset

Unlike `zoom`/`annotation`/`dataLabels`, `gradient` is **boolean only** —
it has no plugin-level config of its own to merge into
`options.plugins.gradient` at all. Its real config lives on each
**dataset** instead, which already reaches Chart.js untouched via the
existing `data` prop:

```vue
<Chart
  type="bar"
  gradient
  :data="{
    datasets: [{
      data: [20, 45, 70, 90, 60],
      gradient: {
        backgroundColor: { axis: 'y', colors: { 0: 'red', 50: 'yellow', 100: 'green' } },
      },
    }],
  }"
/>
```

Unlike `timestack`/`hierarchical` below, `gradient` isn't a dependency
on a third-party package at all — its logic (originally
`chartjs-plugin-gradient`) is ported directly into `keystone-chartjs-core`
(`src/plugins/gradient/gradientPlugin.ts`), never registered via `Chart.register(...)`,
supplied per-chart-instance via Chart.js's own inline `plugins` array
instead (the same mechanism `zoom`/`imageLabel` use). Being local code
rather than a dynamic import also means this is one of seven plugins on
this project's docs site (alongside `zoom`, `imageLabel`, `hierarchical`,
`autocolors`, `deferred`, and `trendline`) whose own example renders
genuinely live rather than source-only.

See the [Gradient plugin example](/vue/examples/gradient-plugin) for the
full version, and
[Colors, fonts & padding](/vue/guide/concepts/styling) for how this
compares to Chart.js's own built-in `Colors` plugin.

## Timestack — a real scale, not a Chart.js "plugin" object

`timestack` is also **boolean only**, for the identical reason as
`gradient` — confirmed directly from the real package's own README
(github.com/jkmnt/chartjs-scale-timestack): there is no exported plugin
object to pass to `Chart.register(...)` at all. The package registers
its own `timestack` **scale** as a side effect of being imported, and
has no plugin-level config of its own either — it's used via the
standard `options.scales.<id>.type = 'timestack'` mechanism, which
already reaches Chart.js untouched via the existing `options` prop:

```vue
<Chart
  type="line"
  timestack
  :data="{
    datasets: [{
      data: [{ x: 1735689600000, y: 1 }, { x: 1735693200000, y: 5 }],
    }],
  }"
  :options="{ scales: { x: { type: 'timestack' } } }"
/>
```

**Real, hard dependency on Luxon**: this package requires `luxon` for
locale-aware time formatting — a real, sizeable added dependency, not
merely optional. Data points must be `{x, y}` with millisecond
timestamps (X-values are not parsed, unlike Chart.js's own stock `time`
scale); X-values as labels aren't supported; custom tick `callback`s are
ignored. See the
[package's own README](https://github.com/jkmnt/chartjs-scale-timestack)
for its full list of documented constraints, and the
[Timestack scale example](/vue/examples/timestack-scale) for the full
version.

## Hierarchical — a local port, a real scale, not a Chart.js "plugin" object

`hierarchical` draws on a local port of `chartjs-plugin-hierarchical`.
Like `gradient`/`imageLabel`, it isn't a dependency on a third-party
package at all — its logic (a real `CategoryScale` subclass plus a
companion drawing/interaction plugin, dissected from the original
package's own real TypeScript source) is ported directly into
`keystone-chartjs-core` (`src/plugins/hierarchical/hierarchicalScale.ts`). Boolean only, like
`gradient`/`timestack` — no plugin-level config to merge, used via
`options.scales.<id>.type = 'hierarchical'`:

```vue
<Chart
  type="bar"
  hierarchical
  :data="{
    labels: [{ label: '2024', children: ['Q1', 'Q2', 'Q3', 'Q4'] }],
    datasets: [{ data: [{ value: 100, children: [20, 25, 22, 33] }] }],
  }"
  :options="{ scales: { x: { type: 'hierarchical' } } }"
/>
```

**No external runtime dependency, unlike `timestack`**: confirmed
directly from the real package's own `package.json`
(`peerDependencies: { "chart.js": "^4.1.0" }`, nothing else) — this
port is fully self-contained, the same "zero extra dependency weight"
outcome `zoom`/`gradient`/`imageLabel` already have. `Chart.register(
HierarchicalScale)` alone registers both the scale and its own
companion drawing/interaction plugin — the scale's own real, static
`afterRegister()` hook registers the plugin automatically, no separate
call needed.

**Real, distinct tree-node data shape**: `data.labels`/`dataset.data`
need this scale's own tree structure (`{ label, children }` /
`{ value, children }`), not the flat arrays every other kind or plugin
in this project accepts — confirmed directly from the real package's
own type declarations, dissected into this project's own
`HierarchicalRawLabelNode`/`HierarchicalValueNode` types (exported from
`keystone-chartjs-core`). Being local code rather than a dynamic import
also means this is one of seven plugins/scales on this project's docs
site (alongside `zoom`, `gradient`, `imageLabel`, `autocolors`,
`deferred`, and `trendline`) whose own example renders genuinely live
rather than source-only — click a category's own box below the axis to expand/
collapse it, or the small dot on a fully-expanded group to zoom in/out,
right on the example page. See the
[Hierarchical scale example](/vue/examples/hierarchical-scale) for the
full version.

## Image label — a local port, not a dependency, doughnut/pie only

Genuinely different mechanism from `annotation`/`dataLabels` (the two
still-dependency-based plugins left): `imageLabel` is never
registered globally via `Chart.register(...)` at all — it's supplied
per-chart-instance, via Chart.js's own real inline `plugins` array, the
same mechanism the `plugins` prop below already exposes for
custom/community plugins. Unlike `gradient`/`zoom`, it has no
plain-boolean opt-in form — `imagesList` is required, since there's no
sensible empty default (same reasoning as `annotation`):

```vue
<Chart
  type="doughnut"
  :image-label="{
    imagesList: [
      { imageUrl: 'chrome.png', imageWidth: 32, imageHeight: 32 },
      { imageUrl: 'firefox.png', imageWidth: 32, imageHeight: 32 },
    ],
  }"
  :data="data"
/>
```

Its logic (originally `chartjs-plugin-image-label`) is ported directly
into `keystone-chartjs-core` (`src/plugins/imageLabel/imageLabelPlugin.ts`), fixing two
bugs found in the original along the way: it now draws labels for every
dataset (not just the first), and positions each image using Chart.js's
own already-computed arc geometry instead of recomputing slice angles
from raw values. See the
[Image label plugin example](/vue/examples/image-label-plugin) for the
full version.

## Autocolors — a local port, not a dependency, config lives in options.plugins

`autocolors` draws on a local port of `chartjs-plugin-autocolors` (by
Jukka Kurkela, the same maintainer already behind `gradient`/`zoom`
before those two were also ported). Genuinely different registration
shape from every other plugin above: it both registers via a real,
synchronous `Chart.register(...)` call (matching `hierarchical`'s own
mechanism) AND has real plugin-level config of its own to merge into
`options.plugins.autocolors` (matching `dataLabels`'s own config-
merging shape) — `hierarchical` has no config to merge (a scale, not a
plugin with options), and `dataLabels` is still a real npm dependency
needing an async dynamic import to register.

```vue
<Chart
  type="line"
  autocolors
  :data="{
    datasets: [
      { label: 'Product A', data: [12, 19, 8, 15] },
      { label: 'Product B', data: [8, 14, 20, 11] },
    ],
  }"
/>
```

Accepts either `true` (apply with the real defaults — `'dataset'` mode)
or a config object merged into `options.plugins.autocolors`:
`mode` (`'dataset'` default, `'data'`, or `'label'` — `'dataset'` mode
doesn't work properly for doughnut/pie charts, where `'data'` mode is
the real package's own documented recommendation instead), `offset`/
`repeat` (both real numbers), and `customize` (a function receiving the
generated `{background, border}` colors plus context, returning a
replacement pair).

**Zero extra dependency weight, unlike `timestack`**: the original
package's own real logic imports two small color-conversion utility
functions (`hsv2rgb`, `rgbString`) from a separate package,
`@kurkle/color` — a real, declared peer dependency of the original, not
bundled into its own `dist` output. Rather than adding that package as a
new dependency of this project, this port reimplements those two small,
standard color-space-conversion functions locally (one universally
agreed-upon definition, not any bespoke logic of the plugin's own)
while carrying over every real piece of the plugin's own actual color-
*selection* logic (the hue-stepping generator, mode branching, the
"don't overwrite an already-set color" merge behavior) unchanged. Being
local code rather than a dynamic import also means this is one of seven
plugins/scales on this project's docs site (alongside `zoom`,
`gradient`, `hierarchical`, `imageLabel`, `deferred`, and `trendline`)
whose own example renders genuinely live rather than source-only. See the
[Autocolors plugin example](/vue/examples/autocolors-plugin) for the
full version.

## Deferred — a local port, not a dependency, config lives in options.plugins

`deferred` draws on a local port of `chartjs-plugin-deferred`
(originally by the official Chart.js team). Genuinely different
registration nuance from the original package's own v1.x behavior:
confirmed directly from its own README/migration guide, as of v2.x this
plugin "no longer registers itself automatically" — needs an explicit
`Chart.register(...)` call, which this port's own `withDeferred`
supplies directly and synchronously (matching `withAutocolors`'s own
mechanism: a real `Chart.register(...)` call AND real plugin-level
config merged into `options.plugins.deferred`).

```vue
<Chart
  type="bar"
  :deferred="{ xOffset: 150, yOffset: '50%', delay: 500 }"
  :data="data"
/>
```

Defers the chart's own real initial update — and thus its initial-
render animations (bars growing, lines drawing in) — until the canvas
actually scrolls into the viewport, plus an optional extra `delay` in
milliseconds after that. Useful for charts far down a long page that
would otherwise animate in unseen before the user ever scrolls to them.
Accepts either `true` (apply with the real defaults) or a config object:
`xOffset`/`yOffset` (pixels, or a percentage string like `'50%'`, of the
canvas's own width/height that must already be showing) and `delay`,
all defaulting to `0`.

**Real mechanism, confirmed directly from the original's own real
source during the port**: scroll-event-based, not `IntersectionObserver`-
based — it walks up from the canvas's own parent chain for the nearest
scrollable ancestor (falling back to the whole page if none is found)
and listens for a real `scroll` event there. **A real bug found and
fixed during the port**, the identical class already found in
`gradientPlugin.ts`'s own port: the original names its teardown hook
`destroy`, but Chart.js's own real `Plugin` interface has no such hook
at all — renamed to `afterDestroy`, the correct real hook name. Zero
runtime dependencies of its own. Being local code rather than a dynamic
import also means this is one of seven plugins/scales on this project's
docs site (alongside `zoom`, `gradient`, `hierarchical`, `imageLabel`,
`autocolors`, and `trendline`) whose own example renders genuinely live
rather than source-only. See the [Deferred plugin example](/vue/examples/deferred-plugin)
for the full version.

## Trendline — a local port, not a dependency, config lives on the dataset

`trendline` draws on a local port of `chartjs-plugin-trendline` (v3.2.12,
MIT, by Marcus Alsterfjord). Genuinely different motivation from every
other port above: there was no concrete bug or unmaintained-dependency
reason for this one — the real package is actively maintained with zero
runtime dependencies of its own and no known bugs found during
dissection. Ported anyway, at your explicit request, specifically so
`keystone-chartjs-core` depends on nothing but `chart.js` itself —
`annotation`/`dataLabels` remain the only two real npm dependencies left
in this project.

Like `gradient`, `trendline` is **boolean only** — it has no
plugin-level config of its own to merge into `options.plugins.
trendline` at all. Its real config lives on each **dataset** instead
(`dataset.trendlineLinear`/`dataset.trendlineExponential`), which
already reaches Chart.js untouched via the existing `data` prop:

```vue
<Chart
  type="line"
  trendline
  :data="{
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May'],
    datasets: [{
      label: 'Revenue',
      data: [12, 19, 15, 24, 30],
      trendlineLinear: { colorMin: 'red', colorMax: 'red', lineStyle: 'dotted', width: 2 },
    }],
  }"
/>
```

Use `trendlineExponential` instead of `trendlineLinear` to fit
`y = a × e^(b×x)` — works best with positive y-values, per the real
package's own documented caveat. Both accept the identical set of
styling options (`colorMin`/`colorMax`, `lineStyle`, `width`,
`xAxisKey`/`yAxisKey`, `projection`, `trendoffset`, `label`, `legend`).

**Real, undocumented features found only by reading the real, installed
package's own source directly** — neither its README nor `MIGRATION.md`
mentions any of these:
- **`fillColor`** on the trendline config — fills the area between the
  trendline and the chart's own bottom edge.
- **`dataset.order`** — trendlines draw in ascending order, except
  order-`0` datasets (Chart.js's own real default when unset), which
  draw *last*, on top of every other trendline.
- **`dataset.alwaysShowTrendline`** — draws the trendline even when the
  dataset itself is currently hidden via the legend.
- **Automatic ARIA-label generation** — the chart canvas's own
  `aria-label` is updated automatically with a generated description of
  each dataset's own trendline, customizable per dataset via
  `accessibility.description`/`.label`.
- **Legend integration** — a `legend` sub-config on the trendline adds a
  real, additional legend entry for it (`text`, `strokeStyle`,
  `fillStyle`, `lineCap`, `lineDash`, `lineWidth`), alongside Chart.js's
  own default-generated entries — confirmed via a real, direct patch of
  the chart's own `legend.options.labels.generateLabels`, additive to
  whatever Chart.js itself already generates.

**No type declarations shipped by the real package at all** — a
genuine, confirmed gap unlike `annotation`/`dataLabels`, both of which
ship real `.d.ts` files of their own — irrelevant to this port itself
(no dependency left to lack types for), but worth knowing if you ever
compare against the original package directly.

Being local code rather than a dynamic import also means this is one of
seven plugins/scales on this project's docs site (alongside `zoom`,
`gradient`, `hierarchical`, `imageLabel`, `autocolors`, and `deferred`)
whose own example renders genuinely live rather than source-only. See
the [Trendline plugin example](/vue/examples/trendline-plugin) for the
full version.

## Custom, inline plugins

Chart.js's own `ChartConfiguration.plugins` field — inline, per-chart-instance
custom plugin objects, distinct from these 10 officially-supported plugins —
is also implemented, via the `plugins` prop. Use it for any custom plugin
you write yourself, or any community plugin outside the 10 above. See
[Props → Custom, inline plugins](/vue/components/props#custom-inline-plugins)
for the full guide, including a real update-behavior difference worth
knowing (a `plugins` change forces a destroy-and-reconstruct, unlike
`options`/`data`).