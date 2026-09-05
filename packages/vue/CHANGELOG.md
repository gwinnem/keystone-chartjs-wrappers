# Changelog — keystone-chartjs-vue

## [Unreleased]

### Added

- `<Chart>` single-file component for Vue 3 — one generic component
  covering all 15 chart kinds (8 built-in + 7 ecosystem extensions), all 9
  official plugins via opt-in props, and inline custom plugins via a
  `plugins` prop.
- Props: `type`, `data`, `options`, `zoom`, `annotation`, `dataLabels`,
  `gradient`, `timestack`, `hierarchical`, `imageLabel`, `autocolors`,
  `deferred`, `plugins`.
- ARIA-attribute and arbitrary canvas-attribute fallthrough via Vue's own
  default single-root-component behavior (confirmed via a real component
  test, not assumed).
- Default slot for accessible fallback content inside the canvas tags.
- Reactive updates: `data`/`options`/plugin-prop changes update in place;
  a `type` change, or a changed `plugins` array reference, destroys and
  reconstructs.
- Exposed `chart` instance ref (`defineExpose`) for advanced consumer access.
- `useChartController` composable — extracted from `Chart.vue` specifically
  so Stryker mutation testing has a plain `.ts` file to target.
- 48 component tests, 100% coverage (statements/branches/functions/lines),
  97.73% mutation score, 1 accepted and documented surviving mutant.
- 81/81 Playwright e2e tests passing across Chromium, Firefox, and WebKit —
  all 15 chart kinds, all 9 plugins, and resize behavior confirmed rendering
  real, non-blank pixels in a real browser.

[Unreleased]: https://github.com/gwinnem/keystone-chartjs-wrappers/compare/HEAD
