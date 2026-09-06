---
editUrl: false
title: "ensureChartKindRegistered"
---

> **ensureChartKindRegistered**(`kind`): `Promise`\<`void`\>

Ensures Chart.js can render the given kind, dynamically importing and
registering its controller/elements exactly once per kind, per process.
Safe to call redundantly — every caller (mount, update, mixed-dataset
resolution) calls this for every kind it touches, and the cache makes
repeat calls a no-op.

## Parameters

### kind

[`ChartKind`](../types/ChartKind.md)

## Returns

`Promise`\<`void`\>
