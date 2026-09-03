<template>
  <div class="demo-stage">
    <Chart type="bar" :data="data" :options="options" hierarchical />
  </div>
</template>

<script setup lang="ts">
import { Chart } from 'keystone-chartjs-vue';
import type { ChartConfigData, ChartConfiguration } from 'keystone-chartjs-core';

// Hierarchical requires data.labels/dataset.data in this scale's own
// tree-node shape (ILabelNode/IValueNode), not the flat arrays every
// other kind/plugin in this project accepts — confirmed directly from
// the real package's own type declarations
// (github.com/sgratzl/chartjs-plugin-hierarchical).
//
// Cast needed: neither Chart.js's own built-in data types nor this
// project's own ChartConfigData model this tree shape, since it's only
// ever recognized at runtime, after the scale's own dynamic import
// registers it via Chart.register(HierarchicalScale).
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
const options = {
  responsive: true,
  maintainAspectRatio: false,
  scales: {
    x: { type: 'hierarchical' },
  },
} as unknown as ChartConfiguration['options'];
</script>

<style scoped>
.demo-stage {
  height: 320px;
}
</style>
