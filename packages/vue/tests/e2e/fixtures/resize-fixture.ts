// The real ResizeObserver-driven resize path createChartController wires
// up (packages/core/src/controller.ts) — jsdom has no real layout engine
// at all, so a real browser is the only way to prove a canvas actually
// resizes when its container does, rather than trusting the wiring
// alone. The fixture's own container is percentage-width (see the HTML
// file's own comment), so a real viewport resize changes its real size.
import { createApp, h } from 'vue';
import Chart from '../../../src/Chart.vue';

createApp({
  render: () =>
    h('div', { id: 'container' }, [
      h(Chart, {
        type: 'bar',
        data: {
          labels: ['A', 'B'],
          datasets: [{ label: 'Series', data: [1, 2] }],
        },
      }),
    ]),
}).mount('#app');
