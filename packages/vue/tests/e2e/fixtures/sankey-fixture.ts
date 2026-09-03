// Every other test suite in this monorepo mocks chartjs-chart-sankey
// (and the other 4 extension packages) entirely — this is the first and
// only place the REAL package's own real export names/registration
// actually get exercised end-to-end, against a real Chart.js instance
// in a real browser. A version mismatch or renamed export (the exact
// risk registry.ts's own error message warns about) surfaces here as a
// real, visible failure, not a passing mocked test.
import { createApp, h } from 'vue';
import Chart from '../../../src/Chart.vue';

createApp({
  render: () =>
    h('div', { id: 'container', style: 'width: 400px; height: 300px' }, [
      h(Chart, {
        type: 'sankey',
        data: {
          datasets: [
            {
              label: 'Flow',
              data: [
                { from: 'A', to: 'B', flow: 10 },
                { from: 'B', to: 'C', flow: 5 },
              ],
            },
          ],
        },
      }),
    ]),
}).mount('#app');
