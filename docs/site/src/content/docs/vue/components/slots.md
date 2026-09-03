---
title: Chart slots
description: The default slot on <Chart>, for accessible fallback content.
---

| Slot | Purpose | Status |
|---|---|---|
| default | Fallback content rendered inside the `<canvas>` tags | Implemented |

Chart.js's own accessibility docs are explicit that content placed between
a canvas element's own opening and closing tags is what browsers and
assistive technology that can't render canvas at all actually show. Any
content passed as default slot content renders exactly there:

```vue
<Chart type="bar" :data="data">
  <p>Quarterly revenue: Q1 $50k, Q2 $65k, Q3 $58k, Q4 $72k</p>
</Chart>
```

A real, meaningful text alternative (a summary, or a real data table) is
what belongs here — not a generic "your browser doesn't support canvas"
message, which gives a screen reader nothing useful to announce. See
[Accessibility](/vue/guide/concepts/accessibility) for the full guide,
including how this combines with ARIA attributes passed directly to
`<Chart>` (see [Props](/vue/components/props#accessibility-attributes)).
