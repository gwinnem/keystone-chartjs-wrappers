---
editUrl: false
title: "AnnotationPluginOptions"
---

`chartjs-plugin-annotation`'s real config lives under
`options.plugins.annotation.annotations` — see
docs/CHARTJS_ANALYSIS.md §4. Same "loose on purpose" note as
`ZoomPluginOptions` used to have before that plugin's own local port
(see zoomPlugin.ts, which now models its own options precisely).

## Properties

### annotations

> **annotations**: `Record`\<`string`, `unknown`\>
