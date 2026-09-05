// Real chartjs-plugin-autocolors registration, not mocked — same
// rationale as zoom-fixture.ts's own header comment, though this
// plugin's own logic is now local, ported code (autocolorsPlugin.ts),
// not a real third-party dependency at all. Three datasets, none with
// an explicit color, in 'dataset' mode (the real default) — each
// should end up with its own distinct generated background/border
// color.
import { createApp, h } from 'vue';
import Chart from '../../../src/Chart.vue';

createApp({
  render: () =>
    h('div', { id: 'container', style: 'width: 400px; height: 300px' }, [
      h(Chart, {
        type: 'line',
        data: {
          labels: ['Jan', 'Feb', 'Mar', 'Apr'],
          datasets: [
            { label: 'Product A', data: [12, 19, 8, 15] },
            { label: 'Product B', data: [8, 14, 20, 11] },
            { label: 'Product C', data: [20, 10, 15, 22] },
          ],
        },
        autocolors: true,
      }),
    ]),
}).mount('#app');
