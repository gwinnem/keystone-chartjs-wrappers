// A minimal, deterministic mount of the real <Chart> component with a
// real Chart.js 'matrix' chart via the real chartjs-chart-matrix
// package (registered lazily, not mocked) — same rationale as
// bar-chart-fixture.ts's own header comment. Data shape ({x, y, v} per
// cell, with scriptable `width`/`height` functions and explicit linear
// scale bounds) confirmed against that package's own real docs/README —
// matrix cells have no inherent size Chart.js can infer on its own,
// unlike every other built-in/extension kind here.
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
        type: 'matrix',
        data: {
          datasets: [
            {
              label: 'Grid',
              data: [
                { x: 1, y: 1, v: 11 },
                { x: 1, y: 2, v: 12 },
                { x: 2, y: 1, v: 21 },
                { x: 2, y: 2, v: 22 },
              ],
              backgroundColor: 'rgba(79, 184, 201, 0.6)',
              borderColor: 'rgba(46, 122, 136, 0.9)',
              borderWidth: 1,
              width: ({ chart }: { chart: { chartArea?: { width: number } } }) =>
                (chart.chartArea?.width ?? 0) / 2 - 1,
              height: ({ chart }: { chart: { chartArea?: { height: number } } }) =>
                (chart.chartArea?.height ?? 0) / 2 - 1,
            },
          ],
        },
        options: {
          scales: {
            x: { type: 'linear', display: false, min: 0.5, max: 2.5, offset: false },
            y: { type: 'linear', display: false, min: 0.5, max: 2.5 },
          },
        },
      }),
    ]),
}).mount('#app');
