---
title: Options resolution
description: How Chart.js decides which value wins when the same option is set in more than one place.
---

Every option `<Chart>` accepts — via the `options` prop, or via Chart.js's
own defaults — goes through Chart.js's own resolution algorithm before it
takes effect. This is entirely Chart.js's own behavior; `keystone-chartjs-vue`
passes `options` through untouched.

## The general idea

More specific always wins over more general. Chart.js checks, in order,
until it finds a value:

1. The most specific place the option could be set (a single dataset, a
   single element).
2. Progressively more general chart-wide settings (`options`, then
   per-chart-type overrides).
3. Chart.js's own global `Chart.defaults`, as a last resort.

## Chart-level options

```
options
overrides[type]
defaults
```

Your own `options` wins. If you didn't set something, Chart.js falls back
to that chart type's own built-in defaults, then to the global defaults.

## Dataset-level options

```
dataset
options.datasets[dataset.type]
options
overrides[type].datasets[dataset.type]
defaults.datasets[dataset.type]
defaults
```

A property set directly on one dataset object wins over everything else —
useful for one-off overrides without touching `options` at all. Note
`dataset.type` here: for [mixed charts](/vue/guide/concepts/mixed-charts),
each dataset's own type is what `options.datasets[...]` and
`defaults.datasets[...]` key off, not the chart's own top-level `type`.

## Element-level options

Point/line/bar/arc element options add one more layer, and a naming
convention worth knowing: an option is looked up first with its element
type as a prefix, then without. For example, a point's own `radius` is
looked up as `pointRadius` first, then `radius`, if `pointRadius` isn't
set anywhere in the chain above.

## Plugin options

```
options.plugins[plugin.id]
overrides[type].plugins[plugin.id]
defaults.plugins[plugin.id]
```

This is exactly where this library's own 3 official-plugin opt-in props
land: `zoom` → `options.plugins.zoom`, `annotation` →
`options.plugins.annotation`, `dataLabels` → `options.plugins.datalabels`.
Passing your own `options.plugins.zoom` directly (rather than through the
`zoom` prop) resolves through this exact same chain — the prop is a
convenience for registering + merging config in one step, not a separate
mechanism.

## Scriptable options

Nearly any option can be a function instead of a static value — called
per data value, receiving a `context` object with information about what's
currently being drawn:

```js
const options = {
  datasets: {
    bar: {
      backgroundColor(context) {
        const value = context.dataset.data[context.dataIndex];
        return value < 0 ? '#e05a4f' : '#3f6fe0';
      },
    },
  },
};
```

Always check `context.type`/`context.dataset.type` inside a scriptable
function before assuming what shape `context` has — the same function can
be invoked in more than one context (dataset-level, element-level, tick
label, tooltip) depending on where it's set.

## Indexable options

An array also works, matched by index — shorter arrays loop rather than
run out:

```js
backgroundColor: ['#e05a4f', '#3f6fe0', '#3fae5c'];
```

A scriptable function is usually the better choice once the logic is
anything beyond a fixed, known list.

## Setting global defaults directly

`Chart.defaults` is a real, shared, module-level object on Chart.js's own
`Chart` class — not something `<Chart>` exposes a prop for, since changing
it from one chart instance would affect every other chart on the page too.
Since `chart.js` is a peer dependency you already install alongside this
library, import its real `Chart` class directly, wherever your app
initializes, once:

```ts
import { Chart } from 'chart.js';
Chart.defaults.font.size = 14;
```

The `ChartJs` type this library re-exports from `keystone-chartjs-core` is
the type-only counterpart of this same class — useful for typing a ref to
this project's own exposed chart instance, not for reaching `.defaults`
itself.
