---
editUrl: false
title: "DeferredPluginOptions"
description: "`chartjs-plugin-deferred`'s real config, confirmed directly from the real package's own README (github.com/chartjs/chartjs-plugin-deferred) — modeled…"
---

`chartjs-plugin-deferred`'s real config, confirmed directly from the
real package's own README (github.com/chartjs/chartjs-plugin-deferred)
— modeled precisely rather than loosely, since the package's own real
surface is small and fully documented (same approach as
`ImageLabelPluginOptions`/`AutocolorsPluginOptions` above). Lives
under `options.plugins.deferred`.

## Properties

### delay?

> `optional` **delay?**: `number`

Extra delay, in milliseconds, after the canvas is considered
inside the viewport before the real initial update actually runs.

#### Default

```ts
500
```

***

### xOffset?

> `optional` **xOffset?**: `string` \| `number`

How many pixels (or, as a percentage string, what fraction) of the
canvas's own width must already be inside the viewport before the
chart's real initial update runs.

#### Default

```ts
150
```

***

### yOffset?

> `optional` **yOffset?**: `string` \| `number`

Same as `xOffset`, for the canvas's own height.

#### Default

```ts
150
```
