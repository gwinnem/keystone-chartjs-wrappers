<template>
  <div class="demo-status">{{ status }}</div>
  <div class="demo-stage">
    <Chart :data="data" :options="options" type="bar" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { Chart } from 'keystone-chartjs-vue';

const data = {
  labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
  datasets: [{ label: 'Orders', data: [12, 19, 8, 15, 22] }],
};

const status = ref('Click a bar to see its value.');

// Chart.js's own native options.onClick — reaches Chart.js untouched via
// the `options` prop, same as every other option. The callback's second
// argument is already the array of chart elements at the click position
// (Chart.js's own `getElementsAtEventForMode` result), so no extra call
// is needed to find out what was clicked.
const options = {
  responsive: true,
  maintainAspectRatio: false,
  onClick(_event: unknown, elements: { datasetIndex: number; index: number }[]) {
    if (elements.length === 0) {
      status.value = 'Click a bar to see its value.';
      return;
    }
    const { datasetIndex, index } = elements[0];
    const label = data.labels[index];
    const value = data.datasets[datasetIndex].data[index];
    status.value = `${data.datasets[datasetIndex].label} on ${label}: ${value}`;
  },
};
</script>

<style scoped>
.demo-status {
  margin-bottom: 12px;
  font-family: var(--kg-font-body);
  font-size: 13px;
  color: var(--kg-text-muted, #666);
  min-height: 1.2em;
}

.demo-stage {
  height: 320px;
}
</style>
