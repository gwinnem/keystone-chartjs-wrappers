// A minimal, deterministic mount of the real <Chart> component with a
// real Chart.js 'candlestick' chart via the real chartjs-chart-financial
// package (registered lazily, not mocked) — same rationale as
// bar-chart-fixture.ts's own header comment, plus the same real-package
// registration risk sankey/zoom-fixture.ts already prove for their own
// packages. Data shape ({x, o, h, l, c}) confirmed against
// chartjs-chart-financial's own real docs. A plain numeric `x` (not a
// real date/time value) is used deliberately — financial charts
// typically pair with a 'time' scale, which needs a separate date-
// adapter package (e.g. chartjs-adapter-luxon) this project doesn't
// depend on; an explicit `linear` x scale avoids that dependency
// entirely while still exercising the real controller/element.
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
        type: 'candlestick',
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
