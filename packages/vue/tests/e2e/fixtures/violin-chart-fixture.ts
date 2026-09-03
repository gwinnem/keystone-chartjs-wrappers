// A minimal, deterministic mount of the real <Chart> component with a
// real Chart.js 'violin' chart via the real
// @sgratzl/chartjs-chart-boxplot package — same package and data shape
// as boxplot-chart-fixture.ts's own header comment (that package backs
// both kinds).
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
        type: 'violin',
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
