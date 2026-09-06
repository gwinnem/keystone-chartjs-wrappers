---
editUrl: false
title: "HierarchicalValueNode"
description: "The raw, consumer-authored shape passed in as each dataset's own `data` (via the `tree` field the plugin populates on first use) — either a plain leaf…"
---

The raw, consumer-authored shape passed in as each dataset's own
`data` (via the `tree` field the plugin populates on first use) —
either a plain leaf number, or an object with its own `children`
mirroring the label tree's own shape one-for-one.

## Properties

### children

> **children**: readonly (`number` \| `HierarchicalValueNode`)[]

This node's own children, mirroring the corresponding label
node's own children one-for-one.

***

### value

> **value**: `number`

This node's own value (only meaningful for a leaf; an internal
node's own `value` is never read directly — see `resolve()`
below).
