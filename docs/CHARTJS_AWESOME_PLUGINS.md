# Chart.js "Awesome" Plugins — Chart.js v4-Compatible Survey

Source: https://github.com/chartjs/awesome#plugins, fetched Sept 2026.
Filtered to plugins marked v4-compatible in that list's own support column
(this project only targets Chart.js v4) — v2/v3-only plugins are excluded
entirely, not just deprioritized. A reference for Phase 5 (ecosystem
extensions & plugins hardening) when deciding whether any of these are
worth adding as an 11th+ official opt-in prop, alongside the 10 this
project now ships (zoom, annotation, dataLabels, gradient, timestack,
hierarchical, image-label, autocolors, deferred, trendline — all ten
already appear in this same "awesome" list, confirming they were
reasonable picks; each of the last seven started as one of the rows
below and was promoted to implemented — see their own notes under
Styling/Features/Interactions. `zoom`, `gradient`, `hierarchical`,
`image-label`, `autocolors`, `deferred`, and `trendline` are all
ported directly into this project's own source rather than kept as a
real dependency — see `CHARTJS_ANALYSIS.md` §4's own "Zoom/pan"/"Added
after v1 kickoff: Gradient"/"...Hierarchical"/"...Image label"/
"...Autocolors"/"...Deferred"/"...Trendline" sections.

Confidence: this list states what the "awesome" list itself claims
(name, repo, one-line description, v4-support badge) — none of these
remaining packages' own current maintenance status, real API shape, or
actual Chart.js v4 compatibility has been independently verified the way
the 10 official plugins' real config shapes were in `CHARTJS_ANALYSIS.md`
§4. Treat every remaining row here as "worth investigating," not
"confirmed to work."

## Styling

**autocolors (kurkle/chartjs-plugin-autocolors) has been implemented**,
at your explicit request — but not as a dependency: confirmed version
0.3.1, MIT, real Chart.js v4 compatibility confirmed directly from the
real package's own README ("This plugin requires Chart.js 3.0.0 or
later"), by the same maintainer already behind `gradient`/`zoom`. Its
real, published dist output (the package ships no real `src/`) was
dissected and ported directly into
`packages/core/src/plugins/autocolors/autocolorsPlugin.ts`, reimplementing the original's
own two small `@kurkle/color`-dependent color-conversion utility
functions locally (standard, textbook algorithms, not any bespoke logic
of the plugin's own) rather than adding that package as a new
dependency of this project. See `CHARTJS_ANALYSIS.md` §4's own "Added
after v1 kickoff: Autocolors" section for the full verification, and
`docs/site/src/content/docs/vue/examples/autocolors-plugin.mdx` for the
docs-site example. No longer a survey candidate — removed from the
table above (this section's own table is now empty; `colorschemes`/
`rough`/`style`, the other three "Styling" candidates the "awesome"
list surveys, remain excluded entirely — see "Not included above"
below — confirmed genuinely Chart.js-v2/v3-era with no verified
v4-compatible official release, not merely deprioritized).

**gradient (kurkle/chartjs-plugin-gradient) and timestack
(jkmnt/chartjs-scale-timestack) have both been implemented**, at your
explicit request. `timestack` remains a real npm dependency (confirmed
version 1.0.1, MIT, real Chart.js v4 compatibility confirmed). `gradient`
was originally added as a dependency the same way (confirmed version
0.6.1, MIT) but was later ported directly into
`packages/core/src/plugins/gradient/gradientPlugin.ts`, the same way `image-label` was —
it is no longer a real npm dependency of this project. See
`CHARTJS_ANALYSIS.md` §4's own "Added after v1 kickoff" sections for the
full verification, and `docs/site/src/content/docs/vue/examples/
gradient-plugin.mdx` / `timestack-scale.mdx` for the docs-site examples.
Neither is a survey candidate anymore — both removed from the table
above.

## Features

**trendline (Makanz/chartjs-plugin-trendline) has been implemented**,
at your explicit request — but not as a dependency: confirmed version
3.2.12, MIT, real Chart.js v4 compatibility confirmed directly ("Made
for Chart.js > 4.0", tested against 4.4.9/4.5.0), by Marcus
Alsterfjord, zero runtime dependencies of its own. Unlike every other
plugin this project has ported, there was no concrete bug or
unmaintained-dependency reason to port this one — it's actively
maintained with no known bugs found during dissection. Ported anyway,
at your explicit request, specifically so `keystone-chartjs-core`
depends on nothing but `chart.js` itself. Its real, published source
(the package ships real `.js` source, not just a minified bundle) was
dissected and ported directly into `packages/core/src/plugins/
trendline/` (six real files, mirroring the original's own real module
split). Its real config lives on each dataset (`dataset.trendlineLinear`/
`dataset.trendlineExponential`), like `gradient`. See `CHARTJS_
ANALYSIS.md` §4's own "Added after v1 kickoff: Trendline" section for
the full verification (including several genuine, undocumented
features found only by reading the source — `fillColor`, `dataset.
order`, `dataset.alwaysShowTrendline`, automatic ARIA labels, and real
legend integration), and `docs/site/src/content/docs/vue/examples/
trendline-plugin.mdx` for the docs-site example. No longer a survey
candidate — removed from the table above (this section's own table is
now empty).

(`annotation`/`datalabels` also appear in this list's own "Features"
category — already this project's own official plugins, not new
candidates.)

**hierarchical (sgratzl/chartjs-plugin-hierarchical) has been
implemented**, at your explicit request — confirmed version 4.4.5, MIT,
by sgratzl (the same maintainer already behind `@sgratzl/chartjs-chart-
boxplot` in this project). See `CHARTJS_ANALYSIS.md` §4's own "Added
after v1 kickoff" section for the full verification, and
`docs/site/src/content/docs/vue/examples/hierarchical-scale.mdx` for the
docs-site example. No longer a survey candidate — removed from the table
above.

**image-label (yunusemrejs/chartjs-image-label) has also been
implemented**, at your explicit request — but not as a dependency:
its real, published source (v1.0.10, MIT) was dissected and ported
directly into `packages/core/src/plugins/imageLabel/imageLabelPlugin.ts`, fixing two real
bugs found in the original along the way. One of seven of this
project's own 10 official plugins/scales (alongside `gradient`, `zoom`,
`hierarchical`, `autocolors`, `deferred`, and `trendline`) that renders live on the
docs site rather than source-only, since local code has no dynamic
import for the known docs-site hydration gap to apply to. See
`CHARTJS_ANALYSIS.md` §4's own "Added after v1 kickoff: Image label"
section for the full verification, and
`docs/site/src/content/docs/vue/examples/image-label-plugin.mdx` for
the docs-site example. No longer a survey candidate — removed from the
table above.

## Interactions

| Plugin | Repo | Description |
|---|---|---|
| **a11y-legend** | julianna-langston/chartjs-plugin-a11y-legend | Keyboard accessibility for chart legends |
| **chart2music** | julianna-langston/chartjs2music | Chart accessibility via keyboard navigation and sonification |
| dragdata | artus9033/chartjs-plugin-dragdata | Lets users drag data points on the chart |
| interaction-tools | NVital14/chartjs-plugin-interaction-tools | Drag data points and draw freeform trails directly on charts |
| select-drag | 01CodeLT/chartjs-plugin-selectdrag | Drag across charts to select an axis range |

**deferred (chartjs/chartjs-plugin-deferred) has been implemented**, at
your explicit request — confirmed version 2.0.0, MIT, by the official
Chart.js team (simonbrunel), real Chart.js v3/v4 compatibility
confirmed directly from the real package's own README ("Requires
Chart.js 3.x") and its own real-world use against Chart.js 4.x.
**Initially added as a real npm dependency, then later ported directly
into `packages/core/src/plugins/deferred/deferredPlugin.ts` in the same work session, at
your explicit request** — it is not, and is no longer, a real npm
dependency of this project. The package ships real, readable source
(not just a minified bundle), which was dissected and carried over
largely unchanged — including fixing a real bug (a `destroy` teardown
hook name Chart.js's own real `Plugin` interface doesn't recognize;
renamed to `afterDestroy`), the identical class of bug already found in
`gradient`'s own port. One of seven of this project's own 10 official
plugins/scales (alongside `gradient`, `zoom`, `hierarchical`, `image-
label`, `autocolors`, and `trendline`) that renders live on the docs site rather
than source-only. See `CHARTJS_ANALYSIS.md` §4's own "Added after v1
kickoff: Deferred" section for the full verification, and
`docs/site/src/content/docs/vue/examples/deferred-plugin.mdx` for the
docs-site example. No longer a survey candidate — removed from the
table above.

(`zoom` also appears in this list's own "Interactions" category —
already this project's own official plugin, not a new candidate.
**Later ported directly into `packages/core/src/plugins/zoom/zoomPlugin.ts`, at your
explicit request** — it is no longer a real npm dependency of this
project, dropping every Hammer.js-dependent code path (pinch-zoom,
gesture-driven pan) along the way, which also resolves the Hammer.js
unmaintained-dependency concern `CHARTJS_ANALYSIS.md` §6 originally
flagged as open. See that document's own §4 "Zoom/pan" section for the
full verification.)

**a11y-legend and chart2music are directly relevant to this project's own
existing, tracked accessibility gap** (see `IMPLEMENTATION_PLAN.md`'s
"Current status & open issues" item #7 and
`docs/site/.../guide/concepts/accessibility.md`) — worth specifically
considering alongside that gap, not just as generic Phase 5 candidates,
since both plugins directly address chart accessibility rather than
requiring this project to build ARIA/fallback-content support entirely
from scratch.

## Data Sources

| Plugin | Repo | Description |
|---|---|---|
| datasource-prometheus | samber/chartjs-plugin-datasource-prometheus | Displays time-series from Prometheus |

## Not included above (confirmed v2/v3-only, excluded, not just deprioritized)

colorschemes, rough, style (Styling); crosshair, doughnutlabel,
piechart-outlabels, regression, waterfall (Features); streaming (Data
Sources) — every one of these is marked unsupported for Chart.js v4 in the
"awesome" list's own support column.

**`regression` and `waterfall` have a real refactor plan written up**,
unlike the other v2/v3-only exclusions above — both are confirmed
genuinely abandoned at the v2 API level (`regression`'s own README states
outright "does not work with <chart.js@3.x>"; `waterfall`'s latest npm
release is 7 years old), so bringing either to Chart.js v4 means writing a
new, v4-native implementation guided by the original's own documented
behavior, not a source port. See `docs/REGRESSION_WATERFALL_REFACTOR_PLAN.md`
for the full scope analysis, real documented config shapes, and
step-by-step plan.

## Open items for later

- None of these remaining packages' own real current maintenance status,
  exact config shape, or genuine Chart.js v4 compatibility has been
  independently verified yet — do that before committing to any one as an
  11th official opt-in prop, matching the real verification `CHARTJS_
  ANALYSIS.md` §4 already did for zoom/annotation/dataLabels/gradient/
  timestack/hierarchical/image-label/autocolors/deferred/trendline.
- Decide whether adding an 11th+ official plugin is even the right model
  going forward, versus resolving the inline-`plugins`-array gap first
  (already resolved — see "Current status & open issues" item #6, now
  marked `[Resolved]`) — that fix means a consumer can already use any
  of these directly without this project needing to ship a dedicated
  opt-in prop for each one.
