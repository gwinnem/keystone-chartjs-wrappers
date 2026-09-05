# keystone-chartjs-wrappers

<div align="center">

<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 22 22" fill="none" width="72" height="72">
  <rect x="1" y="10" width="4" height="11" rx="1" fill="#4FB8C9"/>
  <rect x="7" y="4" width="4" height="17" rx="1" fill="#F2A93B"/>
  <rect x="13" y="12" width="4" height="9" rx="1" fill="#4FB8C9"/>
</svg>

[![Documentation](https://img.shields.io/badge/docs-kcw.winnem.tech-blue?style=flat-square)](https://kcw.winnem.tech)
[![CI](https://github.com/gwinnem/keystone-chartjs-wrappers/actions/workflows/ci.yml/badge.svg)](https://github.com/gwinnem/keystone-chartjs-wrappers/actions/workflows/ci.yml)
[![code style: prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg?style=flat-square)](https://github.com/prettier/prettier)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

</div>

Idiomatic Chart.js wrapper components for Vue 3, React, and Angular — all
sharing a single, framework-agnostic core. One generic `<Chart type="...">`
component per framework, covering every built-in Chart.js type plus the most
popular ecosystem extension kinds, with zero manual registration required.

## Packages

| Package | Description | npm |
|---|---|---|
| [`keystone-chartjs-vue`](packages/vue) | Vue 3 component | *(pre-release)* |
| [`keystone-chartjs-react`](packages/react) | React component | *(pre-release)* |
| [`keystone-chartjs-angular`](packages/angular) | Angular component | *(pre-release)* |

`keystone-chartjs-core` is the shared engine. It is not published
standalone — it is bundled into each framework package's own dist output.

## Features

- **One generic component** — `<Chart type="bar">`, `<Chart type="sankey">`,
  `<Chart type="candlestick">` — same API regardless of chart kind, no
  per-type component imports.
- **15 chart kinds out of the box** — all 8 Chart.js built-ins plus
  candlestick, ohlc, boxplot, violin, matrix, sankey, and treemap.
- **8 official plugins** — zoom/pan, annotation, data labels, gradient,
  timestack (an alternative time scale), hierarchical (a
  collapsible tree-like scale), image label (draws an image on each
  doughnut/pie slice), and autocolors (automatically assigns a distinct
  color per dataset), each an opt-in prop (`zoom`, `annotation`,
  `dataLabels`, `gradient`, `timestack`, `hierarchical`, `imageLabel`,
  `autocolors`).
- **Custom, inline plugins** — Chart.js's own `ChartConfiguration.plugins`
  field is fully supported via a `plugins` prop, for any plugin outside the
  8 official ones above.
- **Zero manual registration** — built-ins are registered eagerly; extension
  kinds and plugins are registered lazily, automatically, on first use.
  You never call `Chart.register(...)` yourself.
- **Reactive updates** — `data`/`options` changes update the chart in place
  via `chart.update()`; a `type` change, or a changed `plugins` array
  reference, triggers a full destroy-and-reconstruct.
- **Mixed charts** — per-dataset `type` overrides work out of the box; each
  kind used is registered automatically.
- **Accessible** — ARIA attributes pass through to the rendered `<canvas>`
  natively; a default slot/children mechanism provides real fallback content
  for assistive technology that can't render canvas.

## Quick start (Vue)

```bash
npm install keystone-chartjs-vue chart.js
```

```vue
<script setup lang="ts">
import { Chart } from 'keystone-chartjs-vue';

const data = {
  labels: ['Jan', 'Feb', 'Mar'],
  datasets: [{ label: 'Revenue', data: [50, 65, 58] }],
};
</script>

<template>
  <Chart type="bar" :data="data" aria-label="Monthly revenue" />
</template>
```

See the [documentation site](https://kcw.winnem.tech) for the full guide,
API reference, and live examples.

## Supported chart kinds

| Kind | Backed by |
|---|---|
| `bar`, `line`, `bubble`, `scatter`, `doughnut`, `pie`, `polarArea`, `radar` | Chart.js built-in |
| `candlestick`, `ohlc` | chartjs-chart-financial |
| `boxplot`, `violin` | @sgratzl/chartjs-chart-boxplot |
| `matrix` | chartjs-chart-matrix |
| `sankey` | chartjs-chart-sankey |
| `treemap` | chartjs-chart-treemap |

## Repository structure

```
packages/
  core/      Framework-agnostic engine (never published standalone)
  vue/       keystone-chartjs-vue
  react/     keystone-chartjs-react (Phase 3 — in progress)
  angular/   keystone-chartjs-angular (Phase 4 — not yet started)
docs/
  site/      Astro + Starlight documentation site
  IMPLEMENTATION_PLAN.md
  CHARTJS_ANALYSIS.md
```

## Development

```bash
pnpm install
turbo run typecheck lint test:coverage
```

Requires Node ≥ 22 and pnpm ≥ 10.

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines, and
[SECURITY.md](SECURITY.md) to report a vulnerability.

## License

MIT — see [LICENSE](LICENSE) for details.
Copyright (c) 2025 Geirr Winnem.
