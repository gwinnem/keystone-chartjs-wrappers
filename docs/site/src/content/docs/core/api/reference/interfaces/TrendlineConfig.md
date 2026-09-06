---
editUrl: false
title: "TrendlineConfig"
---

`chartjs-plugin-trendline`'s real per-dataset config — confirmed
directly from the real, installed package's own real source
(`src/components/trendline.js`, not just its README, which omits two
real, working fields: `fillColor` and `accessibility`), dissected
during this project's own local port (see `plugins/trendline/
trendlinePlugin.ts` for the full port rationale). Lives on each
*dataset* (`dataset.trendlineLinear`/`dataset.trendlineExponential`),
not `options.plugins.trendline` — the same mechanism `gradient`'s own
`dataset.gradient` field already uses, reaching Chart.js untouched via
this project's own `ChartConfigDataset` index signature (no type
change needed there). A dataset may set either, both, or neither —
they aren't mutually exclusive at the type level, matching the real
package's own behavior. `dataset.order`/`dataset.alwaysShowTrendline`
are separate, real dataset-level fields (not part of this config
object itself) — already reach the plugin untouched via
`ChartConfigDataset`'s own index signature, no type change needed for
those either.

## Properties

### accessibility?

> `optional` **accessibility?**: `object`

Feeds this project's own local port's automatic ARIA-label
generation — also a real, working feature the real package's own
README never documents at all, confirmed only by reading its
source directly. `description`, if given, is used verbatim as the
chart canvas's own generated `aria-label` contribution for this
dataset's trendline; otherwise `label` is folded into a short,
auto-generated sentence instead.

#### description?

> `optional` **description?**: `string`

#### label?

> `optional` **label?**: `string`

***

### colorMax?

> `optional` **colorMax?**: `string`

***

### colorMin?

> `optional` **colorMin?**: `string`

***

### fillColor?

> `optional` **fillColor?**: `string` \| `false`

Fills the area between the trendline and the chart's own bottom
edge with this color — a real, working feature the real package's
own README never documents at all, confirmed only by reading its
source directly.

***

### label?

> `optional` **label?**: `object`

#### color?

> `optional` **color?**: `string`

#### display?

> `optional` **display?**: `boolean`

#### displayValue?

> `optional` **displayValue?**: `boolean`

Linear: shows the fitted line's own slope. Exponential: shows
the fitted `a`/`b` parameters (`y = a × e^(b×x)`).

#### font?

> `optional` **font?**: `object`

##### font.family?

> `optional` **family?**: `string`

##### font.size?

> `optional` **size?**: `number`

#### offset?

> `optional` **offset?**: `number`

#### percentage?

> `optional` **percentage?**: `boolean`

Linear only: shows the slope as a percentage rather than a raw
value.

#### text?

> `optional` **text?**: `string`

***

### legend?

> `optional` **legend?**: `object`

#### color?

> `optional` **color?**: `string`

#### fillStyle?

> `optional` **fillStyle?**: `string`

#### lineCap?

> `optional` **lineCap?**: `CanvasLineCap`

#### lineDash?

> `optional` **lineDash?**: `number`[]

#### lineWidth?

> `optional` **lineWidth?**: `number`

#### strokeStyle?

> `optional` **strokeStyle?**: `string`

#### text?

> `optional` **text?**: `string`

***

### lineStyle?

> `optional` **lineStyle?**: `"dotted"` \| `"solid"` \| `"dashed"` \| `"dashdot"`

***

### projection?

> `optional` **projection?**: `boolean`

Extends the fitted line beyond the real data's own first/last
point, across the full chart area.

***

### trendoffset?

> `optional` **trendoffset?**: `number`

If positive, skips this many leading data points before fitting;
if negative, fits only the last `abs(trendoffset)` points — useful
for excluding an initial ramp-up/outlier period from the fit.

***

### width?

> `optional` **width?**: `number`

***

### xAxisKey?

> `optional` **xAxisKey?**: `string`

Reads x-values from this dataset key instead of Chart.js's own
default `x`/index-based resolution — for datasets using a
non-default parsing key (e.g. `{ xAxisKey: 'date' }`).

***

### yAxisKey?

> `optional` **yAxisKey?**: `string`
