---
title: Data structures
description: The data shapes Chart.js accepts, and which ones keystone-chartjs-vue's own extension kinds need instead.
---

The `data` prop on `<Chart>` reaches Chart.js's own dataset-parsing logic
completely untouched — this page explains what Chart.js itself accepts, not
anything this library adds on top.

## Built-in kinds

Chart.js's own built-in kinds (`bar`, `line`, `bubble`, `scatter`, `pie`,
`doughnut`, `polarArea`, `radar`) accept several different shapes for each
dataset's own `data` array:

### Primitive numbers

```js
data.value = {
  labels: ['a', 'b'],
  datasets: [{ data: [20, 10] }],
};
```

Each number lines up with the `labels` array at the same index.

### `[x, y]` tuples

```js
data.value = {
  datasets: [{ data: [[10, 20], [15, null], [20, 10]] }],
};
```

The first element of each pair is the index axis value, the second is the
value axis. `null` marks a skipped point.

### `{x, y}` objects

```js
data.value = {
  datasets: [{ data: [{ x: 10, y: 20 }, { x: 15, y: null }] }],
};
```

This is also Chart.js's own internal parsed format. `x`/`y` accept numbers,
date strings, or category strings depending on the scale type in use (see
[Axes & scales](/vue/guide/concepts/axes-and-scales)).

### Custom-keyed objects, via `options.parsing`

```js
data.value = {
  datasets: [{ data: [{ id: 'Sales', nested: { value: 1500 } }] }],
};
const options = {
  parsing: { xAxisKey: 'id', yAxisKey: 'nested.value' },
};
```

`parsing.xAxisKey`/`yAxisKey` point at whatever property names your own data
actually uses — useful when the data is coming from an API response you
don't want to reshape first. A dotted key that itself contains a literal
dot needs escaping: `'data\\.key'`.

### Disabling parsing entirely

```js
const options = { parsing: false };
```

If your data is already in Chart.js's own internal format (sorted, in the
scale's own internal representation), disabling parsing skips that step
for a real performance gain — see [Performance](/vue/guide/concepts/performance).

## Extension kinds

The 7 ecosystem extension kinds this library ships (`candlestick`, `ohlc`,
`boxplot`, `violin`, `matrix`, `sankey`, `treemap`) each define their own
`data` shape, since Chart.js's own core types have no concept of them at
all. Confirmed against each real package's own docs (not guessed) — see
each kind's own example for the exact shape:

| Kind | Shape |
|---|---|
| `candlestick`, `ohlc` | `{x, o, h, l, c}` per point |
| `boxplot`, `violin` | a raw `number[]` per box — statistics computed automatically |
| `matrix` | `{x, y, v}` per cell, plus scriptable `width`/`height` dataset functions |
| `sankey` | `{from, to, flow}` per link |
| `treemap` | a flat `number[]` — no `tree`/`key`/`groups` needed for the simplest case |

## What `keystone-chartjs-vue` adds

Nothing to the shapes themselves — `data` passes straight through to real
Chart.js, for both built-in and extension kinds alike. What this library
does add: **lazy registration**. The backing package for whichever kind(s)
your `data`/`type` actually use (including per-dataset `type` overrides —
see [Mixed charts](/vue/guide/concepts/mixed-charts)) is dynamically
imported and registered automatically, the first time that kind is
encountered — you never call `Chart.register(...)` yourself for anything
this library ships.
