---
editUrl: false
title: "HierarchicalScaleOptions"
---

## Extends

- `CategoryScaleOptions`

## Properties

### alignToPixels

> **alignToPixels**: `boolean`

Align pixel values to device pixels

#### Inherited from

`CategoryScaleOptions.alignToPixels`

***

### attributes

> **attributes**: `Record`\<`string`, `unknown`\>

Per-attribute defaults (e.g. `backgroundColor`) inherited down
the tree from whichever ancestor node first defines them —
populated onto each dataset automatically once resolved.

#### Default

```ts
{}
```

***

### axis

> **axis**: `"x"` \| `"y"` \| `"r"`

Which type of axis this is. Possible values are: 'x', 'y', 'r'. If not set, this is inferred from the first character of the ID which should be 'x', 'y' or 'r'.

#### Inherited from

`CategoryScaleOptions.axis`

***

### backgroundColor

> **backgroundColor**: `Color`

Background color of the scale area.

#### Inherited from

`CategoryScaleOptions.backgroundColor`

***

### border

> **border**: `BorderOptions`

#### Inherited from

`CategoryScaleOptions.border`

***

### bounds

> **bounds**: `"data"` \| `"ticks"`

Scale boundary strategy (bypassed by min/max time options)
- `data`: make sure data are fully visible, ticks outside are removed
- `ticks`: make sure ticks are fully visible, data outside are truncated

#### Since

2.7.0

#### Default

```ts
'ticks'
```

#### Inherited from

`CategoryScaleOptions.bounds`

***

### clip

> **clip**: `boolean`

Clip the dataset drawing against the size of the scale instead of chart area.

#### Default

```ts
true
```

#### Inherited from

`CategoryScaleOptions.clip`

***

### display

> **display**: `boolean` \| `"auto"`

Controls the axis global visibility (visible when true, hidden when false). When display: 'auto', the axis is visible only if at least one associated dataset is visible.

#### Default

```ts
true
```

#### Inherited from

`CategoryScaleOptions.display`

***

### grid

> **grid**: `Partial`\<`GridLineOptions`\>

#### Inherited from

`CategoryScaleOptions.grid`

***

### hierarchyBoxColor

> **hierarchyBoxColor**: `string`

Stroke color of the expand/collapse/focus indicator boxes
themselves.

***

### hierarchyBoxLineHeight

> **hierarchyBoxLineHeight**: `number`

Vertical (or, for a vertical axis, horizontal) distance between
two stacked hierarchy indicator rows.

***

### hierarchyBoxSize

> **hierarchyBoxSize**: `number`

Size, in pixels, of each expand/collapse/focus indicator box.

***

### hierarchyBoxWidth

> **hierarchyBoxWidth**: `number`

Stroke width of those same indicator boxes.

***

### hierarchyGroupLabelPosition

> **hierarchyGroupLabelPosition**: `"center"` \| `"first"` \| `"last"` \| `"between-first-and-second"`

Where each expanded group's own label is centered relative to
its own visible children.

#### Default

```ts
'between-first-and-second'
```

***

### hierarchyLabelPosition

> **hierarchyLabelPosition**: `"none"` \| `"below"` \| `"above"` \| `null`

Where each expanded group's own label is drawn relative to the
axis — `'none'` disables it entirely.

#### Default

```ts
'below'
```

***

### hierarchySpanColor

> **hierarchySpanColor**: `string`

Stroke color of the connector lines between an expanded group's
own visible children.

***

### hierarchySpanWidth

> **hierarchySpanWidth**: `number`

Stroke width of those same connector lines.

***

### labels

> **labels**: `string`[] \| `string`[][]

#### Inherited from

`CategoryScaleOptions.labels`

***

### levelPercentage

> **levelPercentage**: `number`

Ratio by which the distance between two elements shrinks the
higher the level of the tree is — two top-level bars have a
distance of `1`; two nested one level down have `levelPercentage`
instead (e.g. `0.75`).

#### Default

```ts
0.75
```

***

### max

> **max**: `string` \| `number`

#### Inherited from

`CategoryScaleOptions.max`

***

### min

> **min**: `string` \| `number`

#### Inherited from

`CategoryScaleOptions.min`

***

### offset

> **offset**: `true`

If true, extra space is added to the both edges and the axis is scaled to fit into the chart area. This is set to true for a bar chart by default.

#### Default

```ts
false
```

#### Overrides

`CategoryScaleOptions.offset`

***

### padding

> **padding**: `number`

Padding between the axis's own edge and the first row of
expand/collapse indicators.

#### Default

```ts
5
```

***

### position

> **position**: `"center"` \| `"right"` \| `"bottom"` \| `"left"` \| `"top"` \| \{\[`scale`: `string`\]: `number`; \}

Position of the axis.

#### Inherited from

`CategoryScaleOptions.position`

***

### reverse

> **reverse**: `boolean`

Reverse the scale.

#### Default

```ts
false
```

#### Inherited from

`CategoryScaleOptions.reverse`

***

### reverseOrder

> **reverseOrder**: `boolean`

`true` puts the lowest hierarchy level nearest the axis and the
highest level farthest from it (reversing the usual, top-down
drawing order).

#### Default

```ts
false
```

***

### stack?

> `optional` **stack?**: `string`

Stack group. Axes at the same `position` with same `stack` are stacked.

#### Inherited from

`CategoryScaleOptions.stack`

***

### stacked?

> `optional` **stacked?**: `boolean` \| `"single"`

If true, data will be comprised between datasets of data

#### Default

```ts
false
```

#### Inherited from

`CategoryScaleOptions.stacked`

***

### stackWeight?

> `optional` **stackWeight?**: `number`

Weight of the scale in stack group. Used to determine the amount of allocated space for the scale within the group.

#### Default

```ts
1
```

#### Inherited from

`CategoryScaleOptions.stackWeight`

***

### static

> **static**: `boolean`

`true` disables the interactive expand/collapse/focus boxes
entirely, drawing only the static connector lines/labels.

#### Default

```ts
false
```

***

### suggestedMax

> **suggestedMax**: `unknown`

Adjustment used when calculating the minimum data value.

#### Inherited from

`CategoryScaleOptions.suggestedMax`

***

### suggestedMin

> **suggestedMin**: `unknown`

Adjustment used when calculating the maximum data value.

#### Inherited from

`CategoryScaleOptions.suggestedMin`

***

### ticks

> **ticks**: `CartesianTickOptions`

#### Inherited from

`CategoryScaleOptions.ticks`

***

### title

> **title**: `object`

Options for the scale title.

#### align

> **align**: `Align`

Alignment of the axis title.

#### color

> **color**: `Color`

Color of the axis label.

#### display

> **display**: `boolean`

If true, displays the axis title.

#### font

> **font**: `ScriptableAndScriptableOptions`\<`Partial`\<`FontSpec`\>, `ScriptableCartesianScaleContext`\>

Information about the axis title font.

#### padding

> **padding**: `number` \| \{ `bottom`: `number`; `top`: `number`; `y`: `number`; \}

Padding to apply around scale labels.

##### Union Members

`number`

***

###### Type Literal

\{ `bottom`: `number`; `top`: `number`; `y`: `number`; \}

###### bottom

> **bottom**: `number`

Padding on the (relative) bottom side of this axis label.

###### top

> **top**: `number`

Padding on the (relative) top side of this axis label.

###### y

> **y**: `number`

This is a shorthand for defining top/bottom to the same values.

#### text

> **text**: `string` \| `string`[]

The text for the title, e.g. "# of People" or "Response Choices".

#### Inherited from

`CategoryScaleOptions.title`

***

### weight

> **weight**: `number`

The weight used to sort the axis. Higher weights are further away from the chart area.

#### Default

```ts
true
```

#### Inherited from

`CategoryScaleOptions.weight`

## Methods

### afterBuildTicks()

> **afterBuildTicks**(`axis`): `void`

Callback that runs after ticks are created. Useful for filtering ticks.

#### Parameters

##### axis

`Scale`

#### Returns

`void`

#### Inherited from

`CategoryScaleOptions.afterBuildTicks`

***

### afterCalculateLabelRotation()

> **afterCalculateLabelRotation**(`axis`): `void`

Callback that runs after tick rotation is determined.

#### Parameters

##### axis

`Scale`

#### Returns

`void`

#### Inherited from

`CategoryScaleOptions.afterCalculateLabelRotation`

***

### afterDataLimits()

> **afterDataLimits**(`axis`): `void`

Callback that runs after data limits are determined.

#### Parameters

##### axis

`Scale`

#### Returns

`void`

#### Inherited from

`CategoryScaleOptions.afterDataLimits`

***

### afterFit()

> **afterFit**(`axis`): `void`

Callback that runs after the scale fits to the canvas.

#### Parameters

##### axis

`Scale`

#### Returns

`void`

#### Inherited from

`CategoryScaleOptions.afterFit`

***

### afterSetDimensions()

> **afterSetDimensions**(`axis`): `void`

Callback that runs after dimensions are set.

#### Parameters

##### axis

`Scale`

#### Returns

`void`

#### Inherited from

`CategoryScaleOptions.afterSetDimensions`

***

### afterTickToLabelConversion()

> **afterTickToLabelConversion**(`axis`): `void`

Callback that runs after ticks are converted into strings.

#### Parameters

##### axis

`Scale`

#### Returns

`void`

#### Inherited from

`CategoryScaleOptions.afterTickToLabelConversion`

***

### afterUpdate()

> **afterUpdate**(`axis`): `void`

Callback that runs at the end of the update process.

#### Parameters

##### axis

`Scale`

#### Returns

`void`

#### Inherited from

`CategoryScaleOptions.afterUpdate`

***

### beforeBuildTicks()

> **beforeBuildTicks**(`axis`): `void`

Callback that runs before ticks are created.

#### Parameters

##### axis

`Scale`

#### Returns

`void`

#### Inherited from

`CategoryScaleOptions.beforeBuildTicks`

***

### beforeCalculateLabelRotation()

> **beforeCalculateLabelRotation**(`axis`): `void`

Callback that runs before tick rotation is determined.

#### Parameters

##### axis

`Scale`

#### Returns

`void`

#### Inherited from

`CategoryScaleOptions.beforeCalculateLabelRotation`

***

### beforeDataLimits()

> **beforeDataLimits**(`axis`): `void`

Callback that runs before data limits are determined.

#### Parameters

##### axis

`Scale`

#### Returns

`void`

#### Inherited from

`CategoryScaleOptions.beforeDataLimits`

***

### beforeFit()

> **beforeFit**(`axis`): `void`

Callback that runs before the scale fits to the canvas.

#### Parameters

##### axis

`Scale`

#### Returns

`void`

#### Inherited from

`CategoryScaleOptions.beforeFit`

***

### beforeSetDimensions()

> **beforeSetDimensions**(`axis`): `void`

Callback that runs before dimensions are set.

#### Parameters

##### axis

`Scale`

#### Returns

`void`

#### Inherited from

`CategoryScaleOptions.beforeSetDimensions`

***

### beforeTickToLabelConversion()

> **beforeTickToLabelConversion**(`axis`): `void`

Callback that runs before ticks are converted into strings.

#### Parameters

##### axis

`Scale`

#### Returns

`void`

#### Inherited from

`CategoryScaleOptions.beforeTickToLabelConversion`

***

### beforeUpdate()

> **beforeUpdate**(`axis`): `void`

Callback called before the update process starts.

#### Parameters

##### axis

`Scale`

#### Returns

`void`

#### Inherited from

`CategoryScaleOptions.beforeUpdate`
