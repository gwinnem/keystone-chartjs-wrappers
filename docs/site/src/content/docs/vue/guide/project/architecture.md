---
title: Architecture
description: How keystone-chartjs-vue relates to keystone-chartjs-core, and where responsibility splits between the two.
---

`keystone-chartjs-vue` follows the same core/framework split as
`keystone-chartjs-react` and `keystone-chartjs-angular`:

```
keystone-chartjs-core     — framework-agnostic. Zero Vue/React/Angular dependency.
  ├── chart lifecycle (construct, diff-and-update, destroy)
  ├── lazy chart-type registration (CHART_TYPE_REGISTRY)
  ├── plugin registration helpers (zoom, annotation, data labels, gradient,
  │   timestack, hierarchical)
  ├── inline, custom plugin passthrough (Chart.js's own `plugins` field)
  └── resize handling (ResizeObserver)

keystone-chartjs-vue       — thin Vue layer on top of core.
  └── <Chart> component: canvas ref + prop wiring into core's controller
```

**Everything that isn't Vue-specific belongs in core, not here.** If a fix
or feature seems to require duplicating logic core already has (e.g.
re-implementing the lazy-registration lookup, or hand-rolling resize
handling), that's a sign it should be added to or extended in core instead,
so React and Angular get the same fix for free rather than needing it
re-implemented three times.

`keystone-chartjs-core` is never published as a standalone package — it's
bundled directly into this package's own `dist` output at build time
(`chart.js` itself stays a real, separate peer dependency, since it keeps
global registration state that shouldn't be duplicated across two installed
copies).

## What this package actually owns

- The `<Chart>` single-file component: a `<canvas>` ref, `type`/`data`/
  `options`/`plugins` props, plus per-plugin opt-in props (`zoom`,
  `annotation`, `dataLabels`, `gradient`, `timestack`, `hierarchical`)
  that thread into core's plugin helpers.
- Vue lifecycle wiring, extracted into a `useChartController` composable
  (kept separate from `Chart.vue`'s own `<script setup>` block
  specifically so mutation testing has a real `.ts` file to target — a
  `.vue` SFC's own `<script>` block isn't a supported Stryker mutation
  target): mounting on `onMounted`, tearing down on `onBeforeUnmount`, and
  reacting to `type`/`data`/`options`/plugin-prop changes via a `watch`.
  Every mount/update call is serialized through a shared promise chain,
  since both of core's own controller calls are async and an overlapping
  prop change could otherwise race a still-in-flight one.
- An exposed chart-instance ref (via `defineExpose`) for advanced consumer
  access — the same "exposed instance state" pattern used elsewhere in the
  Keystone project family.

See [docs/IMPLEMENTATION_PLAN.md](https://github.com/gwinnem/keystone-chartjs-wrappers/blob/main/docs/IMPLEMENTATION_PLAN.md)
Phase 1 (core) and Phase 2 (this package) for the full implementation
history, including real bugs found and fixed along the way.
