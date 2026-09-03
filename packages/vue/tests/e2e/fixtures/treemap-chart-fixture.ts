// A minimal, deterministic mount of the real <Chart> component with a
// real Chart.js 'treemap' chart via the real chartjs-chart-treemap
// package (registered lazily, not mocked) — same rationale as
// bar-chart-fixture.ts's own header comment. Uses the simplest
// confirmed-real data shape (a flat array of raw numbers — no `tree`/
// `key`/`groups` config needed at all), matching that package's own
// simplest documented example.
//
// This fixture's own e2e spec is currently `test.fixme` — see
// candlestick-chart.spec.ts's own header comment for the known,
// documented dev-server resolution limitation this hits.
import { createApp, h } from 'vue';
import Chart from '../../../src/Chart.vue';

createApp({
  render: () =>
    h('div', { id: 'container', style: 'width: 400px; height: 300px' }, [
      h(Chart, {
        type: 'treemap',
        data: {
          datasets: [{ label: 'Sample', data: [100, 20, 6, 6, 5, 4, 3, 2, 2, 1] }],
        },
      }),
    ]),
}).mount('#app');
