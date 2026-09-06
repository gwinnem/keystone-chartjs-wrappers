---
editUrl: false
title: "withGradient"
---

> **withGradient**(`options`): `Promise`\<\{ `options`: `Options`; `plugin`: `unknown`; \}\>

Merges the given config into `options.plugins.gradient` (this
plugin's own real, documented option path) and returns the local
plugin object (defined in gradientPlugin.ts) for the caller to
include in Chart.js's own inline `plugins` array — the same
`{ options, plugin }` shape `withImageLabel` returns, since this
plugin (as of the local port) is also never passed to a global
`Chart.register(...)` call.

Unlike `withZoom`/`withAnnotation`/`withDataLabels`, there is no
plugin-level config to merge into `options.plugins.gradient` at all —
confirmed directly from the real package's own docs
(github.com/kurkle/chartjs-plugin-gradient): its own config lives on
each *dataset* instead (`dataset.gradient = { backgroundColor: {...},
borderColor: {...} }`), which already reaches Chart.js untouched via
this project's own `data` passthrough (`ChartConfigDataset`'s own
index signature already allows an arbitrary `gradient` key — no type
change needed for that half at all). `options` is therefore returned
completely unchanged; the `gradient` opt-in prop is boolean-only
(registration only), unlike `zoom`/`dataLabels` (boolean-or-config-
object) or `annotation` (config-object required).

## Parameters

### options

`Options`

## Returns

`Promise`\<\{ `options`: `Options`; `plugin`: `unknown`; \}\>
