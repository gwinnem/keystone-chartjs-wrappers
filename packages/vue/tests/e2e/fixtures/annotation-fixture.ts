// A minimal, deterministic mount of the real <Chart> component with the
// real chartjs-plugin-annotation package (registered lazily via the
// `annotation` prop, not mocked) — same rationale as
// bar-chart-fixture.ts's own header comment. `annotation` has no
// plain-boolean form (unlike `zoom`/`dataLabels`): a real `annotations`
// object is required, since there's no sensible empty default — see
// packages/vue/src/useChartController.ts's own `UseChartControllerProps`
// comment on this exact distinction. A single horizontal line
// annotation is the plugin's own standard, documented config shape.
import { createApp, h } from 'vue';
import Chart from '../../../src/Chart.vue';

createApp({
  render: () =>
    h('div', { id: 'container', style: 'width: 400px; height: 300px' }, [
      h(Chart, {
        type: 'line',
        data: {
          labels: ['Jan', 'Feb', 'Mar', 'Apr'],
          datasets: [{ label: 'Revenue', data: [12, 19, 8, 15] }],
        },
        annotation: {
          annotations: {
            targetLine: {
              type: 'line',
              yMin: 14,
              yMax: 14,
              borderColor: 'red',
              borderWidth: 2,
            },
          },
        },
      }),
    ]),
}).mount('#app');
