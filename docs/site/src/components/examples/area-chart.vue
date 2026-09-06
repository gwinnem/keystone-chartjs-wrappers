<template>
  <div class="demo-stage">
    <Chart :data="data" :options="options" type="line" />
  </div>
</template>

<script setup lang="ts">
import { Chart } from 'keystone-chartjs-vue';

const data = {
  labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  datasets: [
    {
      label: 'This week',
      data: [12, 19, 14, 25, 22, 30, 28],
      fill: true,
      backgroundColor: 'rgba(79, 184, 201, 0.3)',
      borderColor: 'rgb(79, 184, 201)',
      tension: 0.3,
    },
    {
      label: 'Last week',
      data: [8, 15, 18, 16, 20, 24, 22],
      fill: true,
      backgroundColor: 'rgba(242, 169, 59, 0.3)',
      borderColor: 'rgb(242, 169, 59)',
      tension: 0.3,
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
