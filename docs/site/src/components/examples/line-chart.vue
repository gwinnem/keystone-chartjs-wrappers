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
    { label: 'Signups', data: [12, 19, 14, 25, 22, 30, 28] },
  ],
};

const options = { responsive: true, maintainAspectRatio: false };
</script>

<style scoped>
.demo-stage {
  height: 320px;
}
</style>
