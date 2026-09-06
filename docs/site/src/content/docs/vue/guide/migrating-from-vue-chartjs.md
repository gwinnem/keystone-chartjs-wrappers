---
title: Migrating from vue-chartjs
description: Moving an existing vue-chartjs project to keystone-chartjs-vue — component shape, registration, and plugin differences.
---

`vue-chartjs` and `keystone-chartjs-vue` both wrap the same underlying
[Chart.js](https://www.chartjs.org/), so your `data`/`options` objects
carry over unchanged — the real differences are in how a chart gets
**registered** and how many **components** you import.

## The core difference: one component per kind vs. one generic component

`vue-chartjs` ships a separate component per chart kind (`Bar`, `Line`,
`Pie`, `Doughnut`, `PolarArea`, `Radar`, `Bubble`, `Scatter`) that you
import individually, and requires you to call Chart.js's own
`ChartJS.register(...)` yourself with every controller/element/scale/
plugin the chart needs:

```vue
<!-- vue-chartjs -->
<script setup>
import { Bar } from 'vue-chartjs';
import { Chart as ChartJS, Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale } from 'chart.js';

ChartJS.register(Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale);

const data = { labels: ['Jan', 'Feb', 'Mar'], datasets: [{ label: 'Revenue', data: [50, 65, 58] }] };
</script>

<template>
  <Bar :data="data" />
</template>
```

`keystone-chartjs-vue` has a single, generic `<Chart>` component with a
`type` prop, and registers whatever the chosen `type` needs
automatically — no `ChartJS.register(...)` call, and no separate
component import per kind:

```vue
<!-- keystone-chartjs-vue -->
<script setup lang="ts">
import { Chart } from 'keystone-chartjs-vue';

const data = { labels: ['Jan', 'Feb', 'Mar'], datasets: [{ label: 'Revenue', data: [50, 65, 58] }] };
</script>

<template>
  <Chart type="bar" :data="data" />
</template>
```

`data`/`options` themselves need no changes at all — both libraries pass
them straight through to Chart.js untouched.

## Component-to-`type` mapping

| `vue-chartjs` component | `keystone-chartjs-vue` `type` |
|---|---|
| `Bar` | `"bar"` |
| `Line` | `"line"` |
| `Pie` | `"pie"` |
| `Doughnut` | `"doughnut"` |
| `PolarArea` | `"polarArea"` |
| `Radar` | `"radar"` |
| `Bubble` | `"bubble"` |
| `Scatter` | `"scatter"` |

`keystone-chartjs-vue` also covers 7 kinds `vue-chartjs` has no
component for at all: `candlestick`, `ohlc`, `boxplot`, `violin`,
`matrix`, `sankey`, `treemap` — each backed by its own real ecosystem
extension package, registered lazily the same automatic way as the 8
built-ins. See [Chart kinds](/vue/api/chart-kinds) for the full list.

## Registration

`vue-chartjs` never calls `ChartJS.register(...)` for you — every
controller, element, scale, and plugin your chart needs must be
imported from `chart.js` and registered explicitly, per component, by
you. Forgetting one throws a real Chart.js error at render time.

`keystone-chartjs-vue` registers automatically: the 8 built-in kinds
are registered eagerly at module load; the 7 ecosystem extension kinds
register lazily, once, the first time a chart of that kind actually
renders. There is no `ChartJS.register(...)` call to write, for kinds
or for any of the 10 official plugins below.

## Plugins

`vue-chartjs` has no plugin system of its own — using any Chart.js
plugin (official or community) means registering it yourself via
`ChartJS.register(...)` and configuring it through plain
`options.plugins.<id>`, the same as using Chart.js directly with no
wrapper at all.

`keystone-chartjs-vue` ships 10 official plugins as one-line opt-in
props — `zoom`, `annotation`, `dataLabels`, `gradient`, `timestack`,
`hierarchical`, `imageLabel`, `autocolors`, `deferred`, `trendline` —
each registered automatically the first time its own prop is used:

```vue
<!-- vue-chartjs: manual registration + plain Chart.js plugin options -->
<script setup>
import { Bar } from 'vue-chartjs';
import { Chart as ChartJS, BarElement, CategoryScale, LinearScale } from 'chart.js';
import zoomPlugin from 'chartjs-plugin-zoom';

ChartJS.register(BarElement, CategoryScale, LinearScale, zoomPlugin);

const options = { plugins: { zoom: { zoom: { wheel: { enabled: true } } } } };
</script>

<template>
  <Bar :data="data" :options="options" />
</template>
```

```vue
<!-- keystone-chartjs-vue: opt-in prop, no manual registration -->
<script setup lang="ts">
import { Chart } from 'keystone-chartjs-vue';
</script>

<template>
  <Chart type="bar" :data="data" :zoom="{ zoom: { wheel: { enabled: true } } }" />
</template>
```

Any Chart.js plugin `keystone-chartjs-vue` doesn't officially ship as
one of those 10 still works, the same way it does in `vue-chartjs` —
via the separate [`plugins` prop](/vue/components/props#custom-inline-plugins),
which passes plain plugin objects straight through to Chart.js's own
`ChartConfiguration.plugins` field untouched.

## Reactivity

Both libraries watch `data`/`options` and update the chart in place
(`chart.update()`) rather than destroying and recreating it — no
behavior change to carry over here. `keystone-chartjs-vue` additionally
diffs the top-level `type` prop and the `plugins` array's own reference:
changing either destroys and reconstructs the chart, since Chart.js
itself only reads those at construction time.

## Accessibility

Both support the same two real mechanisms, named slightly differently:

| | `vue-chartjs` | `keystone-chartjs-vue` |
|---|---|---|
| ARIA attributes | `aria-label`/`aria-describedby`/`role` pass through automatically | Same — any non-prop attribute passes through onto the rendered `<canvas>` |
| Fallback content | Component's own default slot | `<Chart>`'s own default slot |

See [Accessibility](/vue/guide/concepts/accessibility) for the full guide.

## Escape hatch

`vue-chartjs` exposes the underlying Chart.js instance via
`chartInstance`/`chart.js` template refs depending on version;
`keystone-chartjs-vue` exposes it as `chart` via `defineExpose`:

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { Chart } from 'keystone-chartjs-vue';

const chartRef = ref<InstanceType<typeof Chart> | null>(null);
// chartRef.value?.chart — the live Chart.js instance, after mount
</script>

<template>
  <Chart ref="chartRef" type="bar" :data="data" />
</template>
```

## What doesn't change at all

- Your `data`/`options` objects — both libraries pass them straight
  through to Chart.js untouched, so any existing config carries over
  with no changes.
- Chart.js's own behavior, defaults, and every real option — neither
  wrapper changes what Chart.js itself does, only how much
  registration/import boilerplate you write to reach it.
