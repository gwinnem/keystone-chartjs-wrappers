---
title: Recipes
description: Practical patterns for real-time updates, theming, responsive sizing, loading states, and exporting a chart as an image.
---

Task-oriented patterns rather than API reference — see [Props](/vue/components/props)
for the full prop list each of these draws on.

## Real-time / polling data updates

Mutate a reactive `data` object in place (or replace it with a new
object) and `<Chart>` diffs and applies the change via a real, in-place
`chart.update()` — no manual Chart.js call needed:

```vue
<script setup lang="ts">
import { reactive, onMounted, onUnmounted } from 'vue';
import { Chart } from 'keystone-chartjs-vue';

const data = reactive({
  labels: [] as string[],
  datasets: [{ label: 'Live value', data: [] as number[] }],
});

let timer: ReturnType<typeof setInterval>;

onMounted(() => {
  timer = setInterval(() => {
    const now = new Date().toLocaleTimeString();
    data.labels.push(now);
    data.datasets[0].data.push(Math.round(Math.random() * 100));
    // Keep a rolling window instead of growing forever.
    if (data.labels.length > 20) {
      data.labels.shift();
      data.datasets[0].data.shift();
    }
  }, 1000);
});

onUnmounted(() => clearInterval(timer));
</script>

<template>
  <Chart type="line" :data="data" :options="{ animation: false }" />
</template>
```

`animation: false` avoids each new point re-triggering a full draw-in
animation — worth setting for anything updating on an interval shorter
than the animation itself. The same pattern works for a WebSocket
message handler in place of `setInterval` — push into the reactive
`data` object from the message callback instead.

## Dark/light theme switching

Make `options` reactive and derive its color-bearing fields from a
theme flag — `<Chart>` diffs `options` the same way it diffs `data`, so
flipping the theme just triggers a normal in-place update, no manual
Chart.js call needed:

```vue
<script setup lang="ts">
import { ref, computed } from 'vue';
import { Chart } from 'keystone-chartjs-vue';

const isDark = ref(true);

const options = computed(() => ({
  responsive: true,
  scales: {
    x: { ticks: { color: isDark.value ? '#f5f4ef' : '#14171a' } },
    y: { ticks: { color: isDark.value ? '#f5f4ef' : '#14171a' } },
  },
  plugins: {
    legend: { labels: { color: isDark.value ? '#f5f4ef' : '#14171a' } },
  },
}));
</script>

<template>
  <button @click="isDark = !isDark">Toggle theme</button>
  <Chart type="bar" :data="data" :options="options" />
</template>
```

For an app-wide default (every chart, not just one instance) rather
than per-chart `options`, set Chart.js's own global `Chart.defaults`
directly instead — see [Options resolution](/vue/guide/concepts/options-resolution)'s
own section on that.

## Server-fetched data with a loading state

Chart.js needs real `data` synchronously at mount — fetching first and
gating the component behind a loading flag avoids mounting against
`null`/empty data and then replacing it a moment later:

```vue
<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { Chart } from 'keystone-chartjs-vue';

const loading = ref(true);
const data = ref<{ labels: string[]; datasets: { label: string; data: number[] }[] } | null>(null);

onMounted(async () => {
  const res = await fetch('/api/revenue');
  data.value = await res.json();
  loading.value = false;
});
</script>

<template>
  <p v-if="loading">Loading…</p>
  <Chart v-else type="bar" :data="data!" />
</template>
```

## Responsive sizing

`<Chart>` already handles resize automatically — a `ResizeObserver` on
the canvas's own parent element calls `chart.resize()` whenever that
parent's size changes (see [API → Lifecycle](/core/api/lifecycle)), so
there's no manual resize wiring to add. The part that trips people up
instead is giving that **parent** a real, defined size in the first
place — an unconstrained parent collapses to the canvas's own intrinsic
size (or `0`), which looks like a broken/invisible chart with nothing
actually wrong on the component's side:

```vue
<template>
  <!-- The parent needs a real height — a canvas has none of its own. -->
  <div style="height: 320px;">
    <Chart type="line" :data="data" :options="{ responsive: true, maintainAspectRatio: false }" />
  </div>
</template>
```

`maintainAspectRatio: false` (Chart.js's own option) lets the chart fill
that parent's exact height instead of computing its own height from a
fixed aspect ratio — the combination most people mean by "make it fill
its container."

## Exporting a chart as an image

The exposed `chart` ref is the real, live Chart.js instance — its own
real `toBase64Image()` method (not anything this library adds) returns
a data URL you can wire straight into a download link:

```vue
<script setup lang="ts">
import { ref } from 'vue';
import { Chart } from 'keystone-chartjs-vue';

const chartRef = ref<InstanceType<typeof Chart> | null>(null);

function downloadImage() {
  const url = chartRef.value?.chart?.toBase64Image();
  if (!url) return;
  const link = document.createElement('a');
  link.href = url;
  link.download = 'chart.png';
  link.click();
}
</script>

<template>
  <Chart ref="chartRef" type="bar" :data="data" />
  <button @click="downloadImage">Download PNG</button>
</template>
```

See [Props → Escape hatch](/vue/components/props#escape-hatch) for more
on the exposed `chart` ref.
