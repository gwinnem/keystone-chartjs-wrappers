# Annotation Plugin Local-Port Plan

Companion to `CHARTJS_ANALYSIS.md` §4 and `docs/ZOOM_PLUGIN_PORT_PLAN.md`
(the port whose real scope this one exceeds, and whose own plan
structure this one follows). **Not yet started** — written to capture
the real scope/decisions found while scoping this out, so the work can
be picked up later without re-deriving any of it.

## Why this exists

At the user's explicit request: port `chartjs-plugin-annotation`
directly into `packages/core/src/`, the same way `chartjs-plugin-zoom`/
`chartjs-plugin-gradient`/`chartjs-plugin-image-label`/`chartjs-plugin-
hierarchical`/`chartjs-plugin-autocolors`/`chartjs-plugin-deferred` were
— real source dissected from the actual package (this one ships real
`src/`, confirmed directly from the real GitHub repo, not just a
minified bundle), fixing any real bugs found along the way, avoiding the
docs-site dynamic-import hydration gap (item #4 in
`IMPLEMENTATION_PLAN.md`) since local code has no `import()` for that
gap to apply to.

## Scope comparison — why this is bigger than every port done so far, `zoom` included

Real source read directly from the actual repository
(`github.com/chartjs/chartjs-plugin-annotation`, confirmed `src/`
exists and ships real, readable files — not a minified bundle):

| | `zoomPlugin.ts` (done, previously the largest port) | `chartjs-plugin-annotation` (this plan) |
|---|---|---|
| Real installed dist size | ~56 KB (this project's own ported file, including docs) | **91 KB** (dist, unminified) — confirmed directly, the largest of any plugin this project has looked at |
| File count | 1 file | **1 orchestrator (`annotation.js`, 272 lines) + 6 real annotation-type files (`types/{line,box,ellipse,point,label,polygon}.js`) + a doughnut-label special case + a dedicated `events.js`** — confirmed directly from the real, current `src/annotation.js`'s own imports (`'./types/box'`, `'./types/line'`, `'./types/ellipse'`, `'./types/point'`, plus label/polygon per the README's own documented feature list) |
| Registration mechanism | supplied per-chart-instance via the inline `plugins` array | **each annotation type registers as a real Chart.js *element*** (`Chart.register(annotationTypes)` inside the plugin's own `afterRegister()` hook) — meaning every type needs to be a proper element subclass (`resolveElementProperties`, `draw`, `inRange`/hit-testing, and — for types with a label sub-element — `drawLabel`), not just a plain object |
| Option resolution | plain object merge | uses Chart.js's own **internal, advanced option-resolution machinery** (`_fallback`, `_scriptable`, `additionalOptionScopes`, per-type `defaults`/`defaultRoutes`) — confirmed directly from `resolveAnnotationOptions()`/`resolveObj()` in the real source; this is not a simple "spread the given config" merge the way every other plugin ported so far has been |
| Scale interaction | none | **automatically extends an axis's own min/max** to fit annotation values that would otherwise fall outside it (`adjustScaleRange`/`getScaleLimits`, hooked into `afterDataLimits`) — a real, distinct interaction with Chart.js's own layout pass, a new category of behavior no prior port has needed |
| Interaction/events | real DOM `wheel`/`mouse*`/`pointer*` events, own state machine | **no direct DOM events at all** — routes entirely through Chart.js's own `beforeEvent` hook, using `options.interaction` (`nearest`/point mode) to hit-test which annotation element a chart-level mouse/click event landed on, then dispatches `click`/`enter`/`leave` callbacks per annotation (confirmed via `events.js`'s own `handleEvent`/`updateListeners`/`handleMoveEvents`/`handleClickEvents`) — genuinely different mechanism from `zoom`'s own raw DOM-event approach, not a smaller version of it |
| Drag-to-reposition | n/a | **not part of this package at all** — confirmed via research: draggable/movable annotations are a *separate*, third-party add-on package (`chartjs-plugin-draggable`, or newer community forks like `chartjs-plugin-annotation-drag2`), not a feature `chartjs-plugin-annotation` itself ships. Worth stating plainly since the annotation types' own real interaction surface (click/enter/leave hit-testing) could easily be mistaken for drag support at a glance — it isn't |
| Chart.js plugin hooks used | 8 (`start`, `beforeEvent`, `beforeUpdate`, `beforeDatasetsDraw`, `afterDatasetsDraw`, `beforeDraw`, `afterDraw`, `stop`) | **9, a different set**: `afterRegister`, `afterUnregister`, `beforeInit`, `beforeUpdate`, `afterDataLimits`, `afterUpdate`, `beforeDatasetsDraw`, `afterDatasetsDraw`, `beforeDraw`, `afterDraw`, `beforeEvent`, `destroy` (12 total, several more than `zoom`'s own 8) |
| External dependency | `hammerjs` (later removed by the port) | **none** — confirmed directly from the real package's own `package.json`; only a real `chart.js` peer dependency |
| Per-chart state | `WeakMap` (drag/pan bookkeeping) | a plain `Map` in the real source (`chartStates`) — **the identical `destroy`-hook-name bug already found and fixed in `gradientPlugin.ts`/`deferredPlugin.ts`'s own ports is present here too**: the real source's own teardown hook is named `destroy`, which Chart.js's real `Plugin` interface doesn't recognize (only `beforeDestroy`/`afterDestroy` exist) — confirmed directly from the dissected source shown above (`destroy(chart) { chartStates.delete(chart); }`). This port should rename it to `afterDestroy`, the third time this exact class of bug has been found across this project's ports, and should also switch the plain `Map` to a `WeakMap` (matching `deferredPlugin.ts`'s own already-made improvement) so a chart that somehow never reaches its teardown hook doesn't leak its own state entry forever |

## What the six annotation types each need, concretely

Confirmed from the real source and the plugin's own documented
per-type option pages (`docs/guide/types/*.md` in the real repo) — each
type is its own real element subclass, not a config variant of one
shared shape:

- **`line`** — a straight line at a fixed scale value (or between two),
  horizontal or vertical depending on which axis it's bound to; supports
  an optional attached label.
- **`box`** — a rectangle bound by `xMin`/`xMax`/`yMin`/`yMax` (any axis
  omitted expands to the chart's own edge); supports an attached label.
- **`ellipse`** — an ellipse bound the same way as `box`.
- **`point`** — a fixed-radius marker at a single `{x, y}` (or scale-
  value) position.
- **`label`** — a standalone text/image/canvas label with its own real
  positioning system (`position` as a keyword/percentage per axis,
  `xAdjust`/`yAdjust`, callout support connecting the label to a target
  point) — confirmed as its own genuinely non-trivial geometry, not a
  simple text draw.
- **`polygon`** — an arbitrary closed shape from a real point list
  (`sides`/`radius`/rotation-based regular polygon, or an explicit point
  array).
- **`doughnutLabel`** (a related, special-cased type, not one of the
  "core" six) — draws content in the center hole of a doughnut chart,
  confirmed from the README's own separate callout ("Furthermore you
  can use a doughnut label annotation...").

Each of the four box-like/line-like types (`line`/`box`/`ellipse`/
`point`) that support an attached `label` shares real label-drawing
logic with the standalone `label` type itself (confirmed via
`annotation.js`'s own `'drawLabel' in el`, `el.drawLabel(ctx,
chartArea)` calls in its `draw()` function) — worth designing as shared
logic from the start rather than duplicating per type, the same
"dissect for real shared structure before writing" approach
`hierarchicalScale.ts`'s own port already used successfully.

## Open decisions — need your call before implementation starts

1. **Full six-type port, or a smaller first slice?** Given the real
   size difference above, porting all six types plus `doughnutLabel` in
   one pass is a substantially bigger unit of work than any prior port
   (including `zoom`). A real, honest alternative: port `line`/`box`
   first (the two most commonly used, and confirmed to share the most
   structure with the standalone `label` type), ship that, then add
   `ellipse`/`point`/`polygon`/`doughnutLabel` as a clearly-scoped
   follow-up — mirroring how `deferred` itself was first added as a
   dependency then ported in a distinct, later step. Not decided here;
   flagging the option rather than defaulting silently.
2. **`AnnotationPluginOptions` typing.** Currently deliberately loose
   (`{ annotations: Record<string, unknown> }`, per `types.ts`'s own
   doc comment) — matching the "full plugin-specific typing is Phase 5
   scope" pattern this project has used for every still-loosely-typed
   plugin option. A real, precise discriminated union (keyed off each
   annotation's own `type` field, one member per one of the six types)
   is possible once the real per-type option shapes are dissected here,
   but is itself a real, separate scope decision — worth deciding
   whether this port also tackles that typing work, or leaves it loose
   for now the way it's stayed since the original v1 scope decision.
3. **Scale-range auto-adjustment (`afterDataLimits`)** is a real,
   distinct interaction with Chart.js's own scale/layout system no
   prior port has touched — worth confirming this behavior is actually
   wanted/expected before porting it silently, since a consumer who
   didn't realize an annotation could expand their own axis's range
   might be surprised by it. (The real package does this by default,
   with no opt-out short of setting explicit `min`/`max`/`suggestedMin`/
   `suggestedMax` on the scale itself — confirmed from
   `adjustScaleRange`'s own guard clauses.)

## Step-by-step plan (mirrors the zoom/hierarchical ports' own real structure, adjusted for six types)

1. **Dissect the real source in full** — this plan pulled
   `src/annotation.js` (272 lines, the orchestrator) directly; each of
   the six `src/types/*.js` files, `src/events.js`, and any shared
   `src/helpers.js`-style utility file still need their own real,
   line-by-line read before writing any port code, the same rigor
   every prior port used (e.g. `hierarchicalScale.ts`'s own
   `src/{model,utils}.ts`/`src/{scale,plugin}/hierarchical.ts` read).
2. **New files, one per real type, not one giant file** — given the
   real size here, mirror the original's own `src/types/` split rather
   than following `zoomPlugin.ts`'s single-file precedent:
   `packages/core/src/annotationPlugin/` with `line.ts`, `box.ts`,
   `ellipse.ts`, `point.ts`, `label.ts`, `polygon.ts`,
   `doughnutLabel.ts`, `events.ts`, and an `index.ts` orchestrator
   mirroring the real `annotation.js`. A header comment on the
   orchestrator file should state the real source version ported from,
   which decision was made on open items #1/#2 above, and the real
   `destroy`-vs-`afterDestroy` bug fixed (matching every prior port's
   own header-comment convention).
3. **`types.ts`**: resolve open decision #2 above before writing this
   step for real — either keep `AnnotationPluginOptions` loose (no
   change needed) or model the real discriminated union now that the
   per-type shapes are fully dissected.
4. **`plugins.ts`**: rewrite `withAnnotation` to register the six (or
   fewer, per open decision #1) annotation types directly via a real,
   synchronous `Chart.register(...)` call inside the port's own
   `afterRegister()` hook (matching the original's own real mechanism,
   and this project's own `withHierarchical`/`withAutocolors`/
   `withDeferred` registration shape) — no more dynamic `import()`/
   `mod.default ?? mod` fallback. Config still merges into
   `options.plugins.annotation`, unchanged from today's real shape.
5. **Core unit tests**: split per real file, matching the multi-file
   structure above — `tests/unit/annotationPlugin/{line,box,ellipse,
   point,label,polygon,doughnutLabel,events}.spec.ts`, each covering its
   own file's real logic directly, plus `plugins.spec.ts`'s own
   `withAnnotation` describe block updated for the new registration
   shape. Expect this tier to be the largest of any plugin ported so
   far, given the real scope above — `zoomPlugin.spec.ts`'s own 194
   tests is the closest prior benchmark, and this plugin has more real
   files and more real per-type geometry/hit-testing logic to cover
   than `zoom`'s own single, event-focused file did.
6. **`stryker.config.mjs`**: add every new file under
   `src/annotationPlugin/` to `mutate`.
7. **Vue component tests**: `Chart.spec.ts`'s existing `annotation` prop
   tests need re-checking against the new registration mechanism —
   the prop's own public contract (`annotation?: AnnotationPluginOptions`,
   config-object required, no boolean form) is unchanged.
8. **e2e**: the existing `annotation-plugin.spec.ts`/
   `annotation-fixture.ts` already exercise real rendering against the
   *dependency* version — re-run against the ported version to confirm
   parity, then flip `annotation-plugin.mdx` from `live={false}` to
   `live={true}` once confirmed live in a real browser (the docs-site
   dynamic-import hydration gap this plugin currently hits goes away
   entirely once it's local code, the same outcome every prior port
   reached).
9. **`package.json`**: remove `chartjs-plugin-annotation` from
   `packages/core/package.json`'s own `dependencies` once the port is
   confirmed working end-to-end.
10. **Docs**: `CHARTJS_ANALYSIS.md` §4 (a new "Added after v1 kickoff:
    Annotation (later locally ported...)" section, following the exact
    structure every prior port's own section already uses — package/
    version/purpose table, the real bug found and fixed, the real
    registration-shape comparison, live-in-browser confirmation, test
    coverage summary), `CHARTJS_AWESOME_PLUGINS.md` (annotation already
    isn't a survey candidate, but its own cross-references to "still-
    dependency-based plugins" need updating down from 2 to 1 —
    `dataLabels` alone, if that port hasn't also landed by then),
    `docs/site/.../vue/api/plugins.md` (rewrite the "Annotations" row/
    section for the port, update every "one of six/seven live plugins"
    cross-reference elsewhere in that file and in `examples.mdx`),
    `IMPLEMENTATION_PLAN.md` (a new numbered item matching #22's own
    structure), and the three `CHANGELOG.md`/two `README.md` files'
    own plugin lists and dependency-vs-port counts.

## Real risks/unknowns worth flagging before starting

- **The real per-type option resolution system** (`_fallback`,
  `_scriptable`, `additionalOptionScopes`, `resolveObj`) is Chart.js's
  own internal, semi-documented machinery — confirming this port can
  actually call into it correctly (rather than needing to reimplement a
  parallel version) needs real experimentation against the installed
  `chart.js` package's own actual behavior, not just reading its public
  type declarations the way every prior port's own type-checking has
  relied on.
- **Six real element classes is a much larger surface for hit-testing
  correctness** (`inRange`-style geometry per type) than anything ported
  so far — `label`'s own position/callout system in particular is
  real, non-trivial 2D geometry, closer in kind to `hierarchicalScale.ts`'s
  own span-logic subtlety (which needed a dedicated coverage-hardening
  pass) than to any single-purpose plugin ported before it.
- **`doughnutLabel` interacts with a different chart kind entirely**
  (doughnut, not line/bar/scatter/bubble like the other six) — worth
  confirming during the real dissection whether it's cleanly separable
  from the other six types' own shared code, or whether it has its own
  real, separate registration/lifecycle quirks not yet uncovered by this
  plan's own research.
- **Given the real scope difference confirmed above, this port alone is
  a bigger undertaking than the `zoom` port was** — worth treating as
  its own multi-session effort rather than assuming it fits in the same
  single-turn shape every prior port (including `deferred`, `zoom`, and
  `hierarchical`) has fit into so far.
