// A minimal, deterministic mount of the real <Chart> component with a
// real Chart.js 'bar' chart — proves the real canvas 2D rendering path
// works end-to-end in a real browser, which Vitest's own component
// tests (Chart.spec.ts, keystone-chartjs-core entirely mocked) can't
// verify at all, since jsdom has no real canvas implementation.
//
// Animation deliberately left at Chart.js's own default (not disabled)
// — an earlier version of this fixture set `options: { animation:
// false }`, on the theory that the very first paint could land before
// requestAnimationFrame had fired. A real run showed the opposite: with
// animation disabled, the canvas stayed genuinely blank for the spec's
// entire 5s poll, while sankey-fixture.ts/zoom-fixture.ts (both left at
// default animation) render correctly — pointing at `animation: false`
// itself skipping Chart.js's own initial render in some version-
// specific way, not a timing race `animation: false` was meant to
// avoid. Removed rather than kept as an unexplained workaround.
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
      }),
    ]),
}).mount('#app');
