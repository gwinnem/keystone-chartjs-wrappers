---
title: Introduction
description: What keystone-chartjs-core actually is, who needs to reach for it directly, and what's genuinely framework-free versus DOM-dependent.
---

`keystone-chartjs-core` is the shared implementation underneath every
framework package in this project. Chart lifecycle (construct-on-mount,
diff-and-update on data/options change, destroy-on-unmount), lazy chart-kind
registration (dynamically importing and registering an ecosystem
extension's controller on first use), and official-plugin wiring (zoom,
annotation, data labels, gradient, timestack, hierarchical, and a
locally-ported image-label plugin) all live here exactly once — the Vue,
React, and Angular packages each call into this same code rather than
maintaining their own copy of any of it.

## Who this is for

Most people don't need this page at all — installing
[Vue](/vue/), React, or Angular already pulls this in as a dependency, and
none of its exports need to be touched directly to use any of those three
packages normally.

This package is worth reaching for directly when you want the same chart
lifecycle/registration/plugin logic *without* any of those three
components — for example:

- Driving a managed Chart.js instance from plain TypeScript, with no
  framework involved at all.
- Building an integration for a framework this project doesn't ship a
  package for yet (Svelte, Solid, or plain web components) — the same
  lifecycle/registration/plugin logic the three existing packages use,
  without reimplementing any of it.

## What's genuinely framework-agnostic, and what isn't

Every export here is free of Vue/React/Angular-specific code — that's the
whole point of this package existing. It is **not**, however, entirely free
of the DOM: `createChartController` constructs a real Chart.js instance
against a real `HTMLCanvasElement` and wires up a real `ResizeObserver` on
its parent element. That's *framework*-agnostic (nothing here cares which
UI framework called it) but not *DOM*-free, unlike `ensureChartKindRegistered`
and five of the seven plugin helpers (`withZoom`, `withAnnotation`,
`withDataLabels`, `withTimestack`, `withHierarchical`), which only ever
touch Chart.js's own registration API — no canvas, no DOM element,
required. `withGradient` and `withImageLabel` are both partial
exceptions: each helper function itself is still DOM-free (both just
return `{ options, plugin }`), but the local plugin object each one
returns has its own real draw/update hooks that Chart.js calls later
with a real canvas context (and, for `withImageLabel`, `Image()`
elements too) — unavoidable, since that's the whole point of each
plugin.

## Where to go next

- **[Installation](/core/guide/installation)** — how this package is
  actually reached today.
- **[API reference](/core/api)** — every exported function and type,
  grouped by what it does.
