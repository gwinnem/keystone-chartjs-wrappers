---
title: Chart kinds
description: Every chart kind this library resolves to a controller for, and how lazy registration works.
---

- **`ChartKind`** — every chart kind this library resolves to a
  controller for: Chart.js's own 8 built-in types, plus the 7 ecosystem
  extensions (`candlestick`, `ohlc`, `boxplot`, `violin`, `matrix`,
  `sankey`, `treemap`).
- **`CHART_TYPE_REGISTRY`** — maps each `ChartKind` to the npm package (and
  the exact named exports) whose controller/element must be registered
  before a chart of that kind can render. `null` for the 8 built-ins,
  which need no extra registration.
- **`ensureChartKindRegistered(kind)`** — dynamically imports and
  registers the given kind's controller/elements exactly once per kind,
  per process; a cache makes repeat calls for an already-registered kind
  a no-op. `createChartController` and `handle.update()` (see
  [Lifecycle](/core/api/lifecycle)) both call this for every kind a
  payload touches — not usually called directly.
