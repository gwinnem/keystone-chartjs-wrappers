---
title: Plugins
description: Official Chart.js plugins this package wires in as opt-in props.
---

| Plugin | Package | Purpose | Prop | Status |
|---|---|---|---|---|
| Zoom/pan | `chartjs-plugin-zoom` | Mouse-wheel/pinch zoom, drag pan | `zoom` | Implemented |
| Annotations | `chartjs-plugin-annotation` | Lines, boxes, points, labels, polygons, ellipses drawn on the chart area | `annotation` | Implemented |
| Data labels | `chartjs-plugin-datalabels` | Renders a label directly on each data element | `dataLabels` | Implemented |
| Gradient | locally ported, not a dependency | Per-dataset color gradients, keyed by axis position | `gradient` | Implemented |
| Timestack | `chartjs-scale-timestack` | Alternative time axis, formatting time in two stacked, human-friendly rows | `timestack` | Implemented |
| Hierarchical | `chartjs-plugin-hierarchical` | Collapsible, tree-like categorical axis | `hierarchical` | Implemented |
| Image label | locally ported, not a dependency | Draws an image on each doughnut/pie slice | `imageLabel` | Implemented |

These are chart-instance plugins, not chart types — they apply across
whichever `type` you use them with. Each is a one-line opt-in prop on
`<Chart>` (see [Props](/vue/components/props)) rather than requiring a
manual `Chart.register()` call in consumer code — the backing package is
dynamically imported and registered automatically, the first time the prop
is used (except `gradient`/`imageLabel` — see their own sections below).

`zoom`/`dataLabels` accept either `true` (apply with no extra config) or a
config object merged into `options.plugins.zoom`/`options.plugins.datalabels`
respectively. `annotation` has no boolean form — pass a real config object
with at least one entry under `annotations`.

```vue
<Chart type="line" :data="data" zoom dataLabels :annotation="{ annotations: { line1: { type: 'line', yMin: 50, yMax: 50 } } }" />
```

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
(`src/gradientPlugin.ts`), never registered via `Chart.register(...)`,
supplied per-chart-instance via Chart.js's own inline `plugins` array
instead (the same mechanism `imageLabel` below uses). Being local code
rather than a dynamic import also means this is one of only two plugins
on this project's docs site (alongside `imageLabel`) whose own example
renders genuinely live rather than source-only.

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

## Hierarchical — another real scale, with its own real named export

`hierarchical` is boolean only too, but registers differently from
every other still-dependency-based helper in this file — confirmed
directly from the real package's own README
(github.com/sgratzl/chartjs-plugin-hierarchical): its ESM build is
genuinely tree-shakeable with no side effects, so it needs an explicit
`Chart.register(HierarchicalScale)` call via its own real, confirmed
named export (unlike `timestack`'s side-effect-only import). Same
shape otherwise — no plugin-level config to merge, used via
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

**Real, distinct tree-node data shape**: `data.labels`/`dataset.data`
need this scale's own `ILabelNode`/`IValueNode` tree structure
(`{ label, children }` / `{ value, children }`), not the flat arrays
every other kind or plugin in this project accepts — confirmed directly
from the real package's own type declarations. See the
[Hierarchical scale example](/vue/examples/hierarchical-scale) for the
full version.

## Image label — a local port, not a dependency, doughnut/pie only

Genuinely different mechanism from every still-dependency-based helper
above: `imageLabel` is never registered globally via
`Chart.register(...)` at all — it's supplied per-chart-instance, via
Chart.js's own real inline `plugins` array, the same mechanism the
`plugins` prop below already exposes for custom/community plugins.
Unlike `gradient`, it has no plain-boolean opt-in form —
`imagesList` is required, since there's no sensible empty default (same
reasoning as `annotation`):

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
into `keystone-chartjs-core` (`src/imageLabelPlugin.ts`), fixing two
bugs found in the original along the way: it now draws labels for every
dataset (not just the first), and positions each image using Chart.js's
own already-computed arc geometry instead of recomputing slice angles
from raw values. See the
[Image label plugin example](/vue/examples/image-label-plugin) for the
full version.

## Custom, inline plugins

Chart.js's own `ChartConfiguration.plugins` field — inline, per-chart-instance
custom plugin objects, distinct from these 7 officially-supported plugins —
is also implemented, via the `plugins` prop. Use it for any custom plugin
you write yourself, or any community plugin outside the 7 above. See
[Props → Custom, inline plugins](/vue/components/props#custom-inline-plugins)
for the full guide, including a real update-behavior difference worth
knowing (a `plugins` change forces a destroy-and-reconstruct, unlike
`options`/`data`).
