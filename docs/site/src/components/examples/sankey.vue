<template>
  <div class="demo-stage">
    <Chart :data="data" type="sankey" />
  </div>
</template>

<script setup lang="ts">
import { Chart } from 'keystone-chartjs-vue';

// {from, to, flow} — chartjs-chart-sankey's own real data-point shape,
// confirmed against that package's own README.
const data = {
  datasets: [
    {
      label: 'Energy flow',
      data: [
        { from: 'Solar', to: 'Grid', flow: 12 },
        { from: 'Wind', to: 'Grid', flow: 18 },
        { from: 'Grid', to: 'Homes', flow: 20 },
        { from: 'Grid', to: 'Industry', flow: 10 },
      ],
    },
  ],
};
</script>

<style scoped>
.demo-stage {
  height: 320px;
}
</style>
