<template>
  <div class="demo-stage">
    <Chart :data="data" :options="options" type="treemap" />
  </div>
</template>

<script setup lang="ts">
import { Chart } from 'keystone-chartjs-vue';

// A flat number[] — chartjs-chart-treemap's own simplest supported
// shape; no `tree`/`key`/`groups` needed at all for a single-level
// treemap like this one.
const data = {
  datasets: [
    {
      label: 'Bundle size by package',
      tree: [45, 30, 12, 8, 5],
      labels: ['core', 'vue', 'react', 'angular', 'shared-types'],
    },
  ],
};

const options = { responsive: true, maintainAspectRatio: false };
</script>

<style scoped>
.demo-stage {
  height: 320px;
}
</style>
