---
editUrl: false
title: "ChartControllerHandle"
---

The handle `createChartController` resolves to — the imperative surface
framework layers call into for the rest of the chart's lifecycle after
mount.

## Properties

### chart

> `readonly` **chart**: [`ChartJs`](ChartJs.md)

The live Chart.js instance. Framework layers may read from it, but
should go through the methods below to change it — the controller
needs to know about type changes to decide update-vs-recreate.

## Methods

### applyTheme()

> **applyTheme**(`patch`): `void`

Merges `patch` into the live chart's own `options` (one level deep —
see controller.ts's own `mergeOptions`) and calls `chart.update()`,
without touching `data` or recreating the instance. Intended for
light/dark theme token re-application, not general options changes —
use `update()` for those.

#### Parameters

##### patch

`NonNullable`\<[`ChartConfiguration`](ChartConfiguration.md)\[`"options"`\]\>

#### Returns

`void`

***

### destroy()

> **destroy**(): `void`

Disconnects the ResizeObserver and destroys the Chart.js instance.

#### Returns

`void`

***

### resize()

> **resize**(): `void`

Manual resize trigger — also called automatically by the
ResizeObserver wired up in `createChartController`.

#### Returns

`void`

***

### update()

> **update**(`next`): `Promise`\<`void`\>

Diffs `next` against the current chart: same `type` (including every
dataset's own `type` override) updates in place via `chart.update()`;
a changed `type` destroys and reconstructs. Either path re-registers
any not-yet-registered chart kinds first.

#### Parameters

##### next

[`ChartUpdatePayload`](ChartUpdatePayload.md)

#### Returns

`Promise`\<`void`\>
