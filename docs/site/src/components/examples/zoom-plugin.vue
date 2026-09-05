<template>
  <p class="demo-hint">Scroll to zoom in/out. Drag to zoom into a rectangle (hold Shift with a mouse). On a touch/pen device, drag with one finger to pan, or pinch with two fingers to zoom. Use the buttons for programmatic pan/reset.</p>
  <div class="demo-stage">
    <Chart ref="chartRef" :data="data" :options="options" :zoom="zoomConfig" type="line" />
  </div>
  <div class="demo-controls">
    <button type="button" @click="panLeft">&larr; Pan</button>
    <button type="button" @click="panRight">Pan &rarr;</button>
    <button type="button" @click="resetZoom">Reset zoom</button>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
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

const options = { responsive: true, maintainAspectRatio: false };

// A real, working config, not a bare `zoom` boolean, since chartjs-plugin-zoom
// requires explicit wheel/drag config to actually do anything; an empty
// config object registers the plugin but enables no interaction at all.
//
// `pan.enabled`/`zoom.pinch.enabled` both drive real, interactive touch/
// pen gestures here (single-finger drag-to-pan, two-finger pinch-zoom),
// since this project's own local port of this plugin reimplemented both
// directly on the standards-based Pointer Events API, rather than
// leaving them dropped along with the original's own real, hard
// Hammer.js dependency (see the Zoom plugin docs page's own
// explanation). Mouse input is deliberately excluded from that same
// pointer-event path, though: `pan.enabled` only suppresses drag-to-
// zoom while its own modifier key is held for mouse users, and the pan
// buttons below call `chart.pan()` programmatically instead, since
// there's no interactive mouse-drag-to-pan gesture to rely on (the
// original package never had one either, per the same docs page).
const zoomConfig = {
  zoom: { wheel: { enabled: true }, drag: { enabled: true, modifierKey: 'shift' }, pinch: { enabled: true }, mode: 'x' },
  pan: { enabled: true, mode: 'x' },
};

const chartRef = ref<InstanceType<typeof Chart> | null>(null);

// Starts partially zoomed in (days 6-15 of 20) rather than showing the
// full range from the very start — confirmed directly (not assumed)
// that panning from a fully-zoomed-out view is a real, correct no-op:
// zoomPlugin.ts's own panCategoryScale clamps a pan request to nothing
// once the chart already shows every category, since there's nowhere
// left to pan to. Left at that starting state, the pan buttons below
// (and reset, which would have nothing to restore from) would look
// broken on first load. `zoomScale` needs the real chart instance,
// which the child Chart component only creates asynchronously (after
// this component's own onMounted already ran), so this polls via
// requestAnimationFrame until chartRef.value.chart genuinely exists.
onMounted(() => {
  const trySetInitialZoom = () => {
    const chart = chartRef.value?.chart as any;
    if (chart) {
      chart.zoomScale('x', { min: 5, max: 14 });
    } else {
      requestAnimationFrame(trySetInitialZoom);
    }
  };
  trySetInitialZoom();
});

// `chart` is exposed from Chart.vue via `defineExpose({ chart })` as a
// `shallowRef` internally, but accessing it through a parent's own
// template ref goes through Vue's own component-instance proxy, which
// auto-unwraps it, confirmed directly (not assumed) by logging
// `chartRef.value.chart` here during development: it resolved to the
// real Chart.js instance itself, not the ref wrapping it. A cast to
// `any` is still needed: `.pan()`/`.resetZoom()` are attached
// dynamically by zoomPlugin.ts's own `start()` hook at runtime, not
// declared on Chart.js's own static type at all.
function panLeft() {
  (chartRef.value?.chart as any)?.pan({ x: 100 });
}
function panRight() {
  (chartRef.value?.chart as any)?.pan({ x: -100 });
}
function resetZoom() {
  (chartRef.value?.chart as any)?.resetZoom();
}
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

.demo-controls {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.demo-controls button {
  padding: 6px 12px;
  font-size: 13px;
  border: 1px solid var(--kg-border-dark, #444);
  border-radius: 4px;
  background: transparent;
  color: inherit;
  cursor: pointer;
}
</style>
