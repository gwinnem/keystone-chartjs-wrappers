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
| Official plugins (zoom/pan, annotation, data labels, gradient, timestack, hierarchical) | Implemented — opt-in props (`zoom`, `annotation`, `dataLabels`, `gradient`, `timestack`, `hierarchical`) |
| Reactive updates (`chart.update()`, not destroy/recreate) | Implemented — diffed on top-level `type` and the `plugins` array's own reference; unchanged, an update applies in place, a change to either destroys and reconstructs |
| Resize handling | Implemented — automatic via `ResizeObserver` |
| Exposed chart-instance ref (escape hatch) | Implemented — `defineExpose({ chart })` |
| Mixed/combo charts (per-dataset `type`) | Implemented — see the [Mixed charts](/vue/guide/concepts/mixed-charts) guide |
| TypeScript types for every prop, config, and chart kind | Implemented |
| Vue-native lifecycle events (`ready`/`update`/`destroy`) | Not implemented — see [Events](/vue/components/events) |
| Accessibility (ARIA-attribute fallthrough, fallback-content slot) | Implemented — see [Accessibility](/vue/guide/concepts/accessibility) |
| Inline, custom Chart.js plugins (`ChartConfiguration.plugins`, distinct from the 6 official opt-ins above) | Implemented — the `plugins` prop, see [API → Plugins](/vue/api/plugins) |

## Test coverage

All implemented features above are backed by real, confirmed test tiers,
not just written and assumed correct:

- Unit + component tests: 100% coverage (statements/branches/functions/lines)
- Mutation testing (Stryker): 97.73% for this package (one accepted,
  explained survivor), 93.55% for `keystone-chartjs-core` (`plugins.ts`
  alone: 88.14%, with 7 accepted survivors — all one root cause, see
  that file's own doc comment on `withTimestack`)
- End-to-end (real browser, real Chart.js, Chromium/Firefox/WebKit): 69/69
  passing — all 15 chart kinds, all 6 plugins, and resize behavior pass
  across all 3 browsers. No known limitations remain.

See the
[Roadmap](/vue/guide/project/roadmap) for what's next and
[Chart.js coverage analysis](https://github.com/gwinnem/keystone-chartjs-wrappers/blob/main/docs/CHARTJS_ANALYSIS.md)
for the reasoning behind the scope choices above.
