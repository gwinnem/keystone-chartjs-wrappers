---
editUrl: false
title: "withAutocolors"
---

> **withAutocolors**(`options`, `autocolorsOptions?`): `Promise`\<`_DeepPartialObject`\<`CoreChartOptions`\<keyof `ChartTypeRegistry`\> & `ElementChartOptions`\<keyof `ChartTypeRegistry`\> & `PluginChartOptions`\<keyof `ChartTypeRegistry`\> & `DatasetChartOptions`\<keyof `ChartTypeRegistry`\> & `ScaleChartOptions`\<keyof `ChartTypeRegistry`\>\>\>

Registers a local port of `chartjs-plugin-autocolors` (once), via
this project's own autocolorPlugin — see
`autocolorsPlugin.ts`'s own header comment for the full port
rationale (a real, faithful port of the original's own color-
selection logic; only its own two small, standard color-conversion
utility functions are reimplemented locally, to avoid a new
dependency on `@kurkle/color`). As of the port, `Chart.register(...)`
is called directly and synchronously (no dynamic `import()` at all,
unlike this function's own prior, still-a-dependency version) —
kept `async` regardless, purely so `useChartController.ts`'s own
`await withAutocolors(opts, ...)` call site needed no changes.

Genuinely different shape from every other helper in this file: the
only one that both (a) registers a local port directly via a real,
synchronous `Chart.register(...)` call (matching `withHierarchical`'s
own registration mechanism) AND (b) has real plugin-level config of
its own to merge into `options.plugins.autocolors` (matching
`withAnnotation`/`withDataLabels`'s own config-merging shape) —
`withHierarchical` has no config to merge (a scale, not a plugin
with options), and `withAnnotation`/`withDataLabels` are still real
npm dependencies needing an async dynamic import to register.

## Parameters

### options

`Options`

### autocolorsOptions?

[`AutocolorsPluginOptions`](../interfaces/AutocolorsPluginOptions.md) = `{}`

## Returns

`Promise`\<`_DeepPartialObject`\<`CoreChartOptions`\<keyof `ChartTypeRegistry`\> & `ElementChartOptions`\<keyof `ChartTypeRegistry`\> & `PluginChartOptions`\<keyof `ChartTypeRegistry`\> & `DatasetChartOptions`\<keyof `ChartTypeRegistry`\> & `ScaleChartOptions`\<keyof `ChartTypeRegistry`\>\>\>
