---
editUrl: false
title: "HierarchicalRawLabelNode"
description: "The raw, consumer-authored shape passed in as `data.labels` — either a plain string leaf, or an object with optional `children` (each itself a nested…"
---

The raw, consumer-authored shape passed in as `data.labels` —
either a plain string leaf, or an object with optional `children`
(each itself a nested `HierarchicalRawLabelNode` or plain string).

## Properties

### children?

> `optional` **children?**: (`string` \| `HierarchicalRawLabelNode`)[]

This node's own children, each either a nested raw node or a
plain string leaf label.

***

### expand?

> `optional` **expand?**: `boolean` \| `"focus"`

Whether this node starts collapsed (`false`), expanded (`true`),
or expanded-and-focused/zoomed-in (`'focus'`).

#### Default

```ts
false
```

***

### hidden?

> `optional` **hidden?**: `boolean`

Hides this node (and, transitively, its own children) entirely.

***

### label

> **label**: `string`

The label text shown on the axis.
