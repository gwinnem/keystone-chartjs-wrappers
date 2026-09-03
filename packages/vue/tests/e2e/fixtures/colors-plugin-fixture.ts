// Real, unmocked <Chart> + Chart.js's own built-in Colors plugin —
// proves two things a mocked component test structurally can't: (1)
// the plugin is registered and enabled by default (it's part of
// Chart.js's own `registerables`, which registry.ts already registers
// eagerly), auto-coloring datasets that specify no color of their own;
// (2) a real, confirmed gotcha found via a live manual browser test
// (see docs/IMPLEMENTATION_PLAN.md's own Phase 6 entry): the plugin's
// own "does any dataset already have a color" check looks at all
// datasets together, so a dataset added AFTER the chart's first render
// is left uncolored unless `forceOverride: true` is set. This fixture
// mounts with 2 datasets, then adds a 3rd shortly after — with
// `forceOverride: true` in place, confirming the fix actually works,
// not just the base 2-dataset case.
//
// Animation deliberately left at Chart.js's own default — see
// bar-chart-fixture.ts's own header comment for why disabling it was
// tried and reverted in an earlier fixture.
import { createApp, h, ref } from 'vue';
import Chart from '../../../src/Chart.vue';

const data = ref({
  labels: ['Jan', 'Feb', 'Mar'],
  datasets: [
    { label: 'A', data: [12, 19, 8] },
    { label: 'B', data: [8, 15, 20] },
  ],
});

createApp({
  render: () =>
    h('div', { id: 'container', style: 'width: 400px; height: 300px' }, [
      h(Chart, {
        type: 'bar',
        data: data.value,
        options: { plugins: { colors: { forceOverride: true } } },
      }),
    ]),
}).mount('#app');

setTimeout(() => {
  data.value = {
    ...data.value,
    datasets: [...data.value.datasets, { label: 'C', data: [5, 10, 15] }],
  };
}, 200);
