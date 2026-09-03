// Real chartjs-plugin-image-label registration, not mocked — same
// rationale as zoom-fixture.ts's own header comment. Confirmed
// directly from the real package's own README
// (npmjs.com/package/chartjs-plugin-image-label): doughnut charts
// only, and unlike every other plugin/scale in this project, it's
// never registered globally via Chart.register(...) — it's supplied
// per-chart-instance via Chart.js's own real inline `plugins` array
// instead (this project's own `imageLabel` prop handles that merge
// automatically).
//
// A tiny, well-known 1x1 transparent PNG data URI is used for
// `imageUrl` rather than a real, remote image — deterministic and
// network-free, avoiding flakiness from an external image host in a
// real e2e run.
import { createApp, h } from 'vue';
import Chart from '../../../src/Chart.vue';

const TINY_PNG =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=';

createApp({
  render: () =>
    h('div', { id: 'container', style: 'width: 400px; height: 300px' }, [
      h(Chart, {
        type: 'doughnut',
        data: {
          labels: ['A', 'B', 'C'],
          datasets: [
            {
              data: [30, 40, 30],
              backgroundColor: ['red', 'blue', 'green'],
            },
          ],
        },
        imageLabel: {
          verticalAlign: 'middle',
          horizontalAlign: 'middle',
          imagesList: [
            { imageUrl: TINY_PNG, imageWidth: 16, imageHeight: 16 },
            { imageUrl: TINY_PNG, imageWidth: 16, imageHeight: 16 },
            { imageUrl: TINY_PNG, imageWidth: 16, imageHeight: 16 },
          ],
        },
      }),
    ]),
}).mount('#app');
