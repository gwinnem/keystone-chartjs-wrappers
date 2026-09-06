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
  deferred, and trendline, and inline/custom Chart.js plugin passthrough
  (`ChartUpdatePayload.plugins`).
- `ChartConfigData`/`ChartConfigDataset` exported types covering all 15
  chart kinds' real data shapes.
- `ChartConfiguration`, `ChartJs`, `ChartKind`, `ChartUpdatePayload`,
  `ZoomPluginOptions`, `AnnotationPluginOptions`, `DataLabelsPluginOptions`,
  `ImageLabelPluginOptions`, `AutocolorsPluginOptions`, `DeferredPluginOptions`,
  `TrendlineConfig` re-exported for consumer use.
- Nine of the ten official plugins are local ports, not real npm
  dependencies (`zoom`, `annotation`, `gradient`, `hierarchical`,
  `imageLabel`, `autocolors`, `deferred`, `trendline`, `dataLabels`),
  each dissected directly from the real, installed package's own source
  (fixing a handful of real bugs found along the way — see each
  plugin's own file header for the full rationale). `timestack` remains
  the only real npm dependency.
- 921 unit tests. 99.11% statements/lines, 94.52% branches, 99.63%
  functions overall — every individual file clears the project's own
  90% per-file floor on every metric, with a handful (`zoomPlugin.ts`,
  `hierarchicalScale.ts`, `deferredPlugin.ts`, `autocolorsPlugin.ts`,
  and the `trendline/*.ts`/`dataLabels/*.ts`/`plugins/annotation/**`
  files) settling in the 90–99% branch range rather than a clean 100%,
  each with its own documented, accepted survivors.

### keystone-chartjs-vue

- Single generic `<Chart type="...">` component for Vue 3 covering all 15
  chart kinds, all 10 official plugins, and inline custom plugins.
- Zero manual `Chart.register(...)` calls required — built-ins registered
  eagerly; extension kinds and plugins registered lazily on first use.
- Reactive updates: `data`/`options` changes update in place; a `type`
  change, or a changed `plugins` array reference, destroys and
  reconstructs.
- `zoom`, `annotation`, `dataLabels`, `gradient`, `timestack`,
  `hierarchical`, `imageLabel`, `autocolors`, `deferred`, `trendline`
  opt-in props, plus a `plugins` prop for any custom or community
  plugin outside those 10.
- Exposed `chart` instance ref (`defineExpose`).
- ARIA-attribute fallthrough onto the rendered `<canvas>` (Vue's own
  default single-root-component behavior — confirmed via a real test).
- Default slot for accessible fallback content inside the canvas tags.
- 49 component tests, 100% coverage.
- 84/84 Playwright e2e tests passing across Chromium, Firefox, and WebKit.

### Docs site

- Astro + Starlight documentation site with full Vue guide, API, components,
  and examples coverage (bar, line, bubble, scatter, doughnut, pie,
  polar area, radar, horizontal bar, mixed chart, multiple axes,
  chart events, colors plugin, zoom plugin, annotation plugin, data
  labels plugin, gradient plugin, timestack scale, hierarchical scale,
  image label plugin, autocolors plugin, deferred plugin, and trendline
  plugin — zoom/annotation/gradient/hierarchical/imageLabel/autocolors/
  deferred/trendline/dataLabels live and interactive; timestack
  source-only for its own real `luxon` dependency, a docs-site
  build-pipeline gap around dynamic imports of real npm dependencies).
- Concept guide pages: data structures, options resolution, axes & scales,
  mixed charts, colors/fonts/padding, performance, accessibility.

[Unreleased]: https://github.com/gwinnem/keystone-chartjs-wrappers/compare/HEAD
