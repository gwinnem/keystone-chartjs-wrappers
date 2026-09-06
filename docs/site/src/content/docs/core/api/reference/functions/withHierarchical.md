---
editUrl: false
title: "withHierarchical"
---

> **withHierarchical**(`options`): `Promise`\<`_DeepPartialObject`\<`CoreChartOptions`\<keyof `ChartTypeRegistry`\> & `ElementChartOptions`\<keyof `ChartTypeRegistry`\> & `PluginChartOptions`\<keyof `ChartTypeRegistry`\> & `DatasetChartOptions`\<keyof `ChartTypeRegistry`\> & `ScaleChartOptions`\<keyof `ChartTypeRegistry`\>\>\>

Registers a local port of `chartjs-plugin-hierarchical` (once), via
this project's own HierarchicalScale — see `hierarchicalScale.ts`'s
own header comment for the full port rationale. As of the port,
`Chart.register(...)` is called directly and synchronously (no
dynamic `import()` at all, unlike this function's own prior,
still-a-dependency version) — kept `async` regardless, purely so
`useChartController.ts`'s own `await withHierarchical(opts)` call
site needed no changes.

Like `withGradient`/`withTimestack`, there is no plugin-level config
of its own to merge into `options` here — it's a real, distinct
**scale** (`hierarchical`), not a Chart.js "plugin" object with
lifecycle hooks, used via the standard
`options.scales.<id>.type = 'hierarchical'` mechanism (and optionally
`options.scales.<id>.hierarchical = {...}` for its own real styling
config), both of which already reach Chart.js untouched via the
existing `options` prop. `options` is returned unchanged.

Real, non-trivial data-shape requirement worth knowing: this scale
needs `data.labels`/`dataset.data` in its own tree-node shape
(`HierarchicalRawLabelNode`/`HierarchicalValueNode`, exported from
`hierarchicalScale.ts`) rather than the flat arrays every other
kind/plugin in this project accepts — already reaches Chart.js
untouched via the existing `data` prop, no type change needed here
either, but a real, meaningfully different shape a consumer needs to
know about (see the docs site's own example).

## Parameters

### options

`Options`

## Returns

`Promise`\<`_DeepPartialObject`\<`CoreChartOptions`\<keyof `ChartTypeRegistry`\> & `ElementChartOptions`\<keyof `ChartTypeRegistry`\> & `PluginChartOptions`\<keyof `ChartTypeRegistry`\> & `DatasetChartOptions`\<keyof `ChartTypeRegistry`\> & `ScaleChartOptions`\<keyof `ChartTypeRegistry`\>\>\>
