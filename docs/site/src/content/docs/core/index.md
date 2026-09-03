---
title: Core
description: The framework-agnostic Chart.js engine underneath the Vue, React, and Angular packages — chart lifecycle, lazy type registration, and plugin wiring, usable standalone within this monorepo.
---

`keystone-chartjs-core` is the framework-agnostic engine shared by
`keystone-chartjs-vue`, `keystone-chartjs-react`, and
`keystone-chartjs-angular`. Chart lifecycle (construct, diff-and-update,
destroy), lazy chart-kind registration, and official-plugin wiring all live
here exactly once, so none of the three framework packages maintain their
own copy of any of it.

## Jump in

- **[Guide](/core/guide/introduction)** — what this package is, who it's
  for, and how it's actually reached today.
- **[API reference](/core/api)** — every exported function and type,
  grouped by what it does.

Most people building with this project's own [Vue](/vue/), React, or
Angular package never need to install this directly — it's already a
dependency of each. Reach for it on its own when you want the same chart
lifecycle/registration/plugin logic outside any of those three components
entirely — building an integration for a framework this project doesn't
have a package for yet, or driving a Chart.js instance from plain
TypeScript with no framework at all.
