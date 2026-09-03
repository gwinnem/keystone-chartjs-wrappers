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

  // Unlike Vue's SFCs, Chart.tsx is plain TS/JSX — a fully supported
  // Stryker mutation target, same as any other .ts(x) file.
  mutate: ['src/Chart.tsx', '!src/index.ts'],

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
