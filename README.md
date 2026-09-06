# keystone-chartjs-wrappers

<div align="center">

<svg width="620" height="440" viewBox="0 0 620 440" xmlns="http://www.w3.org/2000/svg">
  <rect width="620" height="440" rx="14" fill="#1d2126" stroke="rgba(255,255,255,0.1)"/>

  <rect x="20" y="20" width="282" height="192" rx="10" fill="#262b31" stroke="rgba(255,255,255,0.1)"/>
  <text x="36" y="45" font-family="monospace" font-size="11" fill="#9ca6aa">type="bar"</text>
  <g transform="translate(36,59) scale(2.5,2.78)">
    <rect x="6" y="24" width="12" height="20" rx="2" fill="#4fb8c9"/>
    <rect x="24" y="12" width="12" height="32" rx="2" fill="#4fb8c9"/>
    <rect x="42" y="30" width="12" height="14" rx="2" fill="#f2a93b"/>
    <rect x="60" y="6" width="12" height="38" rx="2" fill="#4fb8c9"/>
    <rect x="78" y="18" width="12" height="26" rx="2" fill="#4fb8c9"/>
  </g>

  <rect x="318" y="20" width="282" height="192" rx="10" fill="#262b31" stroke="rgba(255,255,255,0.1)"/>
  <text x="334" y="45" font-family="monospace" font-size="11" fill="#9ca6aa">type="line"</text>
  <g transform="translate(334,59) scale(2.5,2.78)">
    <polyline points="4,40 22,28 40,34 58,14 76,22 96,4" fill="none" stroke="#4fb8c9" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="96" cy="4" r="1.2" fill="#f2a93b"/>
  </g>

  <rect x="20" y="228" width="282" height="192" rx="10" fill="#262b31" stroke="rgba(255,255,255,0.1)"/>
  <text x="36" y="253" font-family="monospace" font-size="11" fill="#9ca6aa">type="doughnut"</text>
  <g transform="translate(36,267) scale(2.5,2.78)">
    <g transform="translate(50,25)">
      <path d="M 0 -18 A 18 18 0 1 1 -12 -13.4 Z" fill="#4fb8c9"/>
      <path d="M -12 -13.4 A 18 18 0 0 1 0 -18 Z" fill="#f2a93b"/>
      <circle r="9" fill="#262b31"/>
    </g>
  </g>

  <rect x="318" y="228" width="282" height="192" rx="10" fill="#262b31" stroke="rgba(255,255,255,0.1)"/>
  <text x="334" y="253" font-family="monospace" font-size="11" fill="#9ca6aa">type="radar"</text>
  <g transform="translate(334,267) scale(2.5,2.78)">
    <polygon points="50,6 78,20 68,42 32,42 22,20" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="0.5"/>
    <polygon points="50,14 68,24 60,38 40,38 32,24" fill="rgba(79,184,201,0.35)" stroke="#4fb8c9" stroke-width="1"/>
  </g>
  <rect x="454" y="16" width="150" height="26" rx="6" fill="#14171a" stroke="#9c6208"/>
  <text x="529" y="33" font-family="monospace" font-size="11" fill="#f2a93b" text-anchor="middle">&lt;Chart type="..." /&gt;</text>
</svg>

**[View Documentation →](https://kcw.winnem.tech)**

</div>

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
- **10 official plugins** — zoom/pan, annotation, data labels, gradient,
  timestack (an alternative time scale), hierarchical (a
  collapsible tree-like scale), image label (draws an image on each
  doughnut/pie slice), autocolors (automatically assigns a distinct
  color per dataset), deferred (defers a chart's own initial update
  until it scrolls into the viewport), and trendline (fits a real
  linear or exponential trend line to each dataset), each an opt-in
  prop (`zoom`, `annotation`, `dataLabels`, `gradient`, `timestack`,
  `hierarchical`, `imageLabel`, `autocolors`, `deferred`, `trendline`).
- **Custom, inline plugins** — Chart.js's own `ChartConfiguration.plugins`
  field is fully supported via a `plugins` prop, for any plugin outside the
  10 official ones above.
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
