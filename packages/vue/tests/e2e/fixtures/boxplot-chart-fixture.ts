// A minimal, deterministic mount of the real <Chart> component with a
// real Chart.js 'boxplot' chart via the real
// @sgratzl/chartjs-chart-boxplot package (registered lazily, not
// mocked) — same rationale as bar-chart-fixture.ts's own header
// comment. Data shape (an array of raw numbers per box — the package
// computes min/max/median/quartiles itself) confirmed against that
// package's own real README.
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
        type: 'boxplot',
        data: {
          labels: ['Group A', 'Group B'],
          datasets: [
            {
              label: 'Scores',
              data: [
                [1, 2, 3, 4, 5, 6, 7, 8, 9],
                [3, 4, 5, 6, 7, 8, 9, 10, 11],
              ],
            },
          ],
        },
      }),
    ]),
}).mount('#app');
