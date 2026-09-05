# keystone-chartjs-core

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

Framework-agnostic Chart.js engine shared by `keystone-chartjs-vue`,
`keystone-chartjs-react`, and `keystone-chartjs-angular`.

> **Not intended for direct use.** This package is bundled into each
> framework package's own dist output and is never published standalone.
> Import from `keystone-chartjs-vue`, `keystone-chartjs-react`, or
> `keystone-chartjs-angular` instead.

## What it provides

- `createChartController(canvas, payload)` — constructs a Chart.js instance,
  wires `ResizeObserver`, and returns an imperative handle for
  update/resize/theme/destroy.
- `ensureChartKindRegistered(kind)` — lazily imports and registers the
  backing package for any of the 7 ecosystem extension kinds, once, on first
  use. Built-ins are registered eagerly at module load via
  `Chart.register(...registerables)`.
- `withZoom`, `withAnnotation`, `withDataLabels` — register the respective
  official plugin once and merge its config into `options.plugins.*`.
- Exported types: `ChartKind`, `ChartConfigData`, `ChartConfigDataset`,
  `ChartUpdatePayload`, `ChartControllerHandle`, `ChartConfiguration`,
  `ChartJs`, `ZoomPluginOptions`, `AnnotationPluginOptions`,
  `DataLabelsPluginOptions`.

## License

MIT — see [LICENSE](LICENSE).
Copyright (c) 2025 Geirr Winnem.
