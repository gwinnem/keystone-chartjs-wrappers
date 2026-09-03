# keystone-chartjs-vue vs. All Surveyed Vue + Chart.js Solutions — Parity & Gap Matrix

Source: this project's own `VUE_CHARTJS_OSS_PROJECTS.md` (the survey this
matrix is built from) plus the same search/fetch pass behind
`VUE_CHARTJS_PARITY.md` (the deeper, single-project vue-chartjs
comparison). This document extends that same exercise across every
actively-maintained project identified in the survey — a working
reference for later use, not itself a public-facing doc.

Confidence is marked per claim, same convention as `VUE_CHARTJS_PARITY.md`:
**[confirmed]** — read directly from that project's own docs/README/source;
**[likely, unverified]** — inferred from a search snippet or general
knowledge, not independently re-confirmed here. Confidence is markedly
lower for every project here except `vue-chartjs` (which had a full,
dedicated comparison pass in `VUE_CHARTJS_PARITY.md`) — treat every other
row as a starting point for verification, not a settled fact, before it
feeds into anything public-facing.

## Comparison matrix

| Dimension | **keystone-chartjs-vue** | vue-chartjs | vue3-chartjs | @coreui/vue-chartjs | vue-chartjs-component | SeregPie/VueChart | vue-chart-3 |
|---|---|---|---|---|---|---|---|
| **Component shape** | One generic `<Chart type="...">` **[confirmed]** | Per-kind (`Bar`, `Line`, etc.) + `createTypedChart` **[confirmed]** | One generic `<vue3-chart-js type="...">` **[confirmed]** | Both: generic `<CChart>` *and* per-kind (`CChartBar`, etc.) **[confirmed]** | One generic `<chart-component type="...">` **[confirmed]** | One generic `<vue-chart type="...">` **[confirmed]** | Per-kind, vue-chartjs-style **[likely, unverified — a stated rewrite of vue-chartjs, presumably inherited its component shape]** |
| **Built-in registration** | Automatic, eager (`Chart.register(...registerables)` at module load) — zero consumer setup **[confirmed]** | Manual — consumer must call `ChartJS.register(...)` even for built-ins **[confirmed]** | **[likely, unverified]** — not confirmed either way from what's been read | **[likely, unverified]** | **[likely, unverified]** | **[likely, unverified]** | **[likely, unverified — inherited vue-chartjs's own manual-registration model, given it's a direct rewrite]** |
| **Ecosystem extension kinds shipped** (financial/boxplot/violin/matrix/sankey/treemap) | All 7, first-class, auto-registered on first use **[confirmed]** | None shipped; possible via `createTypedChart` + manual registration **[confirmed: none shipped; likely, unverified: possible via factory]** | **[likely, unverified — no mention found of extension-kind support]** | **[likely, unverified — no mention found]** | **[likely, unverified — no mention found]** | **[likely, unverified — no mention found]** | **[likely, unverified — no mention found]** |
| **Official plugin opt-ins** (zoom/annotation/dataLabels) | First-class props, auto-registered on first use **[confirmed]** | Not a built-in concept — consumer registers and configures plugins directly against Chart.js's own API **[likely, unverified, but consistent with vue-chartjs's own "just Chart.js underneath" philosophy]** | **[likely, unverified]** | **[likely, unverified]** | **[likely, unverified]** | **[likely, unverified]** | **[likely, unverified]** |
| **Vue version support** | Vue 3 only **[confirmed — this project's own peerDependency]** | Vue 3 (current major); legacy Vue 1.x/2.x existed under older/`@legacy` tags **[confirmed]** | Vue 3 only, per its own name/positioning **[likely, unverified]** | Vue 3 (current); likely has a Vue 2 history like most in this space **[likely, unverified]** | Vue 2 *and* 3, via `vue-demi` **[confirmed]** | Vue 2 *and* 3, via `vue-demi` **[confirmed]** | Vue 2 *and* 3 (separate `@legacy` tag for Vue 2 + `@vue/composition-api`) **[confirmed]** |
| **TypeScript** | Full, first-party (this project is TypeScript-authored) **[confirmed]** | Full, first-party **[confirmed]** | **[likely, unverified]** | **[likely, unverified]** | Full — explicitly described as "Typescript compatible" **[confirmed]** | **[likely, unverified]** | Full — explicitly built "with Typescript...in mind" **[confirmed]** |
| **Escape hatch to raw Chart.js instance** | `chart` exposed ref (`defineExpose`) **[confirmed]** | Accessible per-component (documented pattern varies by version) **[likely, unverified — not independently re-confirmed here]** | `chartRef.value.chartJSState.chart` **[confirmed]** | **[likely, unverified]** | `Chart.getChart(canvasId)` (Chart.js's own static lookup, not a wrapper-provided ref) **[confirmed]** | **[likely, unverified]** | `chartInstance` accessible by ref, per its own changelog **[confirmed]** |
| **Maintenance status (as of this survey)** | Active (this project) | Very active — 1M+ weekly downloads, current version 5.3.4 **[confirmed]** | **[likely, unverified — not independently re-checked for recent commit activity]** | Active, part of the broader CoreUI ecosystem **[likely, unverified]** | Uncertain — last npm publish ~5 years before this writing per its own page **[confirmed from npm page; current status beyond that not checked]** | **[likely, unverified]** | Real and functional (176k+ downloads) but largely superseded now that vue-chartjs itself supports Vue3/Chart.js4 natively **[confirmed re: download count; "superseded" is this project's own judgment, not a claim from either project's own docs]** |

## What this confirms, at high confidence

- **No surveyed project ships ecosystem extension kinds as first-class,
  pre-registered chart kinds.** Every one of them, to the extent their
  own docs describe scope at all, targets Chart.js's 8 built-in types
  primarily — `keystone-chartjs-vue`'s own 7-extension-kind coverage
  (candlestick, ohlc, boxplot, violin, matrix, sankey, treemap) is a
  genuine, apparently-uncommon differentiator in this space, not just
  relative to vue-chartjs specifically.
- **Automatic registration (zero manual `Chart.register(...)` calls,
  even for built-ins) is not the norm.** vue-chartjs explicitly requires
  it; the rest are unconfirmed but, given most either wrap or
  historically derive from vue-chartjs's own approach, likely share
  this same manual-registration expectation rather than this project's
  own automatic model.
- **The generic-component-vs-per-kind-components split is genuinely
  mixed across the ecosystem**, not a settled convention either way —
  vue3-chartjs, vue-chartjs-component, and SeregPie/VueChart all chose
  the same one-generic-component shape this project did; vue-chartjs
  and (presumably) vue-chart-3 chose per-kind components; CoreUI offers
  both.

## Open items for later

- Every **[likely, unverified]** cell above should be checked directly
  against that project's own real docs/source before this feeds into
  anything public-facing — this pass relied on search snippets, not a
  dedicated deep-read the way `VUE_CHARTJS_PARITY.md`'s own vue-chartjs
  comparison did.
- Confirm current commit/release activity for vue3-chartjs, CoreUI's
  wrapper, SeregPie/VueChart, and vue-chartjs-component specifically —
  maintenance status is the least-confirmed dimension in this whole
  matrix.
- Consider whether the "no extension kinds anywhere else" finding is
  worth its own standalone note in a future public comparison page,
  independent of any single competitor — it's a scope claim about the
  whole ecosystem, not just one alternative.
