---
editUrl: false
title: "ChartJs"
---

## Type Parameters

### TType

`TType` *extends* `ChartType` = `ChartType`

### TData

`TData` = `DefaultDataPoint`\<`TType`\>

### TLabel

`TLabel` = `unknown`

## Properties

### aspectRatio

> `readonly` **aspectRatio**: `number`

***

### attached

> `readonly` **attached**: `boolean`

***

### boxes

> `readonly` **boxes**: `LayoutItem`[]

***

### canvas

> `readonly` **canvas**: `HTMLCanvasElement`

***

### chartArea

> `readonly` **chartArea**: `ChartArea`

***

### config

> `readonly` **config**: [`ChartConfiguration`](/core/api/reference/interfaces/chartconfiguration/)\<`TType`, `TData`, `TLabel`\> \| `ChartConfigurationCustomTypesPerDataset`\<`TType`, `TData`, `TLabel`\>

***

### ctx

> `readonly` **ctx**: `CanvasRenderingContext2D`

***

### currentDevicePixelRatio

> `readonly` **currentDevicePixelRatio**: `number`

***

### data

> **data**: `ChartData`\<`TType`, `TData`, `TLabel`\>

***

### height

> `readonly` **height**: `number`

***

### id

> `readonly` **id**: `string`

***

### legend?

> `readonly` `optional` **legend?**: `LegendElement`\<`TType`\>

***

### options

> **options**: `Exclude`\<`DeepPartial`\<`CoreChartOptions`\<`TType`\> & `ElementChartOptions`\<`TType`\> & `PluginChartOptions`\<`TType`\> & `DatasetChartOptions`\<`TType`\> & `ScaleChartOptions`\<`TType`\> & `ChartTypeRegistry`\[`TType`\]\[`"chartOptions"`\]\>\>

***

### platform

> `readonly` **platform**: `BasePlatform`

***

### scales

> `readonly` **scales**: `object`

#### Index Signature

\[`key`: `string`\]: `Scale`\<`CoreScaleOptions`\>

***

### tooltip?

> `readonly` `optional` **tooltip?**: `TooltipModel`\<`TType`\>

***

### width

> `readonly` **width**: `number`

## Methods

### bindEvents()

> **bindEvents**(): `void`

#### Returns

`void`

***

### buildOrUpdateControllers()

> **buildOrUpdateControllers**(): `void`

#### Returns

`void`

***

### buildOrUpdateScales()

> **buildOrUpdateScales**(): `void`

#### Returns

`void`

***

### clear()

> **clear**(): `this`

#### Returns

`this`

***

### destroy()

> **destroy**(): `void`

#### Returns

`void`

***

### draw()

> **draw**(): `void`

#### Returns

`void`

***

### ensureScalesHaveIDs()

> **ensureScalesHaveIDs**(): `void`

#### Returns

`void`

***

### getActiveElements()

> **getActiveElements**(): `ActiveElement`[]

#### Returns

`ActiveElement`[]

***

### getContext()

> **getContext**(): `object`

#### Returns

`object`

##### chart

> **chart**: `Chart`

##### type

> **type**: `string`

***

### getDatasetMeta()

> **getDatasetMeta**(`datasetIndex`): `ChartMeta`

#### Parameters

##### datasetIndex

`number`

#### Returns

`ChartMeta`

***

### getDataVisibility()

> **getDataVisibility**(`index`): `boolean`

#### Parameters

##### index

`number`

#### Returns

`boolean`

***

### getElementsAtEventForMode()

> **getElementsAtEventForMode**(`e`, `mode`, `options`, `useFinalPosition`): `InteractionItem`[]

#### Parameters

##### e

`Event`

##### mode

`string`

##### options

`InteractionOptions`

##### useFinalPosition

`boolean`

#### Returns

`InteractionItem`[]

***

### getSortedVisibleDatasetMetas()

> **getSortedVisibleDatasetMetas**(): `ChartMeta`\<keyof `ChartTypeRegistry`, `Element`\<`AnyObject`, `AnyObject`\>, `Element`\<`AnyObject`, `AnyObject`\>\>[]

#### Returns

`ChartMeta`\<keyof `ChartTypeRegistry`, `Element`\<`AnyObject`, `AnyObject`\>, `Element`\<`AnyObject`, `AnyObject`\>\>[]

***

### getVisibleDatasetCount()

> **getVisibleDatasetCount**(): `number`

#### Returns

`number`

***

### hide()

> **hide**(`datasetIndex`, `dataIndex?`): `void`

#### Parameters

##### datasetIndex

`number`

##### dataIndex?

`number`

#### Returns

`void`

***

### isDatasetVisible()

> **isDatasetVisible**(`datasetIndex`): `boolean`

#### Parameters

##### datasetIndex

`number`

#### Returns

`boolean`

***

### isPluginEnabled()

> **isPluginEnabled**(`pluginId`): `boolean`

#### Parameters

##### pluginId

`string`

#### Returns

`boolean`

***

### isPointInArea()

> **isPointInArea**(`point`): `boolean`

#### Parameters

##### point

`Point`

#### Returns

`boolean`

***

### notifyPlugins()

> **notifyPlugins**(`hook`, `args?`): `boolean` \| `void`

#### Parameters

##### hook

`string`

##### args?

`AnyObject`

#### Returns

`boolean` \| `void`

***

### render()

> **render**(): `void`

#### Returns

`void`

***

### reset()

> **reset**(): `void`

#### Returns

`void`

***

### resize()

> **resize**(`width?`, `height?`): `void`

#### Parameters

##### width?

`number`

##### height?

`number`

#### Returns

`void`

***

### setActiveElements()

> **setActiveElements**(`active`): `void`

#### Parameters

##### active

`ActiveDataPoint`[]

#### Returns

`void`

***

### setDatasetVisibility()

> **setDatasetVisibility**(`datasetIndex`, `visible`): `void`

#### Parameters

##### datasetIndex

`number`

##### visible

`boolean`

#### Returns

`void`

***

### show()

> **show**(`datasetIndex`, `dataIndex?`): `void`

#### Parameters

##### datasetIndex

`number`

##### dataIndex?

`number`

#### Returns

`void`

***

### stop()

> **stop**(): `this`

#### Returns

`this`

***

### toBase64Image()

> **toBase64Image**(`type?`, `quality?`): `string`

#### Parameters

##### type?

`string`

##### quality?

`unknown`

#### Returns

`string`

***

### toggleDataVisibility()

> **toggleDataVisibility**(`index`): `void`

#### Parameters

##### index

`number`

#### Returns

`void`

***

### unbindEvents()

> **unbindEvents**(): `void`

#### Returns

`void`

***

### update()

> **update**(`mode?`): `void`

#### Parameters

##### mode?

`"reset"` \| `"resize"` \| `"none"` \| `"hide"` \| `"show"` \| `"default"` \| `"active"` \| ((`ctx`) => `"reset"` \| `"resize"` \| `"none"` \| `"hide"` \| `"show"` \| `"default"` \| `"active"`)

#### Returns

`void`

***

### updateHoverStyle()

> **updateHoverStyle**(`items`, `mode`, `enabled`): `void`

#### Parameters

##### items

`InteractionItem`[]

##### mode

`"dataset"`

##### enabled

`boolean`

#### Returns

`void`
