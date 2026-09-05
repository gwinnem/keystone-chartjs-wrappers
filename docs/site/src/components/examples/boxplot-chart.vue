<template>
  <div class="demo-stage">
    <Chart :data="data" :options="options" type="boxplot" />
  </div>
</template>

<script setup lang="ts">
import { Chart } from 'keystone-chartjs-vue';

// A raw number[] per box — @sgratzl/chartjs-chart-boxplot computes
// min/q1/median/q3/max (and outliers) automatically from the raw values;
// no pre-computed statistics needed.
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
