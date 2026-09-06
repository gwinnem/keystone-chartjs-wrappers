---
editUrl: false
title: "withZoom"
description: "Merges `zoomOptions` (`pan`/`zoom` config) into `options.plugins.zoom` (this plugin's own real, documented option path) and returns the local plugin…"
---

> **withZoom**(`options`, `zoomOptions?`): `Promise`\<\{ `options`: `Options`; `plugin`: `unknown`; \}\>

Merges `zoomOptions` (`pan`/`zoom` config) into `options.plugins.zoom`
(this plugin's own real, documented option path) and returns the
local plugin object (defined in zoomPlugin.ts) for the caller to
include in Chart.js's own inline `plugins` array — the same
`{ options, plugin }` shape `withGradient`/`withImageLabel` return,
since this plugin (as of the local port) is also never passed to a
global `Chart.register(...)` call.

As of the port, `ZoomPluginOptions` is imported from `zoomPlugin.ts`
itself, not `types.ts` — modeled precisely now that the real option
shape is fully known from the dissected source, rather than the
deliberately loose shape used while this was still a dependency (see
zoomPlugin.ts's own header comment for the real scope this port
covers — notably, no Hammer.js-dependent pinch/gesture-pan support).

## Parameters

### options

`Options`

### zoomOptions?

[`ZoomPluginOptions`](/core/api/reference/interfaces/zoompluginoptions/) = `{}`

## Returns

`Promise`\<\{ `options`: `Options`; `plugin`: `unknown`; \}\>
