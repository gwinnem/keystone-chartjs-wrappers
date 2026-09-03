---
title: Angular
description: A single generic KeystoneChartComponent for Angular, wrapping Chart.js — every built-in chart type plus the financial, boxplot, matrix, sankey, and treemap extensions.
---

`keystone-chartjs-angular` is a single, generic, standalone
`KeystoneChartComponent` for Angular that wraps
[Chart.js](https://www.chartjs.org/) — every built-in chart type, plus the
financial, boxplot/violin, matrix, sankey, and treemap ecosystem extensions,
all selected with one `type` input rather than a different component per
chart.

It sits on top of `keystone-chartjs-core`, the framework-agnostic engine
shared with the Vue and React packages — chart lifecycle, lazy type
registration, and plugin wiring all live there, so this package stays a thin,
idiomatic Angular layer.

## Installation

```bash
pnpm add keystone-chartjs-angular chart.js
```

`@angular/core` and `@angular/common` are peer dependencies — install them
alongside the wrapper.

## Basic usage

```ts
import { Component } from '@angular/core';
import { KeystoneChartComponent } from 'keystone-chartjs-angular';

@Component({
  selector: 'app-revenue-chart',
  standalone: true,
  imports: [KeystoneChartComponent],
  template: `<keystone-chart type="bar" [data]="data" />`,
})
export class RevenueChartComponent {
  data = {
    labels: ['Jan', 'Feb', 'Mar'],
    datasets: [{ label: 'Revenue', data: [12, 19, 8] }],
  };
}
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

## Status

This package is in active development — see the
[implementation plan](https://github.com/gwinnem/keystone-chartjs-wrappers/blob/main/docs/IMPLEMENTATION_PLAN.md)
(Phase 4) for current progress. Component and API reference pages (Inputs,
public members, Styling) land here as that work completes.
