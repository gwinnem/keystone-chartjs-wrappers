// A minimal, deterministic mount of the real <Chart> component with a
// real Chart.js 'scatter' chart — {x, y} data points, no `labels` array,
// same rationale as bar-chart-fixture.ts's own header comment.
import { createApp, h } from 'vue';
import Chart from '../../../src/Chart.vue';

createApp({
  render: () =>
    h('div', { id: 'container', style: 'width: 400px; height: 300px' }, [
      h(Chart, {
        type: 'scatter',
        data: {
          datasets: [
            {
              label: 'Measurements',
              data: [
                { x: 1, y: 3 },
                { x: 2, y: 7 },
                { x: 3, y: 4 },
                { x: 4, y: 9 },
                { x: 5, y: 6 },
                { x: 6, y: 11 },
              ],
            },
          ],
        },
      }),
    ]),
}).mount('#app');
