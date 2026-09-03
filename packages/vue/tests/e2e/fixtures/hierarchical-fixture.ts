// Real chartjs-plugin-hierarchical registration, not mocked — same
// rationale as zoom-fixture.ts's own header comment. Data shape
// confirmed directly from the real package's own type declarations
// (ILabelNode/IValueNode, confirmed via multiple independent mirrors of
// its README, since the GitHub page itself only links out to external
// API doc pages): `data.labels` is an array of `string | ILabelNode`
// (`{ label, children }`), and each dataset's own `data` is an array of
// `T | IValueNode<T>` (`{ value, children }`) — a real, distinct tree
// shape, not the flat arrays every other kind/plugin in this project
// accepts.
import { createApp, h } from 'vue';
import type { ChartConfigData, ChartConfiguration } from 'keystone-chartjs-core';
import Chart from '../../../src/Chart.vue';

// Cast needed here, same reasoning as timestack-fixture.ts's own header
// comment: Chart.js's own built-in scale-type union has no static
// knowledge of 'hierarchical' at all, since that type string is only
// ever recognized at runtime, after chartjs-plugin-hierarchical's own
// dynamic import (inside withHierarchical) registers it via
// Chart.register(HierarchicalScale) — the augmenting module is never
// statically imported anywhere in this file's own compile graph. A
// direct `as ChartConfiguration['options']` isn't accepted either (the
// two types are considered insufficiently overlapping), so this routes
// through `unknown` first, confirmed as the correct fix by a real
// typecheck run against the identical class of error for timestack.
const options = {
  scales: {
    x: { type: 'hierarchical' },
  },
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
