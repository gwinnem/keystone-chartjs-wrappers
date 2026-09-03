/// <reference types="vitest" />
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import dts from 'vite-plugin-dts';
import { resolve } from 'node:path';

// Single config file for both `vite build` (library mode) and `vitest`
// (Vitest reads the same `test` field Vite itself ignores) — the
// standard combined idiom, rather than a separate vitest.config.ts.
export default defineConfig({
  plugins: [
    vue(),
    dts({ include: ['src'], rollupTypes: false }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'KeystoneChartjsVue',
      fileName: (format) => `keystone-chartjs-vue.${format === 'es' ? 'es.js' : 'umd.cjs'}`,
    },
    rollupOptions: {
      // vue stays external (peer dependency — consumers bring their own
      // Vue install). keystone-chartjs-core is now bundled directly into
      // this package's own dist (per your explicit direction: core is
      // never published standalone, imported directly into each
      // framework package instead) — no longer listed here. chart.js
      // stays external too: this package's own source imports its types
      // directly (now via keystone-chartjs-core's own re-export, not
      // 'chart.js' directly — see that package's own types.ts) and
      // constructs real Chart.js instances at runtime, so it's a real,
      // separate `peerDependency` in package.json (not `dependencies`),
      // matching vue-chartjs's own established convention: Chart.js
      // keeps global, module-level registration state
      // (`Chart.register(...)`), so bundling/duplicating it risks a
      // consumer's app ending up with two separate copies whose
      // registrations are invisible to each other.
      external: ['vue', 'chart.js'],
      output: {
        globals: { vue: 'Vue' },
      },
    },
  },
  test: {
    environment: 'jsdom',
    include: ['tests/component/**/*.spec.ts'],
    coverage: {
      reporter: ['text', 'html', 'json'],
      // Scoped to real source, same reason as packages/core/
      // vitest.config.ts's own comment: without this, v8's default
      // `all: true` behavior sweeps in stray root-level files
      // (stryker.config.mjs, vite.config.ts itself) as 0%-covered
      // "application code" — confirmed to be a real, not hypothetical,
      // risk by that exact thing happening to packages/core earlier in
      // this project.
      include: ['src/**/*.{ts,vue}'],
      // Project-wide floor — see packages/core/vitest.config.ts's own
      // comment; enforced identically across all four packages.
      thresholds: {
        statements: 90,
        branches: 90,
        functions: 90,
        lines: 90,
      },
    },
  },
  // This same config file also backs the dev server Playwright's own
  // e2e suite runs against (playwright.config.ts's own `webServer:
  // pnpm exec vite dev ...`).
  //
  // `optimizeDeps.include` was tried here and confirmed NOT to help,
  // for a real, specific reason (not guessed): a real run's own startup
  // output showed "Failed to resolve dependency: chartjs-chart-
  // financial, present in 'optimizeDeps.include'" for all 8 of the
  // extension-kind/plugin packages this file used to list — including
  // the 4 (sankey/zoom/annotation/datalabels) that already resolve
  // successfully at runtime. Vite's own dependency-scan step for
  // `optimizeDeps.include` resolves relative to THIS package's own
  // root (`packages/vue`), where none of these 8 packages are direct
  // dependencies at all — they're all direct dependencies of
  // `packages/core` instead (confirmed directly in that package's own
  // `package.json`), so the scan can never find any of them from here,
  // successful-at-runtime or not. Removed, since it produced only a
  // confusing startup warning with no actual effect either way.
  //
  // The underlying issue itself (6 of the 7 extension kinds
  // consistently throw "Failed to resolve module specifier" for their
  // own backing package, in this specific dev-server setup) is left as
  // a known, documented limitation rather than fixed here — see
  // `tests/e2e/candlestick-chart.spec.ts`'s own header comment for the
  // full investigation (a parallel-worker discovery race and a stale
  // on-disk Vite cache were both tried and ruled out too) and the
  // confirmed real fix (rewriting `packages/core/src/registry.ts`'s own
  // dynamic import to use static, literal `import()` calls per kind),
  // deliberately deferred rather than made unilaterally to already
  // mutation-tested Phase 1 code.
});
