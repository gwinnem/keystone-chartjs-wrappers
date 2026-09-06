---
title: Troubleshooting & FAQ
description: Common problems and their real causes — blank charts, stuck updates, TypeScript errors, and more.
---

## The chart doesn't render at all (blank canvas)

Almost always a sizing problem, not a data problem: `<canvas>` has no
intrinsic size of its own, so an unconstrained parent element collapses
to zero height and the chart draws into nothing. Give the parent a
real, defined height:

```vue
<div style="height: 320px;">
  <Chart type="line" :data="data" :options="{ maintainAspectRatio: false }" />
</div>
```

See [Recipes → Responsive sizing](/vue/guide/recipes#responsive-sizing)
for the full pattern. If sizing isn't the issue, check the browser
console next — a missing/misshapen `data` object throws a real, visible
Chart.js error rather than failing silently.

## An ecosystem-extension chart kind (`sankey`, `treemap`, etc.) doesn't render

These 7 kinds (`candlestick`, `ohlc`, `boxplot`, `violin`, `matrix`,
`sankey`, `treemap`) are lazily registered — the backing package is
dynamically imported the first time a chart of that kind actually
mounts. If that import fails (a missing dependency, a bundler
misconfiguration), Chart.js throws a real, visible
`"<kind>" is not a registered controller` error. Confirm the relevant
package (see [Chart kinds](/vue/api/chart-kinds) for which one backs
which kind) is actually installed alongside `keystone-chartjs-vue`, not
just `chart.js` itself.

## Changing `data`/`options` doesn't seem to update the chart

Check whether you're mutating in place or replacing the reference —
both are diffed correctly (Vue's own reactivity tracks in-place
mutation of a `reactive()` object, or a changed `ref()` value equally
well), so this is almost always something else:

- **A `type` change is expected to be more disruptive than a normal
  update.** A changed top-level `type` prop destroys and reconstructs
  the whole chart rather than updating in place — if you're toggling
  `type` and *also* expecting a smooth transition, that's real Chart.js
  behavior (a `bar` chart and a `sankey` chart have no shared internal
  state to update between), not a bug.
- **A changed `plugins` array reference also destroys and
  reconstructs** — Chart.js only ever reads `plugins` at construction
  time, so there's no in-place path for it at all. Keep that array's own
  reference stable (a top-level `const`, not a fresh array literal
  computed on every render) unless you actually want a full rebuild.
- **Confirm the prop is actually reactive.** A plain, non-reactive JS
  object reassigned via `someObject.data = newData` outside Vue's own
  reactivity system won't trigger anything — wrap it in `ref()`/
  `reactive()`.

## "Canvas is already in use" error

A real Chart.js error, not specific to this wrapper — it means a
previous `Chart` instance on the same `<canvas>` element was never
destroyed before a new one was constructed. If you're seeing this,
it's almost always from mixing this library's own managed lifecycle
with a *second*, manually-constructed `new Chart(...)` against the
same canvas somewhere else in your code — let `<Chart>` own the
canvas's lifecycle entirely rather than constructing your own instance
alongside it.

## TypeScript errors on plugin options

`AnnotationPluginOptions`/`DataLabelsPluginOptions`/`AutocolorsPluginOptions`/
`DeferredPluginOptions` are deliberately loose today (not a precise,
full mirror of each plugin's own much larger option surface — see
[Plugins](/vue/api/plugins)), so passing a genuinely-supported option
that TypeScript doesn't recognize is a real, known gap, not a sign
you're using the prop wrong. `ZoomPluginOptions`/`ImageLabelPluginOptions`
are modeled precisely, since both are local ports with a fully-known
surface. If a loose type is rejecting something Chart.js itself
accepts, a targeted `as` cast on that one field is the pragmatic
workaround until full typing lands.

## Do I need to call `Chart.register(...)` myself?

No, for any of the 10 official plugins or 15 chart kinds this library
covers — registration is automatic (eager for the 8 built-ins, lazy
and on-first-use for the 7 extension kinds and all 10 plugins). You
only need Chart.js's own `Chart.register(...)` if you're using a
custom or community plugin outside those 10 via the separate
[`plugins` prop](/vue/components/props#custom-inline-plugins) — that
prop passes plugin objects straight through to Chart.js untouched,
with no automatic registration step of its own.

## Where do I ask something not covered here?

[Open an issue on GitHub](https://github.com/gwinnem/keystone-chartjs-wrappers/issues) —
include your `type`, a minimal `data`/`options` shape, and which
package versions (`keystone-chartjs-vue`, `chart.js`) you're on.
