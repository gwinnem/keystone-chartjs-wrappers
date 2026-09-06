---
editUrl: false
title: "withImageLabel"
description: "Merges the given config into `options.plugins.imageLabel` (this plugin's own real, documented option path) and returns the local plugin object (defined in…"
---

> **withImageLabel**(`options`, `imageLabelOptions`): `Promise`\<\{ `options`: `Options`; `plugin`: `unknown`; \}\>

Merges the given config into `options.plugins.imageLabel` (this
plugin's own real, documented option path) and returns the local
plugin object (defined in imageLabelPlugin.ts) for the caller to
include in Chart.js's own inline `plugins` array — kept async and
returning the same `{ options, plugin }` shape as before this was
split into its own file, so `useChartController.ts`'s own
`resolveOptionsAndPlugins()` needed no changes at all.

`imagesList` is required — there's no sensible empty default, matching
`AnnotationPluginOptions.annotations`'s own reasoning — so `imageLabel`
has no plain-boolean opt-in form the way `zoom`/`dataLabels` do.
Doughnut/pie charts only (enforced in imageLabelPlugin.ts's own
`afterDraw`, not here).

## Parameters

### options

`Options`

### imageLabelOptions

[`ImageLabelPluginOptions`](/core/api/reference/interfaces/imagelabelpluginoptions/)

## Returns

`Promise`\<\{ `options`: `Options`; `plugin`: `unknown`; \}\>
