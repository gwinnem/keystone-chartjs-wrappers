# Trendline Plugin Implementation Plan

Companion to `CHARTJS_ANALYSIS.md` §4 and `CHARTJS_AWESOME_PLUGINS.md`'s own
"Features" table (`trendline` — the one v4-compatible, not-yet-implemented
candidate remaining in that category; `crosshair`/`doughnutlabel`/
`piechart-outlabels`/`regression`/`waterfall` are all confirmed v2/v3-only
and stay excluded). **Not yet started** — written to capture the real
scope/decisions found while scoping this out, matching
`ZOOM_PLUGIN_PORT_PLAN.md`'s own precedent, so the work can be picked up
later without re-deriving any of it.

## Package verified

`chartjs-plugin-trendline` (Makanz), confirmed via npm/GitHub:

- **Version**: `3.2.12` (released ~3 weeks before this plan was written)
- **License**: MIT
- **Author**: Marcus Alsterfjord
- **Chart.js compatibility**: "Made for Chart.js > 4.0", tested against
  4.4.9 — matches this project's own `^4.5.1` pin
- **Runtime dependencies**: none — confirmed directly from the real
  package's own `package.json` (only `devDependencies`: babel, jest,
  rollup, jest-canvas-mock — none of these are runtime deps)
- **ESM support**: v3.2.0+ added real ESM output specifically for
  bundlers like Vite (per the package's own `MIGRATION.md`) — the CDN/UMD
  build auto-registers itself as a side effect of `<script>` loading, but
  **the ESM import does NOT auto-register**: the package's own README
  shows an explicit `Chart.register(ChartJSTrendline)` call for the ESM/
  Node usage path, which is the one this project actually uses.

**Not yet dissected**: unlike `zoomPlugin.ts`/`gradientPlugin.ts`, this
plan was written from the real package's own README/docs, not yet from
its installed dist output — do that (`node_modules/chartjs-plugin-
trendline/dist/*.esm.js` or equivalent) as the actual first implementation
step, the same way every other local port in this project started.

## Real config shape (confirmed from the package's own README)

Config lives on each **dataset**, not `options.plugins.trendline` —
same mechanism as `gradient`. Two mutually-independent shapes, `trendlineLinear`
and `trendlineExponential` (a dataset can use either, and different
datasets on the same chart can use different ones):

```ts
interface TrendlineFontConfig {
  family?: string;
  size?: number;
}

interface TrendlineLabelConfig {
  color?: Color;
  text?: string;
  display?: boolean;
  displayValue?: boolean; // linear: shows slope; exponential: shows a, b
  offset?: number;
  percentage?: boolean; // linear only
  font?: TrendlineFontConfig;
}

interface TrendlineLegendConfig {
  text?: string;
  strokeStyle?: Color;
  fillStyle?: Color;
  lineCap?: CanvasLineCap;
  lineDash?: number[];
  lineWidth?: number;
}

interface TrendlineConfig {
  colorMin?: Color;
  colorMax?: Color;
  lineStyle?: 'dotted' | 'solid' | 'dashed' | 'dashdot';
  width?: number;
  xAxisKey?: string;
  yAxisKey?: string;
  projection?: boolean; // extend the line beyond the real data range
  trendoffset?: number; // >0 skips first n points, <0 uses only the last n
  label?: TrendlineLabelConfig;
  legend?: TrendlineLegendConfig;
}
```

`dataset.trendlineLinear = {...}` fits a straight line; `dataset.
trendlineExponential = {...}` fits `y = a × e^(b×x)` (works best with
positive y-values, per the package's own documented caveat). Both are
supported "for all chart types" per the README — worth confirming during
implementation which chart kinds this project offers actually make sense
paired with a trendline (`line`/`bar`/`scatter`/`bubble` clearly do;
`doughnut`/`pie`/`radar`/`polarArea` are a real open question, not
assumed either way here).

## Decision — dependency or local port?

**Recommendation: keep as a real npm dependency**, matching `annotation`/
`dataLabels` rather than porting. Reasoning, to confirm or override before
starting:

- **No real motivating reason to port.** Every plugin this project has
  ported so far had a concrete reason: `zoom` (Hammer.js unmaintained-
  dependency concern), `gradient`/`image-label` (a real, fixable bug
  found during dissection), `hierarchical` (zero dependencies of its
  own, making the port trivially self-contained), `autocolors` (avoiding
  a new `@kurkle/color` dependency, and the two functions needing it were
  small/standard enough to reimplement). Trendline has none of these:
  zero runtime dependencies already, actively maintained, no known bugs
  found yet (none looked for either — see "Not yet dissected" above).
- **The real cost of staying a dependency**: this project's own confirmed
  docs-site dynamic-import hydration gap (item #4 in
  `IMPLEMENTATION_PLAN.md`) — a dependency-based plugin's docs example
  renders source-only, not live, the same as `annotation`/`dataLabels`/
  `timestack` today. If a live example matters enough to outweigh the
  "no reason to port" point above, porting is the only way to get one —
  worth an explicit decision, not a default.
- **If ported anyway**: zero new dependencies either way (the package
  itself has none), so a port would be motivated purely by wanting a
  live docs example, not by avoiding dependency weight or fixing a bug —
  a materially different, weaker justification than every prior port had.

## Step-by-step plan (dependency path — adjust if the decision above changes)

1. **Add the dependency**: `packages/core/package.json` →
   `"chartjs-plugin-trendline": "^3.2.12"`.
2. **`types.ts`**: add `TrendlineConfig` (the shape above, likely two
   thin named types — `TrendlineLinearConfig`/`TrendlineExponentialConfig`
   — if the two configs' own fields diverge enough to be worth
   distinguishing at the type level once the real source confirms it).
   Merge onto `ChartConfigDataset`'s own index signature as
   `trendlineLinear?`/`trendlineExponential?` fields, the same way
   `gradient`'s own `dataset.gradient` field already reaches Chart.js
   untouched via the existing `data` passthrough — confirm during
   implementation whether a `declare module 'chart.js'` augmentation is
   needed the way `hierarchicalScale.ts`'s own `ControllerDatasetOptions`
   augmentation was, or whether the existing `ChartConfigDataset` index
   signature already covers it without one.
3. **`plugins.ts`**: `withTrendline(options)` — registers the dependency
   once via a dynamic `import('chartjs-plugin-trendline')` +
   `Chart.register(mod.default ?? mod)` call, matching `withAnnotation`/
   `withDataLabels`'s own exact shape (a real dependency, config lives
   elsewhere so nothing to merge into `options.plugins.*` — matching
   `withGradient`'s own "no plugin-level config, `options` returned
   unchanged" shape instead). Boolean-only opt-in, like `gradient`/
   `timestack`/`hierarchical` (config lives on the dataset, so there's
   no config object for the prop itself to carry).
4. **Vue**: `trendline?: boolean` prop on `useChartController.ts`/
   `Chart.vue`, threaded through `resolveOptionsAndPlugins()` the same
   way `timestack`/`hierarchical` are (a plain `if (props.trendline) {
   opts = await withTrendline(opts); }`, no inline-plugins-array
   involvement since it's registered globally like `annotation`/
   `dataLabels`, not supplied per-instance).
5. **Core unit tests**: `plugins.spec.ts` gets a `describe('withTrendline'
   , ...)` block matching `withGradient`'s own tests (`options` returned
   unchanged, registers exactly once, `mod.default ?? mod` fallback
   test alongside `withAnnotation`/`withDataLabels`'s own equivalents).
6. **Vue component tests**: `Chart.spec.ts` gets a `withTrendline` mock
   and a boolean-prop test, matching `withTimestack`/`withHierarchical`'s
   own existing tests exactly (boolean-only, no config-object form,
   `options` unchanged).
7. **e2e**: new `trendline-plugin.spec.ts` + fixture, matching
   `datalabels-plugin.spec.ts`'s own real-dependency pattern (not
   `gradient-plugin.spec.ts`'s local-port pattern) — real chart, a
   dataset with an actual linear trend in its data, confirming the
   trendline itself renders as a real, distinct line color/style from
   the data line. **Will render source-only on the docs site** (not
   live), the same known, accepted gap `annotation`/`dataLabels`/
   `timestack` already have — confirm this is acceptable before writing
   the docs example as source-only, per the decision above.
8. **Docs**:
   - New `docs/site/src/content/docs/vue/examples/trendline-plugin.mdx`
     (source-only, `live={false}`, matching `annotation-plugin.mdx`'s own
     structure) + example `.vue` component.
   - Sidebar (`astro.config.mjs`) + gallery (`examples.mdx`) entries
     under "Official plugins", plus the `official-plugins.mdx` overview
     page's own table/count (9 plugins).
   - `api/plugins.md`: new "Trendline" section, matching `annotation`'s
     own structure (real dependency, config-on-dataset like `gradient`,
     so a hybrid of the two existing section styles).
   - `CHARTJS_ANALYSIS.md` §4: new "Added after v1 kickoff: Trendline"
     section, matching `Timestack`'s own structure (real dependency,
     version/license/compat verification, no port).
   - `CHARTJS_AWESOME_PLUGINS.md`: mark implemented, remove from the
     "Features" survey table, matching how `hierarchical`/`trendline`'s
     own sibling `annotation`/`datalabels` entries are already written.
   - `IMPLEMENTATION_PLAN.md`: new numbered item, matching item #20's
     own structure (this plan document, package verification, real
     test/coverage numbers once implemented).
   - `CHANGELOG.md` (root, core, vue), both `README.md`s, `features.md`,
     `roadmap.md`, `testing.md`, `props.md`: updated plugin counts/lists
     (9th official plugin) — check each of these against the actual
     current prop list before editing, since several of these were found
     out-of-sync with real, already-shipped props (`imageLabel`) during
     the `autocolors` work and may drift again.
9. **`stryker.config.mjs`**: no change needed if kept a dependency (only
   local-port files are in `mutate` — `plugins.ts`'s own new
   `withTrendline` branch is already covered by that file's existing
   entry).

## Real risks/unknowns worth flagging before starting

- **Chart-kind applicability**: confirm which of this project's 15 chart
  kinds a trendline meaningfully applies to before writing the docs
  example — the README claims "all chart types" but a trendline on a
  `pie`/`doughnut`/`polarArea` chart has no obvious meaning; likely worth
  restricting the *example* to `line`/`bar`/`scatter` even if the plugin
  itself doesn't enforce a restriction the way `imageLabel` enforces
  doughnut/pie-only.
- **`xAxisKey`/`yAxisKey` interaction with this project's own
  `ChartConfigDataset` typing**: confirm these don't conflict with how
  this project already types per-dataset axis keys for mixed/scatter
  charts before finalizing the type.
- **Real source not yet dissected**: this plan's own config shape is
  taken from the README, not the installed dist output — confirm no
  divergence (the way `gradient`'s own `destroy`-vs-`afterDestroy` hook
  name bug, or `image-label`'s two real bugs, were only found by reading
  the real source directly) before considering this plugin done.
