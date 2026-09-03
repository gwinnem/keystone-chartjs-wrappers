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
  return Array.from({ length: 4 }, () => Math.round(Math.random() * 80) + 10);
}

const data = ref({
  labels: ['Q1', 'Q2', 'Q3', 'Q4'],
  datasets: [{ label: 'Revenue', data: randomValues() }],
});

const options = { responsive: true, maintainAspectRatio: false };

function randomize(): void {
  // A whole new object, not a mutation of the existing one — exercises
  // the same-type in-place update path (chart.update(), not
  // destroy+recreate), the behavior Chart.spec.ts's own component tests
  // verify at the unit level and this example demonstrates for real.
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
