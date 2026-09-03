# Chart.js "General" Docs — Wrapper Implications

Source: https://www.chartjs.org/docs/latest/general/{accessibility,colors,
data-structures,fonts,options,padding,performance}.html and
https://www.chartjs.org/docs/latest/configuration/ (the left-sidebar
"Configuration" overview), fetched Sept 2026. For each topic: does Chart.js
handle it entirely on its own (transparent passthrough, no wrapper code
needed), or does our own wrapper need to do something — and if so, is that
a `packages/core` concern (shared, framework-agnostic) or a framework-level
concern (needs parity across Vue/React/Angular once implemented)?

## Summary table

| Topic | Chart.js handles it alone? | Wrapper action needed? | Level |
|---|---|---|---|
| Accessibility | No — explicitly the consumer's job | **Was a real gap — now resolved for Vue** | Framework (Vue done; React/Angular still need it) |
| Colors | Yes | No | — |
| Data structures | Yes | Verify only (see below) | — |
| Fonts | Yes | No | — |
| Options (resolution) | Yes | No | — |
| Padding | Yes | No | — |
| Performance | Mostly yes | One niche item to note | — |
| Inline `plugins` array (from Configuration overview) | No — needs a real config field | **Was a real gap — now resolved** | **Core** (fixed once, all 3 frameworks benefit) |

Both genuine, actionable gaps this pass found have since been fixed —
see each section below for how. Everything else was already transparent
passthrough (`data`/`options` reach Chart.js untouched today, confirmed
by this project's own architecture) or a documentation-only topic worth
an example page, not a code change.

## 1. Accessibility — was a real gap, framework-level; **now resolved for Vue**

Chart.js's own docs are explicit: `canvas` accessibility is entirely on the
consumer. Chart.js does nothing automatically — accessibility must be added
via ARIA attributes on the `<canvas>` element itself, or via fallback
content placed between the opening/closing canvas tags (for browsers/
assistive tech that can't render canvas at all).

- **Current state**: **resolved for Vue.** `Chart.vue` now has a `<slot>`
  inside the `<canvas>` tags for real fallback content, confirmed via a
  dedicated component test. ARIA-attribute forwarding needed no code
  change at all — confirmed via a real test that Vue's own default
  single-root-component fallthrough behavior already handles it. React
  and Angular don't have either mechanism yet; each needs its own
  equivalent once their real components are built (Phases 3/4).
- **This is the same gap already flagged in
  `VUE_CHARTJS_FEATURE_INVENTORY.md`** (comparing against vue-chartjs's own
  confirmed `ariaLabel`/`ariaDescribedby` props + fallback-content slot) —
  this Chart.js-docs pass independently confirms it's a real Chart.js-level
  concern too, not just a vue-chartjs-parity nice-to-have.
- **Two distinct mechanisms, two distinct fixes — both now implemented
  for Vue**:
  1. **ARIA attributes** (`aria-label`, `role="img"`, `aria-describedby`) —
     these are plain HTML attributes on the `<canvas>` tag itself.
     **Confirmed via a real component test**: Vue 3's own "fallthrough
     attributes" behavior means `Chart.vue` (a single-root component)
     already forwards any attribute the consumer passes that isn't a
     declared prop straight onto the root `<canvas>` element, with zero
     code changes needed — `<Chart aria-label="Revenue chart">` works
     today. React and Angular would each need their own equivalent
     confirmation (React: spreading unknown props onto the canvas ref;
     Angular: attribute binding to the native element) — not necessarily
     the same amount of work in each framework, and neither is done yet.
  2. **Fallback content** (`<p>Hello Fallback World</p>` *inside* the
     canvas tags) — this is real child content, not an attribute, so it
     needed an explicit mechanism regardless of fallthrough behavior:
     `Chart.vue` now has a `<slot>` for exactly this, confirmed via a
     dedicated test. React (`children` prop) and Angular (`<ng-content>`)
     still need their own equivalent.
- **Level**: framework, not core — the `<canvas>` element itself is
  rendered inside each framework package's own component; core has no DOM
  knowledge at all (`createChartController` receives an
  already-existing canvas element as a parameter). If implemented for one
  framework, the same capability should exist in all three for parity,
  but the actual code (a slot vs. a children prop vs. ng-content) is
  necessarily framework-specific, not something core can provide once for
  everyone.

## 2. Colors — no wrapper action needed, and now fully verified

Entirely `backgroundColor`/`borderColor` (datasets) and `color` (text) —
plain `options`/dataset fields, or Chart.js's own built-in `Colors` plugin
(`import { Colors } from 'chart.js'; Chart.register(Colors)`). All of this
already flows through untouched via this project's own `data`/`options`
passthrough.

- **Confirmed by reading Chart.js's own real bundled source directly**
  (not assumed, and correcting an earlier, unverified claim in this same
  section — see below): `Colors` is part of the `plugins` group inside
  Chart.js's own `registerables` array (`Colors: plugin_colors`), which
  `registry.ts` already calls `Chart.register(...registerables)` on,
  unconditionally, at module load — so it's already registered for every
  consumer of this project's packages, today, with zero code needed.
  **Further confirmed: it's also enabled by default**, not just
  registered — the plugin's own real defaults are `{ enabled: true,
  forceOverride: false }`, read directly from its own source. A consumer
  gets automatic dataset coloring for free, unless their own data already
  specifies colors (in which case the plugin's own `beforeLayout` hook
  checks for that and skips applying anything, unless `forceOverride` is
  set).
  **This corrects an earlier version of this exact section**, which
  speculated (without checking) that "registration and enabled are
  separate concerns... on by default only in the UMD build, not the
  tree-shakeable ESM build this project uses" — that claim was never
  verified against the real source and turned out to be wrong for this
  project's own real Chart.js version (4.5.1): the plugin's own defaults
  don't distinguish build type at all.

## 3. Data structures — no wrapper action needed, one thing worth verifying

Chart.js's own built-in kinds already accept several `data` shapes
natively: `Primitive[]` (plain numbers, paired with a `labels` array),
`Array[]` (`[x, y]` tuples), `Object[]` (`{x, y}` pairs, including custom
keys via `options.parsing.xAxisKey`/`yAxisKey`), and even a plain `Object`
(`{January: 10, February: 20}`). All of this is native Chart.js behavior,
already covered by `DefaultDataPoint<ChartType>` (Chart.js's own real
type, used directly in `packages/core/src/types.ts`'s own `ChartConfigData`
today) for the 8 built-in kinds.

- **Worth double-checking, given this exact area's own recent history**:
  the `ChartConfigData`/`ExtensionData` type-widening work (done earlier
  in this project to fix real `vue-tsc` errors for the 7 extension kinds)
  got the array-nesting wrong on a first attempt and needed a real
  correction — worth one targeted check that none of these native
  built-in-kind data shapes were narrowed as a side effect of that fix,
  since `DefaultDataPoint<ChartType>` itself was untouched (only the
  *union it's combined with*, `ExtensionData`, changed), this is likely
  fine, but "likely fine" isn't the same as confirmed given the track
  record here.

## 4. Fonts — no wrapper action needed

`Chart.defaults.font.*` is a **global** setting (mutates a shared,
module-level Chart.js object) — not something that makes sense as a
per-component prop, since setting it via one `<Chart>` instance would
affect every other chart on the page too. A consumer who wants this can
already do it directly via the `ChartJs` type this project already
re-exports from `keystone-chartjs-core` (`ChartJs.defaults.font.size =
16`). Per-option `font: {...}` inside `options` is plain passthrough.

- The one edge case Chart.js's own docs call out (a chart needing to
  re-render once a not-yet-loaded font finishes loading, via the
  browser's own Font Loading API) needs no wrapper support either — a
  consumer can already call `.update()` on this project's own exposed
  `chart` ref themselves once their own font-loaded promise resolves.

## 5. Options (resolution) — no wrapper action needed

Purely Chart.js's own internal cascading-options algorithm (chart-level →
dataset-level → scale-level → plugin-level, scriptable/indexable options,
option context). Entirely transparent to this project's own `options`
passthrough — nothing here needs any wrapper-level code. A genuinely
useful topic for a docs-site guide page (linking to or summarizing Chart.js's
own resolution order), but not a code-level gap.

## 6. Padding — no wrapper action needed

Purely `options.layout.padding` (number, `{top,left,bottom,right}`, or
`{x,y}` shorthand) — plain passthrough, no wrapper involvement.

## 7. Performance — no wrapper action needed, one niche item worth naming

Nearly everything here (`parsing: false`, `normalized: true`, the
decimation plugin, `animation: false`, scale `min`/`max`, `spanGaps`,
`showLine`, `pointRadius`) is a pure `options`/dataset-field tip — already
transparent passthrough.

- **Web Workers / OffscreenCanvas**: Chart.js's own docs confirm the
  `Chart` constructor accepts an `OffscreenCanvas` in place of a real
  `HTMLCanvasElement`, for rendering off the main thread. **Worth
  checking, not yet done**: whether `createChartController`'s own
  parameter type (`packages/core/src/controller.ts`) is currently typed
  as `HTMLCanvasElement` specifically, which would block this at the
  type level even if the runtime code would otherwise tolerate it. Given
  no framework naturally hands a component an `OffscreenCanvas` from a
  template ref anyway (a consumer would need to call
  `canvas.transferControlToOffscreen()` themselves, well outside any of
  the three components' own normal lifecycle), this is real but niche —
  worth a documented "not currently supported" note rather than urgent
  work.
- Babel `loose` mode: not applicable — this project's own framework
  packages build with Vite/Rollup, not Babel.

## 8. Inline `plugins` array — was a real gap, core-level; **now resolved**

Chart.js's own top-level `ChartConfiguration` shape (confirmed both from
the Configuration-overview page and from Chart.js's own real type
declarations, read directly in an earlier pass of this project) is:

```ts
{ type, data, options, plugins }
```

`plugins` here is a real, distinct field — an array of **inline,
per-chart-instance** plugin objects (Chart.js's own `Plugin<TType>[]`
type), as an alternative to registering a plugin globally via
`Chart.register(...)`. This is different from this project's own 3
official-plugin opt-in props (`zoom`/`annotation`/`dataLabels`), which
handle *registering a known, named package* and merging its config into
`options.plugins.<id>` — it has no mechanism at all for a consumer to pass
their own **custom, inline** Chart.js plugin object.

- **Fixed**: `ChartUpdatePayload` in `packages/core/src/types.ts` gained
  a `plugins?: ChartConfiguration['plugins']` field; `controller.ts`
  threads it through to the real `Chart` constructor untouched, the same
  way `options` already does. A changed `plugins` reference forces a
  destroy-and-reconstruct (Chart.js only reads this field at construction
  time) — confirmed via dedicated unit tests, including two added after a
  real Stryker mutation run surfaced survivors in the new recreate
  branch's own `ResizeObserver` rewiring. `packages/vue`'s own `Chart.vue`
  and `useChartController.ts` expose this as a `plugins` prop.
- **Level: core, not framework** — unlike accessibility (where the actual
  DOM/slot mechanism is inherently framework-specific), this is a single,
  shared data field that flows straight through core's own existing
  mount/update logic exactly the same way `options` already does, with no
  framework-specific behavior needed at all. Once added to
  `ChartUpdatePayload` and threaded through `controller.ts`'s own
  `new Chart(...)`/`handle.update(...)` calls, exposing it as a `plugins`
  prop in Vue/React/Angular is a small, mechanical, identical addition in
  each — much more core-driven than accessibility's own gap.
- **Real, not hypothetical use case**: any Chart.js plugin not published
  as one of the 3 officially-supported ones this project ships (a
  consumer's own custom plugin, or a community plugin outside this
  project's own scope) currently has no way to be used with this
  project's `<Chart>` component at all.

## Recommendation

- Both real gaps this pass found (#1 accessibility, #8 inline `plugins`)
  are now fixed — #8 at the core level (all 3 frameworks benefit
  automatically), #1 for Vue specifically (React/Angular still need their
  own equivalent once built).
- Everything else (#2–7) needs no code change — worth pulling a few of
  these into the docs site as guide pages or example annotations (Colors'
  built-in plugin, Options' resolution order, Performance's tips) since
  they're genuinely useful reference material for consumers even though
  they require zero wrapper-level work.
