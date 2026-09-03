---
title: Axes & scales
description: Cartesian and radial scales, positioning, and how to build a chart with more than one axis.
---

An axis (Chart.js calls it a "scale") maps a data value to a pixel position
on the canvas. `options.scales` reaches Chart.js completely untouched — this
page explains Chart.js's own scale system, not anything this library adds.
See the [Multiple axes example](/vue/examples/multi-axis/) for a full,
working `<Chart>` built around this.

## Cartesian vs. radial

- **Cartesian axes** — one or more X axes and one or more Y axes, mapping
  points onto a 2D plane. Used by `bar`, `line`, `bubble`, `scatter`, and
  most extension kinds. Default IDs: `x` and `y`.
- **Radial axes** — a single axis mapping points in the angular and radial
  directions. Used by `radar` and `polarArea`. Default ID: `r`.

## Scale types

Set via `options.scales.<id>.type`:

| Type | Typical use |
|---|---|
| `linear` | continuous numeric values |
| `logarithmic` | numeric values spanning several orders of magnitude |
| `category` | discrete labels (Chart.js's own default for the index axis on `bar`/`line`) |
| `time` / `timeseries` | date/time values — needs a separate date-adapter package (e.g. `chartjs-adapter-luxon`), not bundled with Chart.js or this library |
| `radialLinear` | the radial scale used by `radar`/`polarArea` |

## Multiple axes

Any chart can define more than one scale on the same axis direction — the
classic case being two Y axes with different units on one chart. Each
dataset then maps to a specific scale via `xAxisID`/`yAxisID`:

```js
const options = {
  scales: {
    y: { type: 'linear', position: 'left' },
    y1: { type: 'linear', position: 'right', grid: { drawOnChartArea: false } },
  },
};

const data = {
  datasets: [
    { label: 'Temperature', data: [...], yAxisID: 'y' },
    { label: 'Visitors', data: [...], yAxisID: 'y1' },
  ],
};
```

**Any scale ID beyond the defaults (`x`, `y`, `r`) needs its own explicit
`type`** — Chart.js doesn't infer one. `drawOnChartArea: false` on the
second scale is a common, purely cosmetic choice: two overlapping grids
usually read as noise, not extra information — see the [Multiple axes
example](/vue/examples/multi-axis/) for the full working version, including
axis titles and `interaction.mode: 'index'` (so hovering shows both
datasets' values together, regardless of which axis they're on).

## Common range options

- `min`/`max` — explicit, hard bounds. Some data points may fall outside
  and simply not render.
- `suggestedMin`/`suggestedMax` — extends the auto-computed range without
  removing Chart.js's own auto-fit behavior; safer than `min`/`max` when you
  just want a bit of headroom.
- `beginAtZero` (linear scales) — forces zero into the visible range.

## Stacking

Setting `stacked: true` on a value scale stacks positive and negative
values separately by default; `stacked: 'single'` stacks them together
into one combined stack. A `stack` string on individual datasets further
subdivides them into separate stack groups within the same scale.

## Where this fits with mixed charts

Per-dataset `xAxisID`/`yAxisID` composes with per-dataset `type` overrides
— see [Mixed charts](/vue/guide/concepts/mixed-charts) — so a chart can
combine different chart kinds *and* different scales in the same
`<Chart>`, exactly as it would in plain Chart.js.
