---
editUrl: false
title: "ChartConfigData"
description: "The real `data` type this library's own `<Chart>` components accept, across all 15 kinds — exported so framework packages (packages/vue|react|angular) can…"
---

The real `data` type this library's own `<Chart>` components accept,
across all 15 kinds — exported so framework packages
(packages/vue|react|angular) can type their own `data` prop/input
against this directly, rather than each re-deriving the same widened
shape independently. Hand-rolled (matching Chart.js's own real
`ChartData` shape: optional `labels`, required `datasets`) rather than
derived from `ChartConfiguration<...>['data']` directly, for the
`ChartConfigDataset` reason above.

## Properties

### datasets

> **datasets**: [`ChartConfigDataset`](/core/api/reference/interfaces/chartconfigdataset/)[]

***

### labels?

> `optional` **labels?**: `unknown`[]
