// Every other test suite in this monorepo mocks chartjs-plugin-zoom
// entirely — this is the first and only place the real plugin's own
// registration actually gets exercised against a real Chart.js instance
// in a real browser.
import { createApp, h } from 'vue';
import Chart from '../../../src/Chart.vue';

createApp({
  render: () =>
    h('div', { id: 'container', style: 'width: 400px; height: 300px' }, [
      h(Chart, {
        type: 'line',
        data: {
          labels: ['A', 'B', 'C'],
          datasets: [{ label: 'Series', data: [1, 5, 3] }],
        },
        zoom: true,
      }),
    ]),
}).mount('#app');
