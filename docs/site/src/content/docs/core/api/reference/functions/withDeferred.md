---
editUrl: false
title: "withDeferred"
description: "Registers a local port of `chartjs-plugin-deferred` (once), via this project's own deferredPlugin — see `deferredPlugin.ts`'s own header comment for the…"
---

> **withDeferred**(`options`, `deferredOptions?`): `Promise`\<`_DeepPartialObject`\<`CoreChartOptions`\<keyof `ChartTypeRegistry`\> & `ElementChartOptions`\<keyof `ChartTypeRegistry`\> & `PluginChartOptions`\<keyof `ChartTypeRegistry`\> & `DatasetChartOptions`\<keyof `ChartTypeRegistry`\> & `ScaleChartOptions`\<keyof `ChartTypeRegistry`\>\>\>

Registers a local port of `chartjs-plugin-deferred` (once), via this
project's own deferredPlugin — see `deferredPlugin.ts`'s own
header comment for the full port rationale (a real, faithful port of
the original's own scroll-event-driven defer logic; a real,
confirmed `destroy`-vs-`afterDestroy` hook-name bug fixed along the
way, the identical class already found in `gradientPlugin.ts`'s own
port). As of the port, `Chart.register(...)` is called directly and
synchronously (no dynamic `import()` at all, unlike this function's
own prior, still-a-dependency version) — kept `async` regardless,
purely so `useChartController.ts`'s own `await withDeferred(opts,
...)` call site needed no changes.

Same registration/config-merging shape as `withAutocolors`: a real,
synchronous `Chart.register(...)` call (matching `withHierarchical`'s
own mechanism) AND real plugin-level config of its own merged into
`options.plugins.deferred` (matching `withAnnotation`/
`withDataLabels`'s own config-merging shape).

## Parameters

### options

`Options`

### deferredOptions?

[`DeferredPluginOptions`](/core/api/reference/interfaces/deferredpluginoptions/) = `{}`

## Returns

`Promise`\<`_DeepPartialObject`\<`CoreChartOptions`\<keyof `ChartTypeRegistry`\> & `ElementChartOptions`\<keyof `ChartTypeRegistry`\> & `PluginChartOptions`\<keyof `ChartTypeRegistry`\> & `DatasetChartOptions`\<keyof `ChartTypeRegistry`\> & `ScaleChartOptions`\<keyof `ChartTypeRegistry`\>\>\>
