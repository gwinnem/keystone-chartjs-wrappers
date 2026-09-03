---
title: Lifecycle
description: Constructing, updating, resizing, and destroying a managed Chart.js instance.
---

- **`createChartController(canvas, initial)`** — constructs a managed
  Chart.js instance against `canvas` and returns a `Promise` resolving to
  a `ChartControllerHandle`. Registers every chart kind `initial` touches
  (the top-level `type` plus any per-dataset `type` override) before
  constructing, and wires up a `ResizeObserver` on `canvas.parentElement`
  (falling back to `canvas` itself if it has none).

## `ChartControllerHandle`

The object `createChartController` resolves to:

- **`chart`** — the live Chart.js instance (read directly; go through the
  methods below to change it).
- **`update(next)`** — diffs `next` against the current chart. An unchanged
  top-level `type` updates `chart.data`/`chart.options` in place via
  `chart.update()` — a changed mix of per-dataset `type` overrides alone
  does **not** force a rebuild. A changed top-level `type`, or a changed
  `plugins` array reference, destroys and reconstructs (`plugins` is
  only read by Chart.js at construction time, so it can't be patched
  in place).
- **`resize()`** — calls `chart.resize()` directly, independent of the
  automatic `ResizeObserver`.
- **`applyTheme(patch)`** — merges `patch` into `chart.options` **one level
  deep only** (not a recursive deep-merge — see the type's own doc
  comment for why) and calls `chart.update()`, without touching `data`.
  Intended for light/dark token re-application, not general options
  changes.
- **`destroy()`** — disconnects the `ResizeObserver` and destroys the
  Chart.js instance.

## `ChartUpdatePayload`

What both `createChartController` and `handle.update()` take:
`{ type, data, options?, plugins? }`. A flat shape, not nested inside a
`config` object. `plugins` is Chart.js's own real
`ChartConfiguration.plugins` field — inline, per-chart-instance plugin
objects, distinct from the [7 official plugin helpers](/core/api/plugins).

## Data and Chart.js re-exports

- **`ChartConfigData`** / **`ChartConfigDataset`** — the `data` shape this
  package's own framework components accept, across all 15 chart kinds
  (8 built-in + 7 ecosystem extensions — see
  [Chart kinds](/core/api/chart-kinds)).
- **`ChartConfiguration`** / **`ChartJs`** — re-exported from `chart.js`
  itself (`ChartJs` is Chart.js's own `Chart` class, aliased to avoid
  colliding with each framework package's own `<Chart>` component), so
  framework packages don't need a separate, direct `chart.js` type import
  for these.
