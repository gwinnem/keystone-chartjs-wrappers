---
title: Plugins
description: The 7 official Chart.js plugin/scale helpers this project wires in.
---

One function per official Chart.js plugin/scale this project targets.
Four of the seven register a third-party package (dynamically imported,
once) and return `options` with the plugin's own config merged into its
real path under `options.plugins`, without touching any other existing
`plugins.*` entry. `withGradient` and `withImageLabel` are genuinely
different — see their own section below.

- **`withZoom(options, zoomOptions?)`** — registers `chartjs-plugin-zoom`;
  merges `zoomOptions` into `options.plugins.zoom`.
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

## `withGradient` and `withImageLabel` — local ports, not dependencies

Both are genuinely different from the four above: neither is a
dependency on a third-party package at all. Each one's logic
(originally `chartjs-plugin-gradient` and `chartjs-plugin-image-label`
respectively) is ported directly into this package
(`gradientPlugin.ts`/`imageLabelPlugin.ts`), and neither is ever passed
to `Chart.register(...)` — both are supplied per-chart-instance via
Chart.js's own inline `plugins` array instead. Both return
`Promise<{ options, plugin }>` rather than just `options` (unlike every
helper above), since the caller needs to merge `plugin` into whatever
`plugins` array is already in effect.

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
  option shapes each corresponding helper above accepts. The first three
  are deliberately loose (not a full mirror of each plugin's own, much
  larger, option surface — full typing is future hardening work, not yet
  done); `ImageLabelPluginOptions` is modeled precisely, since it's this
  package's own local logic with a small, fully-known surface.
  `withGradient`/`withTimestack`/`withHierarchical` have no corresponding
  options type — none of the three takes a config parameter.
