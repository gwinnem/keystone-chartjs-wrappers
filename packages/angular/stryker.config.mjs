// @ts-check
/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
const config = {
  packageManager: 'pnpm',
  // Explicit, not left to Stryker's default `['@stryker-mutator/*']` glob
  // auto-scan — confirmed via a real run against packages/core (see that
  // package's own stryker.config.mjs comment) and Stryker's own
  // troubleshooting docs: pnpm's non-flat node_modules structure breaks
  // that auto-detection entirely.
  plugins: ['@stryker-mutator/jest-runner'],
  testRunner: 'jest',
  reporters: ['clear-text', 'progress', 'html', 'json'],
  // 'off', not 'perTest' like the other three packages' own Vitest-based
  // configs — @stryker-mutator/jest-runner's own docs explicitly call
  // this out ("Make sure you... set coverageAnalysis to 'off' in your
  // Stryker configuration"), unlike the vitest-runner, which supports
  // 'perTest' properly. A real, confirmed divergence, not an oversight.
  coverageAnalysis: 'off',
  ignoreStatic: true,
  timeoutMS: 15000,

  // Jest runner, not Vitest — this package switched away from Vitest
  // (via @analogjs/vite-plugin-angular) after hitting the same
  // genuinely unresolved upstream ecosystem bug
  // keystone-dashboard-layout's own Angular package already ran into
  // and abandoned Vitest for (analogjs/analog#1502,
  // angular/angular-cli#31732) — confirmed directly via a real failing
  // run here too (`ɵgetCleanupHook is not a function`), not assumed.
  // This makes Angular the one package in this monorepo not sharing the
  // other three's Vitest-based mutation runner, matching KDL's own
  // real precedent exactly.
  mutate: ['src/keystone-chart.component.ts', '!src/index.ts'],

  jest: {
    configFile: 'jest.config.ts',
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
