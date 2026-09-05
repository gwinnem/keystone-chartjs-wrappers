# Changelog

All notable changes to the packages in this monorepo are documented here.
This file follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
conventions. Each package's own changelog is maintained separately under
`packages/*/CHANGELOG.md`; this file covers cross-cutting monorepo-level
changes (tooling, shared config, docs site).

## [Unreleased]

### keystone-chartjs-core

- Framework-agnostic Chart.js engine: chart lifecycle (mount, diffed
  update, destroy), lazy registration of all 15 chart kinds (8 built-in +
  7 ecosystem extensions), `ResizeObserver`-driven resize handling,
  `applyTheme()`, plugin registration helpers for zoom, annotation, data
  labels, gradient, timestack, hierarchical, image label, autocolors,
  and deferred, and inline/custom Chart.js plugin passthrough
  (`ChartUpdatePayload.plugins`).
- `ChartConfigData`/`ChartConfigDataset` exported types covering all 15
  chart kinds' real data shapes.
- `ChartConfiguration`, `ChartJs`, `ChartKind`, `ChartUpdatePayload`,
  `ZoomPluginOptions`, `AnnotationPluginOptions`, `DataLabelsPluginOptions`,
  `ImageLabelPluginOptions`, `AutocolorsPluginOptions`, `DeferredPluginOptions`
  re-exported for consumer use.
- 414 unit tests. 100% coverage on every metric except one file:
  `hierarchicalScale.ts` sits at 98.2% statements/lines, 90.93%
  branches, 98% functions (every other file is a clean 100%,
  `zoomPlugin.ts` sits at 98.41% branches) — every file individually
  clears the project's own 90% floor on every metric. 93.55% mutation
  score overall (`plugins.ts` alone: 88.14%, with 7 accepted
  survivors, all tracing to one root cause).

### keystone-chartjs-vue

- Single generic `<Chart type="...">` component for Vue 3 covering all 15
  chart kinds, all 9 official plugins, and inline custom plugins.
- Zero manual `Chart.register(...)` calls required — built-ins registered
  eagerly; extension kinds and plugins registered lazily on first use.
- Reactive updates: `data`/`options` changes update in place; a `type`
  change, or a changed `plugins` array reference, destroys and
  reconstructs.
- `zoom`, `annotation`, `dataLabels`, `gradient`, `timestack`,
  `hierarchical`, `imageLabel`, `autocolors`, `deferred` opt-in props,
  plus a `plugins` prop for any custom or community plugin outside
  those 9.
- Exposed `chart` instance ref (`defineExpose`).
- ARIA-attribute fallthrough onto the rendered `<canvas>` (Vue's own
  default single-root-component behavior — confirmed via a real test).
- Default slot for accessible fallback content inside the canvas tags.
- 48 component tests, 100% coverage, 97.73% mutation score.
- 81/81 Playwright e2e tests passing across Chromium, Firefox, and WebKit.

### Docs site

- Astro + Starlight documentation site with full Vue guide, API, components,
  and examples coverage (bar, line, bubble, scatter, doughnut, pie,
  polar area, radar, horizontal bar, mixed chart, multiple axes,
  chart events, colors plugin, zoom plugin, annotation plugin, data
  labels plugin, gradient plugin, timestack scale, hierarchical scale,
  image label plugin, autocolors plugin, and deferred plugin — zoom/
  gradient/hierarchical/image-label/autocolors live and interactive;
  sankey/annotation/data-labels/timestack/deferred source-only pending
  a docs-site build-pipeline gap).
- Concept guide pages: data structures, options resolution, axes & scales,
  mixed charts, colors/fonts/padding, performance, accessibility.

[Unreleased]: https://github.com/gwinnem/keystone-chartjs-wrappers/compare/HEAD
