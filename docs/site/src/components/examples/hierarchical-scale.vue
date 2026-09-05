<template>
  <p class="demo-hint">Click a category's own box below the axis to expand/collapse it, or the small dot on a fully-expanded group to zoom in — click again on the zoomed-in view to zoom back out.</p>
  <div class="demo-stage">
    <Chart type="bar" :data="data" :options="options" hierarchical />
  </div>
</template>

<script setup lang="ts">
import { Chart } from 'keystone-chartjs-vue';
import type { ChartConfigData, ChartConfiguration } from 'keystone-chartjs-core';

// Hierarchical requires data.labels/dataset.data in this scale's own
// tree-node shape (HierarchicalRawLabelNode/HierarchicalValueNode), not
// the flat arrays every other kind/plugin in this project accepts —
// confirmed directly from the real package's own type declarations
// (github.com/sgratzl/chartjs-plugin-hierarchical), which this local
// port's own hierarchicalScale.ts dissects faithfully.
//
// `options` needs no cast (unlike the equivalent timestack-scale.vue
// example): this project's own local port statically declares its own
// `declare module 'chart.js'` augmentation for `type: 'hierarchical'`,
// which — unlike the original, still-a-dependency package's own
// identical augmentation — is picked up automatically here, since
// `keystone-chartjs-core` (which now includes this augmentation) is
// already statically imported by every real consumer. `data` still
// needs one: `ChartConfigData`'s own `labels` field is intentionally
// loose (`unknown[]`, accepts this tree shape as-is), but its own
// `datasets[].data` field is not — this project's own hand-rolled
// `ChartConfigDataset` type (see types.ts) only covers Chart.js's own
// built-in data-point shapes plus this project's other 6 extension
// kinds, none of which include `HierarchicalValueNode`'s own
// `{ value, children }` shape.
const data = {
  labels: [
    { label: '2024', children: ['Q1', 'Q2', 'Q3', 'Q4'] },
    { label: '2025', children: ['Q1', 'Q2', 'Q3', 'Q4'] },
  ],
  datasets: [
    {
      label: 'Revenue',
      data: [
        { value: 100, children: [20, 25, 22, 33] },
        { value: 120, children: [28, 30, 29, 33] },
      ],
    },
  ],
} as unknown as ChartConfigData;

// The scale is opted into via options.scales.<id>.type = 'hierarchical'
// — this already reaches Chart.js untouched via the existing `options`
// prop. The `hierarchical` prop on <Chart> only registers the scale so
// that value is recognized at all.
//
// `layout.padding.bottom` is a real, necessary addition, confirmed via
// a live, reproduced issue (not a guess): this scale's own companion
// plugin draws its own expand/collapse indicator boxes directly below
// the axis's own real `bottom` edge (`scale.bottom + options.padding`),
// but — same as the original, still-a-dependency package this ports
// from — never participates in Chart.js's own layout/padding
// calculation itself. An attempt at fixing this scale-side (a `fit()`
// override reserving its own extra height) was tried and reverted: a
// live, reproduced regression showed Chart.js's own real, iterative
// layout pass calling `fit()` more than once per render, each call
// adding the same extra amount again on top of the last and eventually
// collapsing the real plot area to near-zero height. Reserving the
// space explicitly here, once, is the safe, verified fix — `40`
// comfortably covers one row (`hierarchyBoxLineHeight`'s own default is
// `30`) plus a small margin.
const options: ChartConfiguration['options'] = {
  responsive: true,
  maintainAspectRatio: false,
  layout: { padding: { bottom: 40 } },
  scales: {
    x: { type: 'hierarchical' },
  },
};
</script>

<style scoped>
.demo-hint {
  color: var(--kg-text-lo-dark);
  font-size: 13px;
  margin-bottom: 12px;
}

.demo-stage {
  height: 320px;
}
</style>
