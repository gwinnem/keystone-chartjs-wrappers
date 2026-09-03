---
title: Introduction
description: What keystone-chartjs-vue is, who it's for, and how it relates to Chart.js and keystone-chartjs-core.
---

`keystone-chartjs-vue` is a single, generic `<Chart>` component for Vue 3 that
wraps [Chart.js](https://www.chartjs.org/) — every built-in chart type, plus
the financial, boxplot/violin, matrix, sankey, and treemap ecosystem
extensions, all selected with one `type` prop rather than a different
component per chart.

## Why one component, not many

Libraries like `vue-chartjs` expose a component per chart type (`<Bar>`,
`<Line>`, `<Doughnut>`, ...). That works well for the 8 built-in kinds, but
gets awkward once ecosystem extensions (candlestick, sankey, treemap, ...)
enter the picture — each would need its own component, its own import, its
own docs page. This library takes the opposite approach: **one** `<Chart>`
component, and `type` picks the kind. Adding support for a new chart kind
later never changes the component's public shape, only what values `type`
accepts.

## Where the actual logic lives

This package is deliberately thin. Chart lifecycle (mount/update/destroy),
lazy type registration, resize handling, and plugin wiring all live in
[`keystone-chartjs-core`](/core/), the framework-agnostic engine shared with
the React and Angular packages. `keystone-chartjs-vue` is the Vue-idiomatic
layer on top: a Composition API component, typed props, and (once built) an
exposed chart-instance ref for escape-hatch access.

## Requirements

- Vue 3.5+
- Chart.js 4.5+ (a peer dependency — install it alongside this package)

## Where to go next

- [Installation](/vue/guide/installation) — get the package added to your project
- [Concepts](/vue/guide/concepts/data-structures) — Chart.js fundamentals (data shapes, options resolution, axes, mixed charts, styling, performance, accessibility), explained in this library's own context so you don't need Chart.js's own docs site for the basics
- [Features](/vue/features) — what's implemented today vs. planned
- [Components](/vue/components) — the `<Chart>` component's props and events
- [API](/vue/api) — chart kinds and plugin helpers exported from this package
