# Implementation Plan — keystone-chartjs-wrappers

Companion to `CHARTJS_ANALYSIS.md` (the factual Chart.js inventory this plan is
built against). Reflects the three architecture decisions made at kickoff:

1. **Component API**: one generic `<Chart type="...">` component per framework
   (not per-chart-type components).
2. **Scope**: the 8 built-in chart types **and** the 5 ecosystem extensions
   (financial, boxplot/violin, matrix, sankey, treemap) plus 3 official
   plugins (zoom, annotation, datalabels) at kickoff — 3 more
   (`gradient`, `timestack`, `hierarchical`) were added later at your
   explicit request; see `CHARTJS_ANALYSIS.md` §4's own "Added after v1
   kickoff" sections and the "Current status & open issues" / Phase 1 /
   Phase 2 entries below for the full implementation.
3. **Architecture**: a shared `packages/core` framework-agnostic engine
   underneath `packages/vue`, `packages/react`, `packages/angular` — same
   shape as `keystone-grid` and `keystone-dashboard-layout`. `keystone-chartjs-core`
   is never published standalone — it's bundled directly into each
   framework package's own `dist` output at build time (Vue/React:
   removed from `rollupOptions.external`; Angular: still open, see Phase 7).
   `chart.js` itself is the opposite: a real `peerDependency` of each
   framework package (not a regular `dependency`), matching vue-chartjs's
   own established convention — Chart.js keeps global, module-level
   registration state (`Chart.register(...)`), so a consumer ending up
   with two separate installed copies (one pulled in by this project's
   own packages, another from their own direct use or a different
   library) would have registrations on one copy invisible to the other.
   `packages/core` itself still depends on `chart.js` as a regular
   dependency — that's fine, since core is never published and never
   reaches an external consumer's own `node_modules` directly. Each
   framework package re-exports the handful of Chart.js types it needs
   (`ChartConfiguration`, `Chart` as `ChartJs`) through
   `keystone-chartjs-core` rather than importing `'chart.js'` directly in
   three places for the same types.

Monorepo tooling (pnpm + Turborepo + Vitest/Vitest UI + Playwright + Stryker +
ESLint flat config + Prettier) is already scaffolded at the repo root and in
each package's `package.json`, matching `keystone-dashboard-layout`'s current
conventions. This plan covers the remaining implementation work, phase by
phase, each phase gated on the previous one's tests being green.

## Current status & open issues (start here)

A consolidated, scannable entry point — read this first before diving into
any phase's own detailed history below. **Current stated priority: finish
Vue completely before starting React or Angular** — items are ordered to
match that.

### Vue + Core — open items

1. **[Resolved — confirmed clean end-to-end]** A real, multi-step
   change from the `chart.js` peer-dependency + core-bundling refactor,
   sitting on top of already-closed Phase 1/2 code:
   - `chart.js` moved from `dependencies` to `peerDependencies` in
     `packages/vue/package.json` (react/angular's too, lower priority
     right now); `keystone-chartjs-core` removed from
     `packages/vue/vite.config.ts`'s own `rollupOptions.external` (now
     bundled into `dist/` directly — see Phase 7).
   - `packages/core/src/types.ts` re-exports `ChartConfiguration`/
     `Chart as ChartJs` from `chart.js`; `Chart.vue`/
     `useChartController.ts` import them from `keystone-chartjs-core`
     instead of `'chart.js'` directly (a leftover direct import in
     `Chart.vue` itself was missed on the first pass and has since been
     fixed).
   - **A real `typecheck` run for `packages/core` surfaced a genuine,
     unrelated pre-existing bug** (a type mismatch in `plugins.ts`'s own
     `withAnnotation` — see Phase 1's own closing entry), fixed.
   - **A real `typecheck` run for `packages/vue` surfaced a second,
     larger genuine pre-existing gap, in two layers, both now fixed**:
     (a) Chart.js's own `ChartType`/`DefaultDataPoint` only model its 8
     built-in kinds' own *data-array* shapes — none of the 7 extension
     kinds' real shapes were type-compatible with `Chart.vue`'s `data`
     prop at all. A first attempt at widening this got the array
     nesting wrong (defined per-entry shapes like bare `number[]` for
     boxplot, missing the outer array Chart.js's own `TData` generic
     actually expects — confirmed wrong by a real run still failing
     identically); corrected to properly-nested array types (e.g.
     `number[][]` for boxplot/violin). (b) A second, deeper layer past
     that: Chart.js's own per-dataset *options* type is ALSO keyed by
     the same narrow, built-ins-only `ChartType` — e.g. matrix's own
     real, documented scriptable `width`/`height` dataset functions
     weren't part of it either. Both fixed together with a fully
     hand-rolled `ChartConfigData`/`ChartConfigDataset` pair in
     `packages/core/src/types.ts` (not derived from Chart.js's own
     generic `ChartConfiguration<...>['data']` at all — a loose index
     signature on the dataset type instead, matching every other "loose
     on purpose, full per-kind modeling deferred to Phase 5" type in
     that file), both exported from the barrel and used in `Chart.vue`/
     `useChartController.ts`. **Specifically re-verified that this
     hand-rolled, looser type is still structurally compatible with
     `controller.ts`'s own real call into Chart.js's actual `Chart`
     constructor** (a real, reasoned concern, not just a formality —
     confirmed via `packages/core`'s own typecheck staying clean
     alongside `packages/vue`'s).
   - A test file (`tests/component/index.spec.ts`) had an unrelated
     import-path bug (a literal `.ts` extension, which this project's
     TS/ESM convention requires as `.js` instead) — fixed.
   **Confirmed: both `pnpm --filter keystone-chartjs-core typecheck`
   and `pnpm --filter keystone-chartjs-vue typecheck` are clean.**
   **Also confirmed, zero regressions across every tier of both
   packages**: core's `test:unit` (47/47), `test:coverage`
   (100%/100%/100%/100%), `test:mutation` (98.90%, same single accepted
   survivor as Phase 1's original close); Vue's `test:component`
   (31/31), `test:coverage` (100%/100%/100%/100%), `test:mutation`
   (97.14%, same single accepted survivor as Phase 2's original close).
   **This item is now fully, genuinely closed** — the `chart.js`
   peer-dependency + core-bundling refactor, and the two real
   type-safety gaps it surfaced along the way, are done and verified
   end-to-end.
2. **[Resolved]** 6 of Vue's 19 e2e specs (candlestick/ohlc/boxplot/
   violin/matrix/treemap) were marked `test.fixme(...)` rather than
   passing, due to a real, fully diagnosed limitation: `registry.ts`'s
   own `import(/* @vite-ignore */ entry.packageName)` used a *variable*
   specifier, which Vite's static crawler could never discover in a
   real browser context. **Fixed, at your explicit direction**:
   rewrote `ensureChartKindRegistered`'s dynamic import into a new
   `importExtensionModule(kind)` function using static, literal
   `import('chartjs-chart-financial')`-style calls per case (grouped
   where two kinds share a package — candlestick/ohlc;
   boxplot/violin), instead of the old variable specifier. Full
   verification chain, every step confirmed via a real run, not
   assumed:
   - **A real `tsc --noEmit` run surfaced a genuinely unrelated,
     pre-existing issue** while checking this change: `controller.ts`'s
     own `new Chart(canvas, toConfig(initial))` hit "TS2590: Expression
     produces a union type that is too complex to represent" — a known
     TypeScript limitation resolving an overloaded generic constructor
     against a bare, unparameterized `ChartConfiguration`. An explicit
     `: Chart` annotation on the *variable* did NOT fix it (confirmed by
     a real run still failing identically — the complexity explosion
     happens during the constructor call's own overload resolution,
     before assignment is even considered); fixed instead with an
     explicit `<ChartType>` generic argument on the constructor call
     itself, at both call sites in `controller.ts`.
   - **A real `test:coverage` run surfaced 2 newly-uncovered lines**:
     `importExtensionModule`'s own `default:` case (structurally
     required for TypeScript's exhaustiveness checking, genuinely
     unreachable at runtime — every real `ChartKind` extension value is
     handled by one of the cases above it). Fixed with `/* v8 ignore
     next 2 */`. Confirmed back to 100%/100%/100%/100%.
   - **A real `test:mutation` run then failed outright** ("Failed to
     resolve import ''") — the exact same class of issue Phase 1's own
     mutation-testing cycle already hit and fixed once for `plugins.ts`:
     Stryker's mutant-switch instrumentation wraps literal import
     specifiers in a conditional, breaking the bundler's ability to
     treat them as plain literals, even with no mutant active. Fixed
     with `// Stryker disable next-line StringLiteral` above each of the
     5 literal import calls.
   - **A second real `test:mutation` run then showed 2 "NoCoverage"
     mutants**, both inside the same `default:` case (the case label
     itself, and its own throw message) — the `/* v8 ignore */` comment
     only affects the coverage tool, not Stryker's own separate
     exclusion mechanism. Fixed with `// Stryker disable all` /
     `// Stryker restore all` wrapped around the whole `default:` case.
   - **Confirmed: core's `typecheck` clean, `test:unit` 47/47,
     `test:coverage` 100%/100%/100%/100%, `test:mutation` 98.86%
     overall** — effectively identical to the original 98.90% (the tiny
     difference is purely from a smaller total mutant count after the
     new exclusions, not a quality regression); `registry.ts` itself now
     100%/100% with 0 survived/no-coverage; `controller.ts`'s one
     survivor is the same, already-documented, already-accepted one from
     Phase 1's original close, not a new one.
   - **The real test this was all for**: the 6 previously-`test.fixme`'d
     e2e specs were reactivated (back to real `test(...)` calls), and
     **a real `pnpm --filter keystone-chartjs-vue test:e2e` run
     confirmed all 57 tests passing** — up from 51/57. Vue's e2e suite
     is now genuinely, fully green across all 15 chart kinds, all 3
     plugins, and resize behavior, on all 3 browser engines. Full
     details in Phase 1's own entry (the `controller.ts`/`registry.ts`
     changes) and Phase 2's own e2e entry (the reactivated specs and
     final 57/57 confirmation) below.
3. **[Resolved]** Two real, confirmed feature gaps relative
   to `vue-chartjs` (the dominant alternative, per
   `docs/VUE_CHARTJS_FEATURE_INVENTORY.md`): no accessibility props
   (`aria-label`, `aria-describedby`, fallback-content slot) and no
   canvas-attribute pass-through pattern. **Implemented and confirmed**:
   attribute fallthrough (ARIA attributes, `id`, `class`, `style`, and
   any other non-prop attribute forwarded onto the rendered `<canvas>`)
   turned out to already work via Vue's own default single-root-
   component behavior — confirmed via a real component test, not just
   assumed from Vue's documented default. A default slot for real
   fallback content (per Chart.js's own accessibility docs — content
   between a canvas element's own opening/closing tags) was genuinely
   new code, added to `Chart.vue`'s own template and confirmed via a
   second dedicated test. Both tests pass (33/33 total now, up from 31),
   and coverage stays at 100%/100%/100%/100% — `Chart.vue` is excluded
   from Stryker's own mutation scope (only `useChartController.ts` is
   mutated), so no mutation re-run was needed for this change. Docs
   updated across the board — see Phase 2's own entry below and Phase 6's
   own docs-site entry for the full list of pages touched. This item is
   the same underlying gap as item #7 below; both are now closed by this
   same work.
4. **[Known, unrelated to the above]** The docs site's own `sankey`/
   `zoom-plugin` Vue examples are source-only, not live-hydrated — a
   *separate* issue from #2 above (an Astro/Vite `@fs/`-alias resolution
   gap specific to the docs site's own build, confirmed via a live browser
   session; Phase 2's own e2e suite exercises the identical dynamic
   imports successfully, so this isn't the same bug). Left unresolved at
   your prior explicit direction — see Phase 6's own entry below for the
   full diagnosis.
5. **[Resolved]** `packages/vue/debug-bar-chart.png` — a diagnostic
   screenshot from an earlier investigation, no longer needed. Deleted.
6. **[Resolved]** No support for Chart.js's own inline `plugins` array —
   a real, distinct field on Chart.js's own `ChartConfiguration`
   (`{ type, data, options, plugins }`) for consumer-supplied,
   per-chart-instance custom plugin objects, as an alternative to
   registering a plugin globally via `Chart.register(...)`. Different
   from this project's own 3 official-plugin opt-in props
   (`zoom`/`annotation`/`dataLabels`), which register a *known, named*
   package and merge its config into `options.plugins.<id>` — there was
   no mechanism at all for a consumer to pass their own **custom,
   inline** Chart.js plugin. Found via a review of Chart.js's own
   "Configuration" docs page (see `docs/CHARTJS_GENERAL_DOCS_ANALYSIS.md`
   §8 for the full writeup).
   **Fixed, at your explicit direction**: `ChartUpdatePayload` in
   `packages/core/src/types.ts` gained a `plugins?:
   ChartConfiguration['plugins']` field; `controller.ts`'s `toConfig()`
   now threads it through to the real `Chart` constructor untouched,
   the same way `options` already does. A new `currentPlugins` variable
   tracks the chart's current inline plugins alongside `currentType` —
   the in-place update branch (same `type`) now checks `next.plugins
   !== currentPlugins` by reference and forces a destroy-and-recreate if
   it changed, since Chart.js only ever reads `plugins` at construction
   time and there's no supported way to patch it on a live instance.
   `packages/vue/src/useChartController.ts` and `Chart.vue` both gained
   a matching `plugins` prop, threaded into both `mount()` and
   `update()` and added to the reactive `watch()` dependency array.
   **Full verification chain, every step confirmed via a real run**:
   - 3 new core unit tests (mount passes `plugins` through; same-
     reference update stays in place; changed-reference update forces a
     recreate) plus 1 new Vue component test (the prop passes straight
     through to `createChartController`).
   - **A real `test:mutation` run surfaced 8 survivors**, all in the new
     plugins-change recreate branch's own `ResizeObserver` rewiring —
     the existing tests always stubbed a real `ResizeObserver`, so the
     `typeof ResizeObserver !== 'undefined'` check was always true
     within them, leaving several mutants (forcing that check, removing
     the `?.` on `disconnect`, mutating the `'undefined'` string)
     unobservable. Fixed with two new tests mirroring the equivalent
     type-change-recreate tests already in the suite: one confirming
     the observer re-attaches to the new instance after a plugins-change
     recreate, and one confirming no throw when a plugins-change
     recreate happens in an environment with no `ResizeObserver` at all
     (the second one is what actually kills the remaining 3 survivors
     the first test alone didn't reach — forcing the conditional true,
     or breaking the `?.`/string comparison, all now cause a real throw
     against a non-constructor `ResizeObserver`).
   - **Confirmed: core's `test:unit` clean, `test:coverage`
     100%/100%/100%/100% for `controller.ts`** (the whole feature down
     to the last branch), **`test:mutation` down to exactly 1
     survivor** — the same pre-existing, already-documented,
     already-accepted `?? []` fallback-array-contents mutant from
     Phase 1's original close, not a new one. Every mutant this feature
     introduced is killed.
   - Vue's own `test:component`/`test:coverage`/`test:mutation` all
     confirmed unaffected (97.14%, identical to Phase 2's original
     close) — Vue's own changes only thread `plugins` through to core's
     already-tested logic, without duplicating any of it.
   **Vue-only so far** — React/Angular need the identical, mechanical
   `plugins` prop addition once their own real components are built
   (Phases 3/4); the core-level fix already covers them.
7. **[Resolved]** No accessibility support at all. Chart.js's own docs
   are explicit that `<canvas>` accessibility is entirely the
   consumer's responsibility — via ARIA attributes on the canvas
   element, or via fallback content placed between the opening/closing
   canvas tags (for browsers/assistive tech that can't render canvas at
   all); Chart.js itself does nothing automatically. Found via a
   Chart.js-docs review (`docs/CHARTJS_GENERAL_DOCS_ANALYSIS.md` §1) —
   independently confirmed the same gap already flagged relative to
   vue-chartjs in `docs/VUE_CHARTJS_FEATURE_INVENTORY.md` (item #3
   above — both closed together). **Both mechanisms now implemented and
   confirmed**: (a) ARIA attributes (`aria-label`, `role`,
   `aria-describedby`) — confirmed via a real component test that Vue
   3's own single-root-component fallthrough-attribute behavior already
   forwards these onto `Chart.vue`'s own rendered `<canvas>`, with zero
   extra code needed; (b) fallback content — a genuinely new `<slot>`
   added to `Chart.vue`'s own template, confirmed via a dedicated test
   that default-slot content renders inside the canvas tags. **Vue-only
   so far** — React (`children` prop) and Angular (`<ng-content>`) still
   need their own equivalent implementations for parity; not done as
   part of this pass, since both frameworks' own real components haven't
   been built yet (Phases 3/4).
13. **[Resolved]** A 4th official plugin, `chartjs-plugin-gradient`, added
    at your explicit request — not part of the original v1 kickoff scope
    (see the top-level architecture-decisions section's own item #2).
    Verified the same way as the original 3: current version (`^0.6.1`),
    MIT, real Chart.js v4 compatibility confirmed from its own release
    notes, maintained by Jukka Kurkela (Chart.js core's own maintainer).
    **Genuinely different shape from the other 3**: this plugin has no
    plugin-level config to merge into `options.plugins.gradient` —
    confirmed directly from its own README — its real config lives on
    each *dataset* instead, already reaching Chart.js untouched via this
    project's own `data` passthrough. `withGradient` in `plugins.ts`
    therefore only registers the plugin, returning `options` completely
    unchanged; the `gradient` prop on `<Chart>` is **boolean only**,
    unlike `zoom`/`dataLabels` (boolean-or-object) or `annotation`
    (object required). **Full verification chain, every step confirmed
    via a real run**: core gained 3 new unit tests (registers once,
    returns options unchanged, no-default-export fallback) — typecheck
    clean, 55 unit tests, 100% coverage, 99.07% mutation score (0 new
    survivors, `plugins.ts` still 100%). Vue gained a matching `gradient`
    prop threaded through `resolveOptions()` and the reactive `watch()`
    dependency array, plus 2 new component tests — typecheck clean, 36
    component tests, 100% coverage, 97.37% mutation score (same single
    pre-existing accepted survivor, not a new one). **A new e2e fixture +
    spec + helper**: `gradient-plugin.spec.ts` confirms a real, unmocked
    chart with a real per-dataset gradient config renders more than one
    genuinely distinct color, using a new `expectDistinctColorCount`
    helper (counts colors filtered by pixel-count significance, matching
    the same approach already used for the Colors-plugin regression test
    above) — confirmed: 60/60 e2e passing across all 3 browsers.
    **Verified live in a real browser too, at your request**: navigated
    to the new docs-site example and found the chart area genuinely
    blank — confirmed via network-request inspection that
    `chartjs-plugin-gradient` was never even requested, the exact same
    signature as the already-known, already-documented item #4 hydration
    gap (`zoom-plugin`/`sankey`). Not a new bug — the docs page was
    corrected to `live={false}` with an honest explanation rather than
    left claiming it works. Docs updated across the board: `props.md`,
    `api/plugins.md` (new "Gradient" section), `features.md`,
    `roadmap.md`, `architecture.md`, `testing.md`, `components/index.md`,
    `vue/index.md`, `styling.md` (new "Gradients via chartjs-plugin-
    gradient" section, cross-linked from the new example), root +
    package READMEs, all three CHANGELOGs, `CHARTJS_ANALYSIS.md` §4 (new
    "Added after v1 kickoff" section), and `CHARTJS_AWESOME_PLUGINS.md`
    (gradient's own row removed from the unverified-survey table, marked
    implemented). **Vue-only so far** — React/Angular need the identical
    mechanical `gradient` prop addition once their own real components
    are built (Phases 3/4); the core-level `withGradient` helper already
    covers them.
14. **[Resolved]** A 5th official plugin, `chartjs-scale-timestack`, added
    at your explicit request. Confirmed version (`^1.0.1`), MIT, real
    Chart.js v4 compatibility confirmed from its own `package.json`, by
    jkmnt. **A genuinely different registration mechanism**: no exported
    plugin object to pass to `Chart.register(...)` at all — it registers
    its own `timestack` scale as a side effect of being imported. No
    `Chart.register` call, no `mod.default ?? mod` fallback; the
    `timestack` prop is boolean only, same shape as `gradient`. **Real,
    hard runtime dependency**: requires `luxon` (confirmed actively
    maintained: version 3.7.2, 2 maintainers, no open unpatched CVEs).
    3 new core unit tests, 2 new Vue component tests. New e2e fixture +
    spec (`timestack-scale.spec.ts`, real `{x, y}` millisecond data).
    **A real TypeScript gap found and fixed**: Chart.js's own scale-type
    union has no static knowledge of `'timestack'`; a direct
    `as ChartConfiguration['options']` cast wasn't accepted either
    (confirmed via a real error), fixed by routing through `unknown`
    first. **Verified live in a real browser**: the docs-site example
    hits the same known item #4 hydration gap — written with
    `live={false}` from the start, no correction needed this time. Docs
    updated across the board (see item #15's own entry for the combined
    final test-tier numbers, since both were verified together).
    **Vue-only so far** — React/Angular need the identical mechanical
    prop addition once built (Phases 3/4).
15. **[Resolved]** A 6th official plugin, `chartjs-plugin-hierarchical`,
    added at your explicit request. Confirmed version (`^4.4.5`), MIT,
    267 kB, by sgratzl — the same maintainer already behind
    `@sgratzl/chartjs-chart-boxplot` in this project, a known, trusted
    maintainer already. Confirmed a legitimate, actively maintained fork
    of the now-archived `chartjs-scale-hierarchical`. **A third, distinct
    registration shape**: its ESM build is genuinely tree-shakeable with
    no side effects, so it needs a real named export
    (`HierarchicalScale`) plus an explicit `Chart.register(...)` call
    (unlike `gradient`'s default export or `timestack`'s side-effect-only
    import). No `mod.default ?? mod` fallback needed; the `hierarchical`
    prop is boolean only, same shape as `gradient`/`timestack`. **Real,
    distinct tree-node data shape**: `data.labels`/`dataset.data` need
    this scale's own `ILabelNode`/`IValueNode` tree structure (`{ label,
    children }` / `{ value, children }`), confirmed directly from the
    real package's own type declarations.
    **Full verification chain, every step confirmed via a real run**:
    core gained 3 new unit tests (returns options unchanged; registers
    via its own named export, not `mod.default ?? mod`; registers the
    scale exactly once) — confirmed: typecheck clean, 62 unit tests,
    100% coverage on every metric.
    **A real mutation-testing investigation, reading the actual
    `mutation-report.json` directly rather than guessing from the
    summary table**: an initial run showed `plugins.ts` at 86.44% with 8
    survivors (down from 100% before timestack/hierarchical). One
    (`hierarchicalRegistered`'s own initial `= false` value, mutated to
    `= true`) was genuinely fixable — `beforeEach`'s own
    `__resetPluginsForTests()` always resets the flag on the
    *already-imported* module before any test body runs, regardless of
    its initial value, so only a genuinely fresh module instance (via
    `vi.resetModules()`, the same technique the existing "no default
    export" fallback tests already use for the other four plugins) can
    observe it. Added exactly that test; confirmed it kills that one
    mutant.
    **The remaining 7 survivors, confirmed via the same report, all
    trace to one root cause**: `timestackRegistered`'s own guard logic
    (its initial value, its if-check in all four mutated forms, its
    true-assignment inside `withTimestack`, and its reset in
    `__resetPluginsForTests`) has no test that can distinguish "guard
    worked, import ran once" from "guard broken, import ran again" —
    because `withTimestack` has no `Chart.register` call and never reads
    any property off its imported module, there is genuinely nothing
    observable about a second `import()` call beyond the first: ES
    module evaluation is cached regardless of the guard's own
    correctness, so even a completely broken guard produces
    byte-identical, unobservable behavior. Same class of gap as
    `controller.ts`'s own already-accepted `handle?.destroy()` survivor.
    Documented precisely in `withTimestack`'s own doc comment rather than
    left unexplained or brittly worked around.
    **Confirmed final state**: core mutation score 93.55% overall —
    `plugins.ts` 88.14% (7 accepted, fully explained survivors, all one
    root cause), `controller.ts` 98.08% (the same single pre-existing
    accepted survivor, unchanged), `registry.ts` 100%.
    Vue gained a matching `hierarchical` prop, plus 2 new component
    tests — confirmed: typecheck clean, 40 component tests, 100%
    coverage, 97.73% mutation score (same single pre-existing accepted
    survivor, not a new one). **A new e2e fixture + spec**:
    `hierarchical-scale.spec.ts` mounts a real, unmocked bar chart with a
    real 2-level tree and `options.scales.x.type = 'hierarchical'`,
    confirming genuinely non-blank rendering. Confirmed: **69/69 e2e
    passing across all 3 browsers** (23 spec files × 3 — up from 60
    before timestack/hierarchical, correcting an initial miscounted
    prediction of 62). Hit the identical TypeScript scale-type-union gap
    timestack's own entry above describes, for both `options.scales.x.
    type = 'hierarchical'` and the tree-shaped `data` field — fixed
    proactively with the same `as unknown as X` cast pattern from the
    start, avoiding a second fix-and-retry round-trip.
    **Verified live in a real browser too**: the new docs-site example
    was found genuinely blank, confirmed via network-request inspection
    — the exact same signature as the already-known, already-documented
    item #4 hydration gap. The docs page was written with `live={false}`
    from the start, matching the established pattern. Docs updated
    across the board: `props.md`, `api/plugins.md` (new "Timestack" and
    "Hierarchical" sections), `features.md`, `roadmap.md`,
    `architecture.md`, `testing.md`, `components/index.md`, `vue/index.
    md`, root + package READMEs, all three CHANGELOGs,
    `CHARTJS_ANALYSIS.md` §4 (new "Added after v1 kickoff: Timestack" /
    "...Hierarchical" sections), and `CHARTJS_AWESOME_PLUGINS.md` (both
    rows removed from their respective survey tables, marked
    implemented). **Vue-only so far** — React/Angular need the identical
    mechanical `hierarchical` prop addition once their own real
    components are built (Phases 3/4); the core-level `withHierarchical`
    helper already covers them.
16. **[Resolved]** A 7th official plugin, `chartjs-plugin-image-label`,
    added at your explicit request — but not as a dependency. Its real,
    published source (v1.0.10, MIT, by Yunus Emre Kara) was dissected
    directly from the installed package's own dist file
    (`node_modules/chartjs-plugin-image-label/dist/chartjs-plugin-image-
    label.es.js`) and ported into a new, dedicated file
    (`packages/core/src/imageLabelPlugin.ts`), at your explicit request
    that it live separately from `plugins.ts`'s own thin dynamic-import
    wrappers, since this is substantial, genuinely local logic rather
    than a few lines wrapping an `import()`.
    **Two real bugs in the original, fixed during the port rather than
    carried over verbatim**: (1) the original only ever read
    `chart.data.datasets[0].data`, silently drawing nothing for any
    dataset beyond the first — fixed by iterating every dataset via
    `chart.getDatasetMeta(datasetIndex)`. (2) the original recomputed
    each slice's angular span from raw data values (always starting at
    a hardcoded `-π/2`), silently mispositioning images under any
    non-default `rotation`/`circumference` option — fixed by reading
    each arc's own real, already-computed `startAngle`/`endAngle`/
    `innerRadius`/`outerRadius` properties directly (confirmed exact
    property names from `chart.js`'s own installed type declarations,
    `dist/elements/element.arc.d.ts`).
    **A code-quality pass followed, at your explicit request**, fixing
    6 further issues: no error handling for failed image loads (added
    `image.onerror` logging); an unbounded image cache (capped at 200
    entries with FIFO eviction via a `Map`); an unchecked `as ArcElement[]`
    cast (replaced with a real `instanceof ArcElement` type guard —
    confirmed `ArcElement` is a genuine, documented value export from
    `chart.js`, not just a type); the plugin object left untyped against
    Chart.js's own `Plugin` interface (now explicitly typed); one large,
    4-levels-deep `afterDraw` function (split into small, named,
    independently-testable functions — `computeDistanceFromCenter`,
    `computeAngleForImage`, `computeImageLabelPosition`,
    `drawClippedImage`, `drawArcImageLabel`); and a `draw` closure
    recreated on every arc iteration (now a top-level function taking
    explicit parameters). The stricter `instanceof` check required
    updating the test file's own mock arcs (`Object.setPrototypeOf(mock,
    ArcElement.prototype)`) — a deliberate signal the guard was doing its
    job, not a workaround.
    **A fourth, genuinely distinct registration shape**: unlike every
    plugin above, this one is never passed to a global
    `Chart.register(...)` call at all, and (unique among all 7) it's also
    never a dynamic `import()` of an external package — the plugin
    object (`imageLabelPlugin` in `imageLabelPlugin.ts`) is a plain,
    local, statically-defined value, supplied per-chart-instance via
    Chart.js's own real inline `plugins` array. `withImageLabel` in
    `plugins.ts` returns `Promise<{ options, plugin }>` rather than just
    `options` (unlike every helper above), since the caller needs to
    merge `plugin` into whatever `plugins` array is already in effect —
    see `useChartController.ts`'s own `resolveOptionsAndPlugins()`, which
    needed no changes across this whole port, since that return shape was
    already established. `imagesList` is required — no plain-boolean
    opt-in form. Doughnut/pie charts only.
    **Full verification chain, every step confirmed via a real run**:
    core's own unit tests split accordingly — `plugins.spec.ts` covers
    `withImageLabel`'s own thin wrapper (config merge, no
    `Chart.register` call, same object reference returned every call);
    a new, dedicated `tests/unit/imageLabelPlugin.spec.ts` covers
    `afterDraw` itself directly (skips non-doughnut/pie datasets; draws
    labels for every dataset, confirming fix #1; positions using the
    arc's own real geometry, confirming fix #2; skips a missing
    `imageUrl`; caches a loaded image by URL) — confirmed: typecheck
    clean, 71 unit tests total, 100% coverage. `stryker.config.mjs`'s
    own `mutate` list extended to include `imageLabelPlugin.ts`.
    **Why this one, uniquely among all 7, never hit the docs-site
    dynamic-import hydration gap** (item #4 above): that gap is
    specifically about a dynamic `import()` of an external package
    failing to resolve when served from outside the docs site's own
    project root. Local, static code with no `import()` at all has
    nothing for that gap to apply to — confirmed live in a real browser,
    not assumed. **Getting the docs-site example genuinely live surfaced
    three further real, separate bugs, all now fixed**: (a) a broader
    regression, unrelated to this plugin specifically — Vite's own
    `server.fs.allow` was never explicitly configured in
    `docs/site/astro.config.mjs`, and a dev-server restart from a
    different invocation/cwd suddenly 403'd on every file under
    `packages/core/src/*` served via the `@fs/` alias (confirmed by
    testing `registry.ts`, untouched that session, hitting the identical
    403); fixed by explicitly listing the monorepo root in `server.fs.
    allow` rather than relying on Vite's own auto-detection. (b) the
    docs page itself (`image-label-plugin.mdx`) never actually passed the
    Vue component into `<ExampleTryIt>`'s own slot — only the `?raw`
    source for the Source tab — so the Preview panel had nothing to
    render; fixed by importing the real component and passing
    `<ImageLabelPlugin client:visible />`. (c) the example component
    itself never set `maintainAspectRatio: false`, so Chart.js defaulted
    to a square aspect ratio, growing the canvas to the container's own
    width regardless of its 320px height constraint — fixed by adding
    that option, matching `doughnut-chart.vue`'s own established
    pattern. **Confirmed live in a real browser after all three fixes**:
    a correctly-sized doughnut chart with all three image labels visible
    and correctly positioned on their own arcs — the only one of this
    project's 7 official plugins/scales that renders live on the docs
    site rather than source-only. Docs updated across the board:
    `image-label-plugin.mdx` rewritten (dropped the now-inaccurate "not
    yet live" callout, `live={true}`), `docs/core/api.md` (full rewrite
    covering all 7 plugin helpers and every type export, not just the
    original 3), `docs/core/guide/introduction.md` (plugin list plus the
    DOM-touching nuance for this one helper), `CHARTJS_ANALYSIS.md` §4
    (new "Added after v1 kickoff: Image label" section), and
    `CHARTJS_AWESOME_PLUGINS.md` (row removed from its survey table,
    marked implemented). **Vue-only so far** — React/Angular need the
    identical mechanical `imageLabel` prop addition once their own real
    components are built (Phases 3/4); the core-level `withImageLabel`
    helper already covers them.
17. **[Resolved]** Ported `chartjs-plugin-zoom` locally into
    `packages/core/src/zoomPlugin.ts` — at your explicit request, the
    same way `chartjs-plugin-image-label` was (item #16). It is no
    longer a real npm dependency of this project; neither is
    `hammerjs`/`@types/hammerjs`, as a direct consequence. Real scope
    analysis, the Hammer.js/touch-support decision, and a full
    step-by-step plan were written up in `docs/ZOOM_PLUGIN_PORT_PLAN.md`
    before implementation started.
    **A real, deliberate scope decision, made explicitly rather than
    silently, later revisited**: this port originally dropped every
    Hammer.js-dependent code path — pinch-zoom, and the gesture-driven
    pan interaction — since Hammer.js itself is confirmed unmaintained
    (a real, open upstream issue, already flagged in
    `CHARTJS_ANALYSIS.md` §6). Mouse-wheel zoom, mouse-drag-to-zoom-
    rectangle (with Escape-to-cancel), and the full programmatic API
    (`chart.zoom()`, `chart.zoomRect()`, `chart.zoomScale()`,
    `chart.resetZoom()`, `chart.pan()`, `chart.getZoomLevel()`,
    `chart.getInitialScaleBounds()`, `chart.getZoomedScaleBounds()`,
    `chart.isZoomedOrPanned()`, `chart.isZoomingOrPanning()`) were all
    kept from the start. **Pinch-zoom and interactive pan were later
    added back in, at your explicit request** (see the dedicated
    paragraph near the end of this item) — reimplemented directly on
    the standards-based Pointer Events API rather than left as a
    permanent feature cut.
    **A real, honest finding from dissecting the original source, not
    assumed from the port plan's own earlier (slightly imprecise)
    summary**: the original plugin has no mouse-only drag-to-pan
    mechanism at all — `pan()` is only ever invoked from Hammer's own
    `handlePan()` (driven by `Hammer.Pan()`, which recognizes both touch
    *and* mouse-pointer drags identically). This is why the later
    Pointer-Events-based pan (below) is touch/pen-only, not an arbitrary
    new limitation — there was no separate "mouse-drag-to-pan" code path
    in the original to reproduce for mouse users in the first place.
    **Two real bugs found and fixed in the port itself, not the
    original package** — confirmed via failing tests during the port,
    not assumed: (1) an earlier draft used
    `enabledScales.length ? enabledScales : liveScales(chart)` to mirror
    the original's own `enabledScales || chart.scales`, but an empty
    array is truthy in JavaScript, so the original never actually falls
    back at all — the `.length`-based version zoomed every scale
    whenever none matched the enabled directions, instead of zooming
    none. (2) an earlier draft coerced a genuinely-possibly-`undefined`
    pixel-to-value result to `NaN` for type-safety reasons, which
    silently made the original's own real `logarithmicZoomRange`
    early-return branch (for an out-of-range pixel) permanently
    unreachable.
    **Fully typed against real Chart.js types throughout, no `any`**,
    matching the identical quality bar already applied to `imageLabel`/
    `gradient` (item #16/#18): a `LiveScale` type for the runtime-only
    properties Chart.js's own public `Scale` type omits (`chart`,
    current `min`/`max`, `getLabels()`); a local `ScreenPoint` type
    instead of Chart.js's own public `Point` (which allows nullable
    `x`/`y`, meant for missing data points, not screen coordinates); a
    local `invoke()` helper replacing `chart.js/helpers`' own
    `callback()`, and plain `Object.values()`/`for...of` replacing its
    own `each()`, both to avoid genuine TypeScript generic-inference
    failures those two helpers hit at several real call sites here
    (confirmed via a real `tsc --noEmit` run, not assumed).
    **A genuinely different registration shape from `gradient`/
    `imageLabel`**: unlike those two, `zoom` still has real plugin-level
    config of its own (`pan`/`zoom` sub-objects) to merge into
    `options.plugins.zoom` — so `withZoom`'s own boolean-or-config-
    object opt-in shape is unchanged from before the port. What changed
    is only where the plugin object comes from: no longer
    `Chart.register(...)`, now supplied per-chart-instance via Chart.js's
    own inline `plugins` array, joining the same reference-stability
    caching in `useChartController.ts`'s own `resolveOptionsAndPlugins()`
    already built for `gradient`/`imageLabel` (extended from two inline
    plugins to three).
    **Full verification chain, every step confirmed via a real run**:
    core's own unit tests split accordingly — `plugins.spec.ts` covers
    `withZoom`'s own thin wrapper (no `Chart.register` call, same plugin
    object reference returned every call, config still merged into
    `options.plugins.zoom` correctly); a new, dedicated
    `tests/unit/zoomPlugin.spec.ts` covers the real logic directly (185
    tests total across the file, exercising real DOM event dispatch —
    `mousedown`/`mousemove`/`mouseup`/`wheel`/`keydown` — against a real
    jsdom `<canvas>` element, plus every real zoom/pan math path per
    scale type — linear, category, logarithmic, timeseries — and every
    limits/minRange/aspect-ratio/legend-area/modifier-key edge case
    found while iterating on coverage) — confirmed: typecheck clean,
    100% statement/line/function coverage and 97%+ branch coverage on
    the ported file specifically (up from 69.9% at the very first pass),
    100% overall. Two branches left deliberately uncovered and
    documented in code rather than forced with contrived tests
    (`resetZoom`'s and `panScale`'s own `else` branches, both
    structurally very hard to reach given their own real callers'
    guarantees). `stryker.config.mjs`'s own `mutate` list extended to
    include `zoomPlugin.ts`.
    **Verified live in a real browser after the port**: joins `gradient`
    and `imageLabel` as one of three of this project's 7 official
    plugins/scales that render live on the docs site rather than
    source-only. Docs updated across the board: `CHARTJS_ANALYSIS.md`
    §4 (a new "Zoom/pan" subsection describing the port) and §6 (the
    Hammer.js open question marked resolved), `CHARTJS_AWESOME_PLUGINS.md`
    (the `zoom` note under Interactions updated), `docs/core/api/
    plugins.md` and `vue/api/plugins.md` (both rewritten — `withZoom`
    moved into the local-port section alongside `withGradient`/
    `withImageLabel`), `docs/core/guide/introduction.md` (the
    DOM-touching-helpers list corrected: `zoom` moved alongside
    `gradient`/`imageLabel` as a partial exception, not grouped with the
    fully DOM-free helpers).
    **Vue-only so far** — React/Angular need the identical mechanical
    prop-shape update (the `zoom` prop's own registration-shape change)
    once their own real components are built (Phases 3/4); the
    core-level `withZoom`/`zoomPlugin.ts` already cover them.
    **A stale test suite gap found and fixed after the port**: Vue's own
    `Chart.spec.ts` still mocked `withZoom` with its pre-port return
    shape (plain `options`, no `plugin`) — caught by 6 real test
    failures on a full `packages/vue` test run, not assumed. Fixed the
    mock and every affected assertion (the plugin-threading tests that
    combine `zoom` with `gradient`/`imageLabel`) to expect `zoom`'s own
    plugin object in the effective `plugins` array alongside the
    others. Also updated the e2e fixture/spec
    (`tests/e2e/fixtures/zoom-fixture.ts`, `tests/e2e/zoom-plugin.spec.ts`)
    to reflect the local port and added a real wheel-zoom interaction
    check (dispatching a real mouse-wheel event and confirming
    `chart.getZoomLevel()` actually changed, not just that the chart
    rendered) — confirmed passing against the real build pipeline in a
    real browser (72/72 e2e tests green).
    **Pinch-zoom and interactive touch/pen pan added back in, at your
    explicit request, resolving the two features dropped at the start
    of this item**: both reimplemented directly on the standards-based
    **Pointer Events API** (`pointerdown`/`pointermove`/`pointerup`/
    `pointercancel`), which unifies mouse/touch/pen input with no
    external dependency at all — rather than reintroducing Hammer.js or
    any other gesture library. New config: `zoom.pinch.enabled` (two-
    finger pinch-zoom, computing an *incremental* zoom ratio per move
    event, matching the wheel handler's own per-tick relative-zoom
    model rather than a ratio against the gesture's starting distance).
    `pan.enabled` now drives a genuine single-finger/pen drag-to-pan
    gesture — which, as a direct consequence, finally makes
    `pan.threshold`/`onPanStart`/`onPanRejected`/`onPanComplete` do
    something real: all three had been dead configuration since the
    original port (kept only for shape compatibility, with no gesture
    in the code to ever apply them to). Mouse input is deliberately
    excluded from this whole pointer-event path (confirmed via a real
    `pointerType === 'mouse'` check in each of the three new handlers,
    tested directly) — mouse users keep wheel-zoom/drag-to-zoom-
    rectangle only, matching the real, honest finding above about the
    original never having a mouse-only pan gesture either. Smooth
    hand-off between gestures: a second finger landing mid-pan takes
    over as a pinch (matching the original's own real Hammer-based
    behavior); lifting back to one finger re-baselines as a fresh pan
    candidate rather than computing a delta against a stale pre-pinch
    position. `touch-action: none` is applied to the canvas while either
    is active, and cleared on `stop()`, so the browser's own native
    touch handling doesn't fight this plugin's own.
    **Verification**: 15 new dedicated tests (93 across the file's own
    describe block total, up from 78), achieving 100%
    statement/line/function coverage and 97.52% branch coverage on the
    ported file specifically — confirmed via a real `test:coverage` run.
    One genuinely untestable gap, documented in code rather than forced:
    jsdom (this project's own test environment) has no `PointerEvent`
    constructor at all (worked around with a plain `MouseEvent` plus
    `pointerId`/`pointerType` attached via `Object.defineProperty`, the
    same pattern already used elsewhere in this file for overriding
    `target` on a `WheelEvent`) and no `setPointerCapture` on
    `Element.prototype` either — the latter's "real capture happens"
    branch can only ever be exercised in a real browser.
    Docs updated to match: `CHARTJS_ANALYSIS.md` §4's own "Zoom/pan"
    subsection and §6's own resolved-question entry (both no longer
    describe pinch/pan as a permanent cut), `vue/api/plugins.md`
    (rewritten with the new config and the real mouse-exclusion
    limitation spelled out precisely), and the `zoom` prop's own doc
    comments in `Chart.vue`/`useChartController.ts`.
18. **[Resolved]** Ported the 4th official plugin, `chartjs-plugin-
    gradient` (originally added at item #13), locally into
    `packages/core/src/gradientPlugin.ts` — at your explicit request,
    the same way `chartjs-plugin-image-label` was (item #16). It is no
    longer a real npm dependency of this project.
    **A faithful port, not a reimplementation**: the original's own real
    logic (per-dataset gradient computation, legend-swatch color
    application, sRGB-aware color interpolation for radar/polar-style
    charts) was dissected directly from the installed package's own
    dist file and carried over largely unchanged.
    **One real bug found and fixed during the port**: the original
    names its teardown hook `destroy`, but Chart.js's real `Plugin`
    interface has no such hook at all — confirmed directly against
    `chart.js`'s own installed type declarations. The real hooks for
    chart teardown are `beforeDestroy`/`afterDestroy`; a hook name
    Chart.js's own plugin system doesn't recognize is never invoked, so
    the original's own `destroy` handler — whose only job is deleting
    this plugin's own per-chart state entry — likely never actually ran
    in real Chart.js, silently leaking one entry per destroyed chart.
    Renamed to `afterDestroy` here, the correct real hook name.
    **A full code-quality pass followed this same port, at your explicit
    request**, matching the identical pass already done for `imageLabel`
    (item #16): eliminated every `any` type in favor of real Chart.js
    types (`Scale`, `RadialLinearScale`, `ChartMeta`, `LegendItem`)
    throughout. Two genuine runtime-vs-public-type gaps handled with
    targeted, commented casts instead of a blanket `any`:
    `ChartMeta.xScale`/`yScale`/`rScale`, and the live Legend plugin's
    own `legendItems`/`legendHitBoxes` (neither is part of Chart.js's
    own public types, though both are real, confirmed runtime
    properties). A new `scaleToGradientArea()` helper replaced the
    original port's own blind cast entirely — `left`/`top`/`right`/
    `bottom` are genuinely public via Chart.js's own `LayoutItem`
    interface every `Scale` implements, and `xCenter`/`yCenter`/
    `drawingArea` are genuinely public on `RadialLinearScale` — so no
    cast was needed there at all once properly typed.
    **A genuinely different registration shape from `withZoom`/
    `withAnnotation`/`withDataLabels`**: no plugin-level config to merge
    into `options.plugins.gradient` at all (confirmed from the original
    package's own README — its real config lives on each dataset
    instead), so `gradient` stays boolean-only, same as before the port.
    As of the port, it's also never passed to `Chart.register(...)` at
    all — supplied per-chart-instance via Chart.js's own inline
    `plugins` array instead, the same mechanism `imageLabel` uses.
    `withGradient`'s own return type changed accordingly (from
    `Promise<Options>` to `Promise<{ options, plugin }>`, matching
    `withImageLabel`'s own shape) — `useChartController.ts`'s own
    `resolveOptionsAndPlugins()` was generalized to merge *multiple*
    inline plugins (`gradient` and `imageLabel` can now both be active
    at once) into the same effective `plugins` array, with the
    identical reference-stability caching already built for `imageLabel`
    extended to cover both.
    **Full verification chain, every step confirmed via a real run**:
    core's own unit tests split accordingly — `plugins.spec.ts` covers
    `withGradient`'s own thin wrapper (no `Chart.register` call, same
    object reference returned every call); a new, dedicated
    `tests/unit/gradientPlugin.spec.ts` covers the real logic directly
    (13 tests: skips an invalid chart area, a gradient-less dataset, a
    hidden dataset; warns and skips a missing scale; creates linear vs.
    radial gradients correctly; sorts/clamps stop colors; reverses stops
    for a reversed scale; applies gradients to both per-dataset and
    per-data-point legend swatches; clears state on `afterDestroy`
    without throwing) — confirmed: typecheck clean, 84 unit tests total,
    100% coverage. `stryker.config.mjs`'s own `mutate` list extended to
    include `gradientPlugin.ts`. Vue's own `Chart.spec.ts` updated for
    the new return shape and the multi-inline-plugin merging (43 tests) —
    confirmed: typecheck clean, all passing.
    **Verified live in a real browser after the port**: the existing
    docs-site example (previously `live={false}`, hitting the known
    item #4 hydration gap) now renders a real bar chart with a genuine
    red→yellow→green vertical gradient per bar, correctly varying by
    each bar's own height — flipped to `live={true}`, joining `imageLabel`
    as the only two of this project's 7 official plugins/scales that
    render live on the docs site rather than source-only. The same class
    of docs-site bug proactively checked for this time (having already
    found all three getting `imageLabel` live): the `.mdx` page was
    indeed missing its own component import/slot content (the same gap
    `image-label-plugin.mdx` had) — fixed the same way. `maintainAspectRatio:
    false` was already set on this example's own component, so that
    specific gap didn't recur here. Docs updated across the board:
    `gradient-plugin.mdx` (dropped the "not yet live" callout,
    `live={true}`, fixed the missing slot content), `docs/core/api/
    plugins.md` (gradient's own entry rewritten to match `imageLabel`'s
    own local-port framing), `vue/api/plugins.md` (same rewrite, plus
    fixing a separate, pre-existing gap: `imageLabel` had never been
    added to this page at all since it was implemented), `docs/core/
    guide/introduction.md` (the DOM-touching-helpers list corrected:
    `gradient` moved alongside `imageLabel` as a partial exception, not
    grouped with the fully DOM-free helpers), and `CHARTJS_ANALYSIS.md`
    §4 (the existing "Added after v1 kickoff: Gradient" section rewritten
    to describe the port, plus a cross-reference fix in the `imageLabel`
    section's own "only one of seven" claim, now "only two of seven").
    **Vue-only so far** — React/Angular need the identical mechanical
    prop-shape update (the `gradient` prop's own return-shape change)
    once their own real components are built (Phases 3/4); the
    core-level `withGradient`/`gradientPlugin.ts` already cover them.
19. **[Resolved]** Ported the 6th official plugin, `chartjs-plugin-
    hierarchical` (originally added at item #15), locally into
    `packages/core/src/hierarchicalScale.ts` — at your explicit request,
    the same way `chartjs-plugin-zoom`/`gradient`/`imageLabel` were. It
    is no longer a real npm dependency of this project. **A real,
    confirmed finding that made this port simpler than `timestack`'s
    own**: unlike `chartjs-scale-timestack` (a hard, real `luxon`
    dependency), this package has zero runtime dependencies of its own,
    confirmed directly from its own `package.json` (only a `chart.js`
    peer dependency) — fully self-contained.
    **Two things bundled into one package, ported as one cohesive
    file**: a real `CategoryScale` subclass (`HierarchicalScale`) plus a
    companion drawing/interaction plugin, dissected directly from the
    installed package's own real TypeScript source (not the minified
    bundle — the package ships its own real `.ts` sources). A single
    `Chart.register(HierarchicalScale)` registers both: the scale's own
    real, static `afterRegister()` hook calls
    `registry.addPlugins(hierarchicalPlugin)` itself.
    **A real, discovered gap in the original package's own design, not
    introduced by this port**: the companion plugin draws its own
    expand/collapse/focus indicator boxes past this scale's own real
    edge, but never participates in Chart.js's own layout/padding
    calculation to reserve space for them — confirmed via a live,
    reproduced issue (indicator boxes drawn past the canvas's own
    visible edge, invisible/unclickable, without a consumer manually
    adding `layout.padding`). An attempt at fixing this scale-side (a
    `fit()` override reserving the space automatically) was tried and
    reverted: a live, reproduced regression showed Chart.js's own real,
    iterative layout pass calling `fit()` more than once per render,
    each call adding the same extra amount again and collapsing the
    real plot area to near-zero height. Documented as a known,
    necessary consumer-side addition instead, matching the original's
    own real, identical behavior.
    **A real, deliberate type-system improvement over the original's
    own consumer experience**: `hierarchicalScale.ts`'s own `declare
    module 'chart.js'` augmentation (`CartesianScaleTypeRegistry`,
    `ControllerDatasetOptions.tree`) is picked up automatically by every
    real consumer (since it's statically imported, unlike the original
    dependency's own identical augmentation, which needed a dynamic
    `import()`) — no `as unknown as X` cast needed in the docs example
    to write `options.scales.x.type = 'hierarchical'` anymore, unlike
    `timestack`'s own still-necessary cast.
    **Full verification chain, every step confirmed via a real run**:
    a new, dedicated `tests/unit/hierarchicalScale.spec.ts` grew to 87
    tests across several rounds (55 from the initial port, then a
    dedicated coverage-hardening pass bringing every individual file in
    core — not just the aggregate — above the project's own 90% floor
    on every metric) covering the tree-flattening/visibility/span-logic
    utilities as pure functions, the scale's own tick/pixel-mapping
    methods, and the companion plugin's own beforeUpdate/
    beforeDatasetsDraw/beforeEvent hooks (collapse/expand/zoom-in/
    zoom-out round trips, vertical-axis rendering, static mode,
    attribute inheritance, common-ancestor tree walks, and several
    genuinely subtle span-logic combinations — focused-parent edges,
    no-visible-children roots) — confirmed: typecheck clean, all 392
    core unit tests passing. `hierarchicalScale.ts` itself: 98.2%
    statements/lines, 90.93% branches, 98% functions — every other core
    file is a clean 100%, `hierarchicalScale.ts`'s own remaining gaps
    are narrow, defensive edge cases (the same class of accepted gap
    `zoomPlugin.ts`/`gradientPlugin.ts` already carry), not left
    unaddressed.
    `plugins.spec.ts`'s own `withHierarchical` tests rewritten for the
    new direct `Chart.register(HierarchicalScale)` call (no more
    `chartjs-plugin-hierarchical` module mock or fresh-module
    registration test, which no longer applies). `stryker.config.mjs`'s
    own `mutate` list extended to include `hierarchicalScale.ts`.
    **Verified live in a real browser after the port**, including the
    real click-to-expand/collapse/zoom-in/zoom-out interaction —
    flipped to `live={true}`, joining `zoom`/`gradient`/`imageLabel` as
    the fourth of this project's plugins/scales that render live on the
    docs site rather than source-only. The e2e suite gained a second,
    interaction-driven test (a real click genuinely expanding a
    collapsed category, confirmed via a real before/after canvas
    screenshot diff) alongside the existing render-only smoke test.
    Docs updated across the board: `hierarchical-scale.mdx` (dropped
    the "not yet live" callout, `live={true}`, added a click-to-explore
    tip), `hierarchical-scale.vue` (added a hint about the click
    interaction and the `layout.padding.bottom` fix), `api/plugins.md`
    (Hierarchical's own section rewritten to match `gradient`/`zoom`'s
    own local-port framing), and `CHARTJS_ANALYSIS.md` §4 (the existing
    "Added after v1 kickoff: Hierarchical" section rewritten to
    describe the port).
    **Vue-only so far** — React/Angular need the identical mechanical
    prop addition once their own real components are built (Phases
    3/4); the core-level `withHierarchical`/`hierarchicalScale.ts`
    already cover them.

20. **[Resolved]** Ported an 8th official plugin, `chartjs-plugin-
    autocolors`, locally into `packages/core/src/autocolorsPlugin.ts` —
    at your explicit request, the same way `chartjs-plugin-zoom`/
    `gradient`/`hierarchical`/`image-label` were. It is not, and has
    never been, a real npm dependency of this project. Confirmed
    version 0.3.1, MIT, by Jukka Kurkela (the same maintainer already
    behind `gradient`/`zoom`) — real Chart.js v4 compatibility
    confirmed directly from the real package's own README ("requires
    Chart.js 3.0.0 or later"). Two other "Styling"-category candidates
    surveyed alongside it (`colorschemes`, `style`) were NOT
    implemented — both confirmed genuinely Chart.js-v2/v3-era, with no
    verified v4-compatible official release (`chartjs-plugin-
    colorschemes`'s own real, installed `package.json` pins
    `peerDependencies: { "chart.js": ">= 2.5.0 < 3" }` directly).
    **A real, genuine dependency the original itself needs, unlike
    every other plugin ported so far**: the original's own real logic
    imports two small color-conversion utility functions (`hsv2rgb`,
    `rgbString`) from a separate package, `@kurkle/color` — a real,
    declared peer dependency of the original, not bundled into its own
    dist output. Chart.js itself already depends on this exact package
    for its own internal color handling, so it's already present in
    `node_modules` for any real consumer of this project regardless —
    but deliberately NOT imported directly here anyway, since doing so
    would mean importing an undeclared transitive dependency, a real,
    confirmed fragile pattern under pnpm's own strict, non-flat
    `node_modules` layout this monorepo already uses. Instead, both
    small functions are reimplemented locally: both are textbook,
    standard color-space-conversion algorithms with one universally
    agreed-upon definition, not any bespoke logic of the plugin's own —
    confirmed by directly comparing this port's own output against the
    real `@kurkle/color` package's own installed source for the same
    inputs before removing that package as a dependency again. Every
    real piece of the plugin's own actual color-*selection* logic (the
    golden-ratio-style hue-stepping generator, `dataset`/`data`/`label`
    mode branching, the "don't overwrite an already-set color" merge
    behavior, `customize`/`offset`/`repeat` config handling) is carried
    over unchanged, dissected directly from the real, installed dist
    output (the package ships no real `src/` in its published files).
    **Genuinely distinct registration shape from every other local port
    so far**: the only one that both (a) registers directly via a
    real, synchronous `Chart.register(...)` call (matching
    `withHierarchical`'s own mechanism) AND (b) has real plugin-level
    config of its own to merge into `options.plugins.autocolors`
    (matching `withAnnotation`/`withDataLabels`'s own config-merging
    shape).
    **Full verification chain, every step confirmed via a real run**: a
    new, dedicated `tests/unit/autocolorsPlugin.spec.ts` (13 tests)
    covers `'dataset'`/`'data'`/`'label'` mode, the "don't overwrite an
    already-set color" merge behavior, `offset`/`repeat`/`customize`
    config handling, and the real, distinct rgba color format each
    generated color produces — confirmed: typecheck clean, all 409 core
    unit tests passing. `stryker.config.mjs`'s own `mutate` list
    extended to include `autocolorsPlugin.ts`.
    **A real, pre-existing, unrelated type-level bug found and fixed
    along the way**: a routine `pnpm typecheck` run (triggered by this
    port's own temporary dependency add/remove cycle) surfaced 7
    pre-existing errors in `hierarchicalScale.ts`, confirmed via `git
    diff pnpm-lock.yaml` to be unrelated to autocolors itself (no
    `chart.js`/`chartjs-chart-financial` version changed) —
    `HierarchicalEnhancedChart`/`HierarchicalEnhancedDataset`/
    `HierarchicalEnhancedChartData` each extended a concrete-`'bar'`-
    typed Chart.js generic, structurally incompatible with the plain,
    default (broader `keyof ChartTypeRegistry`) generic every other
    real call site in that file already used. Fixed by widening the
    two data-shape interfaces to a loose, chart-kind-agnostic shape
    (dropping the concrete `'bar'` parameterization entirely, since the
    plugin's own real logic only ever reads/writes `data`/`tree`
    directly) and declaring `HierarchicalEnhancedChart` as `extends
    Omit<Chart, 'data'>` rather than plain `extends Chart`, removing
    the conflicting property from the comparison before re-adding this
    file's own real override — confirmed via a real `tsc --noEmit` run
    clean afterward, not assumed.
    Vue gained a matching `autocolors` prop (`AutocolorsPluginOptions |
    boolean`, same shape as `dataLabels`) — confirmed: typecheck clean,
    46 component tests (up from 40), all passing.
    Docs updated across the board: a new live, interactive
    `autocolors-plugin.mdx` example (one of five plugins/scales that
    render live on the docs site, alongside `zoom`/`gradient`/
    `hierarchical`/`imageLabel`), `api/plugins.md` (new "Autocolors"
    section, table row, and updated live-plugin counts throughout),
    `CHARTJS_ANALYSIS.md` §4 (new "Added after v1 kickoff: Autocolors"
    section, plus corrected live-plugin counts in the Gradient/
    Hierarchical/Image-label sections), and `CHARTJS_AWESOME_PLUGINS.md`
    (autocolors marked implemented and removed from its own "Styling"
    survey table, `colorschemes`/`style` explicitly confirmed excluded
    rather than left ambiguous).
    **Vue-only so far** — React/Angular need the identical mechanical
    prop addition once their own real components are built (Phases
    3/4); the core-level `withAutocolors`/`autocolorsPlugin.ts` already
    cover them.

21. **[Resolved]** Added a 9th official plugin, `chartjs-plugin-
    deferred` — at your explicit request. Confirmed version 2.0.0,
    MIT, by the official Chart.js team (simonbrunel) — the same
    organization behind `annotation`/`dataLabels` in the original v1
    scope. **Initially added as a real npm dependency** (identical
    mechanism to `withDataLabels`), **then later ported directly into
    `packages/core/src/deferredPlugin.ts` in the same work session, at
    your explicit request** — see item #22 below for the full port.
    It is not, and is no longer, a real npm dependency of this project.

22. **[Resolved]** Ported `chartjs-plugin-deferred` directly into
    `packages/core/src/deferredPlugin.ts`, the same way `chartjs-
    plugin-zoom`/`chartjs-plugin-gradient`/`chartjs-plugin-image-
    label`/`chartjs-plugin-hierarchical`/`chartjs-plugin-autocolors`
    were — at your explicit request, immediately after item #21 first
    added it as a real dependency. The package ships real, readable
    source (`node_modules/chartjs-plugin-deferred/src/plugin.js`, not
    just a minified bundle), which was dissected and carried over
    largely unchanged.
    **A real bug found and fixed during the port, the identical class
    already found in `gradientPlugin.ts`'s own port**: the original
    names its teardown hook `destroy`, but Chart.js's own real
    `Plugin` interface has no such hook at all — confirmed directly
    against `chart.js`'s own installed type declarations. Renamed to
    `afterDestroy`, the correct real hook name; the original's own
    `destroy` handler (removing its own `scroll` listener and clearing
    per-chart bookkeeping) likely never actually ran in real Chart.js,
    silently leaking one `scroll` listener per destroyed chart that
    hadn't yet appeared in the viewport.
    **A real, confirmed finding about the original's own real
    mechanism, not assumed from its own README/marketing copy**: this
    plugin is scroll-event-based, not `IntersectionObserver`-based — it
    walks up from the canvas's own `parentElement` chain for the
    nearest scrollable ancestor (falling back to the whole `document`
    if none is found) and listens for a real `scroll` event there,
    checking `getBoundingClientRect()` against the viewport on every
    scroll (throttled via `requestAnimationFrame`, or `delay` ms via
    `setTimeout`).
    **Real config defaults, confirmed directly from the installed
    source's own `defaults` object, not the README's own example
    values** (which show `xOffset: 150, yOffset: '50%', delay: 500` as
    illustrative numbers, not the real shipped defaults): `{ xOffset:
    0, yOffset: 0, delay: 0 }`.
    **A real, deliberate design improvement over the original's own
    approach**: the original stores its own bookkeeping as ad-hoc
    properties monkey-patched directly onto the chart instance and DOM
    elements themselves (`chart.$deferred`, `element.$chartjs_deferred`)
    — this port uses two module-level `WeakMap`s instead, keyed by the
    real chart/element object, garbage-collected automatically. Same
    real algorithm and observable behavior, confirmed by directly
    comparing the port's own logic against the real installed source
    line-by-line.
    **Genuinely distinct registration shape, matching `withAutocolors`'s
    own shape exactly**: registers directly via a real, synchronous
    `Chart.register(...)` call (matching `withHierarchical`'s own
    mechanism) AND has real plugin-level config of its own to merge
    into `options.plugins.deferred` (matching `withAnnotation`/
    `withDataLabels`'s own config-merging shape).
    **Comprehensive unit test coverage**: a new, dedicated
    `tests/unit/deferredPlugin.spec.ts` (17 tests) covering in-
    viewport-at-mount, delayed updates (including a destroyed-chart-
    during-delay guard), blocking a second update while one is pending,
    outside-viewport-at-mount with a real scroll event revealing the
    canvas, `xOffset`/`yOffset` (fixed and percentage), an unparseable-
    offset fallback, a `display: none` canvas, scrollable-ancestor
    detection, scroll-event throttling, two charts sharing one
    scrollable ancestor, and `afterDestroy` cleanup — confirmed: 434
    core unit tests passing, 96.1% statements/lines, 91.37% branches,
    100% functions on the new file, with three accepted, individually-
    documented survivors (each a defensive guard confirmed structurally
    unreachable given the file's own real call graph). A real, own-
    mistake bug found while writing these tests, not the plugin's own:
    an early draft of the `xOffset` test had the offset's own real
    semantics backwards (assumed a larger offset was more lenient;
    it's actually stricter, requiring *more* of the canvas to already
    be showing) — caught by the test's own failure, not silently
    shipped.
    The `deferred` prop's own type signature is unchanged
    (`DeferredPluginOptions | boolean`) — no Vue-side changes needed.
    Docs updated across the board: `deferred-plugin.mdx` switched from
    source-only (`live={false}`) to genuinely live (`live={true}`,
    since local code has no dynamic-import hydration gap to hit),
    `api/plugins.md`'s own "Deferred" section rewritten for the port
    (dependency-based-plugin count corrected back down from 3 to 2),
    `CHARTJS_ANALYSIS.md` §4's own "Deferred" section rewritten, every
    "one of five/six live plugins" cross-reference elsewhere in that
    file updated, and the e2e test/fixture's own comments corrected
    (an earlier draft incorrectly described the mechanism as
    `IntersectionObserver`-based before the real source was dissected).
    Confirmed via a real e2e rerun: 81/81 passing, no regression from
    the port.
    **Vue-only so far** — React/Angular need the identical mechanical
    prop addition once their own real components are built (Phases
    3/4); the core-level `deferredPlugin.ts`/`withDeferred` already
    cover them.

23. **Not yet started.** `chartjs-plugin-annotation` — at your explicit
    request, scoped for a local port the same way `zoom`/`gradient`/
    `hierarchical`/`image-label`/`autocolors`/`deferred` were. Real
    scope analysis, the real six-annotation-type architecture (line,
    box, ellipse, point, label, polygon, plus a `doughnutLabel` special
    case), the identical `destroy`-vs-`afterDestroy` hook-name bug
    already found in `gradientPlugin.ts`'s/`deferredPlugin.ts`'s own
    ports (confirmed present here too), and a full step-by-step plan
    were written up in `docs/ANNOTATION_PLUGIN_PORT_PLAN.md` before
    implementation started — confirmed, via the real installed dist
    size (91 KB) and the real, multi-file `src/` structure on GitHub,
    to be a bigger undertaking than any port done so far, `zoom`
    included. Two real open decisions flagged in that plan, not yet
    made: whether to port all six types plus `doughnutLabel` in one
    pass or a smaller first slice (line/box first), and whether to
    model `AnnotationPluginOptions` precisely now or keep it loose.

24. **Not yet started.** `chartjs-plugin-datalabels` — at your explicit
    request, scoped for a local port the same way `annotation` (item
    #23) was. Real scope analysis (at least 4 real files: `plugin.js`,
    `label.js`, `positioners.js`, `utils.js`, plus an unconfirmed
    layout/collision-lookup module), the real `enter`/`leave`/`click`
    interaction system, the real per-element-type positioning math
    (arc/bar/point), and a full step-by-step plan were written up in
    `docs/DATALABELS_PLUGIN_PORT_PLAN.md` before implementation started
    — confirmed, via the real installed dist size (32 KB), to sit
    between `hierarchical`/`gradient`-sized work and `annotation`-sized
    work. Not yet confirmed whether the same `destroy`-vs-`afterDestroy`
    hook-name bug already found twice (`gradient`, `deferred`) is
    present here too — flagged as the first thing to check once the
    real source is read in full.

### Deferred until Vue is genuinely complete (per your stated priority)

8. **Phase 3 (React)** — not started. Placeholder `Chart.tsx` still calls
   the old, nonexistent sync/nested-shape `createChartController` API (a
   known, pre-existing gap, not a new regression).
9. **Phase 4 (Angular)** — not started. Phase 0's own toolchain wiring is
   confirmed passing (Jest, not Vitest — see that phase's own detailed
   history for why), but `test:coverage`/`test:mutation` for the Phase 0
   smoke test itself were never run. Separately, the same
   `keystone-chartjs-core`-bundling question from item #1 above is
   **still fully open for Angular specifically** — `ng-packagr` has no
   direct equivalent to Rollup's `external` list, so bundling core's
   source into Angular's own build output needs a different mechanism
   (a build-time copy step, or restructuring core's source to live
   directly under Angular's own `src/` tree) — deliberately left unsolved
   until Phase 4 actually starts.
10. **Phase 5 (ecosystem extensions & plugins hardening, all 3
    frameworks)** — not started. A 9th official plugin, `trendline`
    (`chartjs-plugin-trendline`), is fully scoped and ready to start —
    see `docs/TRENDLINE_PLUGIN_PLAN.md` for the full plan (package
    verification, real config shape, dependency-vs-port decision,
    step-by-step implementation, and open risks). Two further
    candidates, `regression` and `waterfall`, are confirmed genuinely
    Chart.js-v2-only (not just unverified — `regression`'s own README
    states outright "does not work with <chart.js@3.x>"; `waterfall`'s
    latest npm release is 7 years old) — refactoring either into a real
    v4-native implementation is a materially bigger task than any prior
    plugin addition, since the *integration layer* has to be written
    fresh rather than dissected from working source. `regression` now
    has its own dedicated, more detailed plan —
    `docs/REGRESSION_PLUGIN_REFACTOR_PLAN.md` — written once its real,
    confirmed module structure (`types.ts`/`MetaData.ts`/
    `MetaSection.ts`/`regression-plugin.ts`, pulled directly from the
    published package's own compiled output, not just its README) made
    a more detailed plan worthwhile. `waterfall` still only has the
    original, README-only scoping in
    `docs/REGRESSION_WATERFALL_REFACTOR_PLAN.md`.
11. **Phase 6 (docs site)** — React/Angular sections not started; SEO/meta
    parity (OG/Twitter tags, JSON-LD) not done.
12. **Phase 7 (release)** — semantic-release not set up; the Angular
    core-bundling decision (item #9) blocks finalizing this phase's own
    publish-scope question for that one package specifically.

---

## Phase 0 — Toolchain verification (before writing real logic)

- [x] Confirmed the exact current versions of the 5 extension packages and 3
      plugins listed in `CHARTJS_ANALYSIS.md` §3–4 (was placeholder-level;
      now real, sourced versions — see that doc's §3–4 and its "Open
      questions — resolved" §6). Not yet applied to any package.json,
      because none of the four packages depend on these directly yet — that
      happens when Phase 1/5 actually wires them in.
- [x] Wired up `eslint.config.js` per-package overrides: `vue-eslint-parser` +
      `eslint-plugin-vue` for `packages/vue`, `eslint-plugin-react-hooks` for
      `packages/react`, `angular-eslint` for `packages/angular` (flat-config
      package, not the older `@angular-eslint/*` + tslint setup).
- [x] `stryker.config.mjs` per package — **Vitest runner for all four,
      including Angular** (a deliberate project-wide choice made here,
      diverging from `keystone-dashboard-layout`'s own Angular package,
      which uses Jest — not Karma either, confirmed directly from that
      project's real CI workflow). Copied the shape from
      `keystone-theme-builder`'s real `stryker.config.mjs`.
- [x] Angular unit testing runs on **Vitest**, not Karma+Jasmine — wired via
      `@analogjs/vite-plugin-angular` + `@analogjs/vitest-angular`
      (`packages/angular/vitest.config.ts`, `tests/test-setup.ts`), so all
      four packages share one test runner. A Phase-0 smoke test
      (`tests/unit/keystone-chart.component.spec.ts`) proves the TestBed +
      Vitest wiring itself works (component mounts, renders a `<canvas>`) —
      real component-level Angular tests still land in Phase 4.
      **Confirmed against a real `pnpm test:unit` run and fixed twice now**:
      (1) the original pin (`@analogjs/vite-plugin-angular ^1.10.0`)
      resolved to `1.22.5`, which imports `defaultClientConditions` from
      `'vite'` — an export that only exists in Vite 6+, not the
      `vite ^5.3.0` / `vitest ^2.0.0` this package was originally pinned
      to. Fixed by bumping this package's own `vite`/`vitest`/
      `@vitest/coverage-v8`/`@vitest/ui` to `^6.0.0`/`^3.0.0`/`^3.0.0`/
      `^3.0.0` and `@analogjs/vite-plugin-angular`/`@analogjs/vitest-angular`
      to `^2.7.1`/`^2.7.0` (current versions, confirmed via npm) — isolated
      to `packages/angular` alone; `packages/core|vue|react` stay on
      `vite ^5`/`vitest ^2` since nothing in them needs the newer majors.
      (2) after that fix, a second real run surfaced `Cannot find module
      '@angular/build/private'` — `@analogjs/vite-plugin-angular` needs
      Angular's newer esbuild-based build package at runtime, which had
      never been added as a dependency at all. Added
      `@angular/build ^19.0.0`.
      (3) a third real run got past both of those and surfaced two more
      issues: (a) `@analogjs/vite-plugin-angular` defaults to looking for
      `./tsconfig.spec.json`, which this package never had (only
      `tsconfig.json`) — fixed with a real `tsconfig.spec.json` (extends
      `tsconfig.json`, `rootDir: '.'`, includes both `src` and `tests` —
      not just repointing at the main `tsconfig.json`, whose
      `rootDir: './src'` would've conflicted with test files under
      `tests/`); (b) "No test files found" despite the Phase-0 smoke spec
      existing — caused by combining `--dir tests/unit` on the CLI (in
      this package's own `test:unit`/`test:coverage` scripts) with an
      `include: ['tests/unit/**/*.spec.ts']` pattern that already assumed
      root-relative paths, which together made Vitest look for a
      doubly-nested `tests/unit/tests/unit/**/*.spec.ts`. Fixed by
      dropping `--dir` from the scripts and relying on `include` alone.
      **This same latent bug existed in `packages/vue`, `packages/react`,
      and `packages/core`'s own scripts too** (`--dir tests/component` /
      `--dir tests/unit` alongside an equivalent `include`) — fixed in all
      four, not just Angular, even though it hadn't surfaced there yet (no
      real spec files existed in those packages to trigger it).
      (4) a fourth real run got past compilation entirely and actually
      executed the smoke test, which then failed with "Need to call
      TestBed.initTestEnvironment() first" — the single `setup-zone`
      import that sufficed in the `@analogjs/vitest-angular` 1.x line this
      project originally followed no longer initializes the test
      environment by itself in 2.x; it now requires an explicit
      `setupTestBed({ zoneless: false })` call alongside it (confirmed via
      that package's own current docs). Fixed in `tests/test-setup.ts`.
      Still not confirmed clean end-to-end — next real run may surface
      more; this has now taken four real runs to get this far, which says
      more about how fast the Angular/Vite/Vitest ecosystem is moving than
      about any one fix being wrong.
- [x] Filled real gaps found while wiring the above: `packages/vue` and
      `packages/react` had no `tsconfig.json`, `tsconfig.build.json`, or
      `vite.config.ts` at all despite their own `package.json` scripts
      referencing them — added all three per package (combined
      build+Vitest config, the standard idiom). `packages/core` similarly
      had no `vitest.config.ts`.
- [x] CI skeleton (`.github/workflows/ci.yml`) running install → typecheck →
      lint → test:coverage → build via Turbo, plus a separate docs/site
      install+build step (standalone project, not part of the pnpm
      workspace) — scaled back from `keystone-dashboard-layout`'s own
      workflow to match what actually exists here today (no e2e/bundle-
      size/license-audit steps yet).
- [x] `pnpm install` at the repo root — done (confirmed by you). Peer-
      dependency conflicts between Vue 3.5 / React 19 / Angular 19 /
      TypeScript 6 / chart.js 4.5 not reported as blocking.
      **Vue and React confirmed working end-to-end** — `test:ui` (Vitest UI)
      runs cleanly for both, and both the root `pnpm test:ui` (all packages
      in parallel via Turbo) and per-package `pnpm --filter <pkg> test:ui`
      are confirmed working.
      **Angular paused at your request.** The Angular package's own
      `test:unit` was run for real four times during this install/fix
      cycle and failed each of the first four (see the entry above for the
      full sequence) — all four are fixed, but a fifth, actually-passing
      run was never confirmed before you asked to pause it. Treat
      `packages/angular`'s Vitest wiring as **not yet verified** — pick
      this back up before starting real work on Phase 4, not before.
      **Two more real bugs found by reading the code directly, before
      asking for a fifth run** (not new regressions — these existed
      unnoticed since the placeholder was first scaffolded, same root
      cause as Vue/React's own placeholder-API-mismatch note under Phase
      2): (1) `keystone-chart.component.ts`'s `render()` still called the
      old, now-nonexistent sync/nested-shape `createChartController(canvas,
      { kind, config: {...} })` — the real Phase 1 API is async and takes
      a flat `{ type, data, options }` payload, so this would have passed
      `type: undefined, data: undefined` straight to Chart.js and thrown
      at runtime the moment the Phase 0 smoke test ran. Fixed: flat
      payload, `instance` now holds the returned `Promise<
      ChartControllerHandle>` itself, `destroy()` calls chained via
      `.then()` in `ngOnChanges`/`ngOnDestroy` rather than called directly
      on a Promise. The destroy-and-recreate-on-any-change behavior itself
      is untouched — a known, deliberate Phase 4 TODO, not something this
      fix was meant to solve. (2) the smoke test itself never mocked
      `chart.js` at all, unlike every other package's own test suite —
      jsdom has no real canvas 2D context implementation, so the real
      Chart.js constructor would throw "can't acquire context from the
      given item", and since `createChartController` is async and this
      test's own `ngAfterViewInit` call is never awaited, that throw would
      surface as an unhandled rejection rather than a clean pass. Fixed
      with the same `vi.mock('chart.js', ...)` pattern `controller.spec.ts`
      already uses.
      **Next action for you**: run `pnpm --filter keystone-chartjs-angular
      test:unit` for real (attempt #5) and report back what happens —
      these two are genuine, reasoned-through fixes, not guesses, but
      Angular/Vite/Vitest's own moving-target history in this same cycle
      (four real surprises already) means confirming beats assuming here
      too.
      (5th real run) failed immediately: "Failed to resolve import
      '@angular/compiler' from 'tests/test-setup.ts'". Real, simple gap,
      same class as an earlier one in this same cycle (Stryker's plugin
      auto-detection under pnpm) — `@angular/compiler-cli` was listed as
      a devDependency, but `@angular/compiler` (the actual JIT-compiler
      runtime package `test-setup.ts` imports directly, a *different*
      package from `-cli`) never was. `@angular/compiler-cli` depends on
      `@angular/compiler` internally, but pnpm's strict, non-flat
      `node_modules` doesn't let a package import something that isn't
      its own direct dependency just because a sibling devDependency
      happens to depend on it — needed its own explicit entry. Added
      `@angular/compiler ^19.0.0`, matching every other `@angular/*`
      pin in this package.
      **Next action for you**: run `pnpm install` (for this newly-added
      dependency), then rerun `pnpm --filter keystone-chartjs-angular
      test:unit`.
      (6th real run) failed with `TypeError: (0 , ɵgetCleanupHook) is not
      a function` inside `@analogjs/vitest-angular`'s own
      `setup-testbed.js`. Checked `keystone-dashboard-layout`'s own real
      Angular package directly to compare — and it runs **Jest, not
      Vitest**, with its own `package.json` documenting exactly why:
      "the third-party `@analogjs/vite-plugin-angular` route hit a
      genuinely unresolved upstream ecosystem bug
      (analogjs/analog#1502, angular/angular-cli#31732)" — KDL's own
      team tried Vitest first and abandoned it for this identical
      reason, evidenced by real leftover `vitest.config.mts.unused` /
      `vitest.config.ts.old` files still sitting in that project. This
      project's own goal of sharing one Vitest runner across all four
      packages (stated in this same Phase 0 section above) is blocked
      by something outside this codebase, not a local config bug —
      confirmed, not assumed.
      **Switched `packages/angular` to Jest, at your request, matching
      KDL's own real, working setup as closely as possible** (read
      directly from that project's actual `jest.config.ts`/
      `setup-jest.ts`/`package.json`, not guessed):
      - `jest.config.ts` (`jest-preset-angular` preset, `jsdom`
        environment, `setupFilesAfterEnv`, `coverageThreshold` matching
        the project-wide 90% floor) and `setup-jest.ts`
        (`setupZoneTestEnv()` + a no-op `ResizeObserver` mock, since
        `controller.ts` wires a real one on mount and jsdom has none)
        replace `vitest.config.ts`/`tests/test-setup.ts`.
      - `tsconfig.spec.json` rewritten for Jest (`module: commonjs`,
        `types: [jest, node]`), keeping this project's own
        `tests/unit/` convention rather than KDL's colocated
        `src/**/*.spec.ts` — Jest's default `testMatch` already finds
        `*.spec.ts` anywhere, so no explicit override was needed for
        that one difference.
      - **`package.json`'s own `"type": "module"` removed** — a real,
        deliberate divergence from core/vue/react (which keep it):
        confirmed KDL's own Angular `package.json` has no `"type"`
        field at all (plain CommonJS), and `ts-jest`/`jest-preset-angular`
        are fundamentally CommonJS-oriented; Jest's own ESM support is
        notoriously fragile by comparison to what Vitest offered.
      - Swapped every `@analogjs/*`/`vite`/`vitest`/`@vitest/*`
        devDependency for `jest`/`jest-preset-angular`/
        `jest-environment-jsdom`/`@types/jest`, plus
        `@angular/animations`/`cli`/`forms`/`platform-browser`/
        `@angular-devkit/build-angular`/`rxjs` — all present in KDL's
        own real devDependency list but missing from this package
        entirely, several of which are genuine peer requirements of
        `@angular/core` (`rxjs`) or `jest-preset-angular` itself, not
        yet surfaced only because the Vitest path never got far enough
        to need them.
      - `stryker.config.mjs`: `testRunner: 'jest'`, `plugins:
        ['@stryker-mutator/jest-runner']` (matching this package's own
        `@stryker-mutator/core ^8.7.1` pin, not KDL's newer `^9.6.1`
        line — the other three packages here stay on 8.7.1, so Angular
        does too), and **`coverageAnalysis: 'off'`, not `'perTest'`**
        — confirmed via `@stryker-mutator/jest-runner`'s own docs,
        which explicitly call this out as required, unlike the
        vitest-runner the other three packages use.
      - Smoke test itself: `jest.mock(...)` + Jest's own ambient
        globals (`describe`/`it`/`expect`/`jest`), not `vi.mock(...)`/an
        `import ... from 'vitest'`.
      - `vitest.config.ts` and `tests/test-setup.ts` neutralized to
        inert placeholders (this Filesystem connector has no delete
        capability) rather than left with their original content, since
        the original `vitest.config.ts` imported
        `@analogjs/vite-plugin-angular`, a dependency this package no
        longer has at all — **please delete both files**, along with
        this same neutralization note once you have.
      This makes Angular the one package in this monorepo with its own
      separate test runner and its own separate Stryker
      mutation-testing runner, matching KDL's own real precedent — the
      original "all four share one runner" goal (stated earlier in this
      Phase 0 section) is retired for Angular specifically, for a
      confirmed, not assumed, reason.
      **Next action for you**: run `pnpm install` (for all the
      devDependency changes above), then run `pnpm --filter
      keystone-chartjs-angular test:unit` for real (attempt #7) — six
      real surprises in this cycle so far says confirm, don't assume,
      applies here more than almost anywhere else in this project.
      (7th real run) failed immediately: "'ts-node' is required for the
      TypeScript configuration files" — Jest needs `ts-node` installed
      to parse a `.ts` config file at all, and `ts-node` was missed when
      copying KDL's own devDependency list over in the previous fix,
      despite being right there in that list (`"ts-node": "^10.9.0"`).
      Added.
      **Next action for you**: run `pnpm install`, then rerun `pnpm
      --filter keystone-chartjs-angular test:unit`.
      (8th real run) failed with a TypeScript error, not a runtime one:
      "ECMAScript imports and exports cannot be written in a CommonJS
      file under 'verbatimModuleSyntax'" at `jest.config.ts`'s own
      `export default config;` line. Real, precise root cause: the
      shared root `tsconfig.base.json` sets `verbatimModuleSyntax: true`
      with `module: "ESNext"` (inherited by every package's own
      tsconfig, including this one), but this package's own
      `package.json` now sets `"type": "commonjs"` (the deliberate
      divergence from the Jest switch above) — ts-node, which Jest needs
      to read a `.ts` config file at all, enforces that a file's actual
      export syntax matches its real runtime module system under that
      setting, and `export default` in a CommonJS-typed file fails that
      check outright. Fixed by using plain `module.exports = config;` in
      `jest.config.ts` instead — not TypeScript module syntax at all, so
      the check doesn't apply. `setup-jest.ts` doesn't need the same fix
      (no `export` statements there at all, only imports and a
      side-effect global assignment).
      **Next action for you**: rerun `pnpm --filter
      keystone-chartjs-angular test:unit` — unclear yet whether this
      same conflict also affects ts-jest's own transform of the real
      `.ts` source/spec files (which do use real `export`/`import`
      syntax) the way it affected ts-node's compile of the config file
      itself; if so, that's the next thing to fix, confirmed by the next
      real run rather than guessed now.
      (9th real run) got past the TypeScript/module-syntax issue
      entirely (confirming that concern from the previous entry didn't
      materialize — ts-jest's own per-file transform handles real
      source/spec files differently from ts-node's whole-config compile,
      apparently without hitting the same conflict) and failed instead
      with "Cannot find module './controller.js' from
      '../core/src/index.ts'". Real, common friction point:
      `keystone-chartjs-core`'s own `src/index.ts` (and its sibling
      modules) use the standard TS/ESM-style convention of importing
      from `'./controller.js'` even though the real source file is
      `controller.ts` — the `.js` is the eventual compiled-output
      extension, not a literal file. Vite/Vitest's own resolver (used by
      core/vue/react) understands this convention natively; Jest's
      default resolver does not. Fixed with the standard
      `moduleNameMapper` rule (`'^(\\.{1,2}/.*)\\.js$': '$1'`) stripping
      a trailing `.js` off any relative import specifier before Jest's
      resolver looks for the file.
      **Next action for you**: rerun `pnpm --filter
      keystone-chartjs-angular test:unit` once more.
      **(10th real run) confirmed: PASS.** "mounts inside a host
      component and renders a canvas" — 1/1 tests passing. Angular's
      test wiring is genuinely working now, on Jest rather than Vitest
      (see the course-correction above for why), closing out the very
      last open item from this whole Phase 0 section — ten real fix
      cycles total across both the original Vitest attempt (four) and
      the Jest switch (six), every one against an actual command a real
      person ran. `test:coverage` (the 90% floor) and `test:mutation`
      haven't been run yet for this package specifically — worth
      confirming before treating Angular as fully done to the same
      standard Phase 1's `packages/core` reached, but the fundamental
      wiring question this section exists to answer is now settled.

## Phase 1 — Core engine (`packages/core`)

Replaces the placeholder `types.ts` / `registry.ts` / `controller.ts` with real
logic. No framework dependency in this package, ever.

- [x] **Chart lifecycle controller**: `createChartController(canvas, initial)`
      constructs on mount; `handle.update(next)` diffs strictly on
      **top-level `type` only** (per this same bullet's own acceptance
      criterion) — unchanged type calls `chart.data = ...; chart.update()`
      in place (a changed *mix* of per-dataset type overrides alone does
      NOT force a recreate); a changed type destroys and reconstructs.
      `handle.destroy()` tears down the observer + chart.
- [x] **Lazy type registration**: `ensureChartKindRegistered(kind)` in
      `registry.ts` dynamically imports the backing package from
      `CHART_TYPE_REGISTRY` (now real entries with verified export names
      for all 5 extension packages — confirmed via each package's own
      docs/source, not guessed; `violin`'s export names are the one
      exception, inferred from `boxplot`'s confirmed naming convention
      and flagged as such in `registry.ts`'s own comment) and
      `Chart.register(...)`s them, cached per-kind via a `Set` so a
      second request for the same kind is a no-op.
- [x] **Mixed-chart passthrough**: `collectChartKinds()` in `controller.ts`
      gathers the top-level `type` plus every dataset's own `type`
      override and registers all of them, on both mount and update —
      `data.datasets[].type` itself reaches Chart.js completely untouched
      (see `CHARTJS_ANALYSIS.md` §2).
- [x] **Plugin registration helpers**: `withZoom`/`withAnnotation`/
      `withDataLabels`/`withGradient` in `plugins.ts`, each dynamically
      importing and registering its plugin exactly once (a dedicated
      boolean flag per plugin, not the shared kind-registry Set), the
      first three returning `options` with the plugin's own real config
      path merged in (`plugins.zoom`, `plugins.annotation`,
      `plugins.datalabels` respectively) without touching any other
      existing `plugins.*` entry. `withGradient` (added later, at your
      explicit request — see "Current status & open issues" item #13)
      returns `options` completely unchanged instead — `chartjs-plugin-
      gradient` has no plugin-level config of its own, since its real
      config lives on each dataset, confirmed directly from its own
      README. 3 new unit tests added (registers once; returns options
      unchanged; no-default-export fallback, mirroring the identical
      pattern already established for the other three) — confirmed:
      `typecheck` clean, 55 unit tests, 100% coverage, 99.07% mutation
      score, 0 new survivors (`plugins.ts` still 100%).
- [x] **Resize handling**: a `ResizeObserver` on `canvas.parentElement`
      (falling back to the canvas itself if it has no parent) calls
      `chart.resize()`; guarded by `typeof ResizeObserver !== 'undefined'`
      so environments without it (tested explicitly) don't throw.
- [x] **Theme re-application hook**: `handle.applyTheme(patch)` merges
      `patch` into `chart.options` **one level deep only** (a deliberate,
      documented scope limit — see `controller.ts`'s own comment on why a
      full recursive deep-merge isn't attempted yet) and calls
      `chart.update()`, without touching `data`.
- [x] Unit tests (`tests/unit`, Vitest) — **written and partially confirmed
      against real runs, two real bugs fixed so far**, matching the same
      pattern as Phase 0's Angular cycle above:
      (1) `controller.spec.ts` originally declared its `MockChart` stand-in
      as a plain top-level class, but `vi.mock('chart.js', () => ({ Chart:
      MockChart }))` is hoisted above it — a real run threw "Cannot access
      'MockChart' before initialization". Fixed by moving the class inside
      `vi.hoisted(() => {...})`, which hoists together with `vi.mock` in
      the same relative order.
      (2) `registry.spec.ts`'s "missing export" negative-path test
      originally omitted `CandlestickElement` entirely from the `vi.doMock`
      factory's returned object — a real run showed that Vitest's own mock
      wrapper throws its own "No 'CandlestickElement' export is defined on
      the mock" error the instant that key is accessed at all, before
      `registry.ts`'s own `if (!exported)` check ever runs, masking the
      exact behavior the test was meant to exercise. Fixed by including
      the key explicitly with value `undefined` instead of omitting it —
      satisfies Vitest's own completeness check while still being falsy
      enough to trigger the registry's own guard.
      (3) `plugins.spec.ts` failed with "Failed to resolve import
      'chartjs-plugin-zoom' ... Does the file exist?" — this is **not** a
      code bug. `chartjs-plugin-zoom`/`chartjs-plugin-annotation`/
      `chartjs-plugin-datalabels` were added to `package.json` in the same
      batch as the 5 chart-extension packages, but only the 5 extensions
      evidently made it into `node_modules` (their own registry tests all
      passed) — the 3 plugins need a fresh `pnpm install` to actually
      resolve. Vite needs to resolve the specifier on disk before Vitest's
      own `vi.mock` interception can substitute its contents, regardless
      of the `/* @vite-ignore */` comment on the dynamic import (that
      comment only suppresses Vite's dependency-crawl warning, not
      resolution itself).
      (4) after installing, a real run got to **34/35 passing** on the
      first try — the one failure was `controller.spec.ts`'s own "observes
      the canvas itself when it has no parent element" test, which used
      `test-utils.ts`'s `createTestCanvas()` helper — that helper attaches
      the canvas to `document.body` (by its own design, for other tests'
      benefit), which means the canvas it returns is never actually
      parentless, directly contradicting this specific test's premise.
      Compounded by every test's own canvases piling up under
      `document.body` across the file (nothing cleans them up between
      tests), so the observer was called with the whole accumulated body,
      not a bare canvas. Fixed by using a plain, never-attached
      `document.createElement('canvas')` for this one test instead of the
      shared helper.
      (5) with all 35/35 passing, a real `test:coverage` run surfaced the
      actual coverage percentages (83.4% lines/statements, 83.33%
      branches — below the 90% floor) and three distinct, genuine causes,
      not one: (a) `vitest.config.ts` had no `coverage.include`, so the
      v8 provider's default `all: true` behavior was sweeping in
      `stryker.config.mjs` (a mutation-testing config file at the package
      root, not source) as 0%-covered "application code" — fixed by
      scoping `coverage.include` to `src/**/*.ts`; (b) `types.ts` is pure
      type-only declarations with zero runtime statements for v8 to ever
      instrument, so it could only ever report 0% — a tooling artifact,
      not untested logic — fixed by adding it to `coverage.exclude`
      explicitly, with that reasoning in the config's own comment, rather
      than silently sweeping it in with (a); (c) `index.ts` **is** real,
      executable code (its re-export statements run at module-load time)
      that genuinely had zero coverage, because no spec imported the
      barrel directly — every other spec imports from the concrete module.
      Fixed with a real `index.spec.ts` contract test, not an exclusion.
      (6) that same run's per-file branch numbers showed 3 real untested
      branches in `controller.ts` (the `datasets ?? []` fallback in
      `collectChartKinds`; the in-place update branch's `if (next.options)`
      truthy path specifically, since every existing in-place-update test
      happened to omit `options`; `applyTheme`'s `chart.options ?? {}`
      fallback, since every existing applyTheme test happened to start
      with real initial options) and the identical `mod.default ?? mod`
      pattern untested in all three of `plugins.ts`'s own functions (every
      mocked plugin package in the original tests had a default export).
      Added one targeted test per gap, closing all of them.
      (7) those three new `mod.default ?? mod` tests then hit the *exact
      same* Vitest mock-completeness guard as registry.spec.ts's own
      negative-path test did earlier in this cycle — omitting `default`
      entirely from the `vi.doMock` factory threw Vitest's own "No
      'default' export is defined on the mock" error before
      `plugins.ts`'s own `?? mod` fallback ever ran. Same fix, third time
      this exact pattern has shown up: include the key explicitly as
      `default: undefined` instead of omitting it.
      **Confirmed clean**: 44/44 tests passing, **100%** coverage
      (statements/branches/functions/lines) across every file in
      `src/` — well above the 90% floor. Seven real fix cycles to get
      here, every one against an actual `pnpm` run, not guessed at.
      (8) `pnpm --filter keystone-chartjs-core test:mutation` then failed
      outright with "Cannot find TestRunner plugin 'vitest'. In fact, no
      TestRunner plugins were loaded" — two compounding, real gaps: (a)
      `packages/core/package.json` had no `test:mutation` script and no
      `@stryker-mutator/*` devDependencies at all (Vue/React/Angular had
      both; core was missed when originally scaffolding); (b) even once
      added, Stryker's default plugin auto-detection
      (`plugins: ['@stryker-mutator/*']`) genuinely does not work under
      pnpm's non-flat `node_modules` layout — confirmed both by a real run
      and by Stryker's own troubleshooting docs ("Plugins can't be found
      when using pnpm as package manager"), and independently confirmed
      by a real `stryker.conf.json` from `keystone-dashboard-layout`'s own
      core package, which sets the identical explicit
      `plugins: ['@stryker-mutator/vitest-runner']` for this exact reason.
      Fixed in **all four packages'** `stryker.config.mjs` (not just core
      — the same missing-plugins-array gap existed in Vue/React/Angular's
      configs too, just never triggered since none of them had been run
      yet), plus an explicit `timeoutMS: 15000` in all four, matching
      KDL's own real config.
      **Next action for you**: run `pnpm install` (for core's newly-added
      Stryker devDependencies), then rerun `pnpm --filter
      keystone-chartjs-core test:mutation`.
      (9) that ran and got past plugin loading entirely, but the dry run
      itself then failed: "Failed to resolve import '' from
      'src/plugins.ts'". Real, confirmed root cause — Stryker's own
      mutant-switch instrumentation wraps every mutatable string literal
      in a conditional (so it can toggle mutants on/off per test run
      without re-instrumenting), and `withZoom`/`withAnnotation`/
      `withDataLabels`'s three `import(/* @vite-ignore */ '<package>')`
      calls each have exactly such a literal sitting inside a function
      body. Unlike `registry.ts`'s own `packageName` string literals
      (which sit in a static, module-level object literal already
      excluded by this config's own `ignoreStatic: true`), these three
      are re-evaluated per call and get instrumented for real — wrapping
      the specifier in a conditional breaks Vite's ability to treat the
      dynamic import as a plain, `@vite-ignore`-able one, even in the
      unmutated dry run with no mutant active. Fixed with a targeted
      `// Stryker disable next-line StringLiteral` comment directly above
      each of the three import lines — excluding just that literal from
      mutation, not the surrounding registration logic.
      **Next action for you**: rerun `pnpm --filter keystone-chartjs-core
      test:mutation` again.
      (10) that ran clean and produced a real mutation score: **70.08%**
      overall (89 killed, 38 survived, 0 timeouts/no-coverage/errors) —
      `plugins.ts` **100%** (0 survived), `controller.ts` 85.37% (6
      survived), `registry.ts` 38.46% (32 survived). Read the actual
      `mutation-report.json` directly (not just the summary table) to fix
      each survivor by root cause rather than guessing:
      **`controller.ts`'s 6**: three clustered around the same real gap
      — every existing recreate test checked that a type-change destroys
      the old instance and builds a new one, but never re-verified the
      `ResizeObserver` actually gets re-attached to the *new* instance
      afterward (mutants forcing that re-attach's own `if` condition
      false, emptying its block, and no-opping its callback all
      survived). Fixed with one new test asserting a second `observe()`
      call post-recreate and that triggering the (now-overwritten)
      captured callback resizes the *new* chart. One more (`if
      (dataset.type)` forced always-`true`) survived because every
      existing mixed-dataset test only checked `Chart.register`'s call
      count, which an extra silently-no-op registration attempt for an
      untyped dataset (resolving to kind `undefined`) doesn't change —
      fixed by spying on `ensureChartKindRegistered` itself instead, which
      does distinguish 2 calls from 3. One more (the top-level `type`
      itself never mutation-tested alone, only ever reached via a dataset
      override) — fixed with a dedicated test using an extension kind as
      the top-level `type` with zero dataset overrides. The 6th
      (`datasets ?? []`'s fallback *array's own contents*, e.g. `[]` vs
      `["Stryker was here"]`) is a genuinely equivalent mutant given the
      current code — either way, the loop's `if (dataset.type)` check
      finds nothing truthy to act on, so no test can observe a difference
      without contriving one; left as an accepted survivor rather than
      writing a brittle test against it.
      **`registry.ts`'s 32**: confirmed almost all of them (~30) share one
      root cause, not 30 separate gaps — `CHART_TYPE_REGISTRY`'s own
      string/array literals sit in a big object evaluated once at module
      load (`static: true` in the report), so Stryker's `perTest`
      coverage attributes every mutant inside it to whichever test
      happened to trigger that first import, not to the specific
      `it.each` iteration in `registry.spec.ts` that actually reads each
      entry — meaning the *real* test that would catch e.g. a wrong
      `packageName` string for `sankey` was never even re-run against
      that mutant. This is a known tooling limitation with mutating large
      static object literals under `coverageAnalysis: 'perTest'`, not an
      undertested-logic problem — confirmed by checking: the real
      `ensureChartKindRegistered` branching logic around this table (its
      `if`s, the throw, `Chart.register` itself) all show "Killed" in the
      same report. Fixed by wrapping just the `CHART_TYPE_REGISTRY`
      literal in `// Stryker disable all` / `// Stryker restore all` —
      scoped to the data table alone, not the surrounding function logic.
      The remaining 2 survivors were real: two trailing fragments of the
      thrown error's own message (text describing which chart kind and
      suggesting the export was renamed/removed) that came after whatever
      the existing regex assertion already anchored on — fixed by
      broadening that one regex to require the fuller message.
      **Next action for you**: rerun `pnpm --filter keystone-chartjs-core
      test:mutation` once more and confirm the score — expect something
      close to 100% now that the tooling-artifact survivors are excluded
      and the real gaps have dedicated tests, but confirm rather than
      assume, same as every other step in this cycle.
      (11) **confirmed: 98.90% overall** (90 killed, 1 survived, 0
      timeouts/no-coverage/errors) — `plugins.ts` and `registry.ts` both
      **100%** (registry.ts's own "survived" mutants from (10) now
      correctly show `status: "Ignored"` with reason "this is a static
      lookup table, not branching", confirming the Stryker exclusion
      worked exactly as intended, not just theorized). `controller.ts`
      97.56%, with exactly the one survivor predicted and already
      documented in (10) — the `?? []` fallback array's own contents
      (`id:3`), a genuine equivalent mutant given the current code, not
      an oversight. **Phase 1's full acceptance bar (unit tests →
      mutation testing) is now genuinely closed for `packages/core`** —
      44 unit tests, 100% coverage on every metric, 98.90% mutation
      score with the one remaining survivor explicitly accounted for.
      Eleven real fix cycles total to get here across this whole Phase 1
      effort, every one against an actual command a real person ran, not
      assumed or guessed at.
      **Real gap found later, via a genuine `tsc --noEmit` run for this
      package**: Phase 1's own closing sequence above never actually ran
      a dedicated `typecheck` for `packages/core` — only test:unit/
      test:coverage/test:mutation, which don't catch type errors that
      don't affect runtime behavior. A real run surfaced one:
      `plugins.ts`'s own `withAnnotation` assigned our deliberately loose
      `AnnotationPluginOptions` (`{ annotations: Record<string, unknown>
      }`) directly to `options.plugins.annotation`, which
      `chartjs-plugin-annotation`'s own real type augmentation to
      Chart.js's `ChartConfiguration` expects to be a much more specific
      discriminated-union shape. Not a runtime bug — Chart.js itself does
      no compile-time shape checking — but a real type-safety gap
      nonetheless. Fixed with a targeted, well-commented cast
      (`as NonNullable<Options['plugins']>['annotation']`) rather than
      widening `AnnotationPluginOptions` itself, since that type's own
      looseness is deliberate (full plugin-specific typing is Phase 5
      scope, not Phase 1's).
      **Next action for you**: rerun `pnpm --filter keystone-chartjs-core
      typecheck` to confirm this was the only error — then
      `pnpm --filter keystone-chartjs-vue typecheck` next, since that's
      still separately pending (see "Current status & open issues" at
      the top of this document).
      **The registry.ts static-import fix, at your explicit direction**
      (see "Current status & open issues" item #2 for the summary):
      `ensureChartKindRegistered`'s own dynamic import
      (`import(/* @vite-ignore */ entry.packageName)`, a variable
      specifier no bundler's static crawler could ever discover) was
      rewritten into a new `importExtensionModule(kind)` function using
      static, literal `import('chartjs-chart-financial')`-style calls
      per case — one `case` per distinct package, grouped where two
      kinds share one (candlestick/ohlc; boxplot/violin). Real,
      multi-step verification, each issue found and fixed via an actual
      run, not guessed:
      (1) a real `tsc --noEmit` run surfaced a genuinely unrelated,
      pre-existing issue in `controller.ts`: `new Chart(canvas,
      toConfig(initial))` hit "TS2590: Expression produces a union type
      that is too complex to represent" — a known TypeScript limitation
      resolving an overloaded generic constructor against a bare,
      unparameterized `ChartConfiguration`. An explicit `: Chart`
      annotation on the *variable* did NOT fix it — confirmed by a real
      run still failing identically at the same line, since the
      complexity explosion happens during the constructor call's own
      overload resolution, before assignment is even considered. Fixed
      instead with an explicit `<ChartType>` generic argument on the
      constructor call itself (`new Chart<ChartType>(canvas,
      toConfig(...))`), at both call sites (initial mount and the
      type-change recreate branch).
      (2) a real `test:coverage` run surfaced 2 newly-uncovered lines:
      `importExtensionModule`'s own `default:` case — structurally
      required for TypeScript's own exhaustiveness checking (every
      switch must return on every path), but genuinely unreachable at
      runtime, since every real extension `ChartKind` is already handled
      by one of the cases above it, and `ensureChartKindRegistered`
      never calls this function at all for a built-in kind. Fixed with
      `/* v8 ignore next 2 */` directly above the `default:` case.
      Confirmed back to 100%/100%/100%/100%.
      (3) a real `test:mutation` run then failed outright at the dry-run
      stage: "Failed to resolve import ''" — the exact same class of
      issue this same Phase 1 cycle already hit and fixed once for
      `plugins.ts`'s own dynamic imports (see that fix's own entry
      above): Stryker's mutant-switch instrumentation wraps every
      mutatable string literal in a conditional, which breaks a
      bundler's ability to treat a dynamic import as a plain literal —
      even in the unmutated dry run with no mutant active. Fixed with a
      `// Stryker disable next-line StringLiteral` comment directly
      above each of the 5 literal import calls.
      (4) a second real `test:mutation` run then showed 2 "NoCoverage"
      mutants (confirmed by reading the actual `mutation-report.json`
      directly, not just the summary table) — both inside the same
      `default:` case: a `ConditionalExpression` mutant on the case
      itself, and a `StringLiteral` mutant on its own throw message.
      The `/* v8 ignore */` comment from step (2) only affects the v8
      coverage tool; it has no effect on Stryker's own, separate
      mutation-exclusion mechanism, which needed its own comment. Fixed
      by wrapping the whole `default:` case in `// Stryker disable all`
      / `// Stryker restore all`.
      **Confirmed clean across every tier**: `typecheck` clean;
      `test:unit` 47/47 passing; `test:coverage`
      100%/100%/100%/100%; `test:mutation` **98.86%** overall (87
      killed, 1 survived, 0 timeout/no-coverage/errors) — `registry.ts`
      itself now 100%/100% (13 mutants, all killed); `controller.ts`
      97.56%, with exactly the same single already-documented,
      already-accepted survivor from this phase's original close (the
      `?? []` fallback array's own contents), not a new one. The overall
      98.86% vs. the original 98.90% is purely a smaller total mutant
      count after the new exclusions above — not a quality regression.
      **The real test this whole fix was for**: the 6 previously-
      `test.fixme`'d Vue e2e specs (candlestick/ohlc/boxplot/violin/
      matrix/treemap) were reactivated to real `test(...)` calls, and a
      real `pnpm --filter keystone-chartjs-vue test:e2e` run **confirmed
      all 57 tests passing** — up from 51/57. See Phase 2's own e2e
      entry for the full closing note.

## Phase 2 — Vue package (`packages/vue`)

**Note:** the placeholder `Chart.vue` currently calls
`createChartController(canvas, { kind, config: { type, data, options } })`
synchronously. That API no longer exists — Phase 1's real
`createChartController` is `async` and takes a flat
`{ type, data, options }` payload (see `packages/core/src/types.ts`'s own
`ChartUpdatePayload`, and its comment explaining this exact gap). This
isn't a drop-in wiring job; the placeholder won't compile against real
core as-is.

- [x] Replace the placeholder `Chart.vue` (mount-only, no update/resize/theme
      logic) with one wired to the real Phase 1 controller. Serializes
      every mount/update through a shared promise chain (both
      `createChartController` and `handle.update` are async, so an
      overlapping prop change could otherwise race a still-in-flight
      call) rather than calling core directly from a watcher.
- [x] Props: `type`, `data`, `options`, plus per-plugin opt-in props
      (`zoom`, `annotation`, `dataLabels`) that thread into the core's plugin
      helpers. `zoom`/`dataLabels` accept either `true` (apply with no
      extra config) or a config object; `annotation` has no boolean form,
      since `AnnotationPluginOptions.annotations` is required with no
      sensible empty default — must be given a real object to opt in.
      **A 4th prop, `gradient`, added later** (at your explicit request —
      see "Current status & open issues" item #13): boolean only, unlike
      the other three — `chartjs-plugin-gradient` has no plugin-level
      config of its own to thread through `resolveOptions()` at all,
      since its real config lives on each dataset instead (already
      reaching Chart.js untouched via the existing `data` prop). Threaded
      into both `resolveOptions()` and the reactive `watch()` dependency
      array; 2 new component tests added (applies when `true`; threads
      alongside the other three without clobbering their own
      `options.plugins.*` entries). Confirmed: `typecheck` clean, 36
      component tests, 100% coverage, 97.37% mutation score — same
      single pre-existing accepted survivor as before, not a new one.
      **A new e2e fixture + spec + helper**: `gradient-plugin.spec.ts`
      mounts a real, unmocked chart with a real per-dataset gradient
      config (`axis: 'y'`, red→yellow→green) and confirms more than one
      genuinely distinct color renders, via a new
      `expectDistinctColorCount` helper (`tests/e2e/helpers/`) — counts
      colors filtered by pixel-count significance, the same approach
      already used for the Colors-plugin regression test. Confirmed:
      60/60 e2e passing across all 3 browsers (up from 57). **Verified
      live in a real browser too**: the new docs-site example was found
      genuinely blank, confirmed via network-request inspection that
      `chartjs-plugin-gradient` was never even requested — the exact
      same signature as the already-known, already-documented item #4
      hydration gap (`zoom-plugin`/`sankey`), not a new bug. The docs
      page itself was written with `live={false}` accordingly, matching
      that same established pattern rather than falsely claiming it
      works. Docs updated across the board — see Phase 6's own entry
      below for the full list of pages touched.
- [x] Expose a `chart` instance ref (via `defineExpose`) for advanced/escape-
      hatch consumer access. `shallowRef`, re-read from `handle.chart`
      (a live getter on core's own handle) after every update — an
      in-place update keeps the same instance, but a type-change recreate
      swaps it for a new one under the same handle, so the exposed ref
      needs re-reading either way, not just on first mount.
- [x] Component tests (`tests/component/Chart.spec.ts`, Vitest +
      `@vue/test-utils`) — `keystone-chartjs-core` mocked entirely rather
      than used for real: its own registry/controller logic is already
      fully tested at the core level (Phase 1), so these tests verify
      Chart.vue calls core correctly and reacts correctly to what core
      returns, not core's own internal registration/update-vs-recreate
      decisions. Covers: mount for all 15 real `ChartKind` values (8
      built-in + 7 extension — confirmed against `types.ts`'s own union,
      correcting this bullet's original "8 + 5" framing, which conflated
      package count with kind count); in-place update on data/options
      change; that a `type` change still just calls `handle.update` (core
      decides update-vs-recreate, not this component); serialized
      ordering under overlapping prop changes; each plugin prop applied
      correctly (including the true/object-form distinction and the
      annotation-has-no-boolean-form case) and all three threading
      together without clobbering each other's `options.plugins.*`
      entries; the exposed `chart` ref being null pre-mount and the live
      instance post-mount, re-read correctly after a type-change
      recreate; `destroy()` called exactly once on unmount.
      **Confirmed clean: 27/27 tests passing** on the first real run
      (15 mount + 4 update + 6 plugin opt-in + 1 exposed-ref + 1 unmount
      — matches exactly). Before asking for `test:coverage`, proactively
      checked for the same two gaps that hit `packages/core` at this
      exact step, since the setup here is nearly identical — both were
      real, not hypothetical: (a) `vite.config.ts` had no
      `coverage.include` either, so v8's default `all: true` behavior
      would have swept in `stryker.config.mjs`/`vite.config.ts` itself as
      0%-covered "application code", same as it did for core — fixed by
      scoping to `src/**/*.{ts,vue}`; (b) `Chart.spec.ts` imports
      `Chart.vue` directly (the concrete file), not through the barrel,
      so `index.ts`'s own real, executable re-export statement would
      show 0% coverage — fixed with a dedicated
      `tests/component/index.spec.ts` contract test, mirroring core's
      own `index.spec.ts` exactly.
      **Real `test:coverage` run**: 95.23%/82.35%/100%/95.23%
      (stmts/branches/funcs/lines) — branches below the 90% floor,
      flagged at `Chart.vue` lines 87–89: `update()`'s own
      `if (!handle) { await mount(); return; }` fallback. On inspection
      this is genuinely unreachable, not just undertested —
      `enqueue()` always runs `mount()` before any `update()` task
      (`onMounted` enqueues `mount` first; `watch()`'s callback can only
      fire on a later reactive tick, never before setup's own
      `onMounted` call), and `mount()` always successfully sets `handle`
      since the template's own `<canvas>` has no `v-if` — unconditionally
      rendered, so `canvasRef.value` is never null once Vue has mounted
      the component at all. Removed the dead fallback (`handle!` non-null
      assertions in its place, justified by that same invariant in a
      code comment) rather than writing a synthetic test for a state
      this component structurally cannot reach.
      **Next action for you**: rerun `pnpm --filter keystone-chartjs-vue
      test:coverage`.
      **Second real `test:coverage` run**: 100%/87.5%/100%/100% —
      branches still below 90%, now flagged at lines 69 and 75 (line
      numbers shifted after the removal above). Two distinct causes, not
      one: (a) line 69, `resolveOptions()`'s `dataLabels` ternary — a
      genuine test-suite gap, not dead code: the suite tested `zoom` in
      both boolean and object forms but only ever tested
      `dataLabels: true`, never an actual config object, an asymmetry
      that had gone unnoticed. Added the missing test. (b) line 75,
      `mount()`'s own `if (!canvasRef.value) return;` guard — the same
      class of genuinely unreachable defensive code as the fallback
      already removed from `update()` above, for the identical reason:
      the template's `<canvas>` has no `v-if`, so Vue always assigns the
      ref before `onMounted` fires. Removed, with `canvasRef.value!` in
      its place.
      **Next action for you**: rerun `pnpm --filter keystone-chartjs-vue
      test:coverage` once more.
      **Confirmed: 100%/100%/100%/100%** across both `Chart.vue` and
      `index.ts`. Unit/component-test tier for Phase 2 is genuinely
      closed — 28 tests, 100% coverage on every metric, two real gaps
      found and fixed via actual runs (a missing `dataLabels`-object
      test, and two pieces of genuinely unreachable defensive code
      removed rather than worked around) rather than assumed clean.
      **Real architectural gap found while starting the mutation-testing
      tier, before ever running Stryker for real**: `stryker.config.mjs`
      already excluded `.vue` files entirely (Stryker mutates JS/TS ASTs;
      a `.vue` SFC's `<script>` block isn't an officially supported
      target — confirmed directly against `keystone-theme-builder`'s own
      real `stryker.config.mjs`, which documents the identical exclusion
      for its own `.vue` components), but ALL of Phase 2's real logic
      lived directly inside `Chart.vue`'s own `<script setup>` block —
      meaning `mutate: ['src/**/*.ts', '!src/index.ts']` had nothing real
      to match at all. `keystone-theme-builder`'s own real convention
      (confirmed by reading its actual `stryker.config.mjs` and file
      layout) is to keep `.vue` components thin and extract real logic
      into plain `.ts` files/composables specifically so mutation testing
      has something to target — this project's own Chart.vue never
      followed that separation. Fixed by extracting all of it into a new
      `useChartController.ts` composable (mount/update/resolveOptions/
      the promise-chain serialization, the two genuinely-unreachable-code
      removals and their reasoning, all moved as-is); `Chart.vue` itself
      is now just prop declarations, a `canvasRef`, one call to the
      composable, and a template — no behavior change, since nothing
      about the public prop/exposed-ref contract changed, only where the
      logic physically lives. `stryker.config.mjs`'s own `mutate` now
      points at `src/useChartController.ts` specifically. The existing
      28 component tests weren't touched — they test through `Chart.vue`'s
      own public interface, which is unchanged, so they should keep
      passing unchanged against the refactor; worth confirming with a
      real `test:component` run before trusting that, not just assuming
      it from the reasoning alone.
      **Next action for you**: rerun `pnpm --filter keystone-chartjs-vue
      test:component` to confirm the refactor didn't break anything,
      then `pnpm --filter keystone-chartjs-vue test:mutation` for the
      real mutation run this whole fix was for.
      **Confirmed: 29/29 passing** (28 in `Chart.spec.ts` + 1 barrel
      contract test) — the refactor genuinely didn't change any public
      behavior, confirmed rather than assumed.
      **Next action for you**: run `pnpm --filter keystone-chartjs-vue
      test:mutation`.
      **Real run: 91.43% overall, 3 survivors**, all in
      `useChartController.ts` (the only mutated file). Read the actual
      `mutation-report.json` to map survivors to exact lines rather than
      guess from the summary table: (1)/(2) both at the `watch(...)`
      call's own `{ deep: true }` option (mutated to `{}` and to
      `deep: false`) — a genuine gap, not dead code: every
      existing update test replaces `data`/`options` wholesale via
      `setProps`, which Vue's shallow dependency tracking already
      catches regardless of `deep`; `deep: true` only matters for a
      nested mutation of an already-reactive object *without* replacing
      the top-level reference, which no test exercised. Added a test
      using Vue's own `reactive()` to wrap the `data` prop and mutate a
      nested field in place. (3) `handle?.destroy()` in the unmount
      cleanup (optional chaining removed) — also a genuine gap: since
      `enqueue()`'s own `.then(task, task)` pattern deliberately runs the
      next queued task regardless of whether the previous one rejected
      (so one failure doesn't permanently poison the chain), a rejected
      `createChartController` call leaves `handle` never assigned, and a
      subsequent unmount's cleanup task still runs — unlike the two
      guards removed earlier in this same file (genuinely unreachable
      given Vue's own lifecycle ordering), this one protects against a
      real async-failure path. Added a test mocking
      `createChartController` to reject, then unmounting, confirming no
      throw.
      **Next action for you**: rerun `pnpm --filter keystone-chartjs-vue
      test:component` first to confirm the two new tests pass on their
      own, then `pnpm --filter keystone-chartjs-vue test:mutation` again
      to confirm the score.
      **Real run: 31/31 tests passed, but exit code 1 — "1 error".** Not
      a test-assertion failure: the new "does not throw when unmounting
      after mount() itself never resolved a handle" test surfaced a real
      unhandled-promise-rejection gap in the production code itself, not
      just a test artifact. `enqueue()`'s `.then(task, task)` genuinely
      does recover from a rejected task on the *next* `enqueue()` call,
      but nothing marks the intermediate rejected `pending` promise as
      handled during the real time gap between one `enqueue()` call and
      the next — Node/V8 flags a promise as an unhandled rejection based
      on whether *any* handler was ever attached during that window,
      regardless of it eventually being handled later. Fixed with an
      immediate no-op `pending.catch(() => {})` in `enqueue()` itself —
      changes no real behavior (the callback does nothing observable),
      doesn't touch the `pending` reference used for actual chaining,
      exists purely to mark the promise handled before that gap can
      trigger the warning.
      **Next action for you**: rerun `pnpm --filter keystone-chartjs-vue
      test:component` once more, then `pnpm --filter keystone-chartjs-vue
      test:mutation`.
      **Confirmed: 31/31 passing, 0 errors.** The unhandled-rejection gap
      is genuinely fixed.
      **Next action for you**: run `pnpm --filter keystone-chartjs-vue
      test:mutation`.
      **97.14% overall, 1 survivor: `handle?.destroy()` →
      `handle.destroy()`.** Traced through carefully why the new test
      couldn't kill it, rather than assume it should have: `wrapper.
      unmount()` triggers `onBeforeUnmount` synchronously, but the real
      cleanup is an *async* task scheduled via `enqueue()` — the actual
      `handle.destroy()` call happens inside a promise that resolves
      *after* `unmount()` already returned, so a synchronous
      `not.toThrow()` around the unmount call could never observe it
      either way. Worse: the `pending.catch(() => {})` just added to fix
      the unhandled-rejection issue unconditionally swallows *every*
      rejection from *every* enqueued task, including the real one this
      specific mutant would introduce — meaning the fix for one genuine
      gap made the other one's defensive value externally unobservable.
      Accepted as an explained, not brittle-worked-around, survivor —
      rewrote the test's own comment to state this precisely rather than
      leave a misleading claim that it verifies the optional chaining.
      The defensive value of `handle?.destroy()` itself is still real (a
      genuinely possible async-failure path, unlike the two unreachable
      guards already removed from this same file), just not
      distinguishable via any external assertion once the swallowing
      catch exists — rearchitecting error propagation solely to make one
      mutant killable isn't worth the added complexity, matching the
      same judgment call already made for Phase 1's own accepted
      equivalent mutant in `packages/core`.
      **Phase 2's unit/component-test and mutation-testing tiers are now
      genuinely closed** — 31 tests, 100% coverage on every metric,
      97.14% mutation score with the one remaining survivor explicitly
      accounted for. Remaining Phase 2 work: Playwright e2e (needs a
      small `examples/vue` app scaffolded first) — not started.
      **Correction on the e2e approach itself**: this bullet's own
      original wording ("a small examples app, own `examples/vue`
      workspace member") was based on an unverified assumption about
      what `keystone-grid`'s real convention actually is. Checked its
      real `packages/vue/tests/e2e/` directly before building anything
      — the real convention needs no separate workspace member at all:
      each e2e test gets its own tiny fixture (a `.html` shell +
      a `.ts` file that imports the real component directly from
      `../../../src/...` and mounts it with `createApp(...).mount()`),
      served by the package's own Vite dev server via
      `playwright.config.ts`'s own `webServer`. `examples/vue` in that
      project's root `examples/` directory is a separate, unrelated
      thing (proving the docs site's own live-example embedding
      mechanism) — not what Playwright tests against. Followed the real
      convention instead of the plan's own guessed one.
      Built: `playwright.config.ts` (adapted from `keystone-grid`'s own
      real, working config — its `launchOptions.executablePath` pins a
      Linux path specific to that project's own CI sandbox, omitted here
      since it doesn't apply to a real local Windows machine) and four
      fixture+spec pairs, chosen to cover what e2e uniquely proves that
      every other tier in this monorepo structurally can't (since
      `keystone-chartjs-core` is mocked everywhere else): (1) a real bar
      chart actually renders non-blank pixels to a real canvas 2D
      context, which jsdom has none of at all; (2) a real `sankey` chart
      registers and renders via the *real*
      `chartjs-chart-sankey` package (not mocked) — the first place a
      version mismatch or renamed export, the exact risk `registry.ts`'s
      own error message warns about, would surface as a real failure;
      (3) the same for `chartjs-plugin-zoom`, the real package; (4) a
      real browser-driven resize, via a percentage-width fixture
      container and an actual viewport resize, confirming the real
      `ResizeObserver` path actually shrinks the canvas — jsdom has no
      real layout engine, so this can't be verified any other way
      either. Sankey's `{from, to, flow}` data shape confirmed against
      that package's own real README, not assumed.
      This is a representative first slice, not the full "one example +
      e2e test per extension kind and per plugin" scope Phase 5 commits
      to (15 kinds × 3 plugins across all three frameworks) — the
      remaining fixtures for the other 13 kinds and 2 plugins can follow
      the same established pattern incrementally.
      **Next action for you**: run `npx playwright install chromium`
      first if Playwright's browser binaries aren't already installed
      locally, then `pnpm --filter keystone-chartjs-vue test:e2e`.
      **Real run**: "Timed out waiting 30000ms from config.webServer" —
      the webServer never became reachable. The run's own output showed
      the real cause: several "Unknown env config" warnings
      (`npm-globalconfig`, `recursive`, `verify-deps-before-run`,
      `_jsr-registry` — all pnpm-specific env vars), confirming `npx
      vite` was shelling out through npm specifically, a documented
      pnpm+npx friction point — KDL's own real config uses the identical
      `npx vite dev ...` command, but that project's own environment
      apparently tolerates it; this one didn't. Fixed by switching to
      `pnpm exec vite dev ...`, which resolves the local
      `node_modules/.bin/vite` directly without going through npm at
      all, and bumped the timeout from KDL's own 30s to 60s defensively
      (a cold Vite start, particularly first-time esbuild dependency
      pre-bundling, can genuinely take longer than 30s on a real local
      machine that hasn't warmed up yet).
      **Next action for you**: rerun `pnpm --filter keystone-chartjs-vue
      test:e2e`.
      **Real run: still "Timed out waiting 60000ms", now with no npm
      warnings** — confirming the `pnpm exec` fix above genuinely
      resolved the npm/pnpm env-var issue, but something else was still
      wrong. Asked you to run the exact same command directly, outside
      Playwright entirely (`pnpm exec vite dev --port 5183
      --strictPort`) — it started correctly in ~1.4s, ruling out Vite
      itself or the command string as the cause. This matches a known,
      documented Playwright issue (microsoft/playwright#18467): using
      `url` in `webServer` config can cause exactly this kind of
      unreliable timeout in some environments, while `port` "works
      instantly" for the identical setup. Fixed by switching
      `webServer.url` to `webServer.port: 5183` (the separate
      `use.baseURL`, needed for the specs' own `page.goto()` calls, is
      untouched).
      **Next action for you**: rerun `pnpm --filter keystone-chartjs-vue
      test:e2e` once more.
      **Real run: 3/4 passed — the infrastructure genuinely works now.**
      `sankey`, `zoom-plugin`, and `resize` all passed, confirming real
      extension-package registration, real plugin registration, and real
      `ResizeObserver` behavior all work end-to-end. Only `bar-chart`
      failed, and for a different, simpler reason: Chart.js animates bar
      height in from 0 over ~1s by default, so the exact moment the spec
      checked pixel data could genuinely land before the first real
      paint. Fixed with `options: { animation: false }` in the fixture
      (deterministic, immediate rendering) plus polling the pixel check
      itself via `toPass()` — matching `resize.spec.ts`'s own already-
      passing pattern — rather than a fixed-duration wait, since even
      with animation off, canvas sizing still depends on the browser's
      own layout pass completing first.
      **Next action for you**: rerun `pnpm --filter keystone-chartjs-vue
      test:e2e` one more time.
      **Real run: still failing after the full 5s poll** — ruling out a
      timing race entirely (5s is far more than any animation/layout
      delay could need). Notably `bar-chart.spec.ts` was the only one of
      the four specs with no console-error listener at all, unlike
      `sankey`/`zoom-plugin` — and it's also the only one that checks
      actual pixel content rather than just box dimensions, so it's the
      first place a silent rendering failure would actually surface.
      Added the same console/pageerror listener plus a temporary
      diagnostic log of the canvas's own real `width`/`height`
      attributes (Chart.js's actual drawing-buffer size, distinct from
      the CSS box size already checked) to see what's actually happening
      before guessing further.
      **Next action for you**: rerun `pnpm --filter keystone-chartjs-vue
      test:e2e` once more and paste the full output, including the
      "canvas attrs: ..." line it should now print.
      **Real run: canvas attrs `{ width: 400, height: 200 }`, console
      errors `[]`, still blank for the full 5s poll.** Correct real
      dimensions, zero JS errors, yet genuinely zero non-blank pixels
      the entire time — ruling out both a timing race and a code bug in
      this project's own components. This exact combination (right
      layout/size, no errors, nothing ever actually painted) matches a
      real, documented Playwright/Chromium issue: the default `chromium`
      project uses the stripped-down `chrome-headless-shell` binary,
      which has known canvas/GPU rendering differences from the full
      browser — explicitly documented as needing `channel: 'chromium'`
      (the full Chrome-for-Testing/Chromium browser) for "tests that
      depend on GPU, fonts, or canvas," which this entire suite
      fundamentally does. Added `channel: 'chromium'` to the project
      config.
      **Next action for you**: run `npx playwright install chromium`
      again first (the full-browser channel may need its own separate
      download, distinct from the default headless-shell already
      installed), then rerun `pnpm --filter keystone-chartjs-vue
      test:e2e`.
      **Real run: bar-chart/sankey/zoom-plugin all now fail earlier,
      at the console-error assertion** — all three show the identical
      new error: `"Failed to load resource: the server responded with a
      status of 404 (Not Found)"`. Real, but unrelated to the canvas
      question this whole cycle was chasing: browsers automatically
      request `/favicon.ico` for any page, and these minimal fixture
      HTML files define no favicon at all — Chromium logs that 404 to
      the `console` 'error' channel, which is harmless noise unrelated
      to the app's own correctness, not a real bug. The assertion itself
      was too broad — `console` 'error' messages can legitimately include
      browser-level resource noise; `pageerror` (genuine uncaught JS
      exceptions only) is the precise thing that actually matters here.
      Fixed in all three specs: dropped the blanket `page.on('console',
      ...)` listener, kept only `page.on('pageerror', ...)`. This also
      means we still haven't seen whether the earlier `channel:
      'chromium'` fix actually resolved the original blank-canvas
      question — these three specs failed *before* reaching that check
      each time.
      **Next action for you**: rerun `pnpm --filter keystone-chartjs-vue
      test:e2e` once more.
      **Real run: `channel: 'chromium'` alone didn't fix it — identical
      failure, canvas still blank for the full 5s poll.** This actually
      rules out the Chromium-binary theory rather than confirms it:
      `sankey`/`zoom-plugin` both pass, and neither disables animation
      the way `bar-chart-fixture.ts` did (`options: { animation: false
      }`) — `bar-chart` is the one fixture that both sets that option
      *and* is the one that fails. Reverted the animation setting back
      to Chart.js's own default rather than keep an unexplained
      workaround that the evidence now points away from — the
      `channel: 'chromium'` change stays, since it's independently
      correct guidance for canvas-dependent tests regardless of whether
      it was the fix for this specific symptom.
      **Next action for you**: rerun `pnpm --filter keystone-chartjs-vue
      test:e2e` one final time to confirm bar-chart passes and the whole
      suite is genuinely green.
      **Real run: still failing, identically, even reverted.** Ruling
      out the animation theory too — correlation with `sankey`/
      `zoom-plugin` not disabling animation was coincidental, not
      causal. Rather than propose a fourth unverified theory, added a
      real screenshot capture (`page.screenshot(...)`) on failure so the
      actual rendered output can be inspected directly instead of
      reasoned about blind.
      **Next action for you**: rerun `pnpm --filter keystone-chartjs-vue
      test:e2e` once more — it'll still fail, but should now also save
      `debug-bar-chart.png` in `packages/vue/`. Let me know once it's
      there.
      **Screenshot confirmed genuinely blank — the whole page, not just
      the canvas.** This points somewhere more fundamental than a
      rendering-timing or browser-binary issue: `useChartController.ts`'s
      own `enqueue()` has a deliberate `pending.catch(() => {})` (added
      earlier in this same phase to fix a real Vitest unhandled-
      rejection false-positive) that unconditionally swallows *any*
      error from `mount()`/`update()` — including a genuine
      `createChartController` failure in a real browser, which would
      explain every symptom seen so far exactly: the canvas element
      itself still renders (unconditional in the template, unaffected),
      zero errors surface anywhere (swallowed internally), yet nothing
      is ever drawn (construction never actually succeeded). Added
      temporary diagnostic logging to that catch, plus a temporary full
      console listener in the spec, to see what's actually being
      swallowed rather than propose a fifth unverified theory.
      **Next action for you**: rerun `pnpm --filter keystone-chartjs-vue
      test:e2e` once more and paste the full output — looking
      specifically for a `[useChartController] swallowed error: ...`
      line.
      **Found it — a real, substantive bug in Phase 1's own core
      package, not an e2e-infrastructure issue at all**: the swallowed
      error was `"bar" is not a registered controller.` Chart.js v4's
      plain `'chart.js'` entry point (as opposed to `'chart.js/auto'`)
      is the tree-shakeable build and registers *nothing* automatically
      — `registry.ts`'s own doc comment claimed the opposite ("already
      registers globally on import"), which was simply wrong, and every
      earlier test tier's own `vi.mock('chart.js', ...)` made this
      invisible until now: this is the first tier in the whole project
      to construct a chart against real, unmocked Chart.js at all.
      **Fixed in `packages/core/src/registry.ts`**: import Chart.js's own
      `registerables` array and call `Chart.register(...registerables)`
      unconditionally at module load — the same thing `'chart.js/auto'`
      does internally, and the officially recommended pattern for
      "register every built-in, but keep separate extension packages
      lazy." Costs nothing extra in bundle size (`registerables` is
      already part of the base `chart.js` package this project depends
      on regardless); the 5 real extension packages keep their existing
      lazy, dynamic-import registration untouched — that's genuinely
      where the tree-shaking benefit lives. Corrected the misleading doc
      comment on `CHART_TYPE_REGISTRY` to state this accurately, and
      renamed a local variable inside `ensureChartKindRegistered` that
      had been shadowing the newly-imported `registerables`.
      **Also updated all four of `packages/core`'s own test files that
      mock `'chart.js'`** (`controller.spec.ts`, `registry.spec.ts`,
      `plugins.spec.ts`, `index.spec.ts`) to add `registerables: []` to
      their mock factories — without it, `Chart.register(...undefined)`
      would throw at module-import time the instant any test imports
      `registry.ts` (directly or via the barrel), since the mock
      previously had no such property at all. Each file's own
      `beforeEach`-level `mockClear()` already wipes the one extra
      module-load-time `register()` call before any test's own
      assertions run, so none of the existing call-count assertions
      should be affected — worth confirming with a real run rather than
      assuming, since Phase 1 was previously marked "genuinely closed"
      and this is a real change to its own production code, not just
      its tests.
      **Next action for you**: run `pnpm --filter keystone-chartjs-core
      test:unit` (then `test:coverage` and `test:mutation` if that's
      clean) to confirm this real fix didn't regress anything Phase 1
      had already confirmed — before rerunning Vue's own e2e suite to
      confirm bar-chart itself now actually renders.
      **Confirmed: 47/47 passing** — no regressions from the
      registry.ts fix. (47, not the 44 Phase 1 originally confirmed —
      that gap isn't something this fix explains, since only mock
      factories were edited, no new test cases added; not worth
      guessing at further since it doesn't affect this fix's own
      correctness.)
      **Next action for you**: run `pnpm --filter keystone-chartjs-core
      test:coverage`.
      **Confirmed: 100%/100%/100%/100%** across every file, including
      `registry.ts`.
      **Next action for you**: run `pnpm --filter keystone-chartjs-core
      test:mutation`.
      **Confirmed: 98.90% overall** — identical to Phase 1's originally-
      confirmed score, `registry.ts` back at 100% with the one same
      accepted-equivalent survivor in `controller.ts` unchanged. Phase 1
      is genuinely still closed after this real fix — confirmed, not
      assumed.
      **Next action for you**: rerun `pnpm --filter keystone-chartjs-vue
      test:e2e` — this is the run this whole detour was for.
      **Confirmed: 4/4 passing.** The real bug is genuinely fixed —
      `bar-chart` now renders real, non-blank pixels via real,
      unmocked Chart.js. Cleaned up the temporary diagnostics added
      along the way: reverted `useChartController.ts`'s `enqueue()` to
      its exact original, already-mutation-tested silent
      `pending.catch(() => {})` (a permanent error-logging improvement
      there is a good idea, but deserves its own dedicated test and a
      fresh Stryker confirmation, not a sneak-in during cleanup that
      would reopen Phase 2's already-closed 97.14% score unverified);
      restored `bar-chart.spec.ts` to a clean version with a header
      comment on what it caught, without the temporary console-listener
      and screenshot-on-failure diagnostics. One leftover,
      low-priority cleanup item: `packages/vue/debug-bar-chart.png` (a
      diagnostic screenshot saved during this investigation) — this
      connector has no delete capability, so please remove that file
      yourself.
      **Phase 2's e2e tier now has 4 genuinely passing, real-browser
      scenarios**, and caught a real production bug in `packages/core`
      that no earlier, fully-mocked test tier could have found — exactly
      what this tier exists for. Not yet exhaustive across the full
      ~18-scenario scope (remaining 13 kinds, 2 plugins), and Stryker
      mutation testing for Phase 2 is still the one remaining item.
      **Expanded to cover all 8 built-in chart kinds and 2 more browser
      engines, at your request**: added fixture+spec pairs for
      `line`/`bubble`/`scatter`/`doughnut`/`pie`/`polarArea`/`radar`
      (the 7 remaining built-ins — `bar` already existed), each
      following `bar-chart-fixture.ts`'s own established pattern
      exactly (animation left at Chart.js's own default, per that
      file's own comment on why). Extracted the shared non-blank-pixel
      assertion into `tests/e2e/helpers/expectNonBlankCanvas.ts` rather
      than repeat it seven more times verbatim — `bar-chart.spec.ts`
      itself left untouched (already passing; no reason to risk it for
      a refactor-only change). Also added `firefox`/`webkit` projects to
      `playwright.config.ts` — neither needs a `channel` override the
      way `chromium` does (that `chrome-headless-shell`-vs-full-browser
      distinction is Chromium-specific). None of this has been run for
      real yet.
      **Next action for you**: run `npx playwright install firefox
      webkit` first if those browsers aren't already installed locally
      (the earlier `chromium` install doesn't cover them), then `pnpm
      --filter keystone-chartjs-vue test:e2e` — this now runs 11 spec
      files × 3 browser engines (33 test executions total).
      **Confirmed: 33/33 passing** — every one of the 8 built-in chart
      kinds, `sankey`, `zoom-plugin`, and `resize`, all genuinely
      rendering real, non-blank canvas pixels (or resizing correctly)
      across Chromium, Firefox, and WebKit alike. Phase 2's e2e tier for
      Vue now covers all 8 built-ins across all 3 browser engines; still
      open: the other 6 extension kinds (candlestick/ohlc/boxplot/
      violin/matrix/treemap) and the other 2 plugins
      (annotation/dataLabels), plus Stryker mutation testing for this
      package overall.
- [x] Playwright e2e (`tests/e2e/fixtures/*.html`+`*.ts` per scenario, served
      via this package's own Vite dev server — see the entry above for the
      real convention this follows, corrected from an earlier guess)
      exercising each chart kind and each plugin in a real browser.
      **Now exhaustive**: all 15 real `ChartKind` values (8 built-in +
      7 extension — candlestick/ohlc/boxplot/violin/matrix/sankey/
      treemap) and all 3 plugins (zoom/annotation/dataLabels), plus
      resize behavior — 19 spec files total, run across 3 browser
      engines (Chromium/Firefox/WebKit). Data shapes for the 4 newly
      added extension kinds confirmed against each real package's own
      docs before writing, not guessed: candlestick/ohlc use
      chartjs-chart-financial's own `{x, o, h, l, c}` shape (a plain
      numeric `x`, not a real date/time value, to avoid needing a
      separate date-adapter package a `'time'` scale would require);
      boxplot/violin use `@sgratzl/chartjs-chart-boxplot`'s own
      raw-number-array-per-box shape (statistics computed
      automatically); matrix uses `chartjs-chart-matrix`'s own
      `{x, y, v}` shape with the scriptable `width`/`height` dataset
      functions and explicit linear-scale bounds that package's own
      docs show as required (cells have no size Chart.js can infer on
      its own); treemap uses `chartjs-chart-treemap`'s own simplest
      confirmed shape (a flat array of raw numbers, no `tree`/`key`/
      `groups` needed). annotation uses a real, standard line-annotation
      config (`annotations.<key> = { type: 'line', yMin, yMax, ... }`);
      dataLabels uses the plain `true` form. Not yet run for real.
      **Next action for you**: run `pnpm --filter keystone-chartjs-vue
      test:e2e` — this now runs 19 spec files × 3 browser engines (57
      test executions total).
      **Real run: 39/57 passed, 18 failed** — all 18 failures are
      exactly the 6 newer extension kinds (candlestick/ohlc/boxplot/
      violin/matrix/treemap) across all 3 browsers, each throwing
      "Failed to resolve module specifier" for its own backing
      package, while sankey and all 3 plugins (the 4 pre-existing
      extension-kind/plugin specs) pass cleanly. A genuinely extensive
      investigation followed, confirming several theories and ruling
      out several others rather than guessing at just one fix:
      - **Confirmed real, ruled out as the cause**: `Chart.getChart()`
        returning nothing and Chart.vue's own exposed `chart` ref never
        being set both confirmed `mount()` itself was failing, not a
        rendering-timing issue.
      - **Tried, confirmed NOT to fix it**: `optimizeDeps.include`
        (Vite's own dependency-scan step resolves relative to this
        package's own root, where none of these 8 packages are direct
        dependencies — confirmed via a real startup warning showing
        this failing identically for all 8, including the 4 that
        already work); a `globalSetup` script sequentially warming up
        each package's own first dynamic import, one at a time, before
        any parallel test could run (ruling out a parallel-worker
        discovery race entirely — a real run with this in place showed
        the identical 6 failures); `--force` on the dev server's own
        startup command (ruling out a stale on-disk Vite dependency
        cache — a real run with this in place also showed the
        identical 6 failures).
      - **Confirmed NOT the packages themselves**: each package
        resolves and exports correctly when imported via a direct
        `@fs/` path to its own real file, checked live via a real
        browser session against the actual running dev server.
      - **The real, confirmed mechanism**: `registry.ts`'s own
        `import(/* @vite-ignore */ entry.packageName)` uses a
        *variable* specifier (necessarily — the backing package
        differs per kind), which Vite's static dependency crawler can
        never discover, regardless of any config. `@vite-ignore`
        suppresses Vite's own runtime rewriting for that import
        entirely. In this specific dev-server setup, that combination
        breaks for 6 of the 7 extension kinds but not the 7th (sankey)
        or the 3 plugins — re-importing `registry.ts` fresh, live in a
        real browser session, showed even sankey failing under a
        second, separate module evaluation, confirming this is a
        genuine Vite dynamic-import-discovery limitation tied to
        module-evaluation context, not anything specific to any one
        package.
      - **The one fix confirmed to actually work**: rewriting
        `registry.ts`'s own dynamic import to use static, literal
        `import()` calls per kind instead of a variable specifier —
        this lets Vite's own crawler discover and pre-bundle all 7
        extension packages at config time, eliminating this entire
        class of issue. **Deliberately not done** — a real production-
        code change to already mutation-tested Phase 1 code (98.90%
        score), correctly deferred rather than made unilaterally after
        this much speculative back-and-forth; left as an explicit,
        documented decision, not an oversight.
      **Resolution, at your explicit direction**: initially left as a
      known, documented limitation (the 6 affected specs marked
      `test.fixme(...)`), then genuinely fixed — see "Current status &
      open issues" item #2 above and Phase 1's own entry for the full
      `registry.ts`/`controller.ts` fix and its complete verification
      chain. All temporary diagnostics from the original investigation
      were cleaned up along the way: `useChartController.ts`'s
      `enqueue()` reverted to its exact original, mutation-tested form;
      the 6 fixtures' own temporary `window.__chartRef`/`window.
      __ChartJs` exposures removed; `expectNonBlankCanvas.ts` reverted
      to its original form (the screenshot-on-failure addition is no
      longer called with a `page` argument by anything); `--force`
      removed from `playwright.config.ts`'s own `webServer.command`
      (confirmed not to help, no reason to keep the slower startup);
      `tests/e2e/global-setup.ts` and `tests/e2e/helpers/
      getChartDiagnostic.ts` neutralized to inert placeholders (this
      connector has no delete capability) rather than left with content
      that's no longer wired up to anything. Once the real fix landed,
      all 6 specs were reactivated (back to real `test(...)` calls, no
      more `test.fixme`).
      **Final state: 57/57 passing** — confirmed via a real
      `pnpm --filter keystone-chartjs-vue test:e2e` run. Every one of
      the 15 chart kinds, all 3 official plugins, and resize behavior
      now genuinely render/behave correctly, on all 3 browser engines.
      Phase 2's e2e tier is now completely, genuinely closed — no
      remaining known limitations.
- [x] Stryker mutation run — confirmed at **97.14%** overall for
      `useChartController.ts` (the file `stryker.config.mjs` mutates),
      with the one remaining survivor explicitly accounted for (see the
      detailed entry earlier in this section). Target was parity with
      `keystone-grid`'s ~98%+ score; 97.14% with a documented,
      non-brittle-workaround-worthy accepted survivor is close enough to
      call this genuinely done, matching the same judgment call already
      applied to Phase 1's own accepted equivalent mutant in
      `packages/core`.
- [x] **Accessibility — ARIA-attribute fallthrough + fallback-content
      slot**, at your request, closing items #3 and #7 in "Current
      status & open issues" above. `Chart.vue`'s own template gained a
      `<slot>` inside the `<canvas>` tags (Chart.js's own accessibility
      docs are explicit that content between a canvas element's own
      opening/closing tags is what browsers/assistive tech that can't
      render canvas at all actually show) — the one genuinely new piece
      of code this work needed. ARIA-attribute forwarding
      (`aria-label`, `role`, `aria-describedby`, and any other non-prop
      attribute onto the rendered `<canvas>`) needed no code change at
      all: `Chart.vue` declares no `inheritAttrs: false`, so Vue's own
      default single-root-component behavior already handles it —
      confirmed via a real component test rather than left as an
      assumption. Two new tests added to `Chart.spec.ts` (one per
      mechanism) — **confirmed: 33/33 passing** (up from 31),
      **100%/100%/100%/100% coverage** maintained. No mutation re-run
      needed: `Chart.vue` is excluded from Stryker's own `mutate` scope
      (only `useChartController.ts` is mutated, per this same phase's
      own earlier architectural-gap entry), and this change touched
      only `Chart.vue`'s own template. Docs updated across the board —
      see Phase 6's own docs-site entry below for the full list of
      pages touched (a rewritten `guide/concepts/accessibility.md`, a
      new `components/slots.md` page, and updates to `features.md`,
      `components/index.md`, `components/props.md`, and `guide/
      project/roadmap.md`) — plus `docs/VUE_CHARTJS_FEATURE_INVENTORY.md`
      updated to mark its own originally-flagged gap resolved.

## Phase 3 — React package (`packages/react`)

Same acceptance bar as Phase 2, React-flavored. Same API-mismatch note as
Phase 2 above applies here too — the placeholder `Chart.tsx` calls the old
sync/nested-shape `createChartController`, which no longer exists.

- [ ] Replace the placeholder `Chart.tsx` (`useEffect` currently rebuilds the
      whole chart on every `data`/`options` identity change — needs the
      Phase 1 diff-and-update path instead, mirroring the stale-closure
      lessons already learned in `keystone-grid`'s React package).
- [ ] Forward a chart-instance ref via `forwardRef`/`useImperativeHandle`
      (parity with Vue's exposed instance).
- [ ] Component tests (`tests/component`, Vitest + `@testing-library/react`).
- [ ] Playwright e2e against an `examples/react` app.
- [ ] Stryker mutation run.

## Phase 4 — Angular package (`packages/angular`)

Same API-mismatch note as Phase 2 applies here too — the placeholder
`KeystoneChartComponent` calls the old sync/nested-shape
`createChartController`, which no longer exists.

- [ ] Replace the placeholder `KeystoneChartComponent` (currently destroys and
      fully re-renders on *any* input change) with the Phase 1 diff-and-update
      path — only rebuild when `type` itself changes; `data`/`options` changes
      should update in place.
- [ ] `@Input()` for plugin opt-ins, matching Vue/React's props.
- [ ] Confirm barrel exports in `packages/angular/src/index.ts` stay complete
      as new symbols are added — this exact class of bug (missing barrel
      exports) already bit `keystone-dashboard-layout`'s Angular package once.
- [ ] Unit tests (`tests/unit`, Vitest + Angular TestBed via
      `@analogjs/vite-plugin-angular` — not Karma+Jasmine; see Phase 0).
      Real component-level tests replace the Phase 0 smoke test: one spec
      per chart kind, update-vs-recreate behavior, resize handling.
- [ ] Playwright e2e against an `examples/angular` app (standalone Angular CLI
      app, not an Astro island — reuse `keystone-dashboard-layout`'s reasoning
      for why `@analogjs/astro-angular` was abandoned there, rather than
      re-discovering it here).
- [ ] Stryker mutation run (Vitest runner, same as every other package —
      see Phase 0).

## Phase 5 — Ecosystem extensions & plugins hardening

- [ ] Confirm each of the 5 extension packages' real current versions and
      Chart.js-v4 compatibility (flagged as unverified in
      `CHARTJS_ANALYSIS.md` §3).
- [ ] Add one example + one e2e test per extension kind, per framework (15
      new e2e specs: 5 kinds × 3 frameworks).
- [ ] Add one example + one e2e test per plugin, per framework (9 new specs).
- [ ] Bundle-size check script (`scripts/check-bundle-size.js`, following
      `keystone-dashboard-layout`'s own convention) confirming lazy
      registration actually keeps unused extension controllers out of the
      base bundle.
- [ ] **Survey of Chart.js v4-compatible community plugins**, at your
      request — `docs/CHARTJS_AWESOME_PLUGINS.md` catalogs every plugin
      the official https://github.com/chartjs/awesome#plugins list marks
      as Chart.js v4-compatible (v2/v3-only entries excluded entirely,
      since this project only targets v4), grouped by that list's own
      Styling/Features/Interactions/Data Sources categories. Two entries
      stand out as directly relevant to this project's own tracked
      accessibility gap (item #7 in "Current status & open issues"):
      **a11y-legend** (keyboard accessibility for chart legends) and
      **chart2music** (keyboard navigation + sonification) — worth
      evaluating specifically against that gap rather than as generic
      candidates, since both could close real accessibility ground
      without this project building ARIA/fallback-content support from
      scratch. **Five entries have since been implemented**: `gradient`
      (kurkle/chartjs-plugin-gradient), `timestack`
      (jkmnt/chartjs-scale-timestack), `hierarchical`
      (sgratzl/chartjs-plugin-hierarchical), `image-label`
      (yunusemrejs/chartjs-image-label), and `autocolors`
      (kurkle/chartjs-plugin-autocolors), each as an official opt-in
      prop (see "Current status & open issues" items #13–#16/#20 and
      this doc's own Phase 1/2 entries for the full implementation) —
      all five removed from the survey tables, no longer candidates.
      Two candidates surveyed alongside `autocolors` in the same
      "Styling" category (`colorschemes`, `style`) were explicitly
      confirmed excluded, not just skipped — both genuinely Chart.js-
      v2/v3-era with no verified v4-compatible official release.
      **A 9th candidate is now fully scoped and ready to start**:
      `trendline` (Makanz/chartjs-plugin-trendline, from the
      "Features" category) — the one remaining v4-compatible,
      not-yet-implemented entry in that category (`crosshair`/
      `doughnutlabel`/`piechart-outlabels`/`regression`/`waterfall` are
      all confirmed v2/v3-only and stay excluded). See
      `docs/TRENDLINE_PLUGIN_PLAN.md` for the full package verification,
      real config shape, dependency-vs-port decision, and step-by-step
      implementation plan. None of the remaining packages' own real
      current maintenance status, config shape, or genuine v4
      compatibility has been independently verified yet, unlike the real
      verification `CHARTJS_ANALYSIS.md` §4 already did for the plugins
      above — that's real work still ahead of adding any of these as a
      10th+ official opt-in prop. Also worth deciding: whether resolving
      item #6 (the inline `plugins`-array gap, already resolved) makes a
      dedicated opt-in prop unnecessary for some of these, since a
      consumer can already use any of them directly without this project
      shipping bespoke support for each one.

## Phase 6 — Documentation site (`docs/site`, Astro + Starlight)

- [x] Scaffolded `docs/site` as a standalone Astro + Starlight project (own
      `package.json` + `pnpm-workspace.yaml`, not part of the root pnpm
      workspace) — same convention as `keystone-dashboard-layout/astro-docs`.
- [x] Promoted `docs/_design/mockup-landing.html` into
      `docs/site/src/pages/index.astro`, the same way
      `keystone-dashboard-layout`'s own mockup became its real landing page.
      Shares `SiteNav.astro` for its own top nav (Docs/Examples
      framework-switcher dropdowns, theme toggle) — a *different* component
      from the Starlight doc pages' own nav, matching KDL's real site,
      which also uses two separate navs rather than one shared one.
- [x] Sidebar structure (Overview → Guide → Features → Components → API →
      Examples) built for **Vue**, plus a **Core** section (Overview →
      Guide → Installation → API reference — deliberately shorter, no
      Features/Components/Examples, matching KDL's own real Core section
      at `localhost:4321/core/`, read directly rather than guessed) —
      4 real content pages under `src/content/docs/core/`, describing the
      actual Phase 1 implementation (not the stale placeholder API the
      earlier archived version described). `DocsHeader.astro`'s
      Core-specific nav array and `SiteNav.astro`'s `core` entry were
      already wired up in advance (see their own comments) — restoring
      the content and flipping `available: false` → `true` was the only
      change needed, no markup edits. React/Angular remain archived at
      `docs/site/_archived-pages/` (not deleted — no delete capability on
      this filesystem connector); restoring either means the same
      pattern: real content under `src/content/docs/`, a sidebar entry in
      `astro.config.mjs`, and flipping its own `SiteNav.astro` flag.
- [x] Starlight doc pages get their own top nav (`DocsHeader.astro`,
      wired as the `Header` component override) — a VitePress-style section
      nav (Guide/Features/Components/API/Examples/Changelog, scoped to the
      current framework via URL) plus Starlight's own real `Search`
      component and social icons, copied from `keystone-dashboard-layout`'s
      actual `Header.astro` source rather than guessed from a screenshot.
      `tokens.css` intentionally carries only the `--kg-*` brand palette
      (no `--sl-*` overrides), matching KDL's real file — Starlight's own
      default typography/colors are left alone on doc pages.
- [x] Left sidebar scoped to the current top-level section only —
      browsing `/core/*` shows just the Core group (not Vue's much larger
      tree alongside it), and `/vue/guide/*` etc. narrow further to just
      that sub-section, matching KDL's own real site exactly (its own
      `Sidebar.astro` override, read directly, solves the identical
      "every top-level group visible at once" problem for its own
      Vue/React/Angular/Core groups). Implemented as a `Sidebar` component
      override (`src/components/Sidebar.astro`), adapted from that real
      file rather than Starlight's own current "Multiple sidebars"
      tutorial — that tutorial targets the newer
      `Astro.locals.starlightRoute.sidebar` API from Starlight 0.32+,
      while this project (like KDL) has `@astrojs/starlight: "^0.30.0"`
      pinned, whose own installed `Sidebar.astro` reads the older
      `Astro.props.sidebar` shape instead — confirmed by checking both
      projects' actual installed version, not assumed. Verified on the
      real dev server: `/core/` shows only Core, `/vue/` shows only Vue's
      full tree, and `/vue/components` narrows further to just that
      subtree — all three checked directly, not assumed from the code
      alone.
      **Follow-up, at your explicit request**: Vue's own Overview page
      (`/vue/`) now shows only Guide, not the whole tree — a deliberate
      deviation from KDL's own real site (confirmed directly: its own
      `/vue/` Overview page shows everything expanded). Matched by exact
      pathname (`EXACT_SECTION_SIDEBARS` in `Sidebar.astro`), not the
      substring-prefix matching `SECTION_SIDEBARS` uses elsewhere — a
      naive `/vue/` prefix check would have also matched `/vue/features`
      (which contains `/vue/` as a substring) and incorrectly narrowed
      that page too. Verified both cases directly: `/vue/` shows only
      Guide, `/vue/features` still shows the full tree, unaffected.
      **Follow-up 2, at your explicit request**: added a small Vue logo
      + "Vue" text badge (16px, `#42B883`) above the sidebar whenever
      browsing under Vue — narrowing the sidebar (the fix above) had
      dropped the top-level "Vue" group label that used to identify
      which framework's docs these were. Vue-specific for now, not yet
      extended to Core (same now-label-less issue applies there too,
      just not asked about yet).
      **Follow-up 3, at your explicit request**: the "Overview" link
      (originally only prepended on the exact `/vue/` page itself) and
      the badge above now both show consistently on every narrowed Vue
      page — Guide, Components, API, and Examples alike, not just the
      Overview page — rather than the two being visible under different
      conditions from each other. Verified directly on `/vue/components`
      and `/vue/api`, both of which previously showed neither.
      **Follow-up 4, at your explicit request**: `/vue/features` narrows
      to just Features too now, alongside the badge and Overview link —
      it had been silently falling through to the full, unfiltered tree
      this whole time, a real gap in the original narrowing logic rather
      than something newly broken: `findGroup` only ever matches
      `type === 'group'` entries, and "Features" is a plain link (no
      sub-items of its own), so it was never found and every check
      quietly fell back to showing everything. Fixed with a new
      `findSection` helper that tries `findGroup` first (the common
      case) and falls back to wrapping a single `findEntry` match in an
      array when the section turns out to be a plain link instead of a
      group — general enough to cover any future link-only section, not
      just this one. Verified directly: `/vue/features` now shows only
      badge + Overview + Features; `/vue/guide/introduction` re-confirmed
      unaffected by the change.
- [~] Live interactive examples per chart kind and per plugin (15 kinds + 3
      plugins × 3 frameworks — 15, not 13: 8 built-in + 7 extension kinds,
      confirmed against `types.ts`'s own `ChartKind` union) embedded as
      Astro islands (Vue/React) or linked out to a standalone examples app
      (Angular) — reuse the Vue/React-island-vs-Angular-standalone-app
      split `keystone-dashboard-layout` already settled on, rather than
      re-litigating the `@analogjs/astro-angular` question.
      **Started for Vue**: added `@astrojs/vue`, a `keystone-chartjs-vue`
      alias to real source (`packages/vue/src/index.ts` — no published
      package or built `dist/` exists yet), an `ExampleTryIt.astro`
      harness (Preview/Source tabs + copy-to-clipboard, adapted from
      `keystone-theme-builder`'s own real component), and 3 example pages
      (`bar-chart`, `sankey`, `zoom-plugin`) under a real `Examples`
      sidebar group, replacing the flat placeholder page.
      **Only `bar-chart` is actually live-hydrated and interactive** —
      confirmed working end-to-end in a real browser, including its own
      in-place update button. `sankey`/`zoom-plugin` show real, correct
      source code but aren't hydrated: both need `registry.ts`'s own
      `import(/* @vite-ignore */ entry.packageName)` (used to lazily
      register the 5 ecosystem extension packages and 3 plugins) to
      resolve at runtime, and that specific dynamic import — a variable
      specifier, not a literal, so Vite's static crawler can never
      discover it — reaches the browser as a raw, unrewritten bare
      specifier and throws "Failed to resolve module specifier" whenever
      `registry.ts` is reached from outside this docs site's own project
      root (confirmed directly via a live browser session: temporary
      logging traced the failure to this exact line, a network-request
      check showed the dependency was never even requested, and a saved
      screenshot confirmed the resulting canvas was genuinely blank, not
      a timing artifact). Tried and confirmed NOT sufficient on their
      own: `optimizeDeps.include` for the specific packages (doesn't help
      — the gap is in runtime rewriting, not pre-bundling), and switching
      `keystone-chartjs-core` from a direct alias to a real `link:`
      dependency in `docs/site/package.json` (Vite still serves the
      symlink's own resolved, real path via the same `@fs/` mechanism
      either way). Phase 2's own Playwright e2e suite
      (`packages/vue/tests/e2e/`) exercises the identical real,
      unmocked dynamic imports successfully, so this is specifically a
      docs-site build-pipeline gap, not a bug in `keystone-chartjs-vue`/
      `keystone-chartjs-core` themselves — confirmed, not assumed, and
      clearly noted on both affected pages rather than left silently
      broken-looking. Left unresolved at your explicit request rather
      than pursue further speculative Vite-config fixes or rewrite
      `registry.ts`'s own already-mutation-tested dynamic-import logic
      unilaterally; likely resolves naturally once Phase 7 actually
      builds/publishes these packages and this docs site can consume a
      real, non-symlinked `dist/` install instead.
      `ExampleTryIt.astro` itself gained a `live` prop (default `true`)
      for this: `live={false}` defaults to the Source tab active and
      swaps the footer's own "Live, hydrated component" claim for an
      accurate "Source only—not yet live on this docs site", rather than
      show an empty Preview panel under a claim that doesn't hold for it.
      Not yet started for React (`@astrojs/react`) or Angular (its own
      standalone-app link-out convention, per KDL's precedent).
      **Added two more live examples, at your request**: `mixed-chart`
      (a bar chart with one dataset overridden to `type: 'line'`) and
      `multi-axis` (two datasets on independent `y`/`y1` scales via
      `yAxisID`, matching Chart.js's own official Multi Axis Line Chart
      sample config). Both use only built-in kinds/scale types, so both
      are live and interactive immediately, same as `bar-chart` —
      neither hits the `registry.ts` dynamic-import gap `sankey`/
      `zoom-plugin` do.
      **Added a new "Concepts" guide section, at your request, after you
      pointed out the example pages' own inline tips assumed familiarity
      with Chart.js concepts a reader shouldn't need to look up
      separately on chartjs.org**: 7 real guide pages under
      `src/content/docs/vue/guide/concepts/` — data structures, options
      resolution, axes & scales, mixed charts, colors/fonts/padding,
      performance, and accessibility — written in this library's own
      context (cross-referencing its real props/behavior, not just
      restating Chart.js's own docs), nested under Guide alongside the
      existing Project sub-group (confirmed `Sidebar.astro`'s own
      `/vue/guide` prefix-match narrowing already covers this correctly,
      recursing to any depth the same way it already does for Project —
      no sidebar-logic changes needed). The accessibility page in
      particular documents current status honestly rather than
      overclaiming: ARIA-attribute fallthrough is noted as *possibly*
      already working via Vue's own single-root fallthrough behavior but
      explicitly unconfirmed, and fallback-content support is stated
      plainly as not yet implemented — matching item #7 in "Current
      status & open issues" above, not contradicting it. The
      `mixed-chart`/`multi-axis` example pages now link to their own
      matching concept page rather than duplicating the explanation
      inline in a tip callout.
      **Separate, real staleness problem found while verifying the
      above, and fixed, at your request**: several pages describing
      *this library itself* (not Chart.js concepts) still described the
      pre-Phase-2 placeholder state, never updated as Phase 1/2 actually
      got built and tested — `vue/features.md` (nearly every row said
      "Planned"), `vue/index.md`'s own "Status" section, `vue/components/
      index.md` and `props.md` (wrong `data` type, plugin props marked
      "Planned", the old destroy-and-recreate-on-any-change behavior
      described as current), `vue/components/events.md` (called the
      component "the current placeholder component"), `vue/api/index.md`
      and `plugins.md` (plugin exports/props both marked "Planned"),
      `vue/guide/project/architecture.md` (plugin props and the `watch`-
      based update wiring both marked "(planned)"), and `vue/guide/
      project/roadmap.md` (described Phase 2 as "not yet started" and
      Phase 0/Angular as still pending, both long since resolved).
      `vue/api/chart-kinds.md` was the one page already accurate;
      cross-links added there and in `vue/features.md`/`vue/guide/
      project/roadmap.md` to the new Concepts pages and to each other.
      Every rewritten page now states real, current status (100%
      coverage/97.14% mutation for this package, 98.90% for core, 51/57
      e2e with the 6-kind limitation explained plainly, not hidden) and
      the honest, still-open gaps (inline custom plugins, accessibility,
      Vue-native events) rather than a blanket "Planned" that no longer
      matches reality.
      **Added two more live examples, at your request, after analyzing
      https://react-chartjs-2.js.org/examples**: that site's own real
      example list (Line, Bar, Horizontal Bar, Doughnut, Pie, Polar
      Area, Radar, Scatter, Bubble, Multitype Chart, Chart Events —
      confirmed via its own GitHub source tree and search-result
      snippets, since the live site itself returned redirect-loop
      errors on every direct fetch attempt) was cross-checked against
      what this docs site already has; two were genuinely new:
      **horizontal-bar-chart** (Chart.js's own `indexAxis: 'y'` option
      on the regular `bar` kind — not a separate chart type at all) and
      **chart-events** (Chart.js's own native `options.onClick`,
      reacting to which bar was clicked via the callback's own second
      argument — no extra prop or Vue event needed, since `options`
      already reaches Chart.js untouched). "Multitype Chart" is that
      project's own name for what this docs site already covers as
      `mixed-chart`, so no new example was needed for that one. Both
      new examples use only built-in Chart.js features, so both are
      live and interactive immediately, matching `bar-chart`'s own
      pattern — neither hits the `registry.ts` dynamic-import gap
      `sankey`/`zoom-plugin` do. `chart-events` cross-links to the
      exposed `chart` ref (`vue/components/props.md`'s own escape-hatch
      section) for anything beyond what an `options` callback covers.
      **Added a Colors-plugin example, at your request, after a real
      correction**: while confirming whether an example existed for
      this, read Chart.js's own bundled source directly and found that
      an earlier claim in `docs/CHARTJS_GENERAL_DOCS_ANALYSIS.md` §2 and
      `vue/guide/concepts/styling.md` was wrong — both had said the
      built-in `Colors` plugin needed explicit `options.plugins.colors.
      enabled = true`, framed as "on by default only in the UMD build."
      Never actually verified at the time; the plugin's own real
      defaults are `{ enabled: true, forceOverride: false }`, confirmed
      directly from source, with no build-type distinction at all — it
      works today with zero configuration. Both docs corrected, the
      correction itself stated plainly rather than silently rewritten.
      New live example (`colors-plugin`, built-in, no extension package,
      live immediately) added to the sidebar, gallery (new entry under
      the existing "Plugins" section, distinguished from `zoom-plugin`
      as Chart.js's own built-in vs. one of this library's 3 official
      opt-ins), and cross-linked from `styling.md`.
      **Verified live in a real browser, at your request, and a real bug
      surfaced in the example itself**: connected to your own Chrome via
      claude-in-chrome, navigated to the actual dev server (not assumed
      working from reading the code), and confirmed the base 2-dataset
      chart renders and auto-colors correctly. Clicking "Add another
      dataset" then showed a real problem: the 3rd dataset appeared in
      the legend but rendered with **no color at all** — confirmed by
      reading the canvas's own actual pixel data directly (no third
      color present anywhere), not guessed from the screenshot alone.
      Root cause, traced to Chart.js's own real `Colors` plugin source
      (already read directly in an earlier pass): its "does any dataset
      already have a color" check looks at *all* datasets together, not
      each one individually — once the first two datasets are colorized
      on mount, that check stays permanently true, so a later update
      adding a brand-new, never-colored dataset is skipped too, not just
      datasets that already have a color. Fixed with `options.plugins.
      colors.forceOverride: true` in the example itself, then **re-
      verified live**: reloaded, added a 3rd dataset (real, distinct
      color), then a 4th (also real, distinct) — both confirmed via
      screenshot. `styling.md` updated with this exact gotcha as its own
      callout, since any consumer whose app adds datasets after a
      chart's first render would hit the identical issue.
      **Added a real, permanent e2e regression test, at your request**:
      the manual browser verification above isn't part of the automated
      suite, and this specific behavior — the Colors plugin's own
      internal "does any dataset already have a color" logic — can only
      be verified against a real, unmocked Chart.js instance; Vue's own
      component tests mock `createChartController` entirely, so no
      component-level test could exercise any of this at all. New
      `colors-plugin-fixture.ts`/`.html` (mounts 2 datasets, adds a 3rd
      ~200ms later, `forceOverride: true` set) and `colors-plugin.spec.ts`
      — the latter needed a new helper, `expectDistinctColorCount`
      (`tests/e2e/helpers/`), since the existing `expectNonBlankCanvas`
      only confirms *some* pixel has color, not that all 3 datasets
      genuinely got their own distinct one. The new helper counts
      distinct colors filtered by pixel-count significance (>50 pixels)
      to collapse anti-aliasing noise at bar edges, matching the same
      frequency-based approach used during the manual pixel-data
      inspection that found the original bug.
      **Confirmed: 60/60 passing** — all 20 spec files × 3 browser
      engines, including the new `colors-plugin.spec.ts`. This makes the
      `forceOverride` fix a permanent, automated regression test, not
      just something confirmed once by hand in a live browser session.
      Phase 6's live-example work for Vue, and this specific real-bug-
      found-and-fixed cycle, are both genuinely closed.
      **Added a Gradient-plugin example, at your request, alongside
      implementing the 4th official opt-in prop itself** (see "Current
      status & open issues" item #13 for the full implementation).
      `gradient-plugin.mdx` written with `live={false}` from the start —
      verified live in a real browser first (rather than assumed), and
      the chart area was found genuinely blank, confirmed via network-
      request inspection that `chartjs-plugin-gradient` was never even
      requested. Same exact signature as the already-known
      `zoom-plugin`/`sankey` hydration gap, not a new bug. Added to the
      sidebar, gallery (new entry under the existing "Plugins" section),
      and cross-linked from a new "Gradients via chartjs-plugin-gradient"
      section in `styling.md`.
      **Added Timestack-scale and Hierarchical-scale examples, at your
      request, alongside implementing those two opt-in props themselves**
      (see "Current status & open issues" items #14/#15 for the full
      implementation). Both `timestack-scale.mdx`/`hierarchical-scale.mdx`
      written with `live={false}` from the start this time — verified
      live in a real browser first for each, and both were found
      genuinely blank, confirmed via network-request inspection that
      neither `chartjs-scale-timestack` nor `chartjs-plugin-hierarchical`
      was ever requested. Same exact signature as the already-known
      `zoom-plugin`/`sankey`/`gradient-plugin` hydration gap, not a new
      bug. Both added to the sidebar and gallery (new entries under the
      existing "Plugins" section).
- [ ] SEO/meta parity with `keystone-dashboard-layout`'s docs site
      (canonical URLs, OG/Twitter tags, JSON-LD) — domain confirmed as
      `kcw.winnem.tech` (already updated in `astro.config.mjs`'s `site:`
      field, `index.astro`'s canonical link, and every package's own
      `homepage` field); OG/Twitter tags and JSON-LD structured data still
      need adding, not just the domain swap.

## Phase 7 — Release

- [ ] semantic-release + `semantic-release-monorepo`, matching
      `keystone-dashboard-layout`'s root `package.json` devDependencies.
- [ ] Confirm publish scope/visibility for all three framework packages (this
      plan assumes public, unscoped npm packages under the exact names given
      at kickoff: `keystone-chartjs-vue`, `keystone-chartjs-react`,
      `keystone-chartjs-angular`).
      **Resolved, at your explicit direction**: `keystone-chartjs-core`
      is never published standalone — it's imported directly into each
      framework package and bundled into their own `dist` output at
      build time. This is a real, deliberate departure from KDL's own
      precedent (KDL publishes its own core standalone,
      `keystone-dashboard-layout-core`), not an oversight — the earlier
      "private/workspace-internal" note under this bullet already
      correctly described the *current* state; this now settles the
      *intended final* state too, closing the open question.
      **Confirmed and implemented for Vue and React**: both packages'
      own `vite.config.ts` no longer lists `keystone-chartjs-core` in
      `rollupOptions.external` (Rollup bundles it into the built
      `dist/` output directly); `keystone-chartjs-core` moved from
      `dependencies` to `devDependencies` in both `package.json` files
      (still `workspace:*`, needed at build time only — no longer a
      real runtime dependency an external consumer needs installed).
      **Still genuinely open for Angular**: `ng-packagr` doesn't work
      like Rollup here — Angular's own library-build convention treats
      *every* non-relative import as external by default, with no
      direct "bundle this one workspace dependency" option the way
      `rollupOptions.external` provides. Actually inlining
      `keystone-chartjs-core`'s own source into `packages/angular`'s
      built output likely needs a different mechanism entirely (e.g. a
      build-time copy step, or restructuring so core's own source
      files are directly part of Angular's own `src/` tree rather than
      a separate workspace package) — deliberately left unresolved here
      rather than guessed at, since Phase 4 (Angular) hasn't started
      yet and this deserves its own careful solution when it does, not
      a rushed one now. `keystone-chartjs-core` stays a regular
      `dependency` in `packages/angular/package.json` for the time
      being, pending that decision.
      **Also confirmed and implemented across all three framework
      packages**: `chart.js` moved from `dependencies` to
      `peerDependencies` (kept in `devDependencies` too, needed for
      local building/testing) — see this doc's own top-level
      architecture-decisions section for the full reasoning (global
      Chart.js registration state, matching vue-chartjs's own
      established convention). Each framework package's own source
      (`useChartController.ts`/`Chart.tsx`/`keystone-chart.component.ts`)
      now imports `ChartConfiguration`/`ChartJs` from
      `keystone-chartjs-core` (which re-exports them from `chart.js`
      itself, added in `packages/core/src/types.ts`) rather than
      importing them from `'chart.js'` directly in three separate
      places.
      **Next action for you**: run `turbo run typecheck` across all four
      packages, then `pnpm --filter keystone-chartjs-core test:unit`
      (then `test:coverage`/`test:mutation` if clean) and `pnpm --filter
      keystone-chartjs-vue test:component` (then `test:coverage`/
      `test:mutation` if clean) to confirm this real change to already-
      closed Phase 1/2 code didn't regress anything — the change itself
      is purely additive (new type re-exports, an import-source swap,
      and build-config/package.json edits, no logic changes), but
      confirming beats assuming, same as every other step in this
      project.

## Cross-cutting acceptance bar (every phase)

- ESLint + Prettier clean (`turbo run lint`).
- `turbo run typecheck` clean across all four packages.
- **≥90% test coverage (statements/branches/functions/lines) in every
  package** — enforced via `coverage.thresholds` in each package's own
  `vitest.config.ts` (or `vite.config.ts` for vue/react), not just an
  aspirational number: `test:coverage` fails the run if any metric dips
  below 90 in any package. This is a floor, not a ceiling — exceeding it
  is fine and expected once real logic lands.
- No phase is considered done until its own test tier (unit → component →
  e2e → mutation) is green — don't move to the next phase on partial credit,
  per the pattern already established in `keystone-grid`'s and
  `keystone-dashboard-layout`'s own completed work logs.
