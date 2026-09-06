# keystone-chartjs-core

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
- `withZoom`, `withAnnotation`, `withDataLabels`, `withGradient`,
  `withTimestack`, `withHierarchical`, `withImageLabel`,
  `withAutocolors`, `withDeferred`, `withTrendline` — register the
  respective official plugin/scale once and, where the plugin has
  config of its own, merge it into `options.plugins.*`. Nine of the ten
  are local ports (dissected directly from each real package's own
  installed source); only `withTimestack` still performs a real dynamic
  `import()` of a third-party package.
- Exported types: `ChartKind`, `ChartConfigData`, `ChartConfigDataset`,
  `ChartUpdatePayload`, `ChartControllerHandle`, `ChartConfiguration`,
  `ChartJs`, `ZoomPluginOptions`, `AnnotationPluginOptions`,
  `DataLabelsPluginOptions`, `AutocolorsPluginOptions`,
  `DeferredPluginOptions`, `ImageLabelPluginOptions`.

## License

MIT — see [LICENSE](LICENSE).
Copyright (c) 2025 Geirr Winnem.
