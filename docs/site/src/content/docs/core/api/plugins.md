---
title: Plugins
description: The 10 official Chart.js plugin/scale helpers this project wires in.
---

One function per official Chart.js plugin/scale this project targets.
All 10 are local code — nine register directly and synchronously
(`Chart.register(...)`, or a real inline `plugins`-array object for
three of them); only `withTimestack` still performs a real dynamic
`import()` of a third-party package. Every helper stays `async`
regardless of whether it actually awaits anything, purely so call
sites (`useChartController.ts`'s own `resolveOptionsAndPlugins()`)
needed no changes as each one was ported off its own former dependency.

## Helpers that merge config and return `options` directly

Each of these registers its own local plugin (once, guarded by a
module-level flag) via a real, synchronous `Chart.register(...)` call,
then merges the given config into its own real path under
`options.plugins`, without touching any other existing `plugins.*`
entry:

- **`withAnnotation(options, annotationOptions)`** — registers this
  project's own local port of `chartjs-plugin-annotation` (see
  `plugins/annotation/annotationPlugin.ts`); merges `annotationOptions`
  into `options.plugins.annotation`. By far the largest, most
  architecturally distinct port in this project — seven real annotation
  types, each its own genuine Chart.js `Element` subclass, registered
  via a second, nested `Chart.register(annotationTypes)` call inside
  this plugin's own `afterRegister()` hook.
- **`withDataLabels(options, dataLabelsOptions?)`** — registers this
  project's own local port of `chartjs-plugin-datalabels`; merges
  `dataLabelsOptions` into `options.plugins.datalabels`.
- **`withAutocolors(options, autocolorsOptions?)`** — registers this
  project's own local port of `chartjs-plugin-autocolors`; merges
  `autocolorsOptions` into `options.plugins.autocolors`.
- **`withDeferred(options, deferredOptions?)`** — registers this
  project's own local port of `chartjs-plugin-deferred`; merges
  `deferredOptions` into `options.plugins.deferred`.

## Helpers with no plugin-level config at all

These register their own local plugin/scale the same synchronous way,
but return `options` completely unchanged — each one's real config
lives somewhere other than `options.plugins.<id>`:

- **`withTrendline(options)`** — registers this project's own local
  port of `chartjs-plugin-trendline`; its real config
  (`dataset.trendlineLinear`/`dataset.trendlineExponential`) lives on
  each dataset instead.
- **`withHierarchical(options)`** — registers this project's own local
  port of `chartjs-plugin-hierarchical` via its own named export
  (`HierarchicalScale`). A real, distinct **scale**, not a Chart.js
  "plugin" object — used via `options.scales.<id>.type = 'hierarchical'`
  directly. Needs data in this scale's own tree-node shape
  (`HierarchicalRawLabelNode`/`HierarchicalValueNode`), not the flat
  arrays every other kind/plugin accepts.
- **`withTimestack(options)`** — the one remaining real npm dependency:
  registers `chartjs-scale-timestack` via a genuine dynamic `import()`
  (a side-effect-only import — this package has no exported plugin
  object and is never passed to `Chart.register(...)` at all). No
  config to merge; used via `options.scales.<id>.type = 'timestack'`
  directly. Requires `luxon` as a real runtime dependency.

## `withZoom`, `withGradient`, and `withImageLabel` — inline-plugins-array shape

All three are genuinely different from every helper above: none is
ever passed to `Chart.register(...)` at all. Each one's own local
plugin object (`zoomPlugin`/`gradientPlugin`/`imageLabelPlugin`) is
supplied per-chart-instance via Chart.js's own inline `plugins` array
instead. All three return `Promise<{ options, plugin }>` rather than
just `options` (unlike every helper above), since the caller needs to
merge `plugin` into whatever `plugins` array is already in effect.

- **`withZoom(options, zoomOptions?)`** — merges `zoomOptions` into
  `options.plugins.zoom` (this is the one of the three that keeps real
  plugin-level config, unlike `gradient`/`imageLabel` below). **A real,
  deliberate scope decision, later revisited**: this port originally
  dropped every Hammer.js-dependent code path — pinch-zoom, and the
  gesture-driven pan interaction — since Hammer.js is itself
  unmaintained (confirmed via a real, open upstream issue). **Pinch-zoom
  and interactive pan were later added back in, reimplemented directly
  on the standards-based Pointer Events API**
  (`pointerdown`/`pointermove`/`pointerup`/`pointercancel`), which
  unifies mouse/touch/pen input with no external dependency at all —
  `zoom.pinch.enabled` opts into pinch-zoom, `pan.enabled` opts into
  touch/pen drag-to-pan. Mouse input stays wheel-zoom and
  drag-to-zoom-rectangle only, with `chart.pan()` still callable
  programmatically — the original itself never had a mouse-only
  drag-to-pan mechanism either, so this isn't a new limitation. The full
  programmatic API (`chart.zoom()`, `chart.zoomRect()`,
  `chart.zoomScale()`, `chart.resetZoom()`, `chart.pan()`,
  `chart.getZoomLevel()`, and more) is unaffected by any of this.
- **`withGradient(options)`** — no config to merge; its real config
  lives on each *dataset* instead (`dataset.gradient = {...}`), which
  already reaches Chart.js untouched via the existing `data` field, so
  this helper's only job is supplying the plugin object. Boolean-only
  opt-in. During the port, a real bug was found and fixed: the
  original's own teardown hook was named `destroy`, which isn't a real
  Chart.js `Plugin` hook at all (the real hooks are
  `beforeDestroy`/`afterDestroy`) — the original's own cleanup likely
  never actually ran in real Chart.js, silently leaking one state entry
  per destroyed chart.
- **`withImageLabel(options, imageLabelOptions)`** — fixes two bugs
  found in the original along the way (only the first dataset got
  labels; slice angles were recomputed from raw values instead of read
  from Chart.js's own already-computed arc geometry). `imagesList` is
  required — no plain-boolean opt-in form. Doughnut/pie charts only.

## Option types

- **`ZoomPluginOptions`** / **`AnnotationPluginOptions`** /
  **`DataLabelsPluginOptions`** / **`AutocolorsPluginOptions`** /
  **`DeferredPluginOptions`** / **`ImageLabelPluginOptions`** — the
  option shapes each corresponding helper above accepts.
  `AnnotationPluginOptions`/`DataLabelsPluginOptions`/
  `AutocolorsPluginOptions`/`DeferredPluginOptions` are deliberately
  loose (not a full mirror of each plugin's own, much larger, option
  surface — full typing is future hardening work, not yet done);
  `ZoomPluginOptions`/`ImageLabelPluginOptions` are both modeled
  precisely, since both are this package's own local logic with a
  fully-known surface (confirmed by dissecting each plugin's own real
  source directly).
  `withGradient`/`withTimestack`/`withHierarchical`/`withTrendline` have
  no corresponding options type — none of the four takes a config
  parameter.
