<template>
  <div class="demo-stage">
    <Chart :data="data" :options="options" type="violin" />
  </div>
</template>

<script setup lang="ts">
import { Chart } from 'keystone-chartjs-vue';

// The identical raw number[]-per-series shape boxplot uses; `violin`
// differs only in how each series is drawn (a full kernel-density
// distribution shape, rather than a five-number-summary box).
const data = {
  labels: ['Team A', 'Team B', 'Team C'],
  datasets: [
    {
      label: 'Response time (ms)',
      data: [
        [120, 132, 101, 134, 90, 230, 210, 125, 140, 133],
        [150, 145, 160, 149, 200, 155, 158, 300, 152, 148],
        [95, 100, 98, 102, 105, 97, 250, 99, 101, 96],
      ],
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
