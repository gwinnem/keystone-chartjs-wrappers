<template>
  <div class="demo-stage">
    <Chart :data="data" :options="options" autocolors type="line" />
  </div>
</template>

<script setup lang="ts">
import { Chart } from 'keystone-chartjs-vue';

// No colors set on any dataset below — autocolors assigns a distinct
// generated color to each one automatically, in 'dataset' mode (the
// real default).
const data = {
  labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
  datasets: [
    { label: 'Product A', data: [12, 19, 8, 15, 22, 18] },
    { label: 'Product B', data: [8, 14, 20, 11, 9, 16] },
    { label: 'Product C', data: [20, 10, 15, 22, 18, 25] },
  ],
};

const options = { responsive: true, maintainAspectRatio: false };
</script>

<style scoped>
.demo-stage {
  height: 320px;
}
</style>
