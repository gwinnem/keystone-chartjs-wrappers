# Regression Plugin Refactor Plan

Companion to `docs/REGRESSION_WATERFALL_REFACTOR_PLAN.md` (the original,
README-only scoping of this plugin, written before its real module
structure was known) and `docs/ANNOTATION_PLUGIN_PORT_PLAN.md`/
`docs/DATALABELS_PLUGIN_PORT_PLAN.md` (whose real-source-first rigor this
plan now matches for `regression` specifically). **Not yet started** —
written to capture the real scope/decisions found while scoping this
out, so the work can be picked up later without re-deriving any of it.
This plan supersedes the "regression" half of the combined document
above; the "waterfall" half of that document is unaffected and still
current.

## Why this is a refactor, not a port — the real, confirmed distinction

Every plugin this project has actually ported (`zoom`, `gradient`,
`hierarchical`, `image-label`, `autocolors`, `deferred`) started from
real source that already ran correctly against Chart.js v4 — the port
dissected that source and carried its logic over largely unchanged,
fixing any real bugs found along the way. `chartjs-plugin-regression` is
different in kind, confirmed directly and explicitly by its own
maintainer, not inferred: the package's own README states outright,
**"The plugin does not work with &lt;chart.js@3.x&gt;."** Its own real
registration mechanism (`Chart.plugins.register(...)`, or an inline
`plugins: [ChartRegressions]` array under Chart.js v2's own, since-removed
plugin API shape) and its own real per-plugin lifecycle hooks are tied
to APIs Chart.js v3/v4 no longer has. Bringing this to Chart.js v4 means
writing a new, v4-native implementation guided by the original's own
real, documented behavior and real module boundaries — not a source port
carrying logic over unchanged the way every port above did.

## Real module structure, confirmed directly from the installed package's own compiled output

Pulled directly from the real, published `lib/index.js`'s own real
`require(...)` calls (not guessed, not README-only) — the original ships
four real, separate compiled modules, re-exported together from one
entry point:

```js
__exportStar(require("./types"), exports);
__exportStar(require("./MetaData"), exports);
__exportStar(require("./MetaSection"), exports);
__exportStar(require("./regression-plugin"), exports);
```

This is a genuinely more granular real structure than the README alone
suggested — the original's own real `src/` (confirmed to exist and be
real TypeScript, per its own `package.json`'s `"format": "prettier
--write \"src/**/*.ts\""` script) is organized around two real, named
classes (`MetaData`, `MetaSection`) plus a `types.ts` and the plugin
orchestrator itself, not one flat file. Real per-file responsibilities,
inferred from these names combined with the README's own fully
documented public API (not yet confirmed by directly reading each
file's own real body — see "Real risks/unknowns" below for what's still
open):

- **`types.ts`** — the real, documented config shape: `type` (a single
  regression kind, or an array of kinds — the best-R² one is drawn),
  `line` (`{color, width, dash}`), `calculation` (`{precision, order}`),
  `extendPredictions`, `copy` (`{overwriteData, minValue, maxValue,
  fromSectionIndex}`), `sections` (per-dataset), and the global-level
  `onCompleteCalculation` callback.
- **`MetaData.ts`** — almost certainly the real class backing the
  plugin's own documented `.getDataset(chart, datasetIndex)` API, which
  returns `{ sections, getXY(x, y), topY, bottomY }` — a real,
  per-dataset metadata object the plugin builds and maintains
  internally, not just a plain object literal.
- **`MetaSection.ts`** — almost certainly the real class backing each
  entry in that same object's own `sections` array, and what
  `.getSections(chart, datasetIndex)` returns — holding one section's
  own real `{type, startIndex, endIndex, line, result}`, where `result`
  is the actual regression calculation output.
- **`regression-plugin.ts`** — the real Chart.js plugin object itself:
  registration, per-chart-instance state, the real calculation
  orchestration (calling into the `regression` npm package, the
  original's own real calculation engine dependency), and the actual
  `draw()` logic plotting each section's own regression line (and, per
  `extendPredictions`, its own dashed-line continuation into
  neighboring sections).

**Recommended file split for the refactor, mirroring this real
structure** — the same "mirror the original's own real module
boundaries" approach `annotation`'s own plan already committed to for
its six type files:
`packages/core/src/plugins/regression/{types,metaData,metaSection,regressionPlugin}.ts`.

## What genuinely carries over vs. what needs a fresh v4-native implementation

- **Carries over directly, no v4-specific rework needed**: the real
  config shape (`types.ts`'s own real fields, all confirmed from the
  README above) and the real calculation math itself, if
  `MetaSection`'s own real logic turns out to be a thin wrapper around
  the `regression` npm package's own real curve-fitting functions
  (`linear`, `exponential`, `power`, `polynomial`, `logarithmic`) —
  worth keeping as a real dependency if that package itself is still
  maintained and Chart.js-version-agnostic (it has no Chart.js
  dependency of its own at all, being a generic curve-fitting library),
  matching the "keep genuinely independent calculation engines as real
  dependencies" reasoning `autocolors`'s own port used for
  `@kurkle/color` before reimplementing it locally for a *different*
  reason (avoiding an undeclared transitive dependency, which doesn't
  apply here since `regression` would be a direct, declared dependency
  of this project instead).
- **Needs a fresh v4-native implementation, confirmed structurally
  incompatible, not just untested**: the real plugin registration
  mechanism (`Chart.register(...)`, not the original's own v2-era
  `Chart.plugins.register(...)`/inline-array-only shape), any real
  per-chart-instance state storage (a `WeakMap`, matching every prior
  port's own already-improved pattern over the original's typical
  plain-`Map`/ad-hoc-property approach — worth confirming which the
  original actually used once `regression-plugin.ts`'s own real body is
  read), the real scale-value-to-pixel resolution calls (Chart.js v2's
  own scale API — `getPixelForValue`, tick/axis internals — changed
  shape substantially by v3, the same category of break already
  documented in `docs/REGRESSION_WATERFALL_REFACTOR_PLAN.md`'s own "the
  specific v2\u2192v4 API breaks" section), and the real per-drawTime draw
  hook wiring (v4's own real `beforeDraw`/`afterDraw`/
  `beforeDatasetsDraw`/`afterDatasetsDraw` hooks, matching the shape
  `annotation`'s own real multi-phase drawing already uses).

## Open decisions — need your call before implementation starts

1. **Keep `regression` (the calculation-engine npm package) as a real
   dependency, or reimplement its curve-fitting formulas locally?** Not
   yet decided. Its own real maintenance status, current version, and
   genuine Chart.js-independence haven't been confirmed yet (a real,
   required step before this decision, not assumed here) — if it's
   healthy and small, keeping it as a dependency is the more honest
   default (unlike `@kurkle/color`, there's no undeclared-transitive-
   dependency concern to avoid here, since this project would depend on
   `regression` directly). If it's abandoned or oversized for what's
   actually used, reimplementing the specific fits needed (ordinary
   least-squares for linear, log-linearization for exponential/power,
   Vandermonde-matrix solving for polynomial, all standard, textbook
   algorithms) is the fallback, matching `autocolors`'s own precedent
   for small, standard math with one agreed-upon definition.
2. **`sections`/`copy` real semantics need their own real source read**
   before implementation, not just the README's own prose description —
   in particular, `copy.overwriteData: 'empty'`'s own exact real
   definition of "empty" (the README says "zero, undefined, or null
   data") and the real interaction between `extendPredictions` and
   multiple sections' own dashed-line continuations both read as
   genuinely subtle behavior worth confirming against the real
   `MetaSection.ts` body rather than re-deriving from prose alone.
3. **Public API surface** (`.getDataset(chart, datasetIndex)`,
   `.getSections(chart, datasetIndex)`) — worth deciding whether this
   refactor preserves these exact method names/shapes for anyone
   migrating from the original package directly, or whether a more
   idiomatic-for-this-project surface (e.g. a exported helper function
   rather than a method hung off the plugin object) is preferred. No
   prior port in this project has had to make this exact call, since
   none of them expose a comparable public API of their own beyond
   config.

## Step-by-step plan

1. **Read `regression-plugin.ts`, `MetaData.ts`, and `MetaSection.ts` in
   full**, via the real, published npm package's own source map
   (`lib/regression-plugin.js.map`, etc. — confirmed to exist from the
   minified bundle's own `//# sourceMappingURL` comment) or by locating
   the real GitHub repository's own `src/` files directly — not yet
   done for this plan; the module-structure/API facts above come from
   the compiled output's own `require(...)` calls and the README's own
   fully documented config/API surface, not a line-by-line read of
   each file's real body. This is the mandatory first step, the same
   rigor `annotation`/`dataLabels`'s own plans already applied.
2. **Resolve open decision #1** (the `regression` package's own real
   status) before writing any calculation code.
3. **New files**, mirroring the real module split above:
   `packages/core/src/plugins/regression/types.ts` (the real config
   shape), `metaData.ts`/`metaSection.ts` (the real per-dataset/
   per-section state classes, rewritten against Chart.js v4's real
   scale/element APIs), `regressionPlugin.ts` (the real orchestrator —
   registration, per-chart `WeakMap` state, the real multi-phase draw
   hooks, scale-range interaction if the original has any comparable
   to `annotation`'s own `afterDataLimits` auto-adjustment — not yet
   confirmed either way).
4. **`plugins.ts`**: a new `withRegression` helper, registering directly
   via a real, synchronous `Chart.register(...)` call (matching
   `withHierarchical`/`withAutocolors`/`withDeferred`'s own mechanism),
   merging the given config into `options.plugins.regressions` (plural
   — the original's own real, documented option key, confirmed from the
   README) or into a per-dataset `dataset.regressions` field, per
   whichever the real source confirms in step 1 (the README's own
   examples show it as a per-dataset field, similar to `gradient`'s own
   `dataset.gradient`, not `options.plugins.<id>` the way most other
   plugins here work — worth confirming precisely, not assuming, since
   this changes which project convention this plugin follows).
5. **Core unit tests**: split per real file
   (`tests/unit/plugins/regression/{types,metaData,metaSection,
   regressionPlugin}.spec.ts`), each covering its own file's real logic
   directly — the calculation-correctness tests in particular (one real
   curve fit verified per regression type: linear, exponential, power,
   polynomial, logarithmic) deserve the same direct, formula-level
   rigor `zoomPlugin.spec.ts`'s own scale-math tests already established
   for this project's largest prior port.
6. **`stryker.config.mjs`**: add every new file under
   `src/plugins/regression/` to `mutate`.
7. **Vue prop**: a new `regression` prop (config-object required, no
   plain-boolean form — matching `annotation`'s/`imageLabel`'s own
   reasoning, since there's no sensible empty default for "which
   regression type to fit").
8. **New docs-site example, live from the start** (since this is new
   local code, not a dependency, the same outcome every completed port
   has reached) — `chart-events`-style real-data example demonstrating
   at least two real regression types (e.g. `linear` and `polynomial`)
   fitting real, visibly-different curves.
9. **Docs**: `CHARTJS_ANALYSIS.md` §4 (a new "Added after v1 kickoff:
   Regression" section, matching every prior port's own section
   structure), `CHARTJS_AWESOME_PLUGINS.md` (`regression` moves out of
   "Not included above" into the implemented list, alongside a note that
   this was a refactor guided by documented behavior, not a source
   port — the same honest framing `docs/REGRESSION_WATERFALL_REFACTOR_
   PLAN.md` already established), `docs/site/.../vue/api/plugins.md`
   (a new "Regression" section), `IMPLEMENTATION_PLAN.md` (a new
   numbered item), and the CHANGELOG/README files' own plugin
   lists/counts.
10. **`docs/REGRESSION_WATERFALL_REFACTOR_PLAN.md`**: once this plan's
    own work is complete, that document's "regression" section should be
    trimmed to a short pointer at this file, the same way a completed
    port's own once-open plan document stays as a historical record
    rather than being deleted.

## Real risks/unknowns worth flagging before starting

- **This plan's own real module-structure facts come from the compiled
  bundle's own `require(...)` calls, not a direct read of each file's
  real body** — genuinely more grounded than the original README-only
  scoping this supersedes, but still one level short of the
  line-by-line dissection every completed port in this project actually
  had before writing its own port file. Step 1 above is real,
  required work, not a formality.
- **The `regression` npm package's own real maintenance status is
  unconfirmed** — open decision #1 can't be made responsibly until
  that's checked directly (current version, last release date, open
  issues, real Chart.js-independence confirmed by reading its own
  `package.json`).
- **Given this is a genuine rewrite rather than a port**, the honest
  comparison point isn't any completed port in this project but rather
  `annotation`'s own real scope (a new implementation guided by
  real, dissected structure) — worth treating as a real, standalone
  effort rather than assuming it fits the same shape smaller ports like
  `deferred`/`gradient` did.
