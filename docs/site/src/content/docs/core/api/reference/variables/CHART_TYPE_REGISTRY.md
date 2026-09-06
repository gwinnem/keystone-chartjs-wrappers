---
editUrl: false
title: "CHART_TYPE_REGISTRY"
description: "Maps each supported ChartKind to the npm package (if any) whose controller/element must be registered via Chart.register(...) before a chart of that kind…"
---

> `const` **CHART\_TYPE\_REGISTRY**: `Record`\<[`ChartKind`](/core/api/reference/types/chartkind/), `ExtensionEntry` \| `null`\>

Maps each supported ChartKind to the npm package (if any) whose
controller/element must be registered via Chart.register(...) before a
chart of that kind can render. `null` means the kind is a Chart.js
built-in — its own controller/element/scale is registered eagerly at
module load instead, via the `Chart.register(...registerables)` call
above (see that call's own comment for why: this file previously
assumed, incorrectly, that the plain `'chart.js'` entry point
registers built-ins automatically on import — it does not).

See docs/IMPLEMENTATION_PLAN.md Phase 1 for the lazy-registration
strategy the 7 real entries below back (register-on-first-use, not
eagerly on import, to preserve tree-shaking for consumers who only use
a handful of the 5 separate ecosystem extension packages).
