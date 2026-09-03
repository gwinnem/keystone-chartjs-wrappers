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

function randomRevenue(): number[] {
  return Array.from({ length: 6 }, () => Math.round(Math.random() * 60) + 20);
}

function randomTarget(): number[] {
  return Array.from({ length: 6 }, () => Math.round(Math.random() * 20) + 50);
}

const data = ref({
  labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
  datasets: [
    { label: 'Revenue', data: randomRevenue() },
    // No `type` override on the dataset above — it inherits the
    // top-level `type="bar"`. This second dataset's own `type: 'line'`
    // is what makes this a mixed chart: Chart.js draws it as a line
    // overlaid on the same axes as the bars, and this project's own
    // controller.ts registers both 'bar' and 'line' controllers
    // (collectChartKinds() walks every dataset's own type override, not
    // just the top-level one — see that file's own comment).
    { label: 'Target', data: randomTarget(), type: 'line', borderColor: '#e07a3f', borderWidth: 2 },
  ],
});

const options = { responsive: true, maintainAspectRatio: false };

function randomize(): void {
  // A whole new object, not a mutation — same in-place-update path as
  // the plain bar-chart example (top-level `type` is unchanged, so this
  // calls chart.update() rather than destroying and recreating), which
  // this example also demonstrates still works correctly when datasets
  // carry their own `type` overrides.
  data.value = {
    ...data.value,
    datasets: [
      { ...data.value.datasets[0], data: randomRevenue() },
      { ...data.value.datasets[1], data: randomTarget() },
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
