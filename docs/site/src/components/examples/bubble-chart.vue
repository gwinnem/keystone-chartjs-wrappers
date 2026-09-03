<template>
  <div class="demo-stage">
    <Chart :data="data" :options="options" type="bubble" />
  </div>
</template>

<script setup lang="ts">
import { Chart } from 'keystone-chartjs-vue';

const data = {
  datasets: [
    {
      label: 'Products',
      data: [
        { x: 10, y: 20, r: 8 },
        { x: 15, y: 10, r: 14 },
        { x: 26, y: 22, r: 6 },
        { x: 8, y: 30, r: 10 },
        { x: 20, y: 8, r: 18 },
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
