// A minimal, deterministic mount of the real <Chart> component with the
// real chartjs-plugin-datalabels package (registered lazily via the
// `dataLabels` prop, not mocked) — same rationale as
// bar-chart-fixture.ts's own header comment. `true` applies the plugin
// with no extra config, unlike `annotation` (see annotation-fixture.ts's
// own header comment for that distinction).
import { createApp, h } from 'vue';
import Chart from '../../../src/Chart.vue';

createApp({
  render: () =>
    h('div', { id: 'container', style: 'width: 400px; height: 300px' }, [
      h(Chart, {
        type: 'bar',
        data: {
          labels: ['Jan', 'Feb', 'Mar'],
          datasets: [{ label: 'Revenue', data: [12, 19, 8] }],
        },
        dataLabels: true,
      }),
    ]),
}).mount('#app');
