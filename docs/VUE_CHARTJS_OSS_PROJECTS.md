# Open-Source Vue + Chart.js Projects

Source: GitHub/npm search, fetched/searched Sept 2026. A survey of
publicly available open-source projects that wrap or integrate Chart.js
for Vue — compiled for reference alongside `VUE_CHARTJS_PARITY.md`
(which does a deeper comparison against `vue-chartjs` specifically, the
most widely used of these). Forks/mirrors of `apertureless/vue-chartjs`
with no independent identity (e.g. repos that are just re-hosted copies
of that same README) are excluded — this list is distinct projects only.

## Actively maintained (Vue 3 / Chart.js 4, as of this writing)

| Project | Repo | Approach | Notes |
|---|---|---|---|
| **vue-chartjs** | [apertureless/vue-chartjs](https://github.com/apertureless/vue-chartjs) | Per-kind components (`Bar`, `Line`, `Doughnut`, `Pie`, `PolarArea`, `Radar`, `Bubble`, `Scatter`) + `createTypedChart` factory | The de facto standard — 1M+ weekly downloads, current version 5.3.4. Requires manual `ChartJS.register(...)` for every kind, even built-ins. See `VUE_CHARTJS_PARITY.md` for a full comparison against this project. |
| **vue3-chartjs** | [J-T-McC/vue3-chartjs](https://github.com/J-T-McC/vue3-chartjs) (npm: `@j-t-mcc/vue3-chartjs`) | One generic `<vue3-chart-js type="...">` component | Closer in shape to this project's own architecture (one generic component vs. vue-chartjs's per-kind split). Exposes a `chartRef.value.chartJSState.chart` escape hatch for direct Chart.js API access. |
| **@coreui/vue-chartjs** | [coreui/coreui-vue-chartjs](https://github.com/coreui/coreui-vue-chartjs) | Both a generic `<CChart>` and per-kind components (`CChartBar`, `CChartLine`, etc.) | Part of the broader CoreUI component-library ecosystem, not a standalone charting-focused project — likely a heavier dependency footprint if charting is the only thing needed from it. |
| **vue-chartjs-component** | [npm: vue-chartjs-component](https://www.npmjs.com/package/vue-chartjs-component) | One generic `<chart-component type="...">` | Vue 2/3 compatible via `vue-demi`. Smaller/less active project (last published ~5 years before this writing per its own npm page) — worth confirming current maintenance status before relying on it. |
| **VueChart** | [SeregPie/VueChart](https://github.com/SeregPie/VueChart) (npm: `@seregpie/vue-chart`) | One generic `<vue-chart type="...">` | Also Vue 2/3 compatible via `vue-demi`. Simple, minimal-API wrapper. |

## Historical / superseded

| Project | Repo | Status |
|---|---|---|
| **vue-chart-3** | [victorgarciaesgi/vue-chart-3](https://github.com/victorgarciaesgi/vue-chart-3) | A TypeScript/Composition-API rewrite of vue-chartjs for Chart.js 3/4, built specifically because vue-chartjs's own Vue 3 + Chart.js 4 support lagged at the time. Largely superseded now that `vue-chartjs` itself has caught up to Chart.js 4 and Vue 3 natively — still real, published, and functional (176k+ downloads per its own npm page), but a new project today would likely reach for `vue-chartjs` directly instead. |
| **vue-chart-js** (no relation to vue3-chartjs above) | [kevinongko/vue-chart-js](https://github.com/kevinongko/vue-chart-js) | Targets the old Chart.js 2.7 / Vue 2 global-script era (`Vue.use(VueChart.default)`) — not a Vue 3 / Chart.js 4 fit. Maintainer's own README notes reduced free time for upkeep. |
| **vue-charts** | [GimmyHchs/vue-charts](https://github.com/GimmyHchs/vue-charts) | Explicitly marked **Deprecated** by its own maintainer, in the repo's own title. Vue 2 + Chart.js 2.3-era only. |
| **vue-chartjs** (original, pre-v2 Vue 3 support) | N/A — historical versions of `apertureless/vue-chartjs` itself | Not a separate project, but worth noting: `vue-chartjs`'s own Vue 1.x support existed under a `@legacy` npm tag before the project moved to Vue 2, then Vue 3 — its own guide still references this migration history. |

## Adjacent, not Chart.js-specific (included for completeness, since they compete for the same "Vue charting library" search intent)

| Project | Repo | Underlying library |
|---|---|---|
| **vue-echarts** | [ecomfe/vue-echarts](https://github.com/ecomfe/vue-echarts) | Apache ECharts, not Chart.js — a genuinely different charting engine (SVG/Canvas hybrid, much larger feature surface: maps, 3D, more chart kinds out of the box) |
| **ApexCharts** (via its own Vue integration) | [apexcharts/apexcharts.js](https://github.com/apexcharts/apexcharts.js) | Its own charting engine, not Chart.js |
| **jscharting-vue** | [jscharting/jscharting-vue](https://github.com/jscharting/jscharting-vue) | JSCharting (commercial license), not Chart.js |

## Where `keystone-chartjs-vue` fits

Architecturally closest to **vue3-chartjs** (one generic `<Chart type="...">`
component, not vue-chartjs's per-kind split) — see `VUE_CHARTJS_PARITY.md`
§1 for the fuller reasoning behind that choice. Scope-wise, none of the
actively maintained projects above ship the 5 ecosystem extension
packages (financial, boxplot/violin, matrix, sankey, treemap) as
first-class, pre-registered kinds the way this project does — every one
of them would require a consumer to register the extension package
themselves and, in vue-chartjs's case, hand-roll a typed component via
`createTypedChart`. None require zero manual `Chart.register(...)` calls
for built-ins either, unlike this project's own automatic, eager
registration.

## Open items for later

- Confirm current maintenance status (last commit/release date) for
  each project above directly before citing any of them in a public
  comparison page — several of these were identified via search
  snippets that may be stale.
- If a public comparison page is ever written (see
  `VUE_CHARTJS_PARITY.md`'s own §6), decide whether it's worth
  comparing against more than just `vue-chartjs`, or whether that
  remains the single most useful comparison point given its dominant
  adoption.
