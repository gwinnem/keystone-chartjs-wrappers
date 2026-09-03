<template>
  <div class="demo-stage">
    <Chart :data="data" :options="options" type="doughnut" />
  </div>
</template>

<script setup lang="ts">
import { Chart } from 'keystone-chartjs-vue';

const data = {
  labels: ['Chrome', 'Safari', 'Firefox', 'Edge'],
  datasets: [{ data: [58, 20, 12, 10] }],
};

const options = { responsive: true, maintainAspectRatio: false };
</script>

<style scoped>
.demo-stage {
  height: 320px;
}
</style>
