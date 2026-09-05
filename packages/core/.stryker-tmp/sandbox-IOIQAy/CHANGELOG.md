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
- `withHierarchical` — registers `chartjs-plugin-hierarchical` once, via
  its own real, confirmed named export (`HierarchicalScale`) and an
  explicit `Chart.register(...)` call — a third, distinct registration
  shape from the two helpers above.
- Inline, custom Chart.js plugin support (`ChartUpdatePayload.plugins`) —
  passed straight through to the real `Chart` constructor, distinct from
  the 6 official-plugin helpers above. A changed `plugins` array reference
  forces a destroy-and-reconstruct, since Chart.js only reads this field
  at construction time.
- Exported types: `ChartKind`, `ChartConfigData`, `ChartConfigDataset`,
  `ChartUpdatePayload`, `ChartControllerHandle`, `ChartConfiguration`,
  `ChartJs`, `ZoomPluginOptions`, `AnnotationPluginOptions`,
  `DataLabelsPluginOptions`.
- 62 unit tests, 100% coverage (statements/branches/functions/lines),
  93.55% mutation score overall (`plugins.ts` alone: 88.14%, with 7
  accepted survivors, all tracing to one root cause — see that file's
  own doc comment on `withTimestack`).

[Unreleased]: https://github.com/gwinnem/keystone-chartjs-wrappers/compare/HEAD
