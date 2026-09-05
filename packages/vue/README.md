# keystone-chartjs-vue

<div align="center">

<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 22 22" fill="none" width="72" height="72">
  <rect x="1" y="10" width="4" height="11" rx="1" fill="#4FB8C9"/>
  <rect x="7" y="4" width="4" height="17" rx="1" fill="#F2A93B"/>
  <rect x="13" y="12" width="4" height="9" rx="1" fill="#4FB8C9"/>
</svg>

[![Documentation](https://img.shields.io/badge/docs-kcw.winnem.tech%2Fvue-green?style=flat-square)](https://kcw.winnem.tech/vue/guide/introduction)
[![CI](https://github.com/gwinnem/keystone-chartjs-wrappers/actions/workflows/ci.yml/badge.svg)](https://github.com/gwinnem/keystone-chartjs-wrappers/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/keystone-chartjs-vue?style=flat-square)](https://www.npmjs.com/package/keystone-chartjs-vue)
[![code style: prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg?style=flat-square)](https://github.com/prettier/prettier)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

</div>

A single, generic `<Chart>` component for Vue 3 wrapping Chart.js — every
built-in chart type plus the most popular ecosystem extensions, selected via
a `type` prop. Zero manual `Chart.register(...)` calls required.

## Installation

```bash
npm install keystone-chartjs-vue chart.js
```

`chart.js` is a peer dependency — install it alongside this package.

## Quick start

```vue
<script setup lang="ts">
import { Chart } from 'keystone-chartjs-vue';

const data = {
  labels: ['Jan', 'Feb', 'Mar'],
  datasets: [{ label: 'Revenue', data: [50, 65, 58] }],
};

const options = { responsive: true };
</script>

<template>
  <Chart type="bar" :data="data" :options="options" aria-label="Monthly revenue" />
</template>
```

## Supported chart kinds

| `type` value | Kind | Backed by |
|---|---|---|
| `bar` | Bar (vertical or horizontal via `indexAxis: 'y'`) | Chart.js built-in |
| `line` | Line / area | Chart.js built-in |
| `bubble` | Bubble | Chart.js built-in |
| `scatter` | Scatter | Chart.js built-in |
| `doughnut` | Doughnut | Chart.js built-in |
| `pie` | Pie | Chart.js built-in |
| `polarArea` | Polar area | Chart.js built-in |
| `radar` | Radar | Chart.js built-in |
| `candlestick` | Candlestick (OHLC financial) | chartjs-chart-financial |
| `ohlc` | OHLC bar | chartjs-chart-financial |
| `boxplot` | Box plot | @sgratzl/chartjs-chart-boxplot |
| `violin` | Violin plot | @sgratzl/chartjs-chart-boxplot |
| `matrix` | Matrix / heatmap | chartjs-chart-matrix |
| `sankey` | Sankey flow diagram | chartjs-chart-sankey |
| `treemap` | Treemap | chartjs-chart-treemap |

## Props

| Prop | Type | Required | Description |
|---|---|---|---|
| `type` | `ChartKind` | ✅ | Which chart to render |
| `data` | `ChartConfigData` | ✅ | Chart.js dataset configuration |
| `options` | `ChartConfiguration['options']` | — | Chart.js options |
| `zoom` | `ZoomPluginOptions \| boolean` | — | Opt in to chartjs-plugin-zoom |
| `annotation` | `AnnotationPluginOptions` | — | Opt in to chartjs-plugin-annotation |
| `dataLabels` | `DataLabelsPluginOptions \| boolean` | — | Opt in to chartjs-plugin-datalabels |
| `gradient` | `boolean` | — | Opt in to chartjs-plugin-gradient (config lives on each dataset) |
| `timestack` | `boolean` | — | Opt in to chartjs-scale-timestack (alternative time axis) |
| `hierarchical` | `boolean` | — | Opt in to chartjs-plugin-hierarchical (collapsible tree axis) |
| `imageLabel` | `ImageLabelPluginOptions` | — | Opt in to chartjs-plugin-image-label (draws an image on each doughnut/pie slice) |
| `autocolors` | `AutocolorsPluginOptions \| boolean` | — | Opt in to chartjs-plugin-autocolors (automatically assigns a distinct color per dataset) |
| `deferred` | `DeferredPluginOptions \| boolean` | — | Opt in to chartjs-plugin-deferred (defers the chart's initial update until it scrolls into the viewport) |
| `plugins` | `ChartConfiguration['plugins']` | — | Inline, custom Chart.js plugin objects |

Any attribute that isn't a declared prop (including `aria-label`, `role`,
`id`, `class`, `style`) is forwarded directly onto the rendered `<canvas>`
element via Vue's own attribute-fallthrough behavior.

## Slots

| Slot | Description |
|---|---|
| `default` | Fallback content rendered inside the `<canvas>` tags — shown by browsers and assistive technology that cannot render canvas at all |

## Escape hatch

Access the live Chart.js instance via a template ref:

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { Chart } from 'keystone-chartjs-vue';

const chartRef = ref<InstanceType<typeof Chart> | null>(null);
// chartRef.value?.chart — live Chart.js instance after mount
</script>

<template>
  <Chart ref="chartRef" type="bar" :data="data" />
</template>
```

## Plugins

```vue
<!-- Zoom/pan -->
<Chart type="line" :data="data" zoom />
<Chart type="line" :data="data" :zoom="{ zoom: { wheel: { enabled: true } } }" />

<!-- Annotations -->
<Chart type="line" :data="data" :annotation="{ annotations: { line1: { type: 'line', yMin: 50, yMax: 50 } } }" />

<!-- Data labels -->
<Chart type="bar" :data="data" dataLabels />

<!-- Gradient (boolean only — config lives on each dataset, not here) -->
<Chart type="bar" gradient :data="{ datasets: [{ data: [...], gradient: { backgroundColor: { axis: 'y', colors: { 0: 'red', 100: 'green' } } } }] }" />

<!-- Timestack (boolean only — registers via a side-effect import, no Chart.register call) -->
<Chart type="line" timestack :data="{ datasets: [{ data: [{ x: 1735689600000, y: 1 }] }] }" :options="{ scales: { x: { type: 'timestack' } } }" />

<!-- Hierarchical (boolean only — requires this scale's own tree-node data shape) -->
<Chart type="bar" hierarchical :data="{ labels: [{ label: '2024', children: ['Q1', 'Q2'] }], datasets: [{ data: [{ value: 100, children: [40, 60] }] }] }" :options="{ scales: { x: { type: 'hierarchical' } } }" />

<!-- Image label (imagesList is required — no plain-boolean form) -->
<Chart type="doughnut" :image-label="{ imagesList: [{ imageUrl: 'chrome.png', imageWidth: 32, imageHeight: 32 }] }" :data="data" />

<!-- Autocolors (accepts true or a config object, like zoom/dataLabels) -->
<Chart type="line" autocolors :data="data" />

<!-- Deferred (accepts true or a config object, like zoom/dataLabels) -->
<Chart type="bar" :deferred="{ xOffset: 150, yOffset: '50%', delay: 500 }" :data="data" />

<!-- Custom, inline plugins (any plugin outside the 9 official ones above) -->
<Chart type="bar" :data="data" :plugins="[customPlugin]" />
```

Unlike `data`/`options`, changing the `plugins` array's own reference
forces a destroy-and-reconstruct rather than an in-place update, since
Chart.js only ever reads `plugins` at construction time.

## Mixed charts

```vue
<Chart
  type="bar"
  :data="{
    labels: ['Jan', 'Feb', 'Mar'],
    datasets: [
      { label: 'Revenue', data: [50, 65, 58] },
      { label: 'Target', data: [55, 60, 62], type: 'line' }
    ]
  }"
/>
```

## Documentation

Full guide, API reference, concept pages, and live examples at
**[kcw.winnem.tech](https://kcw.winnem.tech/vue/guide/introduction)**.

## License

MIT — see [LICENSE](LICENSE).
Copyright (c) 2025 Geirr Winnem.
