---
title: Performance
description: Tips for large datasets and performance-sensitive charts — parsing, decimation, animation, and web workers.
---

Chart.js renders on `canvas`, which is already fast — these are Chart.js's
own tips for large datasets or performance-sensitive apps, all plain
`options`/dataset-field configuration that reaches Chart.js untouched.

## Data structure and parsing

- **Disable parsing** (`options.parsing = false`) if your data is already
  in Chart.js's own internal format, sorted and consistent — see [Data
  structures](/vue/guide/concepts/data-structures). Skips a real parsing
  step per render.
- **Set `normalized: true`** if your data's own indices are unique, sorted,
  and consistent across datasets — lets Chart.js skip re-sorting.
- **Decimate large datasets** before passing them to `<Chart>` — Chart.js's
  own decimation plugin can do this for line charts automatically, but
  decimating yourself, earlier in the pipeline, is always at least as good
  and often better, since the plugin's own decimation happens late in the
  render cycle.

## Tick calculation

- **Fix `minRotation`/`maxRotation` to the same value** to skip Chart.js
  having to compute an optimal rotation itself.
- **Set `ticks.sampleSize`** to check only a subset of labels when
  computing how much space they need — faster, at the cost of some
  accuracy if label lengths vary a lot.

## Disable animations

```js
const options = { animation: false };
```

Means the chart only needs to render once per update instead of across
multiple animation frames — a real, direct win for charts with long render
times. Line charts specifically also get Path2D caching once animations
are off.

## Specify scale `min`/`max` explicitly

Skips Chart.js having to compute the range from your data:

```js
const options = {
  scales: {
    y: { type: 'linear', min: 0, max: 100 },
  },
};
```

## Line-chart-specific tips

- Leave Bézier curves disabled (`tension: 0`, Chart.js's own default) —
  straight lines are cheaper to draw.
- Enable `spanGaps` if you have a lot of points, to skip line
  segmentation.
- Disabling line drawing (`showLine: false`) or point drawing
  (`pointRadius: 0`) per dataset reduces what's drawn at all.

## Web Workers / OffscreenCanvas

Chart.js's own `Chart` constructor accepts an `OffscreenCanvas` in place
of a real `HTMLCanvasElement`, letting a chart render entirely off the
main thread via a web worker. **This library does not currently support
this** — `<Chart>`'s own internal controller is typed and wired around a
real `HTMLCanvasElement` from a template ref, which is how every framework
naturally provides a canvas element. Using Chart.js's own worker-based
rendering today means bypassing this library and constructing a `Chart`
instance directly against `chart.js`'s own API.
