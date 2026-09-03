// A minimal, deterministic mount of the real <Chart> component with a
// real Chart.js 'pie' chart — same rationale as bar-chart-fixture.ts's
// own header comment.
import { createApp, h } from 'vue';
import Chart from '../../../src/Chart.vue';

createApp({
  render: () =>
    h('div', { id: 'container', style: 'width: 400px; height: 300px' }, [
      h(Chart, {
        type: 'pie',
        data: {
          labels: ['Rent', 'Food', 'Transport', 'Savings'],
          datasets: [{ data: [35, 25, 15, 25] }],
        },
      }),
    ]),
}).mount('#app');
