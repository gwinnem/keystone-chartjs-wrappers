<template>
  <div class="demo-controls">
    <button class="demo-btn" type="button" :disabled="data.datasets.length >= names.length" @click="randomize">
      Add another dataset
    </button>
  </div>
  <div class="demo-stage">
    <Chart :data="data" :options="options" type="bar" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { Chart } from 'keystone-chartjs-vue';

const names = ['Alex', 'Sam', 'Priya', 'Jordan', 'Noor', 'Kai'];

function randomValues(): number[] {
  return Array.from({ length: 5 }, () => Math.round(Math.random() * 80) + 10);
}

// None of these datasets set their own backgroundColor/borderColor —
// Chart.js's own built-in Colors plugin assigns them automatically. This
// library's own registry.ts already registers this plugin eagerly (it's
// part of Chart.js's own `registerables`), and the plugin's own real
// defaults enable it out of the box — no options.plugins.colors config,
// no opt-in prop, needed at all.
const data = ref({
  labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
  datasets: [
    { label: names[0], data: randomValues() },
    { label: names[1], data: randomValues() },
  ],
});

const options = {
  responsive: true,
  maintainAspectRatio: false,
  // forceOverride: true is required here specifically because this demo
  // ADDS datasets after the chart already exists. Chart.js's own Colors
  // plugin checks whether ANY dataset already has a color before doing
  // anything (containsColorsDefinitions(datasets)) — once the first two
  // datasets are colorized on mount, that check is permanently true, so
  // every later update (including one that adds a brand-new, not-yet-
  // colored dataset) would otherwise skip colorizing entirely, leaving
  // the new dataset's own bars invisible (zero-alpha default). Confirmed
  // via a real browser test, not assumed — the newly-added dataset's own
  // bars genuinely rendered with no color at all without this option.
  plugins: { colors: { forceOverride: true } },
};

function randomize(): void {
  const nextName = names[data.value.datasets.length];
  if (!nextName) return;
  data.value = {
    ...data.value,
    datasets: [...data.value.datasets, { label: nextName, data: randomValues() }],
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

.demo-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.demo-stage {
  height: 320px;
}
</style>
