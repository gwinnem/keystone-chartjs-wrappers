---
editUrl: false
title: "ChartUpdatePayload"
description: "What a framework component passes in on mount, and again on every subsequent prop/input change — a flat shape rather than nesting `data`/ `options` inside…"
---

What a framework component passes in on mount, and again on every
subsequent prop/input change — a flat shape rather than nesting `data`/
`options` inside a `config` object, since that's what ends up threaded
straight into `ChartConfiguration` anyway (see controller.ts).

NOTE: this replaces the placeholder `ChartInstanceOptions` shape
(`{ kind, config }`) the scaffolded Chart.vue/Chart.tsx/
KeystoneChartComponent currently construct. Those three placeholders
are NOT updated as part of Phase 1 — updating them to this shape (and
to `createChartController`'s new async signature) is explicitly
Phase 2/3/4 work per docs/IMPLEMENTATION_PLAN.md. Until then they will
not compile/run correctly against this package — a known, tracked gap,
not an oversight.

## Type Parameters

### TKind

`TKind` *extends* [`ChartKind`](/core/api/reference/types/chartkind/) = [`ChartKind`](/core/api/reference/types/chartkind/)

## Properties

### data

> **data**: [`ChartConfigData`](/core/api/reference/interfaces/chartconfigdata/)

***

### options?

> `optional` **options?**: `_DeepPartialObject`\<`CoreChartOptions`\<keyof `ChartTypeRegistry`\> & `ElementChartOptions`\<keyof `ChartTypeRegistry`\> & `PluginChartOptions`\<keyof `ChartTypeRegistry`\> & `DatasetChartOptions`\<keyof `ChartTypeRegistry`\> & `ScaleChartOptions`\<keyof `ChartTypeRegistry`\>\>

***

### plugins?

> `optional` **plugins?**: `Plugin`\<keyof `ChartTypeRegistry`, `AnyObject`\>[]

Inline, per-chart-instance Chart.js plugin objects — the real
`ChartConfiguration['plugins']` field, distinct from this library's
own 3 official opt-in props (`zoom`/`annotation`/`dataLabels`), which
register a *known, named* package and merge its config into
`options.plugins.<id>`. This field is for any Chart.js plugin a
consumer supplies themselves — a custom plugin object, or any
community plugin this library doesn't officially ship support for.
Reaches the real `Chart` constructor untouched via `toConfig()` in
controller.ts, the same way `options` already does.

***

### type

> **type**: `TKind`
