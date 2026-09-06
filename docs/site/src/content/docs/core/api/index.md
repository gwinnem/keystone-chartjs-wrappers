---
title: API overview
description: What keystone-chartjs-core exports, grouped by area, with links to the full detail pages.
---

Every export below comes from the package's own main entry point
(`import { ... } from 'keystone-chartjs-core'`) unless noted otherwise.

| Export | Area | Status |
|---|---|---|
| `createChartController`, `ChartControllerHandle`, `ChartUpdatePayload` | [Lifecycle](/core/api/lifecycle) | Implemented |
| `ChartConfigData`, `ChartConfigDataset`, `ChartConfiguration`, `ChartJs` | [Lifecycle](/core/api/lifecycle) | Implemented |
| `ChartKind`, `CHART_TYPE_REGISTRY`, `ensureChartKindRegistered` | [Chart kinds](/core/api/chart-kinds) | Implemented |
| `withZoom`, `withAnnotation`, `withDataLabels`, `withGradient`, `withTimestack`, `withHierarchical`, `withImageLabel`, `withAutocolors`, `withDeferred`, `withTrendline` | [Plugins](/core/api/plugins) | Implemented |
| Plugin option types (`ZoomPluginOptions`, `AnnotationPluginOptions`, `DataLabelsPluginOptions`, `AutocolorsPluginOptions`, `DeferredPluginOptions`, `ImageLabelPluginOptions`) | [Plugins](/core/api/plugins) | Implemented |
| `createTestCanvas`, `createTestCanvasWithParent` | [Test utilities](/core/api/test-utils) | Implemented |

See:
- **[Lifecycle](/core/api/lifecycle)** — constructing, updating, resizing,
  and destroying a managed Chart.js instance.
- **[Chart kinds](/core/api/chart-kinds)** — every chart kind this
  library resolves to a controller for, and how lazy registration works.
- **[Plugins](/core/api/plugins)** — the 10 official plugin/scale helpers
  this project wires in.
- **[Test utilities](/core/api/test-utils)** — DOM-fixture helpers
  exported from a separate subpath, for the Vue/React/Angular packages'
  own component tests to share.
