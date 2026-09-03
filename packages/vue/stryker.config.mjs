// @ts-check
/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
const config = {
  packageManager: 'pnpm',
  // Explicit, not left to Stryker's default `['@stryker-mutator/*']` glob
  // auto-scan — confirmed via a real run against packages/core (see that
  // package's own stryker.config.mjs comment) and Stryker's own
  // troubleshooting docs: pnpm's non-flat node_modules structure breaks
  // that auto-detection entirely.
  plugins: ['@stryker-mutator/vitest-runner'],
  testRunner: 'vitest',
  reporters: ['clear-text', 'progress', 'html', 'json'],
  coverageAnalysis: 'perTest',
  ignoreStatic: true,
  timeoutMS: 15000,

  // Chart.vue itself is deliberately excluded — Stryker mutates JS/TS
  // ASTs, and a .vue SFC's <script> block isn't an officially supported
  // target the same way a plain .ts file is (same reasoning
  // keystone-theme-builder's own stryker.config.mjs documents for its own
  // .vue components). All of Phase 2's real chart lifecycle/plugin logic
  // was deliberately extracted into useChartController.ts (a plain .ts
  // composable) specifically so this config would have something real
  // to target — Chart.vue itself is now just prop declarations + a
  // template, matching keystone-theme-builder's own thin-.vue-component
  // convention. A prior version of this config kept the logic inline in
  // Chart.vue and had `mutate` pointing at `src/**/*.ts` with nothing
  // real for that glob to match — confirmed as a genuine gap (not
  // hypothetical) before ever running Stryker for real against it.
  mutate: ['src/useChartController.ts'],

  vitest: {
    configFile: 'vite.config.ts',
  },

  thresholds: {
    high: 80,
    low: 60,
    break: null,
  },

  htmlReporter: {
    fileName: 'reports/mutation/mutation-report.html',
  },

  jsonReporter: {
    fileName: 'reports/mutation/mutation-report.json',
  },

  tempDirName: '.stryker-tmp',
  cleanTempDir: true,
};

export default config;
