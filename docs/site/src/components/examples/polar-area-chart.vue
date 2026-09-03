<template>
  <div class="demo-stage">
    <Chart :data="data" :options="options" type="polarArea" />
  </div>
</template>

<script setup lang="ts">
import { Chart } from 'keystone-chartjs-vue';

const data = {
  labels: ['North', 'East', 'South', 'West', 'Central'],
  datasets: [{ data: [11, 16, 7, 14, 9] }],
};

const options = { responsive: true, maintainAspectRatio: false };
</script>

<style scoped>
.demo-stage {
  height: 320px;
}
</style>
