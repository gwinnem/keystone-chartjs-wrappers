---
editUrl: false
title: "withTrendline"
---

> **withTrendline**(`options`): `Promise`\<`_DeepPartialObject`\<`CoreChartOptions`\<keyof `ChartTypeRegistry`\> & `ElementChartOptions`\<keyof `ChartTypeRegistry`\> & `PluginChartOptions`\<keyof `ChartTypeRegistry`\> & `DatasetChartOptions`\<keyof `ChartTypeRegistry`\> & `ScaleChartOptions`\<keyof `ChartTypeRegistry`\>\>\>

Registers a local port of `chartjs-plugin-trendline` (once), via this
project's own trendlinePlugin — see `trendlinePlugin.ts`'s own
header comment for the full port rationale. Unlike every other
plugin this project has actually ported, there was no concrete bug
or unmaintained-dependency reason motivating this one — ported
anyway, at your explicit request, specifically so
`keystone-chartjs-core` depends on nothing but `chart.js` itself.
`Chart.register(...)` is called directly and synchronously (no
dynamic `import()` at all, unlike this function's own prior,
still-a-dependency version) — kept `async` regardless, purely so
`useChartController.ts`'s own `await withTrendline(opts)` call site
needed no changes.

Like `withGradient`/`withTimestack`/`withHierarchical`, there is no
plugin-level config of its own to merge into `options` here — its
real config (`TrendlineConfig`, see types.ts) lives on each
*dataset* instead (`dataset.trendlineLinear`/`dataset.
trendlineExponential`), which already reaches Chart.js untouched via
the existing `data` prop. `options` is returned unchanged.

## Parameters

### options

`Options`

## Returns

`Promise`\<`_DeepPartialObject`\<`CoreChartOptions`\<keyof `ChartTypeRegistry`\> & `ElementChartOptions`\<keyof `ChartTypeRegistry`\> & `PluginChartOptions`\<keyof `ChartTypeRegistry`\> & `DatasetChartOptions`\<keyof `ChartTypeRegistry`\> & `ScaleChartOptions`\<keyof `ChartTypeRegistry`\>\>\>
