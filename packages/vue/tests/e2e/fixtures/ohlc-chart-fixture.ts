// A minimal, deterministic mount of the real <Chart> component with a
// real Chart.js 'ohlc' chart via the real chartjs-chart-financial
// package — same rationale and data shape as candlestick-chart-fixture.ts's
// own header comment (that package backs both kinds).
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
        type: 'ohlc',
        data: {
          datasets: [
            {
              label: 'Price',
              data: [
                { x: 1, o: 10, h: 15, l: 5, c: 12 },
                { x: 2, o: 12, h: 18, l: 9, c: 16 },
                { x: 3, o: 16, h: 17, l: 11, c: 13 },
                { x: 4, o: 13, h: 20, l: 12, c: 19 },
              ],
            },
          ],
        },
        options: { scales: { x: { type: 'linear' } } },
      }),
    ]),
}).mount('#app');
