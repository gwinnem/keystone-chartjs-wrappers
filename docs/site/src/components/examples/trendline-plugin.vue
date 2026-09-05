<template>
  <div class="demo-stage">
    <Chart type="line" :data="data" :trendline="true" />
  </div>
</template>

<script setup lang="ts">
import { Chart } from 'keystone-chartjs-vue';

const data = {
  labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May'],
  datasets: [
    {
      label: 'Revenue',
      data: [12, 19, 15, 24, 30],
      trendlineLinear: {
        colorMin: 'red',
        colorMax: 'red',
        lineStyle: 'dotted',
        width: 2,
      },
    },
  ],
};
</script>

<style scoped>
.demo-stage {
  height: 320px;
}
</style>
