// Real, local HierarchicalScale, statically imported and registered
// via a direct Chart.register(HierarchicalScale) call (see
// hierarchicalScale.ts's own header comment) — not mocked. Data shape
// confirmed directly from the real, original package's own type
// declarations (ILabelNode/IValueNode, dissected from
// chartjs-plugin-hierarchical's own real TypeScript source):
// `data.labels` is an array of `string | ILabelNode` (`{ label,
// children }`), and each dataset's own `data` is an array of `T |
// IValueNode<T>` (`{ value, children }`) — a real, distinct tree
// shape, not the flat arrays every other kind/plugin in this project
// accepts.
import { createApp, h } from 'vue';
import type { ChartConfigData, ChartConfiguration } from 'keystone-chartjs-core';
import Chart from '../../../src/Chart.vue';

// Cast needed here, same reasoning as timestack-fixture.ts's own header
// comment: Chart.js's own built-in scale-type union has no static
// knowledge of 'hierarchical' at all in a file that doesn't statically
// import hierarchicalScale.ts's own module augmentation directly (this
// fixture goes through the Chart.vue prop instead) — a direct
// `as ChartConfiguration['options']` isn't accepted either (the two
// types are considered insufficiently overlapping), so this routes
// through `unknown` first, confirmed as the correct fix by a real
// typecheck run against the identical class of error for timestack.
const options = {
  scales: {
    x: { type: 'hierarchical' },
  },
  // Real, necessary addition — confirmed via a live, reproduced issue
  // (not a guess): this scale's own companion plugin draws its own
  // expand/collapse indicator boxes directly below the axis's own real
  // `bottom` edge, but never participates in Chart.js's own layout/
  // padding calculation itself — without reserving real space for that
  // extra row here, those indicator boxes are drawn past the canvas's
  // own visible bottom edge entirely, invisible and unclickable (this
  // spec's own click-to-expand test needs a real, clickable box). A
  // scale-side fix (overriding fit() to reserve this space
  // automatically) was tried and reverted — see hierarchical-scale.vue's
  // own identical comment for the real regression that caused.
  layout: { padding: { bottom: 40 } },
} as unknown as ChartConfiguration['options'];

// Same reasoning, applied to `data` this time: ChartConfigDataset's own
// `data` field is typed as Chart.js's built-in DefaultDataPoint union
// or this project's own ExtensionData union — neither models
// chartjs-plugin-hierarchical's own real tree-node shape
// (`{ value, children }`), since that shape is only ever recognized at
// runtime by the same dynamically-registered scale. Cast through
// `unknown` for the same reason as `options` above.
const data = {
  labels: [
    { label: '2024', children: ['Q1', 'Q2', 'Q3', 'Q4'] },
    { label: '2025', children: ['Q1', 'Q2', 'Q3', 'Q4'] },
  ],
  datasets: [
    {
      label: 'Revenue',
      data: [
        { value: 100, children: [20, 25, 22, 33] },
        { value: 120, children: [28, 30, 29, 33] },
      ],
    },
  ],
} as unknown as ChartConfigData;

createApp({
  render: () =>
    h('div', { id: 'container', style: 'width: 400px; height: 300px' }, [
      h(Chart, {
        type: 'bar',
        data,
        options,
        hierarchical: true,
      }),
    ]),
}).mount('#app');
