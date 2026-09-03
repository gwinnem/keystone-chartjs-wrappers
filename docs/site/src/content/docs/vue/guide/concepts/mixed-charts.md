---
title: Mixed charts
description: Combining more than one chart type in a single chart, via per-dataset type overrides.
---

Chart.js lets any individual dataset override the chart's own top-level
`type` — that's how "mixed charts" work: a bar-and-line combo, for example,
is just a `bar` chart where one dataset says `type: 'line'`. See the [Mixed
chart example](/vue/examples/mixed-chart/) for a full, working version.

## How it works

```js
const data = {
  labels: [...],
  datasets: [
    { label: 'Revenue', data: [...] },                          // inherits the chart's own type
    { label: 'Target', data: [...], type: 'line' },              // overridden
  ],
};
```

```html
<Chart type="bar" :data="data" :options="options" />
```

A dataset with no `type` of its own simply inherits the chart's top-level
`type` — only datasets that need to differ set their own.

## Registration is automatic, per dataset

`keystone-chartjs-vue` doesn't need every kind used in a chart declared up
front. Internally, `collectChartKinds()` walks the top-level `type` *and*
every dataset's own `type` override, registering whichever backing
controller/element hasn't been registered yet — on both initial mount and
every subsequent update. This applies identically whether the overridden
kind is one of Chart.js's 8 built-ins or one of this library's own 7
ecosystem extension kinds (e.g. a `candlestick` dataset layered under a
`line` chart) — an extension kind used only as a dataset override is
registered lazily on first use, exactly like a top-level one.

## Updates still diff on the top-level `type` only

Changing an individual dataset's own `type` (while the chart's own
top-level `type` stays the same) still goes through the normal in-place
`chart.update()` path, not a full destroy-and-recreate — this library's own
update-vs-recreate decision is based strictly on the top-level `type`,
matching the same rule used everywhere else in this library.

## Combining with per-dataset scales

Mixed types compose with per-dataset `xAxisID`/`yAxisID` — see [Axes &
scales](/vue/guide/concepts/axes-and-scales) — so a single chart can combine
different chart kinds *and* different scales at the same time, exactly as
it would in plain Chart.js.
