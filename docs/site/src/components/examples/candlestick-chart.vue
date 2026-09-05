<template>
  <div class="demo-stage">
    <Chart :data="data" :options="options" type="candlestick" />
  </div>
</template>

<script setup lang="ts">
import { Chart } from 'keystone-chartjs-vue';

// {x, o, h, l, c} — chartjs-chart-financial's own real data-point shape
// (open/high/low/close), confirmed against that package's own README.
// x is a plain day index here to keep the example dependency-free (a
// real time axis needs a date-adapter package this project doesn't
// otherwise depend on).
const data = {
  datasets: [
    {
      label: 'Weekly close',
      data: [
        { x: 1, o: 42, h: 48, l: 40, c: 46 },
        { x: 2, o: 46, h: 47, l: 41, c: 43 },
        { x: 3, o: 43, h: 45, l: 38, c: 39 },
        { x: 4, o: 39, h: 44, l: 37, c: 43 },
        { x: 5, o: 43, h: 50, l: 42, c: 48 },
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
