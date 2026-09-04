// This project's own local port of chartjs-plugin-zoom
// (packages/core/src/zoomPlugin.ts) is otherwise only ever exercised
// against jsdom mocks (packages/core/tests/unit/zoomPlugin.spec.ts) —
// this is the one place it runs through the real build pipeline, in a
// real browser, against a real Chart.js instance.
import { createApp, h, ref } from 'vue';
import Chart from '../../../src/Chart.vue';

const chartRef = ref<InstanceType<typeof Chart> | null>(null);

createApp({
  render: () =>
    h('div', { id: 'container', style: 'width: 400px; height: 300px' }, [
      h(Chart, {
        ref: chartRef,
        type: 'line',
        data: {
          labels: ['A', 'B', 'C'],
          datasets: [{ label: 'Series', data: [1, 5, 3] }],
        },
        zoom: { zoom: { wheel: { enabled: true } } },
      }),
    ]),
}).mount('#app');

// Exposed for the e2e spec's own real wheel-zoom check — the real
// Chart.js instance (with zoomPlugin.ts's own `getZoomLevel()` etc.
// attached by its `start()` hook) isn't reachable from the DOM canvas
// element itself, only via Chart.vue's own `defineExpose({ chart })`.
declare global {
  interface Window {
    __zoomChart?: unknown;
  }
}
Object.defineProperty(window, '__zoomChart', {
  get: () => chartRef.value?.chart,
});
