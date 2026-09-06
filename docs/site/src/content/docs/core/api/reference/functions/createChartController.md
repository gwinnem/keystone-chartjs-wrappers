---
editUrl: false
title: "createChartController"
description: "Constructs a managed Chart.js instance and wires up its full lifecycle: lazy kind registration (including mixed-dataset kinds), a ResizeObserver on the…"
---

> **createChartController**(`canvas`, `initial`): `Promise`\<[`ChartControllerHandle`](/core/api/reference/interfaces/chartcontrollerhandle/)\>

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

[`ChartUpdatePayload`](/core/api/reference/interfaces/chartupdatepayload/)

## Returns

`Promise`\<[`ChartControllerHandle`](/core/api/reference/interfaces/chartcontrollerhandle/)\>
