<template>
  <div class="demo-controls">
    <button class="demo-btn" type="button" @click="randomize">Randomize data</button>
  </div>
  <div class="demo-stage">
    <Chart :data="data" :options="options" type="bar" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { Chart } from 'keystone-chartjs-vue';

function randomValues(): number[] {
  return Array.from({ length: 5 }, () => Math.round(Math.random() * 80) + 10);
}

const data = ref({
  labels: ['Product A', 'Product B', 'Product C', 'Product D', 'Product E'],
  datasets: [{ label: 'Units sold', data: randomValues() }],
});

const options = {
  responsive: true,
  maintainAspectRatio: false,
  // The one option that makes this a horizontal bar chart — no separate
  // chart kind or component involved, just Chart.js's own bar-controller
  // option. Category labels run down the y axis instead of across the x
  // axis, and values run left-to-right instead of bottom-to-top.
  indexAxis: 'y' as const,
};

function randomize(): void {
  data.value = {
    ...data.value,
    datasets: [{ ...data.value.datasets[0], data: randomValues() }],
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
