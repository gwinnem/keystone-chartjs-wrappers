// A minimal, deterministic mount of the real <Chart> component with the
// real chartjs-plugin-trendline package (registered lazily via the
// `trendline` prop, not mocked) — same rationale as
// datalabels-fixture.ts's own header comment. `true` applies the plugin
// with no extra config; the real fitted line's own config
// (`trendlineLinear`) lives on the dataset itself, matching `gradient`'s
// own real config-on-dataset mechanism, not a plugin-level config
// object the `trendline` prop itself would carry.
import { createApp, h } from 'vue';
import Chart from '../../../src/Chart.vue';

createApp({
  render: () =>
    h('div', { id: 'container', style: 'width: 400px; height: 300px' }, [
      h(Chart, {
        type: 'line',
        data: {
          labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May'],
          datasets: [
            {
              label: 'Revenue',
              data: [12, 19, 15, 24, 30],
              trendlineLinear: {
                colorMin: 'red',
                colorMax: 'red',
                lineStyle: 'dotted',
                width: 2,
              },
            },
          ],
        },
        trendline: true,
      }),
    ]),
}).mount('#app');
