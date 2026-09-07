---
title: Keystone ChartJs Vue Wrapper
description: A single generic <Chart type="..."> component for Vue 3, wrapping Chart.js — every built-in chart type plus the financial, boxplot, matrix, sankey, and treemap extensions.
---

`keystone-chartjs-vue` is a single, generic `<Chart>` component for Vue 3 that
wraps [Chart.js](https://www.chartjs.org/) — every built-in chart type, plus
the financial, boxplot/violin, matrix, sankey, and treemap ecosystem
extensions, all selected with one `type` prop rather than a different
component per chart.

It sits on top of `keystone-chartjs-core`, the framework-agnostic engine
shared with the React and Angular packages — chart lifecycle, lazy type
registration, and plugin wiring all live there, so this package stays a thin,
idiomatic Vue layer.

## Installation

```bash
pnpm add keystone-chartjs-vue chart.js
```

`chart.js` is a peer dependency — install it alongside the wrapper.

## Basic usage

```vue
<script setup lang="ts">
import { Chart } from 'keystone-chartjs-vue';

const data = {
  labels: ['Jan', 'Feb', 'Mar'],
  datasets: [{ label: 'Revenue', data: [12, 19, 8] }],
};
</script>

<template>
  <Chart type="bar" :data="data" />
</template>
```

Swap `type="bar"` for `type="line"`, `type="doughnut"`, `type="candlestick"`,
`type="sankey"` — any kind covered in the chart-type table below — and the
same component renders it.

## Supported chart types

| Category | Kinds |
|---|---|
| Chart.js built-in (8) | `bar`, `line`, `bubble`, `scatter`, `doughnut`, `pie`, `polarArea`, `radar` |
| Ecosystem extensions | `candlestick`, `ohlc`, `boxplot`, `violin`, `matrix`, `sankey`, `treemap` |

Extension kinds are lazily registered on first use, so a project that only
renders bar and line charts never pays for the financial or treemap
controllers in its bundle. See
[the Chart.js coverage analysis](https://github.com/gwinnem/keystone-chartjs-wrappers/blob/main/docs/CHARTJS_ANALYSIS.md)
for the full source-by-source breakdown of every kind and which package backs
it.
