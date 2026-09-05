# Changelog — keystone-chartjs-core

## [Unreleased]

### Added

- `createChartController(canvas, payload)` — chart lifecycle: construct,
  diffed update (in-place vs. destroy-and-reconstruct, diffed on
  top-level `type` and the `plugins` array's own reference),
  `ResizeObserver` resize, `applyTheme()`, destroy.
- `ensureChartKindRegistered(kind)` — lazy, cached registration for all 7
  ecosystem extension kinds via static, literal `import()` calls per case
  (enabling bundler static analysis). Built-ins registered eagerly via
  `Chart.register(...registerables)` at module load.
- `withZoom`, `withAnnotation`, `withDataLabels` — plugin registration
  helpers; each registers its plugin once and returns options with the plugin
  config merged into the correct `options.plugins.*` path.
- `withGradient` — registers `chartjs-plugin-gradient` once; unlike the
  three above, returns `options` completely unchanged, since this
  plugin's real config lives on each dataset instead of
  `options.plugins.gradient`.
- `withTimestack` — registers `chartjs-scale-timestack` once, via a
  side-effect-only import (no `Chart.register(...)` call at all, unlike
  every other helper here) — confirmed directly from the real package's
  own README. Requires `luxon` as a real, hard runtime dependency.
- `withHierarchical` — registers a local port of `chartjs-plugin-
  hierarchical` once, via a direct, synchronous `Chart.register(
  HierarchicalScale)` call — a third, distinct registration shape from
  the two helpers above (no config of its own to merge; a real scale,
  not a plugin with options).
- `withImageLabel` — registers a local port of `chartjs-plugin-image-
  label`; like `withGradient`, never calls `Chart.register(...)` at all
  — supplied per-chart-instance via Chart.js's own inline `plugins`
  array instead. `imagesList` is required, no plain-boolean form.
- `withAutocolors` — registers a local port of `chartjs-plugin-
  autocolors` once, via a direct, synchronous `Chart.register(...)`
  call (matching `withHierarchical`'s own mechanism) AND merges its own
  real config into `options.plugins.autocolors` (matching
  `withAnnotation`/`withDataLabels`'s own config-merging shape) — the
  only helper combining both traits.
- `withDeferred` — registers `chartjs-plugin-deferred` once, a real
  npm dependency; identical shape to `withDataLabels` (dynamic
  `import()`, `Chart.register(mod.default ?? mod)`, config merged into
  `options.plugins.deferred`). As of v2.x, this package no longer
  auto-registers itself — confirmed directly from its own README/
  migration guide.
- Inline, custom Chart.js plugin support (`ChartUpdatePayload.plugins`) —
  passed straight through to the real `Chart` constructor, distinct from
  the 9 official-plugin helpers above. A changed `plugins` array reference
  forces a destroy-and-reconstruct, since Chart.js only reads this field
  at construction time.
- Exported types: `ChartKind`, `ChartConfigData`, `ChartConfigDataset`,
  `ChartUpdatePayload`, `ChartControllerHandle`, `ChartConfiguration`,
  `ChartJs`, `ZoomPluginOptions`, `AnnotationPluginOptions`,
  `DataLabelsPluginOptions`, `ImageLabelPluginOptions`,
  `AutocolorsPluginOptions`, `DeferredPluginOptions`.
- 414 unit tests. 100% coverage on every metric except one file:
  `hierarchicalScale.ts` sits at 98.2% statements/lines, 90.93%
  branches, 98% functions (every other file is a clean 100%,
  `zoomPlugin.ts` sits at 98.41% branches) — every file individually
  clears the project's own 90% floor on every metric. 93.55% mutation
  score overall (`plugins.ts` alone: 88.14%, with 7 accepted survivors,
  all tracing to one root cause — see that file's own doc comment on
  `withTimestack`).

[Unreleased]: https://github.com/gwinnem/keystone-chartjs-wrappers/compare/HEAD
