---
editUrl: false
title: "AutocolorsPluginOptions"
---

`chartjs-plugin-autocolors`'s real config, confirmed directly from
the real package's own README (github.com/kurkle/chartjs-plugin-
autocolors) — modeled precisely rather than loosely, since the
package's own real surface is small and fully documented (same
approach as `ImageLabelPluginOptions` above). Lives under
`options.plugins.autocolors`.

## Properties

### customize?

> `optional` **customize?**: (`context`) => `object`

Called once per generated color with the real, computed
`{ background, border }` pair — return a replacement pair (e.g.
lightened/darkened) to customize the generated palette without
replacing it outright.

#### Parameters

##### context

###### colors

\{ `background`: `string`; `border`: `string`; \}

###### colors.background

`string`

###### colors.border

`string`

#### Returns

`object`

##### background

> **background**: `string`

##### border

> **border**: `string`

***

### enabled?

> `optional` **enabled?**: `boolean`

Set to `false` to disable autocoloring for a chart that would
otherwise pick it up from a global `Chart.register(autocolors)`
call.

#### Default

```ts
true
```

***

### mode?

> `optional` **mode?**: `"label"` \| `"data"` \| `"dataset"`

`'dataset'` picks one new color per dataset; `'data'` picks one
per data point within each dataset; `'label'` keys the color to
each data point's own label instead of its index (so the same
label always gets the same color across datasets). `'dataset'`
mode doesn't work properly for doughnut/pie charts — the real
package's own docs recommend `'data'` mode for those instead.

#### Default

```ts
'dataset'
```

***

### offset?

> `optional` **offset?**: `number`

Offsets the color generation by this many colors — useful when
several charts on the same page should not start from the same
first color.

***

### repeat?

> `optional` **repeat?**: `number`

Colors this many adjacent datasets/points the same before moving
to the next color — useful for grouping related series.
