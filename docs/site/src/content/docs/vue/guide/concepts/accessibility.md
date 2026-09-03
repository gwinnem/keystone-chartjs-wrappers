---
title: Accessibility
description: Chart.js renders on canvas, which isn't accessible by default — how keystone-chartjs-vue lets you add ARIA attributes and fallback content.
---

Chart.js renders every chart on a `<canvas>` element. Canvas content is
invisible to screen readers by default — Chart.js does nothing about this
automatically. Making a chart accessible is on you as the consumer, via one
or both of the mechanisms below — both of which `<Chart>` supports directly.

## ARIA attributes

Setting `aria-label` and `role="img"` on the `<canvas>` element gives it an
accessible name:

```html
<canvas aria-label="Quarterly revenue" role="img"></canvas>
```

**Confirmed working in `keystone-chartjs-vue`** — no extra prop needed.
`<Chart>` declares no `inheritAttrs: false`, so Vue's own default
single-root-component behavior forwards any attribute that isn't a declared
prop (`type`/`data`/`options`/`zoom`/`annotation`/`dataLabels`) straight onto
the rendered `<canvas>`:

```vue
<Chart type="bar" :data="data" aria-label="Quarterly revenue" role="img" />
```

This works for any native `<canvas>` attribute, not just ARIA ones —
`id`, `class`, `style`, `aria-describedby`, and so on all pass through the
same way. Confirmed via a real component test
(`tests/component/Chart.spec.ts`'s own "forwards non-prop attributes"
case), not just assumed from Vue's documented default.

## Fallback content

Content placed between a canvas element's own opening and closing tags is
shown by browsers/assistive tech that can't render canvas at all:

```html
<canvas>
  <p>Quarterly revenue: Q1 $50k, Q2 $65k, Q3 $58k, Q4 $72k</p>
</canvas>
```

**Confirmed working in `keystone-chartjs-vue`** via `<Chart>`'s own default
slot — anything you pass as slot content renders inside the canvas tags:

```vue
<Chart type="bar" :data="data">
  <p>Quarterly revenue: Q1 $50k, Q2 $65k, Q3 $58k, Q4 $72k</p>
</Chart>
```

Confirmed via a real component test (`tests/component/Chart.spec.ts`'s own
"renders default slot content as real fallback content" case).

## What good and bad examples look like

Good — an accessible name via ARIA:

```html
<canvas aria-label="Hello ARIA World" role="img"></canvas>
```

Good — a real text alternative via fallback content:

```html
<canvas>
  <p>Hello Fallback World</p>
</canvas>
```

Bad — no accessible name, no fallback, nothing for a screen reader to
announce at all:

```html
<canvas></canvas>
```

Bad — fallback content that isn't actually a meaningful text alternative:

```html
<canvas>Your browser does not support the canvas element.</canvas>
```

## Combining both

Nothing stops you from using both mechanisms on the same chart — an ARIA
label for screen readers that do render the canvas, and fallback content
(e.g. a real data table) for anything that can't:

```vue
<Chart type="bar" :data="data" aria-label="Quarterly revenue" role="img">
  <table>
    <tr><th>Quarter</th><th>Revenue</th></tr>
    <tr><td>Q1</td><td>$50k</td></tr>
    <tr><td>Q2</td><td>$65k</td></tr>
  </table>
</Chart>
```
