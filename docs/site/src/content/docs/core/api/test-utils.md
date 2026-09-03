---
title: Test utilities
description: DOM-fixture helpers exported from a separate subpath, for the Vue/React/Angular packages' own component tests to share.
---

Exported from `keystone-chartjs-core/test-utils`, not the main entry
point — DOM-fixture helpers for the Vue/React/Angular packages' own
component tests to share, rather than each hand-rolling its own.

```ts
import { createTestCanvas } from 'keystone-chartjs-core/test-utils';
```

- **`createTestCanvas()`** — a bare `<canvas>`, attached to
  `document.body`.
- **`createTestCanvasWithParent()`** — a `<canvas>` inside a real parent
  `<div>`, both attached to `document.body`; returns `{ canvas, parent }`.
  Use this one over `createTestCanvas()` when testing anything that
  observes the canvas's *parent* specifically — `createChartController`'s
  own `ResizeObserver` target is `canvas.parentElement`, not the canvas
  (see [Lifecycle](/core/api/lifecycle)).
