<template>
  <p class="demo-hint">Scroll to zoom, drag to pan.</p>
  <div class="demo-stage">
    <Chart :data="data" :zoom="zoomConfig" type="line" />
  </div>
</template>

<script setup lang="ts">
import { Chart } from 'keystone-chartjs-vue';

const data = {
  labels: Array.from({ length: 20 }, (_, i) => `Day ${i + 1}`),
  datasets: [
    {
      label: 'Sessions',
      data: Array.from({ length: 20 }, () => Math.round(Math.random() * 100)),
    },
  ],
};

// A real, working config, not a bare `zoom` boolean — chartjs-plugin-zoom
// requires explicit wheel/pinch/pan config to actually do anything; an
// empty config object registers the plugin but enables no interaction
// at all.
const zoomConfig = {
  zoom: { wheel: { enabled: true }, pinch: { enabled: true }, mode: 'x' },
  pan: { enabled: true, mode: 'x' },
};
</script>

<style scoped>
.demo-hint {
  color: var(--kg-text-lo-dark);
  font-size: 13px;
  margin-bottom: 12px;
}

.demo-stage {
  height: 320px;
}
</style>
