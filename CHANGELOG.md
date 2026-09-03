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
  labels, gradient, timestack, and hierarchical, and inline/custom
  Chart.js plugin passthrough (`ChartUpdatePayload.plugins`).
- `ChartConfigData`/`ChartConfigDataset` exported types covering all 15
  chart kinds' real data shapes.
- `ChartConfiguration`, `ChartJs`, `ChartKind`, `ChartUpdatePayload`,
  `ZoomPluginOptions`, `AnnotationPluginOptions`, `DataLabelsPluginOptions`
  re-exported for consumer use.
- 62 unit tests, 100% coverage, 93.55% mutation score overall
  (`plugins.ts` alone: 88.14%, with 7 accepted survivors, all tracing to
  one root cause).

### keystone-chartjs-vue

- Single generic `<Chart type="...">` component for Vue 3 covering all 15
  chart kinds, all 6 official plugins, and inline custom plugins.
- Zero manual `Chart.register(...)` calls required — built-ins registered
  eagerly; extension kinds and plugins registered lazily on first use.
- Reactive updates: `data`/`options` changes update in place; a `type`
  change, or a changed `plugins` array reference, destroys and
  reconstructs.
- `zoom`, `annotation`, `dataLabels`, `gradient`, `timestack`,
  `hierarchical` opt-in props, plus a `plugins` prop for any custom or
  community plugin outside those 6.
- Exposed `chart` instance ref (`defineExpose`).
- ARIA-attribute fallthrough onto the rendered `<canvas>` (Vue's own
  default single-root-component behavior — confirmed via a real test).
- Default slot for accessible fallback content inside the canvas tags.
- 40 component tests, 100% coverage, 97.73% mutation score.
- 69/69 Playwright e2e tests passing across Chromium, Firefox, and WebKit.

### Docs site

- Astro + Starlight documentation site with full Vue guide, API, components,
  and examples coverage (bar, line, bubble, scatter, doughnut, pie,
  polar area, radar, horizontal bar, mixed chart, multiple axes,
  chart events, colors plugin — all live and interactive; sankey,
  zoom-plugin, gradient-plugin, timestack-scale, and hierarchical-scale
  source-only pending a docs-site build-pipeline gap).
- Concept guide pages: data structures, options resolution, axes & scales,
  mixed charts, colors/fonts/padding, performance, accessibility.

[Unreleased]: https://github.com/gwinnem/keystone-chartjs-wrappers/compare/HEAD
