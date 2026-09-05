<template>
  <div class="demo-stage">
    <Chart :data="data" :options="options" :annotation="annotation" type="line" />
  </div>
</template>

<script setup lang="ts">
import { Chart } from 'keystone-chartjs-vue';

const data = {
  labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
  datasets: [{ label: 'Response time (ms)', data: [42, 55, 38, 61, 47, 90] }],
};

const options = { responsive: true, maintainAspectRatio: false };

// annotations has no plain-boolean form — there's no sensible empty
// default, so a real config object with at least one entry is required.
const annotation = {
  annotations: {
    threshold: {
      type: 'line',
      yMin: 60,
      yMax: 60,
      borderColor: 'rgb(224, 89, 66)',
      borderWidth: 2,
      borderDash: [6, 6],
      label: {
        display: true,
        content: 'SLA threshold',
        position: 'end',
      },
    },
  },
};
</script>

<style scoped>
.demo-stage {
  height: 320px;
}
</style>
