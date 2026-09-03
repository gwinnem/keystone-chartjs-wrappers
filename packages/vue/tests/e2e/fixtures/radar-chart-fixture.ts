// A minimal, deterministic mount of the real <Chart> component with a
// real Chart.js 'radar' chart — same rationale as bar-chart-fixture.ts's
// own header comment.
import { createApp, h } from 'vue';
import Chart from '../../../src/Chart.vue';

createApp({
  render: () =>
    h('div', { id: 'container', style: 'width: 400px; height: 300px' }, [
      h(Chart, {
        type: 'radar',
        data: {
          labels: ['Speed', 'Reliability', 'Comfort', 'Safety', 'Efficiency'],
          datasets: [
            { label: 'Model A', data: [8, 6, 7, 9, 5] },
            { label: 'Model B', data: [6, 9, 8, 7, 8] },
          ],
        },
      }),
    ]),
}).mount('#app');
