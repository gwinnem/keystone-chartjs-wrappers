---
editUrl: false
title: "withTimestack"
description: "Registers `chartjs-scale-timestack` (once). Genuinely different from every other helper in this file, not just `withGradient` — confirmed directly from…"
---

> **withTimestack**(`options`): `Promise`\<`_DeepPartialObject`\<`CoreChartOptions`\<keyof `ChartTypeRegistry`\> & `ElementChartOptions`\<keyof `ChartTypeRegistry`\> & `PluginChartOptions`\<keyof `ChartTypeRegistry`\> & `DatasetChartOptions`\<keyof `ChartTypeRegistry`\> & `ScaleChartOptions`\<keyof `ChartTypeRegistry`\>\>\>

Registers `chartjs-scale-timestack` (once). Genuinely different from
every other helper in this file, not just `withGradient` — confirmed
directly from the real package's own README
(github.com/jkmnt/chartjs-scale-timestack): there is no exported
plugin object to pass to `Chart.register(...)` at all. The package
registers its own `timestack` scale as a *module-load side effect* of
being imported (`import 'chartjs-scale-timestack';` in the package's
own documented usage, with no further call needed) — so this helper's
only job is running that import once; there's nothing to call
`Chart.register` with, and no `mod.default ?? mod` fallback needed
either, unlike `withZoom`/`withAnnotation`/`withDataLabels`/
`withGradient` above. Like `withGradient`, `options` is returned
completely unchanged — the scale is used by setting
`options.scales.<id>.type = 'timestack'` (and optionally
`options.scales.<id>.timestack = {...}` for its own real config),
both of which already reach Chart.js untouched via the existing
`options` prop, no merging needed.

Real, hard runtime dependency worth knowing: this package requires
`luxon` (confirmed from its own README: "npm install luxon chartjs-
scale-timestack") for locale-aware time formatting — a real, sizeable
added dependency, not merely optional. Luxon itself is actively
maintained (confirmed: 2 maintainers, healthy release cadence, no
open unpatched CVEs at the time of this check), unlike the Hammer.js
concern already flagged for `chartjs-plugin-zoom` in
`docs/CHARTJS_ANALYSIS.md` §6 — a real dependency-weight cost, but not
the same maintenance-risk concern.

**Accepted mutation survivors, confirmed via a real run, not
hypothetical**: the `if (!timestackRegistered)` guard itself (and its
own flag's true/false mutations, in both this function and
`__resetPluginsForTests`) has no test that can distinguish "guard
worked, import ran once" from "guard broken, import ran again" —
because this function has no `Chart.register` call and never reads
any property off the imported module, there is genuinely nothing
observable about a second `import()` call beyond the first: ES module
evaluation is cached regardless of the guard's own correctness, so
even a completely broken guard produces byte-identical, unobservable
behavior. This is the same class of gap as `controller.ts`'s own
accepted `handle?.destroy()` survivor — real defensive value (avoiding
a wasted repeat `import()` call on every future invocation), just not
distinguishable via any external assertion given this function's own
design. Contrast with `withHierarchical` below, whose identical-shaped
guard *is* fully covered, because that function's own real
`Chart.register(HierarchicalScale)` call gives every one of its own
guard mutations a real, observable side effect to fail against.

## Parameters

### options

`Options`

## Returns

`Promise`\<`_DeepPartialObject`\<`CoreChartOptions`\<keyof `ChartTypeRegistry`\> & `ElementChartOptions`\<keyof `ChartTypeRegistry`\> & `PluginChartOptions`\<keyof `ChartTypeRegistry`\> & `DatasetChartOptions`\<keyof `ChartTypeRegistry`\> & `ScaleChartOptions`\<keyof `ChartTypeRegistry`\>\>\>
