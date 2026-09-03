---
title: Installation
description: How keystone-chartjs-core is actually reached today — private/workspace-internal, not published to npm.
---

`keystone-chartjs-core` is **private and workspace-internal today** — it
is not published to npm (see its own `package.json`: `"private": true`).
There is no `pnpm add keystone-chartjs-core` to run from outside this
monorepo.

## Inside this monorepo

Every one of `keystone-chartjs-vue`, `keystone-chartjs-react`, and
`keystone-chartjs-angular` already depends on it via the `workspace:*`
protocol — a single `pnpm install` at the repo root wires all of it up;
nothing to install separately.

To import it directly (for example, from a script or test living
elsewhere in this monorepo):

```ts
import { createChartController } from 'keystone-chartjs-core';
```

A second entry point exists for shared test fixtures, kept out of the
main import path since it's testing infrastructure, not part of the
runtime API:

```ts
import { createTestCanvas } from 'keystone-chartjs-core/test-utils';
```

## Outside this monorepo

Not possible today. Whether this package gets published standalone is an
open Phase 7 decision, not yet made — see
[the implementation plan](https://github.com/gwinnem/keystone-chartjs-wrappers/blob/main/docs/IMPLEMENTATION_PLAN.md)
for current status.

## Where to go next

- **[API reference](/core/api)** — every exported function and type,
  grouped by what it does.
