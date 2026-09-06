---
title: Features
description: What keystone-chartjs-vue implements today, and what's planned.
---

| Feature | Status |
|---|---|
| Single generic `<Chart type="...">` component | Implemented |
| 8 built-in Chart.js kinds (bar, line, bubble, scatter, doughnut, pie, polarArea, radar) | Implemented |
| 7 ecosystem extension kinds (candlestick, ohlc, boxplot, violin, matrix, sankey, treemap) | Implemented |
| Lazy chart-type registration (unused controllers stay out of the bundle) | Implemented |
| Official plugins (zoom/pan, annotation, data labels, gradient, timestack, hierarchical, image label, autocolors, deferred, trendline) | Implemented — opt-in props (`zoom`, `annotation`, `dataLabels`, `gradient`, `timestack`, `hierarchical`, `imageLabel`, `autocolors`, `deferred`, `trendline`) |
| Reactive updates (`chart.update()`, not destroy/recreate) | Implemented — diffed on top-level `type` and the `plugins` array's own reference; unchanged, an update applies in place, a change to either destroys and reconstructs |
| Resize handling | Implemented — automatic via `ResizeObserver` |
| Exposed chart-instance ref (escape hatch) | Implemented — `defineExpose({ chart })` |
| Mixed/combo charts (per-dataset `type`) | Implemented — see the [Mixed charts](/vue/guide/concepts/mixed-charts) guide |
| TypeScript types for every prop, config, and chart kind | Implemented |
| Vue-native lifecycle events (`ready`/`update`/`destroy`) | Not implemented — see [Events](/vue/components/events) |
| Accessibility (ARIA-attribute fallthrough, fallback-content slot) | Implemented — see [Accessibility](/vue/guide/concepts/accessibility) |
| Inline, custom Chart.js plugins (`ChartConfiguration.plugins`, distinct from the 10 official opt-ins above) | Implemented — the `plugins` prop, see [API → Plugins](/vue/api/plugins) |

## Test coverage

All implemented features above are backed by real, confirmed test tiers,
not just written and assumed correct:

- Unit (core) + component (this package) tests: core is at 99.11%
  statements/lines, 94.52% branches, 99.63% functions overall — every
  file clears the project's own 90% per-file floor on every metric,
  with a small number of individually-documented survivors (a handful
  of defensive guards confirmed structurally unreachable given each
  file's own real call graph — the same class of accepted gap already
  documented for `controller.ts`). This package's own component tests
  are a clean 100%.
- End-to-end (real browser, real Chart.js, Chromium/Firefox/WebKit): 84/84
  passing — all 15 chart kinds, all 10 plugins, and resize behavior pass
  across all 3 browsers. No known limitations remain.

See the
[Roadmap](/vue/guide/project/roadmap) for what's next and
[Chart.js coverage analysis](https://github.com/gwinnem/keystone-chartjs-wrappers/blob/main/docs/CHARTJS_ANALYSIS.md)
for the reasoning behind the scope choices above.
