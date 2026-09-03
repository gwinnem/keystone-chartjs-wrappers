// A minimal, deterministic mount of the real <Chart> component with a
// real Chart.js 'line' chart — same rationale as bar-chart-fixture.ts's
// own header comment (real canvas 2D rendering, no animation override —
// see that file's own comment for why animation is deliberately left at
// Chart.js's own default here too).
import { createApp, h } from 'vue';
import Chart from '../../../src/Chart.vue';

createApp({
  render: () =>
    h('div', { id: 'container', style: 'width: 400px; height: 300px' }, [
      h(Chart, {
        type: 'line',
        data: {
          labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
          datasets: [{ label: 'Signups', data: [12, 19, 14, 25, 22, 30, 28] }],
        },
      }),
    ]),
}).mount('#app');
