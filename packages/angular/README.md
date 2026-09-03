# keystone-chartjs-angular

<div align="center">

<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 22 22" fill="none" width="72" height="72">
  <rect x="1" y="10" width="4" height="11" rx="1" fill="#4FB8C9"/>
  <rect x="7" y="4" width="4" height="17" rx="1" fill="#F2A93B"/>
  <rect x="13" y="12" width="4" height="9" rx="1" fill="#4FB8C9"/>
</svg>

[![Documentation](https://img.shields.io/badge/docs-kcw.winnem.tech%2Fangular-DD0031?style=flat-square&logo=angular&logoColor=white)](https://kcw.winnem.tech)
[![CI](https://github.com/gwinnem/keystone-chartjs-wrappers/actions/workflows/ci.yml/badge.svg)](https://github.com/gwinnem/keystone-chartjs-wrappers/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/keystone-chartjs-angular?style=flat-square)](https://www.npmjs.com/package/keystone-chartjs-angular)
[![code style: prettier](https://img.shields.io/badge/code_style-prettier-ff69b4.svg?style=flat-square)](https://github.com/prettier/prettier)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](LICENSE)

</div>

> **Pre-release — Phase 4 not yet started.** The Angular component is not
> yet implemented beyond the Phase 0 toolchain smoke test. See
> [`keystone-chartjs-vue`](../vue) for the reference implementation, or
> the [monorepo README](../../README.md) for overall project status.

A single, generic `KeystoneChartComponent` for Angular wrapping Chart.js —
every built-in chart type plus the most popular ecosystem extensions,
selected via a `type` input. Zero manual `Chart.register(...)` calls
required.

## Planned API

```html
<keystone-chart
  type="bar"
  [data]="data"
  [options]="options"
  aria-label="Monthly revenue"
/>
```

```ts
import { KeystoneChartComponent } from 'keystone-chartjs-angular';

@Component({
  standalone: true,
  imports: [KeystoneChartComponent],
  template: `<keystone-chart type="bar" [data]="data" />`,
})
export class MyComponent {
  data = {
    labels: ['Jan', 'Feb', 'Mar'],
    datasets: [{ label: 'Revenue', data: [50, 65, 58] }],
  };
}
```

## License

MIT — see [LICENSE](LICENSE).
Copyright (c) 2025 Geirr Winnem.
