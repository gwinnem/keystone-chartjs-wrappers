<template>
  <div class="demo-stage">
    <Chart type="line" :data="data" :options="options" timestack />
  </div>
</template>

<script setup lang="ts">
import { Chart } from 'keystone-chartjs-vue';
import type { ChartConfiguration } from 'keystone-chartjs-core';

// Timestack requires {x, y} points with millisecond timestamps — X-values
// are not parsed, unlike Chart.js's own stock `time` scale. Confirmed
// directly from the real package's own README
// (github.com/jkmnt/chartjs-scale-timestack).
const start = Date.UTC(2026, 0, 1, 0, 0, 0);
const hour = 60 * 60 * 1000;

const data = {
  datasets: [
    {
      label: 'CPU load',
      data: Array.from({ length: 12 }, (_, i) => ({
        x: start + i * hour,
        y: Math.round(20 + Math.random() * 60),
      })),
    },
  ],
};

// The scale is opted into via options.scales.<id>.type = 'timestack' —
// this already reaches Chart.js untouched via the existing `options`
// prop. The `timestack` prop on <Chart> only registers the scale so
// that value is recognized at all.
//
// Cast needed: Chart.js's own built-in scale-type union has no static
// knowledge of 'timestack' at all, since that type string is only ever
// recognized at runtime, after chartjs-scale-timestack's own dynamic
// import registers it as a side effect — the augmenting module is never
// statically imported anywhere in this file's own compile graph. A
// direct `as ChartConfiguration['options']` isn't accepted either —
// TypeScript considers the two types insufficiently overlapping and
// requires routing through `unknown` first, its own standard idiom for
// this class of cast (confirmed via a real error, not assumed).
const options = {
  responsive: true,
  maintainAspectRatio: false,
  scales: {
    x: { type: 'timestack' },
  },
} as unknown as ChartConfiguration['options'];
</script>

<style scoped>
.demo-stage {
  height: 320px;
}
</style>
