---
title: Components overview
description: The single component this package exports.
---

`keystone-chartjs-vue` exports exactly one component: **`Chart`**. There is
no per-chart-type component (`Bar`, `Line`, etc.) — see
[Introduction](/vue/guide/introduction) for why.

```ts
import { Chart } from 'keystone-chartjs-vue';
```

- [Props](/vue/components/props) — `type`, `data`, `options`, and the 6
  official-plugin opt-in props (`zoom`, `annotation`, `dataLabels`,
  `gradient`, `timestack`, `hierarchical`), all implemented
- [Slots](/vue/components/slots) — a default slot for accessible fallback
  content, implemented
- [Events](/vue/components/events) — Vue events the component emits
  (not implemented — the exposed `chart` ref is the current escape hatch
  for anything an event would otherwise cover)

`<Chart>` also forwards any attribute you pass that isn't a declared prop
straight onto its rendered `<canvas>` (Vue's own default single-root-
component behavior) — useful for `id`, `class`, `style`, and ARIA
attributes alike. See [Accessibility](/vue/guide/concepts/accessibility)
for the full guide.
