// Local port (deferredPlugin.ts), not a dependency — same rationale as
// gradient-fixture.ts's own header comment. A tall spacer div pushes
// the canvas below the fold, so the real plugin's own scroll-event-
// driven defer (confirmed directly from the installed package's own
// real source during the port — not IntersectionObserver-based)
// actually has something to defer past — a short `delay` keeps the
// real e2e wait time small.
import { createApp, h } from 'vue';
import Chart from '../../../src/Chart.vue';

createApp({
  render: () =>
    h('div', {}, [
      h('div', { id: 'spacer', style: 'height: 1500px' }),
      h('div', { id: 'container', style: 'width: 400px; height: 300px' }, [
        h(Chart, {
          type: 'bar',
          data: {
            labels: ['Jan', 'Feb', 'Mar'],
            datasets: [{ label: 'Revenue', data: [12, 19, 8] }],
          },
          options: { animation: false },
          deferred: { delay: 100 },
        }),
      ]),
    ]),
}).mount('#app');
