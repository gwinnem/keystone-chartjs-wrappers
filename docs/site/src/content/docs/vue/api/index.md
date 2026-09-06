---
title: API overview
description: What keystone-chartjs-vue exports beyond the <Chart> component itself.
---

| Export | From | Status |
|---|---|---|
| `Chart` | `keystone-chartjs-vue` | Implemented |
| `ChartKind` | re-exported from `keystone-chartjs-core` | Implemented |
| `ChartConfigData`, `ChartConfigDataset` | re-exported from `keystone-chartjs-core` | Implemented |
| `ChartUpdatePayload` | re-exported from `keystone-chartjs-core` — covers the `plugins` field's own type too | Implemented |
| `CHART_TYPE_REGISTRY` | re-exported from `keystone-chartjs-core` | Implemented |
| `ChartJs`, `ChartConfiguration` | re-exported from `keystone-chartjs-core` (Chart.js's own types) | Implemented |
| Plugin option types (`ZoomPluginOptions`, `AnnotationPluginOptions`, `DataLabelsPluginOptions`, `AutocolorsPluginOptions`, `DeferredPluginOptions`, `ImageLabelPluginOptions`) | re-exported from `keystone-chartjs-core` | Implemented |

See:
- [Chart kinds](/vue/api/chart-kinds) — the full list of `type` values this
  package accepts, and what package (if any) backs each one
- [Plugins](/vue/api/plugins) — the official Chart.js plugins this package
  wires in as opt-in props
