---
title: Chart kinds
description: Every value the type prop accepts, and which package (if any) backs it.
---

| `type` value | Source | Registration |
|---|---|---|
| `bar` | Chart.js built-in | Eager |
| `line` | Chart.js built-in | Eager |
| `bubble` | Chart.js built-in | Eager |
| `scatter` | Chart.js built-in | Eager |
| `doughnut` | Chart.js built-in | Eager |
| `pie` | Chart.js built-in | Eager |
| `polarArea` | Chart.js built-in | Eager |
| `radar` | Chart.js built-in | Eager |
| `candlestick` | `chartjs-chart-financial` | Lazy, on first use |
| `ohlc` | `chartjs-chart-financial` | Lazy, on first use |
| `boxplot` | `@sgratzl/chartjs-chart-boxplot` | Lazy, on first use |
| `violin` | `@sgratzl/chartjs-chart-boxplot` | Lazy, on first use |
| `matrix` | `chartjs-chart-matrix` | Lazy, on first use |
| `sankey` | `chartjs-chart-sankey` | Lazy, on first use |
| `treemap` | `chartjs-chart-treemap` | Lazy, on first use |

"Lazy, on first use" means the backing package is dynamically imported and
registered via `Chart.register(...)` the first time a chart of that kind is
rendered — not on module load — so a project that never uses, say, `sankey`
never pays for `chartjs-chart-sankey` in its bundle.

**Area charts** aren't a separate `type` — build one from `line` (or
`radar`) with the dataset's own `fill` option, matching Chart.js's own
convention. **Mixed/combo charts** work by setting `type` per-dataset inside
`data.datasets[]`, overriding the chart-level `type` prop for that dataset
— see [Mixed charts](/vue/guide/concepts/mixed-charts) for the full guide
and a live example.

See [Data structures](/vue/guide/concepts/data-structures) for the `data`
shape each kind expects, and
[docs/CHARTJS_ANALYSIS.md](https://github.com/gwinnem/keystone-chartjs-wrappers/blob/main/docs/CHARTJS_ANALYSIS.md)
for the full research behind this table, including open questions on exact
version pins for the extension packages.
