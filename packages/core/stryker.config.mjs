// @ts-check
/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
const config = {
  packageManager: 'pnpm',
  // Explicit, not left to Stryker's default `['@stryker-mutator/*']` glob
  // auto-scan — confirmed via a real run and Stryker's own troubleshooting
  // docs (https://stryker-mutator.io/docs/stryker-js/troubleshooting/,
  // "Plugins can't be found when using pnpm as package manager"): pnpm's
  // non-flat node_modules structure breaks that auto-detection entirely,
  // producing "Cannot find TestRunner plugin 'vitest' ... no TestRunner
  // plugins were loaded" even though the package is actually installed.
  plugins: ['@stryker-mutator/vitest-runner'],
  testRunner: 'vitest',
  reporters: ['clear-text', 'progress', 'html', 'json'],
  // 'all', not 'perTest': confirmed via a real side-by-side run that
  // 'perTest' was silently undercounting real coverage across this
  // project's test suites (zoomPlugin.ts alone jumped from 66.04% to
  // 68.57% — 27 mutants "freed" with zero new tests — and
  // gradientPlugin.ts/imageLabelPlugin.ts improved too), not just for
  // it.each-parameterized tests. Slower per run (reruns the full suite
  // per mutant instead of only the tests that "covered" it), but the
  // accuracy is worth it — a fast, wrong number is worse than a slow,
  // right one.
  coverageAnalysis: 'all',
  // 'all' and ignoreStatic are mutually exclusive per Stryker's own
  // config validation — disabled together with the change above.
  ignoreStatic: false,
  // Explicit test-run timeout budget, not left to Stryker's own default —
  // matches keystone-dashboard-layout's own real core package config
  // (confirmed directly from that project's actual stryker.conf.json, not
  // assumed), which sets the same value defensively against mutants that
  // hang rather than fail cleanly (this package's own ResizeObserver
  // wiring is exactly the kind of async/callback-based code where a bad
  // mutant could otherwise spin forever).
  timeoutMS: 15000,

  // Scoped to the real logic files, not types.ts (pure type declarations —
  // nothing for Stryker to mutate there), not index.ts (a barrel
  // re-export with no logic of its own), and not test-utils.ts (trivial
  // DOM-fixture helpers with no branches/conditionals worth mutating).
  // imageLabelPlugin.ts, gradientPlugin.ts, and zoomPlugin.ts added:
  // real, non-trivial ported logic (see each file's own header
  // comment), each with its own dedicated test file
  // (tests/unit/imageLabelPlugin.spec.ts, tests/unit/gradientPlugin.
  // spec.ts, tests/unit/zoomPlugin.spec.ts).
  mutate: ['src/registry.ts', 'src/controller.ts', 'src/plugins.ts', 'src/imageLabelPlugin.ts', 'src/gradientPlugin.ts', 'src/zoomPlugin.ts'],

  vitest: {
    configFile: 'vitest.config.ts',
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
