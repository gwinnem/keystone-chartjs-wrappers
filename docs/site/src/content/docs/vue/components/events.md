---
title: Chart events
description: Vue events emitted by the <Chart> component.
---

Not implemented yet. Planned events, for whenever this lands:

- `ready` — emitted once the underlying Chart.js instance is constructed
  and available (useful for grabbing the exposed instance ref without
  relying on `nextTick`).
- `update` — emitted after a reactive data/options change has been applied
  to the live chart.
- `destroy` — emitted just before the chart instance is torn down.

None of these exist today — `<Chart>`'s own lifecycle (mount, diffed
update, destroy) is fully implemented, but it's exposed only via the
[exposed `chart` instance ref](/vue/components/props#escape-hatch), not
via Vue events. This page describes intent, not shipped behavior. See
[Roadmap](/vue/guide/project/roadmap).
