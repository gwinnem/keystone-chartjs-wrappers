<template>
  <div class="demo-stage">
    <Chart :data="data" :options="options" type="scatter" />
  </div>
</template>

<script setup lang="ts">
import { Chart } from 'keystone-chartjs-vue';

const data = {
  datasets: [
    {
      label: 'Measurements',
      data: [
        { x: 1, y: 3 },
        { x: 2, y: 7 },
        { x: 3, y: 4 },
        { x: 4, y: 9 },
        { x: 5, y: 6 },
        { x: 6, y: 11 },
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
