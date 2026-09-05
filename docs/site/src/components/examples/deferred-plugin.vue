<template>
  <div class="demo-stage">
    <Chart :data="data" :options="options" :deferred="{ delay: 300 }" type="bar" />
  </div>
</template>

<script setup lang="ts">
import { Chart } from 'keystone-chartjs-vue';

// The chart's own real initial update (and its initial-render bar-grow
// animation) is deferred until this canvas actually scrolls into the
// viewport, plus a 300ms delay after that — scroll this example out of
// view and back in to see it animate in again on re-entry.
const data = {
  labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
  datasets: [{ label: 'Revenue', data: [12, 19, 8, 15, 22, 18] }],
};

const options = { responsive: true, maintainAspectRatio: false };
</script>

<style scoped>
.demo-stage {
  height: 320px;
}
</style>
