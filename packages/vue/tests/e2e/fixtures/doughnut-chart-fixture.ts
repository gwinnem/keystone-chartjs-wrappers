// A minimal, deterministic mount of the real <Chart> component with a
// real Chart.js 'doughnut' chart — same rationale as
// bar-chart-fixture.ts's own header comment.
import { createApp, h } from 'vue';
import Chart from '../../../src/Chart.vue';

createApp({
  render: () =>
    h('div', { id: 'container', style: 'width: 400px; height: 300px' }, [
      h(Chart, {
        type: 'doughnut',
        data: {
          labels: ['Chrome', 'Safari', 'Firefox', 'Edge'],
          datasets: [{ data: [58, 20, 12, 10] }],
        },
      }),
    ]),
}).mount('#app');
