# Feature Inventory — All Surveyed Vue + Chart.js Solutions

Source: this project's own `VUE_CHARTJS_OSS_PROJECTS.md` (the survey) and
`VUE_CHARTJS_MULTI_PARITY.md` (the comparison matrix this document
complements) — plus a further, deeper read of vue-chartjs's own real
`guide/` and `api/` pages (fetched directly, not guessed) for that
project specifically. This document inventories what each project
*offers*, standalone, rather than comparing head-to-head — a reference
for later use, not itself a public-facing doc.

Confidence markers match the other two documents: **[confirmed]** — read
directly from that project's own docs/README/source; **[likely,
unverified]** — inferred from a search snippet or general knowledge, not
independently re-confirmed here. Every project below except vue-chartjs
rests mostly on search snippets — treat their own lists as a starting
point to verify, not settled fact.

## keystone-chartjs-vue (this project)

- One generic `<Chart type="...">` component covering all 15 kinds (8
  built-in + 7 extension) **[confirmed]**
- Automatic, eager registration of all 8 built-in kinds at module load
  (`Chart.register(...registerables)`) — zero consumer setup
  **[confirmed]**
- Automatic, lazy registration of all 7 extension kinds (candlestick,
  ohlc, boxplot, violin, matrix, sankey, treemap) on first use of that
  specific kind **[confirmed]**
- First-class opt-in props for all 3 official plugins (`zoom`,
  `annotation`, `dataLabels`), each auto-registered on first use;
  `zoom`/`dataLabels` accept `true` or a config object, `annotation`
  requires a real config object (no boolean form) **[confirmed]**
- Props: `type`, `data`, `options`, `zoom`, `annotation`, `dataLabels`
  **[confirmed]**
- Reactive updates: `data`/`options`/plugin-prop changes update the
  chart in place via `chart.update()`; a `type` change alone destroys
  and reconstructs — diffed strictly on top-level `type` only
  **[confirmed]**
- Exposed `chart` instance ref (`defineExpose`) for direct Chart.js API
  access **[confirmed]**
- Automatic `ResizeObserver`-driven resize handling **[confirmed]**
- `applyTheme(patch)` — one-level-deep options patch + re-render,
  without touching `data` **[confirmed]**
- Mixed-chart passthrough: per-dataset `type` overrides reach Chart.js
  untouched, and their own backing packages get registered
  automatically too **[confirmed]**
- TypeScript-first (this project is authored in TypeScript)
  **[confirmed]**
- Vue 3 only **[confirmed]**
- **Resolved since this was originally written**: ARIA-attribute
  fallthrough (`aria-label`, `role`, `aria-describedby`, and any other
  non-prop attribute forwarded onto the rendered `<canvas>`, via Vue's
  own default single-root-component behavior) and a default slot for
  real fallback content are both now implemented and confirmed via real
  component tests — see `docs/site`'s own `vue/guide/concepts/
  accessibility.md`. No SSR-specific handling is still a genuine, open
  gap.

## vue-chartjs

- Per-kind components: `Bar`, `Line`, `Doughnut`, `Pie`, `PolarArea`,
  `Radar`, `Bubble`, `Scatter` — every Chart.js chart type exported as
  its own named component **[confirmed]**
- `createTypedChart(chartType, chartController)` factory for defining
  additional typed components (e.g. for an extension kind) yourself
  **[confirmed]**
- Props: `data`, `options`, `datasetIdKey` (identifies a dataset across
  updates), `plugins` (an array — page/chart-scoped plugins, not
  wrapper-managed opt-ins), `updateMode` (Chart.js's own transition-mode
  string), `ariaLabel`, `ariaDescribedby` — **any other prop passed
  falls through directly to the underlying `<canvas>` element**
  **[confirmed]**
- Reactive data/options watchers by default since v4 — updates or
  re-renders the chart automatically; the older mixins-based approach
  was removed **[confirmed]**
- Documented gotcha: consumers may hit Vue's `Target is readonly`
  warning when mutating `chartData` in place; the docs' own recommended
  workaround is either a clone (`JSON.parse(JSON.stringify(...))`) or a
  writable computed value **[confirmed]**
- Chart instance access via template ref: `this.$refs.bar.chart` (Vue 3)
  **[confirmed]**
- **Accessibility features**: `aria-label` prop, `aria-describedby` prop
  (referencing a real describing element, e.g. a data table), and a
  fallback-content slot for browsers that can't render `<canvas>`
  **[confirmed]** — none of these have an equivalent in this project
  today.
- Full TypeScript support **[confirmed]**
- Vue 3 (current major); legacy Vue 1.x/2.x support existed under
  older/`@legacy` npm tags **[confirmed]**
- Requires the consumer to manually call `ChartJS.register(...)` for
  every component used, including built-ins **[confirmed]**

## vue3-chartjs

- One generic `<vue3-chart-js type="...">` component **[confirmed]**
- `chartRef.value.update(animationSpeed = 750)`, `.resize()`,
  `.destroy()` — a small set of imperative methods exposed directly by
  reference, not just a raw Chart.js instance **[confirmed]**
- Escape hatch to the full Chart.js instance via
  `chartRef.value.chartJSState.chart` (e.g.
  `.chartJSState.chart.toBase64Image()`) **[confirmed]**
- `@before-render` event hook **[confirmed, from its own example — full
  event list not independently verified]**
- **[likely, unverified]** registration model, reactive-update
  semantics, TypeScript depth, and accessibility features — not
  confirmed from what's been read so far.

## @coreui/vue-chartjs

- Both a generic `<CChart>` component *and* per-kind components
  (`CChartBar`, `CChartLine`, `CChartDoughnut`, `CChartRadar`,
  `CChartPie`, `CChartPolarArea`, `CChartHorizontalBar`) **[confirmed]**
- Props include: `data` (can be a function receiving the canvas
  element, not just a plain object — useful for canvas-gradient-based
  styling), `customTooltips` (opts into HTML-based tooltips instead of
  Chart.js's own canvas-rendered ones, default `true`), `height`
  (default 150), `width` (default 300), `wrapper` (whether to wrap the
  canvas in a container div, default `true`) **[confirmed]**
- Chart instance access via template ref (`this.$refs.chart.instance`
  pattern, confirmed from its own real usage example) **[confirmed]**
- Part of the broader CoreUI component library, not a standalone
  charting-only package **[confirmed, by context]**
- **[likely, unverified]** registration model, full prop list beyond
  what's shown above, TypeScript depth.

## vue-chartjs-component

- One generic `<chart-component type="...">` component **[confirmed]**
- Vue 2 *and* 3 compatible via `vue-demi` **[confirmed]**
- Props include `data`, `options`, `canvasProps` (pass-through
  attributes for the underlying canvas, e.g. an `id`), `updateMode`
  **[confirmed, from its own real usage example]**
- Chart instance access via Chart.js's own static
  `Chart.getChart(canvasId)` lookup, not a wrapper-provided ref
  **[confirmed]**
- Its own docs explicitly position it for "charts that need to update
  periodically" and note that for *frequently* updating data, calling
  Chart.js's own `update()` imperatively may be preferable to relying on
  the wrapper's reactivity **[confirmed]** — a candid, stated limitation
  most other wrappers don't call out this explicitly.
- TypeScript compatible per its own description **[confirmed]**
- Maintenance status uncertain — last npm publish was roughly 5 years
  before this writing per its own npm page **[confirmed]**.

## SeregPie/VueChart (`@seregpie/vue-chart`)

- One generic `<vue-chart type="...">` component **[confirmed]**
- Vue 2 *and* 3 compatible via `vue-demi` **[confirmed]**
- Minimal, small-surface API by design — its own README is
  comparatively terse relative to the others surveyed here
  **[confirmed, by direct comparison of documentation depth]**
- **[likely, unverified]** full prop list, registration model,
  reactive-update semantics, TypeScript depth, escape hatch to the raw
  instance.

## vue-chart-3

- A direct TypeScript/Composition-API rewrite of vue-chartjs, built
  specifically to support Chart.js 3/4 + Vue 3 before vue-chartjs itself
  caught up **[confirmed]**
- `chartInstance` accessible by reference, per its own real changelog
  entry **[confirmed]**
- Reactive options support, including a fix (per its own changelog) for
  a call-stack loop that previously occurred "using reactive options
  using data or ref" **[confirmed, from its own changelog — implies real
  reactive-options support exists, with at least one historical rough
  edge]**
- `ExtractComponentData`/`ExtractComponentProps` utility types for
  stronger typing against its own components **[confirmed]**
- Vue 2 (via a separate `@legacy` tag + `@vue/composition-api`) and Vue
  3 (native) **[confirmed]**
- Since it's a direct rewrite of vue-chartjs, likely inherits that
  project's own per-kind component shape and manual-registration model
  **[likely, unverified — inferred from its own stated positioning, not
  independently re-confirmed against its current source]**

## Cross-cutting observations

- **Accessibility props and a canvas-attribute pass-through pattern were
  both confirmed gaps at the time this document was first written — both
  are now resolved.** ARIA-attribute fallthrough turned out to already
  work via Vue's own default single-root-component behavior (confirmed,
  not assumed, via a real component test); a default slot for real
  fallback content was added as genuinely new code (also confirmed via a
  dedicated test). See `docs/site`'s own `vue/guide/concepts/
  accessibility.md` for the full guide.
- **No surveyed project's own confirmed feature list mentions ecosystem
  extension kinds or official-plugin opt-in props** — consistent with
  `VUE_CHARTJS_MULTI_PARITY.md`'s own same finding from the comparison
  pass.

## Open items for later

- Every **[likely, unverified]** entry above should be checked directly
  against that project's own real docs/source before this feeds into
  anything public-facing.
