---
title: Colors, fonts & padding
description: Styling a chart — dataset colors, the built-in Colors plugin, gradients, global/per-option fonts, and layout padding.
---

Everything on this page is plain Chart.js `options`/dataset-field
configuration — it reaches Chart.js untouched via `<Chart>`'s own `data` and
`options` props. Nothing here is specific to this library.

## Colors

Two kinds of color: geometric (`backgroundColor`/`borderColor`, on
datasets or elements) and textual (`color`, for text). If unset, Chart.js
falls back to its own global defaults (`rgba(0, 0, 0, 0.1)` for
background/border, `#666` for text).

### Per-dataset colors

```js
datasets: [
  { label: 'A', data: [...], borderColor: '#36A2EB', backgroundColor: '#9BD0F5' },
  { label: 'B', data: [...], borderColor: '#FF6384', backgroundColor: '#FFB1C1' },
];
```

### The built-in `Colors` plugin

If you'd rather not set colors on every dataset yourself, Chart.js ships a
`Colors` plugin that cycles through 7 built-in brand colors automatically
whenever a dataset doesn't specify its own — see the
[Colors plugin example](/vue/examples/colors-plugin) for a live,
interactive version. It's part of Chart.js's own core package
(`registerables`), which this library already registers eagerly at module
load — **confirmed directly from Chart.js's own real source: it's both
registered and enabled by default** (the plugin's own defaults are
`{ enabled: true, forceOverride: false }`), so datasets without their own
explicit colors already get automatic coloring with zero configuration on
your part.

It only backs off automatically if your data already specifies real colors
(checked via the plugin's own internal `beforeLayout` hook) — to force
auto-coloring even then, or to disable it entirely, set it explicitly:

```js
const options = {
  plugins: {
    colors: {
      // If your data changes at runtime and you want colors reassigned
      // even when a dataset already has one from a previous render:
      forceOverride: true,
      // Or, to turn automatic coloring off entirely:
      // enabled: false,
    },
  },
};
```

:::caution[Adding new datasets after mount needs `forceOverride: true`]
Confirmed via a real, live test of the example above: the plugin's own
"already has colors" check looks at **all** datasets together, not each
one individually. Once your first render colorizes any dataset, that
check stays true forever — so a *later* update that adds a brand-new
dataset (one that's never had a color at all) still gets skipped, and
its own bars render with no color, not just "the same color as before."
If your app ever adds datasets after the chart's first render (the
[Colors plugin example](/vue/examples/colors-plugin) does exactly this),
set `forceOverride: true` from the start, or the new dataset won't be
colored at all.
:::

### Color formats

Hex (`#36A2EB`, with optional alpha: `#36A2EB80`), `rgb()`/`rgba()`,
`hsl()`/`hsla()`, or a `CanvasPattern`/`CanvasGradient` object for
gradients and image-based fills.

### Gradients via `chartjs-plugin-gradient`

Constructing a real `CanvasGradient` object yourself (via the canvas 2D
context) always works, with zero extra support needed — that's just
another valid color value, per the format list above. If you'd rather not
hand-roll one, `chartjs-plugin-gradient` gives you a declarative
alternative: opt in with the `gradient` prop, then describe the gradient
on the dataset itself:

```vue
<Chart
  type="bar"
  gradient
  :data="{
    datasets: [{
      data: [20, 45, 70, 90, 60],
      gradient: {
        backgroundColor: { axis: 'y', colors: { 0: 'red', 50: 'yellow', 100: 'green' } },
      },
    }],
  }"
/>
```

Unlike `zoom`/`annotation`/`dataLabels`, `gradient` is **boolean only** —
confirmed directly from the real package's own README
(github.com/kurkle/chartjs-plugin-gradient): it has no plugin-level
config of its own to merge into `options.plugins.gradient` at all. Its
real config lives on each dataset instead, which already reaches Chart.js
untouched via the `data` prop — the `gradient` prop's only job is
registering the plugin so that config takes effect. See the
[Gradient plugin example](/vue/examples/gradient-plugin) for the full
version, and [Plugins](/vue/api/plugins) for the full prop reference.

## Fonts

`options.font`, or a more specific `font` object nested under a particular
plugin/element/scale option, both work as plain per-option configuration:

```js
const options = {
  plugins: {
    legend: { labels: { font: { size: 14 } } },
  },
};
```

For a font change that should apply to *every* chart on the page, not just
one `<Chart>` instance, set Chart.js's own global default directly instead
of a per-chart option — see [Options resolution](/vue/guide/concepts/options-resolution)'s
own section on setting `Chart.defaults` directly.

If a font isn't cached and needs to load, a chart already rendered with it
won't pick it up automatically — call `.update()` on this library's own
exposed `chart` ref once your own font-loading promise (via the browser's
[Font Loading API](https://developer.mozilla.org/en-US/docs/Web/API/CSS_Font_Loading_API))
resolves.

## Padding

`options.layout.padding` accepts three shapes:

```js
// same padding on all sides
options.layout.padding = 20;

// per-side, omitted sides default to 0
options.layout.padding = { left: 50 };

// {x, y} shorthand for left/right and top/bottom
options.layout.padding = { x: 10, y: 4 };
```

The `{x, y}` shorthand also shows up in more specific places, like a radial
scale's own tick `backdropPadding`.
