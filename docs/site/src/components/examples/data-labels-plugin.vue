<template>
  <div class="demo-stage">
    <Chart :data="data" :options="options" dataLabels type="bar" />
  </div>
</template>

<script setup lang="ts">
import { Chart } from 'keystone-chartjs-vue';

const data = {
  labels: ['Q1', 'Q2', 'Q3', 'Q4'],
  datasets: [{ label: 'Revenue', data: [50, 65, 58, 72] }],
};

const options = { responsive: true, maintainAspectRatio: false };
</script>

<style scoped>
.demo-stage {
  height: 320px;
}
</style>
