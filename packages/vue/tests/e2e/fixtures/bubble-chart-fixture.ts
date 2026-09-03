// A minimal, deterministic mount of the real <Chart> component with a
// real Chart.js 'bubble' chart — {x, y, r} data points, same rationale
// as bar-chart-fixture.ts's own header comment.
import { createApp, h } from 'vue';
import Chart from '../../../src/Chart.vue';

createApp({
  render: () =>
    h('div', { id: 'container', style: 'width: 400px; height: 300px' }, [
      h(Chart, {
        type: 'bubble',
        data: {
          datasets: [
            {
              label: 'Products',
              data: [
                { x: 10, y: 20, r: 8 },
                { x: 15, y: 10, r: 14 },
                { x: 26, y: 22, r: 6 },
                { x: 8, y: 30, r: 10 },
                { x: 20, y: 8, r: 18 },
              ],
            },
          ],
        },
      }),
    ]),
}).mount('#app');
