<template>
  <div class="demo-stage">
    <Chart type="bar" :data="data" :options="options" gradient />
  </div>
</template>

<script setup lang="ts">
import { Chart } from 'keystone-chartjs-vue';

// Gradient config lives on the DATASET itself (dataset.gradient), not
// under options.plugins.gradient — confirmed directly from the real
// package's own README (github.com/kurkle/chartjs-plugin-gradient). The
// `gradient` prop on <Chart> only registers the plugin so this
// dataset-level config actually takes effect.
const data = {
  labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May'],
  datasets: [
    {
      label: 'Revenue',
      data: [20, 45, 70, 90, 60],
      gradient: {
        backgroundColor: {
          axis: 'y',
          colors: { 0: 'red', 50: 'yellow', 100: 'green' },
        },
      },
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
