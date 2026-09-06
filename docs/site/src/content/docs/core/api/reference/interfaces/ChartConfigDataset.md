---
editUrl: false
title: "ChartConfigDataset"
---

One dataset within `ChartConfigData`. Hand-rolled rather than derived
from Chart.js's own generic `ChartDataset<TType, TData>`, for a
second, real gap found via an actual `vue-tsc --noEmit` run (after
fixing the `data`-shape gap above): Chart.js's own per-dataset
*options* type is ALSO keyed by its narrow, built-ins-only `ChartType`
— e.g. `matrix`'s own real, documented scriptable `width`/`height`
dataset functions aren't part of it at all, the identical class of
gap as `ExtensionData` above but at the dataset-options level rather
than the data-array level. Modeled here as a loose index signature
(`[key: string]: unknown`) alongside the fields every dataset
definitely has, rather than Chart.js's own much stricter
per-built-in-kind dataset-options union — full, precise
per-extension-kind dataset-option typing is real Phase 5 scope,
matching every other "loose on purpose" type in this file.

## Indexable

> \[`key`: `string`\]: `unknown`

## Properties

### data

> **data**: `ExtensionData` \| (`number` \| `number`[] \| \[`number`, `number`\] \| `Point` \| `BubbleDataPoint` \| `FinancialDataPoint` \| `Partial`\<`IBoxPlot`\> & `Pick`\<`IBoxPlot`, `"min"` \| `"max"` \| `"median"` \| `"q1"` \| `"q3"`\> \| `Partial`\<`IViolin`\> & `Pick`\<`IViolin`, `"median"` \| `"coords"`\> \| `MatrixDataPoint` \| `SankeyDataPoint` \| `TreemapDataPoint` \| `null`)[]

***

### label?

> `optional` **label?**: `string`

***

### type?

> `optional` **type?**: [`ChartKind`](../types/ChartKind.md)
