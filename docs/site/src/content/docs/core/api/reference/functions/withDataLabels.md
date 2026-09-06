---
editUrl: false
title: "withDataLabels"
description: "Registers a local port of `chartjs-plugin-datalabels` (once), via this project's own dataLabelsPlugin — see `dataLabelsPlugin.ts`'s own header comment for…"
---

> **withDataLabels**(`options`, `dataLabelsOptions?`): `Promise`\<`_DeepPartialObject`\<`CoreChartOptions`\<keyof `ChartTypeRegistry`\> & `ElementChartOptions`\<keyof `ChartTypeRegistry`\> & `PluginChartOptions`\<keyof `ChartTypeRegistry`\> & `DatasetChartOptions`\<keyof `ChartTypeRegistry`\> & `ScaleChartOptions`\<keyof `ChartTypeRegistry`\>\>\>

Registers a local port of `chartjs-plugin-datalabels` (once), via
this project's own dataLabelsPlugin — see
`dataLabelsPlugin.ts`'s own header comment for the full port
rationale (real overlap auto-hiding, real click/hover interaction,
real multi-label-per-point support, and a real, deliberate
structural improvement replacing the original's own
`chart.$datalabels`/`element.$datalabels` monkey-patched bookkeeping
with module-level `WeakMap`s). `Chart.register(...)` is called
directly and synchronously (no dynamic `import()` at all, unlike
this function's own prior, still-a-dependency version) — kept
`async` regardless, purely so `useChartController.ts`'s own `await
withDataLabels(opts, ...)` call site needed no changes.

Same registration/config-merging shape as `withAutocolors`/
`withDeferred`: a real, synchronous `Chart.register(...)` call
(matching `withHierarchical`'s own mechanism) AND real plugin-level
config of its own merged into `options.plugins.datalabels`.

## Parameters

### options

`Options`

### dataLabelsOptions?

`DataLabelsConfig` = `{}`

## Returns

`Promise`\<`_DeepPartialObject`\<`CoreChartOptions`\<keyof `ChartTypeRegistry`\> & `ElementChartOptions`\<keyof `ChartTypeRegistry`\> & `PluginChartOptions`\<keyof `ChartTypeRegistry`\> & `DatasetChartOptions`\<keyof `ChartTypeRegistry`\> & `ScaleChartOptions`\<keyof `ChartTypeRegistry`\>\>\>
