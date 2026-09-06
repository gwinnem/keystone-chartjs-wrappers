---
editUrl: false
title: "createChartController"
---

> **createChartController**(`canvas`, `initial`): `Promise`\<[`ChartControllerHandle`](../interfaces/ChartControllerHandle.md)\>

Constructs a managed Chart.js instance and wires up its full lifecycle:
lazy kind registration (including mixed-dataset kinds), a ResizeObserver
on the canvas's parent, and an imperative handle for update/resize/
theme/destroy. This is the one thing every framework package's own
`<Chart>` component should call into on mount rather than constructing
`new Chart(...)` directly — see CLAUDE.md's "never re-implement chart
lifecycle/registration logic themselves" rule.

## Parameters

### canvas

`HTMLCanvasElement`

### initial

[`ChartUpdatePayload`](../interfaces/ChartUpdatePayload.md)

## Returns

`Promise`\<[`ChartControllerHandle`](../interfaces/ChartControllerHandle.md)\>
