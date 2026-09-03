// A minimal, deterministic mount of the real <Chart> component with a
// real Chart.js 'polarArea' chart — same rationale as
// bar-chart-fixture.ts's own header comment.
import { createApp, h } from 'vue';
import Chart from '../../../src/Chart.vue';

createApp({
  render: () =>
    h('div', { id: 'container', style: 'width: 400px; height: 300px' }, [
      h(Chart, {
        type: 'polarArea',
        data: {
          labels: ['North', 'East', 'South', 'West', 'Central'],
          datasets: [{ data: [11, 16, 7, 14, 9] }],
        },
      }),
    ]),
}).mount('#app');
