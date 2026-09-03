---
title: Core
description: The framework-agnostic Chart.js engine underneath the Vue, React, and Angular packages — chart lifecycle, lazy type registration, and plugin wiring, usable standalone.
---

`keystone-chartjs-core` is the framework-agnostic engine shared by
`keystone-chartjs-vue`, `keystone-chartjs-react`, and
`keystone-chartjs-angular`. It owns everything that doesn't depend on a UI
framework:

- **Chart lifecycle** — construct-on-mount, diff-and-update on data/options
  change (rather than destroy-and-recreate), destroy-on-unmount.
- **Lazy chart-type registration** — on first request for a given
  [`ChartKind`](https://github.com/gwinnem/keystone-chartjs-wrappers/blob/main/packages/core/src/types.ts),
  the backing package (if it's an ecosystem extension, not a Chart.js
  built-in) is dynamically imported and registered via `Chart.register(...)`,
  keeping unused controllers out of the bundle.
- **Plugin registration helpers** — one function per official plugin
  (zoom, annotation, data labels) that registers the plugin once and returns
  a typed `options.plugins.*` fragment.
- **Resize handling** — a `ResizeObserver` on the canvas's parent, calling
  `chart.resize()`.

This package has **zero framework dependency** — no Vue, React, or Angular in
its own `dependencies`. It's private/workspace-internal today (not published
to npm), but is designed to be usable standalone by anything that just needs
a managed Chart.js instance without a framework wrapper.

## Supported chart kinds

| Category | Kinds |
|---|---|
| Chart.js built-in (8) | `bar`, `line`, `bubble`, `scatter`, `doughnut`, `pie`, `polarArea`, `radar` |
| Ecosystem extensions | `candlestick`, `ohlc`, `boxplot`, `violin`, `matrix`, `sankey`, `treemap` |

See
[the Chart.js coverage analysis](https://github.com/gwinnem/keystone-chartjs-wrappers/blob/main/docs/CHARTJS_ANALYSIS.md)
for the full source-by-source breakdown of every kind and which package backs
it, and the
[`CHART_TYPE_REGISTRY`](https://github.com/gwinnem/keystone-chartjs-wrappers/blob/main/packages/core/src/registry.ts)
for the exact kind → package mapping.

## Status

This package is in active development — see the
[implementation plan](https://github.com/gwinnem/keystone-chartjs-wrappers/blob/main/docs/IMPLEMENTATION_PLAN.md)
(Phase 1) for current progress. An API reference page (`createChartController`,
`CHART_TYPE_REGISTRY`, `ChartKind`) lands here as that work completes.
