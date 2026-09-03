// Real chartjs-scale-timestack registration, not mocked — same rationale
// as zoom-fixture.ts's own header comment. Data shape confirmed directly
// from the real package's own README (github.com/jkmnt/chartjs-scale-
// timestack): points must be `{x, y}` with millisecond timestamps —
// X-values are NOT parsed, unlike Chart.js's own stock `time` scale.
import { createApp, h } from 'vue';
import type { ChartConfiguration } from 'keystone-chartjs-core';
import Chart from '../../../src/Chart.vue';

const start = Date.UTC(2026, 0, 1, 0, 0, 0);
const hour = 60 * 60 * 1000;

// Cast needed here, not a widening of any real project type: Chart.js's
// own built-in scale-type union (linear/logarithmic/category/time/
// timeseries/radialLinear) has no static knowledge of 'timestack' at
// all, since that type string is only ever recognized at runtime, after
// chartjs-scale-timestack's own dynamic import (inside withTimestack)
// registers it as a side effect — the augmenting module is never
// statically imported anywhere in this file's own compile graph. A
// direct `as ChartConfiguration['options']` isn't accepted either —
// TypeScript considers the two types insufficiently overlapping (a real
// run confirmed this, not assumed) and requires routing through
// `unknown` first, its own standard idiom for this class of cast. Not a
// runtime concern either way: Chart.js itself does no compile-time shape
// checking, only reads whatever string is actually passed.
const options = {
  scales: {
    x: { type: 'timestack' },
  },
} as unknown as ChartConfiguration['options'];

createApp({
  render: () =>
    h('div', { id: 'container', style: 'width: 400px; height: 300px' }, [
      h(Chart, {
        type: 'line',
        data: {
          datasets: [
            {
              label: 'Series',
              data: [
                { x: start, y: 1 },
                { x: start + hour, y: 5 },
                { x: start + 2 * hour, y: 3 },
                { x: start + 3 * hour, y: 7 },
              ],
            },
          ],
        },
        options,
        timestack: true,
      }),
    ]),
}).mount('#app');
