<template>
  <div class="demo-controls">
    <button class="demo-btn" type="button" @click="randomize">Randomize data</button>
  </div>
  <div class="demo-stage">
    <Chart :data="data" :options="options" type="line" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { Chart } from 'keystone-chartjs-vue';

function randomTemps(): number[] {
  return Array.from({ length: 6 }, () => Math.round(Math.random() * 30) - 5);
}

function randomVisitors(): number[] {
  return Array.from({ length: 6 }, () => Math.round(Math.random() * 400) + 100);
}

const data = ref({
  labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
  datasets: [
    {
      label: 'Temperature (\u00b0C)',
      data: randomTemps(),
      borderColor: '#e07a3f',
      backgroundColor: 'rgba(224, 122, 63, 0.15)',
      // Maps this dataset onto the 'y' scale defined below, not the
      // chart's own implicit default — required whenever more than one
      // scale shares an axis direction, per Chart.js's own Cartesian
      // Axes docs.
      yAxisID: 'y',
    },
    {
      label: 'Visitors',
      data: randomVisitors(),
      borderColor: '#3f6fe0',
      backgroundColor: 'rgba(63, 111, 224, 0.15)',
      yAxisID: 'y1',
    },
  ],
});

const options = {
  responsive: true,
  maintainAspectRatio: false,
  interaction: { mode: 'index' as const, intersect: false },
  scales: {
    y: {
      type: 'linear' as const,
      display: true,
      position: 'left' as const,
      title: { display: true, text: 'Temperature (\u00b0C)' },
    },
    y1: {
      type: 'linear' as const,
      display: true,
      position: 'right' as const,
      // Only one axis's own grid lines are drawn — two overlapping
      // grids read as visual noise, not extra information.
      grid: { drawOnChartArea: false },
      title: { display: true, text: 'Visitors' },
    },
  },
};

function randomize(): void {
  data.value = {
    ...data.value,
    datasets: [
      { ...data.value.datasets[0], data: randomTemps() },
      { ...data.value.datasets[1], data: randomVisitors() },
    ],
  };
}
</script>

<style scoped>
.demo-controls {
  margin-bottom: 12px;
}

.demo-btn {
  background: var(--kg-blueprint-deep);
  border: none;
  border-radius: 6px;
  color: white;
  cursor: pointer;
  font-family: var(--kg-font-body);
  font-size: 13px;
  font-weight: 500;
  padding: 8px 14px;
}

.demo-btn:hover {
  background: var(--kg-blueprint);
}

.demo-stage {
  height: 320px;
}
</style>
