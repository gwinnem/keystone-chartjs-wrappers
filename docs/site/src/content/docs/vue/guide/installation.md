---
title: Installation
description: Installing keystone-chartjs-vue and its peer dependencies.
---

```bash
pnpm add keystone-chartjs-vue chart.js
```

`chart.js` is a peer dependency — install it alongside the wrapper rather
than relying on it being pulled in transitively. `vue` (^3.5.0) is also a
peer dependency; most Vue projects already have it.

## Registering the component

`Chart` is a plain Vue component — import and use it directly, no plugin
installation or global registration step required:

```vue
<script setup lang="ts">
import { Chart } from 'keystone-chartjs-vue';
</script>

<template>
  <Chart type="bar" :data="data" />
</template>
```

## Verifying the install

Once installed, [Basic usage](/vue/) has a minimal working example. If a
chart doesn't render, check the browser console first — Chart.js itself
throws a clear error when a required controller isn't registered, which
(for the ecosystem-extension kinds) usually means the lazy-registration
import failed rather than anything wrong with your component usage.
