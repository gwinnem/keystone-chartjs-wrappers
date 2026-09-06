---
editUrl: false
title: "ZoomPluginOptions"
---

## Properties

### limits?

> `optional` **limits?**: `Record`\<`string`, `ScaleLimits`\>

***

### pan?

> `optional` **pan?**: `object`

#### enabled?

> `optional` **enabled?**: `boolean`

#### mode?

> `optional` **mode?**: `ZoomMode`

#### modifierKey?

> `optional` **modifierKey?**: `string` \| `null`

#### onPan?

> `optional` **onPan?**: (`ctx`) => `void`

##### Parameters

###### ctx

###### chart

[`ChartJs`](/core/api/reference/interfaces/chartjs/)

##### Returns

`void`

#### onPanComplete?

> `optional` **onPanComplete?**: (`ctx`) => `void`

##### Parameters

###### ctx

###### chart

[`ChartJs`](/core/api/reference/interfaces/chartjs/)

##### Returns

`void`

#### onPanRejected?

> `optional` **onPanRejected?**: (`ctx`) => `void`

##### Parameters

###### ctx

###### chart

[`ChartJs`](/core/api/reference/interfaces/chartjs/)

###### event

`Event`

##### Returns

`void`

#### onPanStart?

> `optional` **onPanStart?**: (`ctx`) => `false` \| `void`

##### Parameters

###### ctx

###### chart

[`ChartJs`](/core/api/reference/interfaces/chartjs/)

###### event

`Event`

###### point

`ScreenPoint`

##### Returns

`false` \| `void`

#### threshold?

> `optional` **threshold?**: `number`

***

### zoom?

> `optional` **zoom?**: `object`

#### drag?

> `optional` **drag?**: `object`

##### drag.backgroundColor?

> `optional` **backgroundColor?**: `string`

##### drag.borderColor?

> `optional` **borderColor?**: `string`

##### drag.borderWidth?

> `optional` **borderWidth?**: `number`

##### drag.drawTime?

> `optional` **drawTime?**: `"afterDraw"` \| `"beforeDraw"` \| `"afterDatasetsDraw"` \| `"beforeDatasetsDraw"`

##### drag.enabled?

> `optional` **enabled?**: `boolean`

##### drag.maintainAspectRatio?

> `optional` **maintainAspectRatio?**: `boolean`

##### drag.modifierKey?

> `optional` **modifierKey?**: `string` \| `null`

##### drag.threshold?

> `optional` **threshold?**: `number`

#### mode?

> `optional` **mode?**: `ZoomMode`

#### onZoom?

> `optional` **onZoom?**: (`ctx`) => `void`

##### Parameters

###### ctx

###### chart

[`ChartJs`](/core/api/reference/interfaces/chartjs/)

###### trigger

`string`

##### Returns

`void`

#### onZoomComplete?

> `optional` **onZoomComplete?**: (`ctx`) => `void`

##### Parameters

###### ctx

###### chart

[`ChartJs`](/core/api/reference/interfaces/chartjs/)

##### Returns

`void`

#### onZoomRejected?

> `optional` **onZoomRejected?**: (`ctx`) => `void`

##### Parameters

###### ctx

###### chart

[`ChartJs`](/core/api/reference/interfaces/chartjs/)

###### event

`Event`

##### Returns

`void`

#### onZoomStart?

> `optional` **onZoomStart?**: (`ctx`) => `false` \| `void`

##### Parameters

###### ctx

###### chart

[`ChartJs`](/core/api/reference/interfaces/chartjs/)

###### event

`Event`

###### point

`ScreenPoint`

##### Returns

`false` \| `void`

#### overScaleMode?

> `optional` **overScaleMode?**: `ZoomMode`

#### pinch?

> `optional` **pinch?**: `object`

Two-finger pinch-zoom, via the Pointer Events API — see this
file's own header comment for why this replaces the original
package's own Hammer.js-driven pinch gesture. `false`/omitted by
default, matching the original's own opt-in default.

##### pinch.enabled?

> `optional` **enabled?**: `boolean`

#### scaleMode?

> `optional` **scaleMode?**: `ZoomMode`

#### wheel?

> `optional` **wheel?**: `object`

##### wheel.enabled?

> `optional` **enabled?**: `boolean`

##### wheel.modifierKey?

> `optional` **modifierKey?**: `string` \| `null`

##### wheel.speed?

> `optional` **speed?**: `number`
