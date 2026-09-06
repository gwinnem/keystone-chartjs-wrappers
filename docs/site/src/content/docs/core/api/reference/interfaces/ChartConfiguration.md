---
editUrl: false
title: "ChartConfiguration"
---

## Type Parameters

### TType

`TType` *extends* `ChartType` = `ChartType`

### TData

`TData` = `DefaultDataPoint`\<`TType`\>

### TLabel

`TLabel` = `unknown`

## Properties

### data

> **data**: `ChartData`\<`TType`, `TData`, `TLabel`\>

***

### options?

> `optional` **options?**: `Exclude`\<`DeepPartial`\<`CoreChartOptions`\<`TType`\> & `ElementChartOptions`\<`TType`\> & `PluginChartOptions`\<`TType`\> & `DatasetChartOptions`\<`TType`\> & `ScaleChartOptions`\<`TType`\> & `ChartTypeRegistry`\[`TType`\]\[`"chartOptions"`\]\>, `_DeepPartialArray`\<`unknown`\>\>

***

### platform?

> `optional` **platform?**: *typeof* `BasePlatform`

***

### plugins?

> `optional` **plugins?**: `Plugin`\<`TType`, `AnyObject`\>[]

***

### type

> **type**: `TType`
