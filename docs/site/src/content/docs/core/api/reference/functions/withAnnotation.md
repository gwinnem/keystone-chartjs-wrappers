---
editUrl: false
title: "withAnnotation"
---

> **withAnnotation**(`options`, `annotationOptions`): `Promise`\<`_DeepPartialObject`\<`CoreChartOptions`\<keyof `ChartTypeRegistry`\> & `ElementChartOptions`\<keyof `ChartTypeRegistry`\> & `PluginChartOptions`\<keyof `ChartTypeRegistry`\> & `DatasetChartOptions`\<keyof `ChartTypeRegistry`\> & `ScaleChartOptions`\<keyof `ChartTypeRegistry`\>\>\>

Registers a local port of `chartjs-plugin-annotation` (once), via
this project's own annotationPlugin — see
`plugins/annotation/annotationPlugin.ts`'s own header comment for
the full port rationale (seven real Chart.js `Element` subclasses —
box/doughnutLabel/ellipse/label/line/point/polygon — each registered
via `Chart.register(annotationTypes)` in the plugin's own
`afterRegister()` hook, plus a real, deliberate structural
improvement replacing the original's own chart-keyed `Map` with a
`WeakMap`). `Chart.register(...)` is called directly and
synchronously (no dynamic `import()` at all, unlike this function's
own prior, still-a-dependency version) — kept `async` regardless,
purely so `useChartController.ts`'s own `await withAnnotation(opts,
...)` call site needed no changes.

Same registration/config-merging shape as `withDataLabels`: a real,
synchronous `Chart.register(...)` call (matching
`withAutocolors`'s/`withDeferred`'s own mechanism) AND real
plugin-level config merged into `options.plugins.annotation`.

## Parameters

### options

`Options`

### annotationOptions

[`AnnotationPluginOptions`](../interfaces/AnnotationPluginOptions.md)

## Returns

`Promise`\<`_DeepPartialObject`\<`CoreChartOptions`\<keyof `ChartTypeRegistry`\> & `ElementChartOptions`\<keyof `ChartTypeRegistry`\> & `PluginChartOptions`\<keyof `ChartTypeRegistry`\> & `DatasetChartOptions`\<keyof `ChartTypeRegistry`\> & `ScaleChartOptions`\<keyof `ChartTypeRegistry`\>\>\>
