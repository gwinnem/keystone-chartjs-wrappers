---
title: Chart props
description: Props accepted by the <Chart> component.
---

| Prop | Type | Required | Status |
|---|---|---|---|
| `type` | `ChartKind` (see [API → Chart kinds](/vue/api/chart-kinds)) | Yes | Implemented |
| `data` | `ChartConfigData` (re-exported from `keystone-chartjs-core`) | Yes | Implemented |
| `options` | `ChartConfiguration['options']` (Chart.js's own type) | No | Implemented |
| `zoom` | `ZoomPluginOptions \| boolean` | No | Implemented |
| `annotation` | `AnnotationPluginOptions` | No | Implemented |
| `dataLabels` | `DataLabelsPluginOptions \| boolean` | No | Implemented |
| `gradient` | `boolean` | No | Implemented |
| `timestack` | `boolean` | No | Implemented |
| `hierarchical` | `boolean` | No | Implemented |
| `plugins` | `ChartConfiguration['plugins']` (Chart.js's own type) | No | Implemented |

`zoom`/`dataLabels` accept either `true` (apply the plugin with no extra
config) or a config object. `annotation` has no boolean form — its own
`annotations` field is required, since there's no sensible empty default to
apply the plugin with. `gradient`/`timestack`/`hierarchical` are boolean
only — unlike the other three, none has any plugin-level config to merge
into `options.plugins.<id>`; their real config lives elsewhere instead (see
[Plugins](/vue/api/plugins) for the full explanation).

`data` isn't Chart.js's own bare `ChartConfiguration['data']` type — Chart.js's
own types only model its 8 built-in kinds' data shapes; `ChartConfigData` is
a deliberately widened type covering this package's 7 extension kinds too
(see [Data structures](/vue/guide/concepts/data-structures)).

## Custom, inline plugins

`plugins` is Chart.js's own real, separate `ChartConfiguration.plugins`
field — an array of inline, per-chart-instance plugin objects, distinct from
the 6 official opt-in props above. Use it for any custom plugin you write
yourself, or any community plugin this package doesn't ship dedicated
support for:

```vue
<script setup lang="ts">
const customPlugin = {
  id: 'watermark',
  afterDraw(chart) {
    const { ctx, width, height } = chart;
    ctx.save();
    ctx.font = '12px sans-serif';
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.fillText('DRAFT', width - 50, height - 10);
    ctx.restore();
  },
};
</script>

<template>
  <Chart type="bar" :data="data" :plugins="[customPlugin]" />
</template>
```

Unlike `data`/`options`, a `plugins` array that changes its own reference
does **not** update in place — Chart.js only ever reads `plugins` at
construction time, so this package destroys and reconstructs the chart
whenever `plugins` changes by reference, even if `type` itself hasn't
changed. Keep the array reference stable (e.g. a top-level `const`, or
`shallowRef`'d once) unless you actually intend to swap plugins.

## How updates actually work

Passing a new `data`/`options`/plugin-prop value doesn't rebuild the chart —
it's diffed against the current state and applied via a real in-place
`chart.update()`, exactly like calling Chart.js's own `update()` method
directly. Two things trigger a full destroy-and-reconstruct instead: a
change to the top-level `type` prop, or a changed `plugins` array reference
(see above) — changing which package/dataset types are in use *without*
changing the top-level `type` (see
[Mixed charts](/vue/guide/concepts/mixed-charts)) still goes through the
same in-place update path.

## Accessibility attributes

`<Chart>` declares no `inheritAttrs: false`, so Vue's own default
single-root-component behavior forwards any attribute you pass that isn't
one of the props above straight onto the rendered `<canvas>` — including
`aria-label`, `role`, and `aria-describedby`:

```vue
<Chart type="bar" :data="data" aria-label="Quarterly revenue" role="img" />
```

Confirmed via a real component test, not just Vue's documented default —
see [Accessibility](/vue/guide/concepts/accessibility) for the full guide,
including the separate default-slot mechanism for real fallback content
(see [Slots](/vue/components/slots)).

## Escape hatch

`<Chart>` exposes its live Chart.js instance via `defineExpose({ chart })` —
grab it with a template ref for anything not covered by props:

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { Chart } from 'keystone-chartjs-vue';

const chartRef = ref<InstanceType<typeof Chart> | null>(null);
// chartRef.value?.chart is the live Chart.js instance, or null before mount
</script>
```
