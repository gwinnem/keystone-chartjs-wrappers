---
title: Plugins
description: The 7 official Chart.js plugin/scale helpers this project wires in.
---

One function per official Chart.js plugin/scale this project targets.
Two of the seven register a third-party package (dynamically imported,
once) and return `options` with the plugin's own config merged into its
real path under `options.plugins`, without touching any other existing
`plugins.*` entry. `withZoom`, `withGradient`, and `withImageLabel` are
genuinely different — see their own section below.

- **`withAnnotation(options, annotationOptions)`** — registers
  `chartjs-plugin-annotation`; merges `annotationOptions` into
  `options.plugins.annotation`.
- **`withDataLabels(options, dataLabelsOptions?)`** — registers
  `chartjs-plugin-datalabels`; merges `dataLabelsOptions` into
  `options.plugins.datalabels`.
- **`withTimestack(options)`** — registers `chartjs-scale-timestack` (a
  side-effect-only import — this package has no exported plugin object
  and is never passed to `Chart.register(...)` at all). No config to
  merge; used via `options.scales.<id>.type = 'timestack'` directly.
  Requires `luxon` as a real runtime dependency.
- **`withHierarchical(options)`** — registers `chartjs-plugin-hierarchical`
  via its own named export (`HierarchicalScale`). No config to merge;
  used via `options.scales.<id>.type = 'hierarchical'` directly. Needs
  data in this scale's own tree-node shape (`ILabelNode`/`IValueNode`),
  not the flat arrays every other kind/plugin accepts.

## `withZoom`, `withGradient`, and `withImageLabel` — local ports, not dependencies

All three are genuinely different from the two above: none is a
dependency on a third-party package at all. Each one's logic
(originally `chartjs-plugin-zoom`, `chartjs-plugin-gradient`, and
`chartjs-plugin-image-label` respectively) is ported directly into this
package (`zoomPlugin.ts`/`gradientPlugin.ts`/`imageLabelPlugin.ts`), and
none is ever passed to `Chart.register(...)` — all three are supplied
per-chart-instance via Chart.js's own inline `plugins` array instead.
All three return `Promise<{ options, plugin }>` rather than just
`options` (unlike either helper above), since the caller needs to merge
`plugin` into whatever `plugins` array is already in effect.

- **`withZoom(options, zoomOptions?)`** — merges `zoomOptions` into
  `options.plugins.zoom`, same as before the port (this is the one of
  the three that keeps real plugin-level config, unlike
  `gradient`/`imageLabel` below). **A real, deliberate scope decision**:
  the port drops every Hammer.js-dependent code path — pinch-zoom, and
  the gesture-driven pan interaction — since Hammer.js is itself
  unmaintained (confirmed via a real, open upstream issue). Mouse-wheel
  zoom, mouse-drag-to-zoom-rectangle, and the full programmatic API
  (`chart.zoom()`, `chart.zoomRect()`, `chart.zoomScale()`,
  `chart.resetZoom()`, `chart.pan()`, `chart.getZoomLevel()`, and more)
  are all kept. A real, honest finding from dissecting the original
  source: it has no mouse-only drag-to-pan mechanism at all — `pan()`
  was only ever driven by Hammer's own gesture recognizer — so dropping
  Hammer.js means dropping *all* interactive pan, not just touch-pan.
  `chart.pan()` stays callable programmatically for a consumer's own
  custom controls, just with no built-in gesture wired to it.
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
  **`DataLabelsPluginOptions`** / **`ImageLabelPluginOptions`** — the
  option shapes each corresponding helper above accepts.
  `AnnotationPluginOptions`/`DataLabelsPluginOptions` are deliberately
  loose (not a full mirror of each plugin's own, much larger, option
  surface — full typing is future hardening work, not yet done);
  `ZoomPluginOptions`/`ImageLabelPluginOptions` are both modeled
  precisely, since both are this package's own local logic with a
  fully-known surface (confirmed by dissecting each plugin's own real
  source directly, not left loose "for later" the way the two
  still-dependency-based ones are).
  `withGradient`/`withTimestack`/`withHierarchical` have no corresponding
  options type — none of the three takes a config parameter.
