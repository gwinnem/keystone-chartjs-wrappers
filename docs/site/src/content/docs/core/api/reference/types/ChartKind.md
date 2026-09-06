---
editUrl: false
title: "ChartKind"
---

> **ChartKind** = `ChartType` \| `"candlestick"` \| `"ohlc"` \| `"boxplot"` \| `"violin"` \| `"matrix"` \| `"sankey"` \| `"treemap"`

Every chart "kind" this library resolves to a Chart.js controller for —
the 8 built-in types plus the ecosystem chart-type extensions decided
in docs/IMPLEMENTATION_PLAN.md (financial, boxplot, matrix, sankey,
treemap). Kept as a distinct union from Chart.js's own `ChartType` so
the registry can validate/lazily-register extension controllers before
a chart is constructed.
