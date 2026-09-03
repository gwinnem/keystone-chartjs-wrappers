<template>
  <div class="demo-stage">
    <Chart :data="data" :options="options" type="pie" />
  </div>
</template>

<script setup lang="ts">
import { Chart } from 'keystone-chartjs-vue';

const data = {
  labels: ['Rent', 'Food', 'Transport', 'Savings'],
  datasets: [{ data: [35, 25, 15, 25] }],
};

const options = { responsive: true, maintainAspectRatio: false };
</script>

<style scoped>
.demo-stage {
  height: 320px;
}
</style>
