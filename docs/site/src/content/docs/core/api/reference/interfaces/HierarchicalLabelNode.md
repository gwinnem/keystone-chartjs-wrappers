---
editUrl: false
title: "HierarchicalLabelNode"
description: "A single node in the flattened hierarchy tree — one per visible or hidden category, with its own real position/visibility state kept directly on the node…"
---

A single node in the flattened hierarchy tree — one per visible or
hidden category, with its own real position/visibility state kept
directly on the node object itself (mutated in place as the user
expands/collapses/focuses parts of the tree), matching the
original's own real design.

## Properties

### center

> **center**: `number`

***

### children

> **children**: `HierarchicalLabelNode`[]

***

### expand

> **expand**: `boolean` \| `"focus"`

***

### hidden

> **hidden**: `boolean`

***

### index

> **index**: `number`

***

### label

> **label**: `string`

***

### level

> **level**: `number`

***

### major

> **major**: `boolean`

***

### parent

> **parent**: `number`

***

### relIndex

> **relIndex**: `number`

***

### value?

> `optional` **value?**: `string`

***

### width

> **width**: `number`

## Methods

### toString()

> **toString**(): `string`

#### Returns

`string`
