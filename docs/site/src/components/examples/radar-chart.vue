<template>
  <div class="demo-stage">
    <Chart :data="data" :options="options" type="radar" />
  </div>
</template>

<script setup lang="ts">
import { Chart } from 'keystone-chartjs-vue';

const data = {
  labels: ['Speed', 'Reliability', 'Comfort', 'Safety', 'Efficiency'],
  datasets: [
    { label: 'Model A', data: [8, 6, 7, 9, 5] },
    { label: 'Model B', data: [6, 9, 8, 7, 8] },
  ],
};

const options = { responsive: true, maintainAspectRatio: false };
</script>

<style scoped>
.demo-stage {
  height: 320px;
}
</style>
