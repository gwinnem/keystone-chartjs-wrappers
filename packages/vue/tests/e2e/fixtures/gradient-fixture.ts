// Real chartjs-plugin-gradient registration, not mocked — same rationale
// as zoom-fixture.ts's own header comment. Config shape confirmed
// directly from the real package's own README (github.com/kurkle/
// chartjs-plugin-gradient): gradient config lives on the *dataset*
// itself, not options.plugins.gradient — the `gradient` prop here only
// registers the plugin so this dataset-level config actually takes
// effect. `axis: 'y'` varies the color by vertical position on the
// chart, so bars of different heights show different portions of the
// red-to-yellow-to-green range.
import { createApp, h } from 'vue';
import Chart from '../../../src/Chart.vue';

createApp({
  render: () =>
    h('div', { id: 'container', style: 'width: 400px; height: 300px' }, [
      h(Chart, {
        type: 'bar',
        data: {
          labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May'],
          datasets: [
            {
              label: 'Revenue',
              data: [20, 45, 70, 90, 60],
              gradient: {
                backgroundColor: {
                  axis: 'y',
                  colors: { 0: 'red', 50: 'yellow', 100: 'green' },
                },
              },
            },
          ],
        },
        gradient: true,
      }),
    ]),
}).mount('#app');
