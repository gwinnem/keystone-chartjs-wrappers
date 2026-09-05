# Regression & Waterfall — Chart.js v4 Refactor Plan

Companion to `CHARTJS_AWESOME_PLUGINS.md`'s own "Features" table
(`regression`, `waterfall` — both confirmed v2/v3-only, excluded from the
survey there) and `TRENDLINE_PLUGIN_PLAN.md` (the one v4-ready candidate
from that same table). **Not yet started** — written to capture the real
scope/decisions found while investigating this, so the work can be picked
up later without re-deriving any of it.

**`regression`'s own real plan has moved** to
`docs/REGRESSION_PLUGIN_REFACTOR_PLAN.md`, once its real, confirmed
module structure (`types.ts`/`MetaData.ts`/`MetaSection.ts`/
`regression-plugin.ts`, pulled directly from the published package's own
compiled output) made a dedicated, more detailed plan worthwhile. This
document's own regression-specific sections below are kept as a
historical record of the earlier, README-only scoping pass — read the
dedicated plan for anything current. This document's own `waterfall`
sections remain fully current; that plugin hasn't had its own dedicated
plan written yet.

## Why this is a different kind of task from every prior port

Every plugin this project has ported so far (`zoom`, `gradient`,
`hierarchical`, `image-label`, `autocolors`) started from a **real,
currently-published, Chart.js v4-compatible package** — the port
dissected the real source and carried its logic over largely unchanged,
fixing bugs found along the way. Neither `regression` nor `waterfall` has
a real v4-compatible release to dissect:

- **`chartjs-plugin-regression`** (pomgui) — confirmed, explicitly, in
  the maintainer's own README: **"The plugin does not work with
  &lt;chart.js@3.x&gt;."** Not a compatibility gap that might work by
  accident — a stated, known incompatibility. Latest published version
  `0.2.1`, 5 years old, ISC license, 3 open issues since 2021 with no
  maintainer response (confirmed via the repo's own Issues tab) — no
  evidence of an in-progress v3/v4 update.
- **`chartjs-plugin-waterfall`** (everestate) — npm's latest published
  version is `1.0.3`, **7 years old**; the repo's own description reads
  "Makes waterfall charts easy with chartjs-2." No v3/v4 release exists
  at all, published or unpublished on the default branch.

Given both are abandoned at the v2 API level, this isn't a "dissect and
carry over" port — it's building a **new, v4-native implementation
inspired by each plugin's own documented behavior and config shape**,
the same relationship a from-scratch rewrite has to a spec, not a port
has to source. Treat the two sections below as a design spec extracted
from each original's real, documented public behavior, not as "found in
real source, ready to copy."

## The specific v2→v4 API breaks both plugins would hit

Neither has had its real source line-by-line dissected yet (that's the
real first step for each — see below), but both are old enough, and use
common-enough v2-era plugin patterns, that the following breaks are
near-certain based on Chart.js's own documented v2→v3 migration guide
(v3→v4 introduced comparatively few further breaking changes for a
plugin at this level):

- **Registration**: `Chart.plugins.register(Plugin)` (v2) was removed
  entirely — v3+ uses `Chart.register(Plugin)`. Both plugins' own READMEs
  show the old form.
- **The `chart.chart` double-wrapper**: v2's own `Chart` constructor
  returned a wrapper object whose real chart instance lived at
  `.chart` — removed in v3+, where the constructor's return value *is*
  the real instance directly. Any plugin hook receiving `chart` and then
  accessing `chart.chart.*` internally needs every one of those
  call sites found and fixed.
- **Scale configuration shape**: v2's `options.scales.xAxes`/`yAxes`
  (arrays, addressed by a generated string ID like `'x-axis-0'`) was
  replaced entirely by v3+'s `options.scales: { x: {...}, y: {...} }`
  (a keyed object, addressed by axis ID directly). `chart.scales['x-axis-0']`-
  style lookups don't exist in v4 at all.
- **Element/dataset-meta model**: v2 elements carried a `._model`
  sub-object holding drawable properties (`_model.x`, `_model.y`, ...);
  v3+ elements are real classes (`PointElement`, `BarElement`, ...) with
  those properties directly on the instance (`element.x`, `element.y`).
  `getDatasetMeta(datasetIndex)` itself is stable across both, but what
  it returns internally changed shape.
- **Helpers namespace**: v2's `Chart.helpers.*` was reorganized in v3,
  then further split into ESM named exports under `chart.js/helpers` by
  v4 — any direct `Chart.helpers.each`/`.color`/etc. call needs
  re-pointing.
- **Animation model**: v2's animation system was rewritten completely in
  v3 (per-property `AnimationSpec`s, no single global `Chart.Animation`
  class) — relevant only if either plugin animates its own drawn
  elements (waterfall's step-line drawing plausibly does; regression's
  static line likely doesn't, but not yet confirmed).

None of this is a guess about whether these breaks apply — it's a
description of what changed in Chart.js itself between the versions
these plugins target and v4. Confirming *which* of these each plugin's
own real source actually touches is real work, not assumed done here.

## `regression` — real, documented behavior to preserve

Real config surface, confirmed directly from the maintainer's own README
(not yet from source):

```ts
interface RegressionCommonConfig {
  /** 'copy' | 'linear' | 'exponential' | 'power' | 'polynomial' |
   * 'polynomial3' | 'polynomial4' | 'logarithmic', or an array of these
   * (best-R² of the combination is drawn). */
  type?: string | string[];
  line?: { color?: Color; width?: number; dash?: number[] };
  calculation?: { precision?: number; order?: number };
  extendPredictions?: boolean;
  copy?: {
    overwriteData?: 'none' | 'all' | 'empty' | 'last';
    minValue?: number;
    maxValue?: number;
    fromSectionIndex?: number;
  };
}

interface RegressionSection extends RegressionCommonConfig {
  startIndex?: number; // default 0
  endIndex?: number;   // default data.length - 1
  label?: string;      // default: x-axis' own label
}

interface RegressionDatasetConfig extends RegressionCommonConfig {
  sections?: RegressionSection[]; // default: [{ start: 0, end: data.length - 1 }]
}

// Global (options.plugins.regressions):
interface RegressionGlobalConfig extends RegressionCommonConfig {
  onCompleteCalculation?: (chart: Chart) => void;
}
```

Three-level config precedence (section > dataset > global) — confirmed
directly. Public API surface to preserve: `.getDataset(chart,
datasetIndex)` (returns `{ sections, getXY(x, y), topY, bottomY }`) and
`.getSections(chart, datasetIndex)` (returns the fully-resolved sections
with real calculation results) — both real, documented, callable methods
consumers may already rely on if migrating from the original package.

**Only `bar`, `line`, and `scatter` chart types are supported** — the
original's own documented restriction, not something to relax without
reason.

**Calculation engine**: the original uses the `regression` npm package
(linear/exponential/power/polynomial/logarithmic curve fitting) as a real
runtime dependency — confirm during implementation whether to keep it as
a dependency (small, focused, likely still maintained — check before
assuming) or reimplement the specific curve-fitting formulas locally,
matching the `autocolors`-style "small, standard, reimplement rather than
depend" reasoning if the formulas turn out to be simple, well-known
statistical fits (they generally are — ordinary least-squares for linear,
log-linearization for exponential/power, Vandermonde-matrix solving for
polynomial).

## `waterfall` — real, documented behavior to preserve

Real config surface, confirmed directly from the maintainer's own README:

```ts
interface WaterfallStepLinesConfig {
  enabled?: boolean;
  startColorStop?: number;
  endColorStop?: number;
  startColor?: Color;
  endColor?: Color;
  diagonalStepLines?: boolean;
}

// options.plugins.waterFallPlugin:
interface WaterfallPluginConfig {
  stepLines?: WaterfallStepLinesConfig;
}

// per-dataset:
interface WaterfallDatasetConfig {
  dummyStack?: boolean; // hides label/tooltip/color for this "invisible spacer" dataset
}
```

**The real mechanism, confirmed from the README**: this plugin doesn't
compute waterfall geometry itself at all — it works entirely by
leveraging Chart.js's own native **stacked bar** support
(`dataset.stack`), with an invisible "dummy" dataset per bar (marked
`dummyStack: true`) acting as the floating offset beneath each real
segment. The plugin's own real job is just: (a) hide the dummy datasets'
own label/tooltip/color automatically (rather than requiring the
consumer to do it via their own `legend`/`tooltip` filter callbacks), and
(b) optionally draw connecting "step lines" between adjacent bars.
**Real, documented limitation**: multiple values per data point aren't
supported.

**Worth checking before committing to a full refactor**: a different,
apparently more modern community fork,
**vitalik23/chartjs-waterfall-plugin**, claims to use "the native bar
chart type" with a simpler `dataset.waterfall = true` marker (no
`stack`/`dummyStack` combination needed) — its own real Chart.js version
compatibility, license, and maintenance status haven't been verified yet
(no npm package found for it during this plan's own research; it may be
GitHub/CDN-only). If genuinely v4-compatible and reasonably maintained,
evaluating it as an alternative *starting point* (or even as a dependency
outright, if its own license permits) could be less work than a from-
scratch rewrite guided only by the abandoned `everestate` package's own
documented behavior — a real, undecided fork in this plan worth
resolving before writing any code.

## Recommended approach

**Treat both as new, local implementations from the start** (matching
`autocolorsPlugin.ts`'s file-per-plugin convention), not a `with*`
dynamic-import-based dependency wrapper in `plugins.ts` — there's no real
package to `Chart.register(...)` at all once refactored, the same
end-state every prior *port* reached, just arrived at differently (by
writing new v4-native code guided by a spec, rather than by dissecting
and fixing bugs in already-v4-compatible source).

- `packages/core/src/regressionPlugin.ts` — real regression-line drawing
  plugin, `Chart.register`-based (matching `hierarchical`'s/
  `autocolors`'s registration mechanism, since — like those two — this
  needs to run its own calculation and drawing logic on every real
  chart update, not just supply per-dataset config Chart.js reads
  natively).
- `packages/core/src/waterfallPlugin.ts` — likely a much thinner plugin
  than regression's, if the `stack`/`dummyStack` mechanism is kept:
  most of the actual "waterfall" visual effect comes from Chart.js's own
  native stacked-bar rendering, not from anything this plugin draws
  itself. Confirm this real scope difference during implementation
  rather than assuming symmetric effort with `regression`.

## Step-by-step plan (per plugin, same shape both times)

1. **Real source dissection** — not yet done for either. Read
   `pomgui/chartjs-plugin-regression`'s and `everestate/chartjs-plugin-
   waterfall`'s own real source directly (both are small enough: the
   former ships real TypeScript under `src/`, not just a minified
   bundle) to confirm exactly which v2 APIs above are actually used,
   and to extract the real calculation formulas (regression) or
   filter/step-line-drawing logic (waterfall) to reimplement against.
   This is the step that turns "design spec from README" into "informed
   implementation," the same real-source grounding every prior port had
   from the start.
2. **Resolve the waterfall-fork question** (see above) before writing
   any waterfall code — evaluate `vitalik23/chartjs-waterfall-plugin`'s
   own real license/maintenance/v4-compatibility first.
3. **New file(s)**: `regressionPlugin.ts`/`waterfallPlugin.ts`, each with
   a header comment stating plainly that this is a v4-native
   reimplementation guided by the original's own documented behavior,
   not a source port — matching this plan's own framing, not
   overstating it as a port the way every `CHARTJS_ANALYSIS.md` §4
   section for a real port does.
4. **`types.ts`**: `RegressionPluginOptions`/`RegressionDatasetConfig`,
   `WaterfallPluginOptions`/`WaterfallDatasetConfig`, modeled on the two
   config shapes above (refined once step 1's real source dissection
   confirms or corrects any detail the README alone couldn't).
5. **`plugins.ts`**: `withRegression`/`withWaterfall`, each registering
   once via `Chart.register(...)`, matching `withHierarchical`'s/
   `withAutocolors`'s shape (config merged into `options.plugins.
   regressions`/`options.plugins.waterFallPlugin` respectively, keeping
   the original's own real option-path names for familiarity to anyone
   migrating from the originals, even though the implementation
   underneath is new).
6. **Vue props**: `regression`/`waterfall`, config-object required for
   `regression` (no plain-boolean form — same reasoning as `annotation`/
   `imageLabel`: no sensible empty default, since a dataset needs at
   least a `type` to know what to fit) — `waterfall` may end up
   boolean-only if the `stack`/`dummyStack` mechanism is kept and the
   plugin itself has no real plugin-level config beyond `stepLines`
   (worth confirming once the real scope is known).
7. **Core unit tests**: a dedicated `tests/unit/regressionPlugin.spec.ts`/
   `waterfallPlugin.spec.ts` per plugin, covering the real calculation/
   drawing logic directly (regression: real curve-fit correctness for
   each type, section-splitting, `copy` behavior, the two public API
   methods; waterfall: dummy-dataset hiding, step-line drawing) — plus
   `plugins.spec.ts` coverage for the thin `with*` wrappers, matching
   every prior local port's own test split.
8. **Vue component tests**, **e2e fixture + spec** per plugin, matching
   the established pattern.
9. **`stryker.config.mjs`**: add both new files to `mutate`.
10. **Docs**: new example pages (both likely `line`/`bar`-only, matching
    each plugin's own documented chart-kind restriction), sidebar/gallery
    entries, `api/plugins.md` sections, `CHARTJS_ANALYSIS.md` §4 new
    "Added after v1 kickoff" sections (framed honestly as new
    implementations guided by an abandoned original, not ports),
    `CHARTJS_AWESOME_PLUGINS.md` (both marked implemented, removed from
    the "Features" survey table), `IMPLEMENTATION_PLAN.md` new numbered
    items, `CHANGELOG.md`s, `README.md`s, `features.md`/`roadmap.md`/
    `testing.md`/`props.md` counts.

## Real risks/unknowns worth flagging before starting

- **This is genuinely more work than any prior plugin addition**,
  `zoom`'s own port included — every prior local port started from
  working, dissectable v4-compatible source; here the *integration
  layer* (registration, scale/element access) must be written fresh
  against real, current Chart.js v4 APIs, even though the *domain logic*
  (curve fitting, stacked-bar-based waterfall geometry) can draw
  directly on each original's own real, documented algorithm.
- **Licensing**: `regression` is ISC, `waterfall` (everestate) and the
  possible `vitalik23` fork both need their own real license confirmed
  before reusing any of their documented config shape or approach
  verbatim in this project's own MIT-licensed codebase — config *shapes*
  (interface field names) are generally not copyrightable in a way that
  blocks reimplementation, but confirm rather than assume for any code
  actually read and adapted during step 1's dissection.
- **Naming collision risk**: `options.plugins.regressions` (plural) is
  the original's own real, documented option key — worth double-checking
  this doesn't collide with anything else in this project's own
  `ChartConfiguration['plugins']` shape before committing to it (unlikely,
  but a one-line check).
- **Waterfall's own real scope is still an open question** (see the
  fork-resolution step above) — this plan can't commit to a concrete
  implementation shape for `waterfallPlugin.ts` until that's resolved,
  unlike `regressionPlugin.ts`, whose scope is clear from the README
  alone regardless of which fork's exact drawing code ends up read.
