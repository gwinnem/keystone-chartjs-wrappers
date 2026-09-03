# keystone-chartjs-vue vs vue-chartjs — Parity & Gap Analysis

Source: https://vue-chartjs.org/ (guide, API, examples pages) and
https://github.com/apertureless/vue-chartjs, fetched/searched Sept 2026.
`vue-chartjs` is the long-established, most widely used Vue wrapper for
Chart.js (1M+ weekly downloads per its npm page) — the natural comparison
point for `keystone-chartjs-vue`. This document is a working reference for
later use (a future `comparison-alternatives` docs page, prioritizing
remaining examples, etc.) — not itself a public-facing doc.

Confidence is marked per claim: **[confirmed]** — read directly from
vue-chartjs's own docs/README/source; **[likely, unverified]** — inferred
from general knowledge of the library, not independently re-confirmed
here; should be checked directly before publishing anything based on it.

## 1. Architecture — the core difference

- **[confirmed]** vue-chartjs ships **pre-typed, per-kind components**:
  `Bar`, `Line`, `Doughnut`, `Pie`, `PolarArea`, `Radar`, `Bubble`,
  `Scatter` — one component per built-in Chart.js type
  (`import { Bar } from 'vue-chartjs'`), plus a `createTypedChart`
  factory for defining additional typed components (e.g. for an
  extension kind) yourself.
- **[confirmed]** `keystone-chartjs-vue` deliberately takes the opposite
  approach — **one generic `<Chart type="...">` component** for all 15
  kinds (8 built-in + 7 extension), decided at this project's own
  kickoff (`IMPLEMENTATION_PLAN.md`'s own architecture-decisions
  section). No `createTypedChart`-equivalent exists or is planned —
  the generic component already covers what that factory exists to
  provide.
- Practical effect: a vue-chartjs consumer importing `Bar` gets
  TypeScript autocomplete/narrowing specific to bar-chart data shapes;
  a `keystone-chartjs-vue` consumer passing `type="bar"` relies on
  `ChartKind`-level narrowing (a union covering all 15 kinds) rather
  than a bar-specific component type. Neither is strictly better —
  it's a real, deliberate trade-off (fewer exported symbols and a
  uniform prop surface vs. per-kind type precision), worth stating
  plainly in a future comparison page rather than as a "win" either
  way.

## 2. Registration model — a real, confirmed gap in vue-chartjs's own favor on ergonomics, closed by design on ours

- **[confirmed]** vue-chartjs requires the **consumer to manually call
  `ChartJS.register(...)`** themselves before using any component —
  every single one of its own getting-started/example snippets shows
  this explicitly:
  ```js
  import { Chart as ChartJS, Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale } from 'chart.js'
  ChartJS.register(Title, Tooltip, Legend, BarElement, CategoryScale, LinearScale)
  ```
  This is true even for built-in kinds — vue-chartjs itself does not
  register anything on the consumer's behalf, matching Chart.js v4's
  own tree-shakeable design (see `packages/core/src/registry.ts`'s own
  comment on this same point, learned the hard way in this project's
  own Phase 2 e2e work).
- **[confirmed]** `keystone-chartjs-vue` requires **zero manual
  registration** for any of the 15 kinds or 3 plugins — built-ins are
  registered eagerly via `Chart.register(...registerables)` at
  `packages/core/src/registry.ts` module load; the 5 extension
  packages and 3 plugins are registered lazily, automatically, on
  first use of that specific kind/plugin. This is a genuine ergonomic
  advantage over vue-chartjs, not a minor one — it removes an entire
  category of setup code and a common source of "why is my chart not
  rendering" confusion (a misregistered/missing component is one of
  the most common vue-chartjs support questions).

## 3. Scope — built-ins vs. extensions vs. plugins

- **[confirmed]** vue-chartjs's own example set (both the current Vue 3
  StackBlitz sandboxes and the legacy Vue 2 ones) covers **only the 8
  Chart.js built-in kinds** — Bar, Bubble, Doughnut, Line, Pie,
  PolarArea, Radar, Scatter — plus three composition-pattern examples
  (reactive data, a custom chart, events). No sandbox for any
  ecosystem extension kind (financial, boxplot/violin, matrix, sankey,
  treemap) or any official plugin (zoom, annotation, datalabels)
  appears anywhere in its own docs.
- **[confirmed]** `keystone-chartjs-vue`'s own scope, per this
  project's kickoff decision, explicitly includes all 5 ecosystem
  extension packages (7 kinds: candlestick, ohlc, boxplot, violin,
  matrix, sankey, treemap) and all 3 official plugins (zoom,
  annotation, dataLabels) as first-class, equally-supported kinds/
  props — not an afterthought bolted on via a generic escape hatch.
  This is a real scope advantage: a vue-chartjs consumer wanting a
  sankey or treemap chart would need to hand-roll their own component
  via `createTypedChart` and register the extension package
  themselves; a `keystone-chartjs-vue` consumer just passes
  `type="sankey"`.
- **[likely, unverified]** vue-chartjs's own `createTypedChart` factory
  presumably *can* support extension kinds if a consumer registers the
  backing package and defines their own typed component — this project
  has not independently confirmed that by trying it, only inferred it
  from the factory's own stated purpose ("factory for custom chart
  types"). Worth confirming directly before stating in a public
  comparison page that vue-chartjs "can't" support extension kinds at
  all — the more defensible claim is that it doesn't ship them
  out of the box the way this project does.

## 4. Reactivity / update behavior

- **[confirmed]** vue-chartjs's own docs state: "Since v4 charts have
  data change watcher and options change watcher by default. Wrapper
  will update or re-render the chart if new data or new options is
  passed" — confirming it does have some reactive update path, not a
  mount-once/no-update implementation.
- **[likely, unverified]** Whether vue-chartjs's own update path
  diffs strictly on **top-level `type`** the same way
  `keystone-chartjs-vue`'s does (unchanged type → in-place
  `chart.update()`; changed type → destroy + reconstruct) is not
  confirmed from what's been read here — this project's own real,
  tested behavior (`packages/core/src/controller.ts`, Phase 1) is a
  deliberate, documented design choice; vue-chartjs's own precise
  semantics here would need to be read from its actual source
  (`src/BaseCharts.ts` or equivalent) before claiming parity or a gap
  either way.
- **[confirmed, a real documented vue-chartjs quirk]** vue-chartjs's
  own guide warns: "You may get Vue's `Target is readonly` warnings
  when you are updating your `chartData`" — a known rough edge in its
  own reactivity approach. Whether `keystone-chartjs-vue` has an
  equivalent warning/quirk is **not yet checked** — this project's own
  component tests do exercise a reactive nested-mutation case
  successfully (`Chart.spec.ts`'s own "reacts to a nested mutation of
  a reactive `data` object" test), which is at least some evidence
  against an equivalent problem, but this hasn't been checked against
  Vue's own dev-mode readonly warnings specifically. Worth a targeted
  check before claiming an advantage here.

## 5. Examples — what to prioritize next, based on this comparison

Given vue-chartjs's own example set is exactly the 8 built-in kinds +
3 composition patterns, and this project's own docs-site examples
gallery (as of this writing) already covers all 8 built-ins plus 2
extension/plugin examples (sankey, zoom — both source-only pending the
docs-site build-pipeline fix, see `IMPLEMENTATION_PLAN.md` Phase 6):

- **Already ahead of vue-chartjs's own example scope**: all 8 built-ins
  (matching), plus sankey and zoom-plugin (exceeding — vue-chartjs has
  no equivalent examples at all).
- **Not yet covered, that vue-chartjs's own example set has and ours
  doesn't**:
  - A dedicated **"custom chart"** composition-pattern example —
    vue-chartjs's own version demonstrates defining a new typed
    component via `createTypedChart`; this project's own equivalent
    would more naturally demonstrate passing an extension kind (e.g.
    `type="matrix"`) directly to the existing generic `<Chart>`,
    since that's the whole point of the architectural difference in
    §1 — worth an example specifically contrasting this with
    vue-chartjs's own more involved approach.
  - A dedicated **"events"** example — showing `options.onClick`/
    `options.onHover` (or a real plugin-based interaction) wired up
    through `<Chart>`. Not yet built for this project at all.
  - vue-chartjs's own **"reactive data"** example is already covered
    by this project's own `bar-chart` example (the in-place update via
    a randomize button) — no separate example needed for parity here.
- **Ahead of vue-chartjs's own scope, still incomplete relative to
  this project's own full 15-kind/3-plugin target**: the remaining 6
  extension kinds (candlestick, ohlc, boxplot, violin, matrix,
  treemap) and 2 plugins (annotation, dataLabels) have real,
  confirmed-working e2e coverage (`packages/vue/tests/e2e/`) but no
  docs-site example page yet.

## 6. Open items for later

- Read vue-chartjs's own source directly (not just its docs) to
  confirm or correct the §4 "likely, unverified" claims about its
  exact update-vs-recreate semantics before using this document to
  write anything public-facing.
- Confirm whether `keystone-chartjs-vue` has any equivalent to the
  `Target is readonly` warning vue-chartjs documents.
- Decide whether a public `vue/guide/project/comparison-alternatives`
  docs page (matching `keystone-dashboard-layout`'s own real
  precedent for its own comparison pages) is worth adding to Phase 6's
  scope, using this document as its factual basis.
