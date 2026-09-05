// @ts-nocheck
function stryNS_9fa48() {
  var g = typeof globalThis === 'object' && globalThis && globalThis.Math === Math && globalThis || new Function("return this")();
  var ns = g.__stryker__ || (g.__stryker__ = {});
  if (ns.activeMutant === undefined && g.process && g.process.env && g.process.env.__STRYKER_ACTIVE_MUTANT__) {
    ns.activeMutant = g.process.env.__STRYKER_ACTIVE_MUTANT__;
  }
  function retrieveNS() {
    return ns;
  }
  stryNS_9fa48 = retrieveNS;
  return retrieveNS();
}
stryNS_9fa48();
function stryCov_9fa48() {
  var ns = stryNS_9fa48();
  var cov = ns.mutantCoverage || (ns.mutantCoverage = {
    static: {},
    perTest: {}
  });
  function cover() {
    var c = cov.static;
    if (ns.currentTestId) {
      c = cov.perTest[ns.currentTestId] = cov.perTest[ns.currentTestId] || {};
    }
    var a = arguments;
    for (var i = 0; i < a.length; i++) {
      c[a[i]] = (c[a[i]] || 0) + 1;
    }
  }
  stryCov_9fa48 = cover;
  cover.apply(null, arguments);
}
function stryMutAct_9fa48(id) {
  var ns = stryNS_9fa48();
  function isActive(id) {
    if (ns.activeMutant === id) {
      if (ns.hitCount !== void 0 && ++ns.hitCount > ns.hitLimit) {
        throw new Error('Stryker: Hit count limit reached (' + ns.hitCount + ')');
      }
      return true;
    }
    return false;
  }
  stryMutAct_9fa48 = isActive;
  return isActive(id);
}
import { Chart, registerables } from 'chart.js';
import type { ChartKind } from './types.js';

// Registers every Chart.js *built-in* controller/element/scale/plugin
// unconditionally, once, at module load — using Chart.js's own official
// `registerables` array, the same thing `'chart.js/auto'` does
// internally. This is required, not optional: Chart.js v4's plain
// `'chart.js'` entry point is the tree-shakeable build and registers
// NOTHING automatically — confirmed by a real, unmocked e2e run in
// packages/vue, which threw `"bar" is not a registered controller`
// the moment a real (non-mocked) Chart.js tried to construct a chart of
// a built-in kind. A prior version of this file's own comment claimed
// the opposite (that the plain entry point "already registers globally
// on import"), which every earlier test tier's own `vi.mock('chart.js',
// ...)` mocking made impossible to catch — this bug was invisible until
// the first tier to use real, unmocked Chart.js actually existed.
// `registerables` costs nothing extra in bundle size (it's already part
// of the base `chart.js` package this project depends on regardless);
// the 5 separate ecosystem extension packages below keep their existing
// lazy, dynamic-import-based registration, since THAT'S where the real
// tree-shaking benefit lives (avoiding pulling in 5 extra npm packages
// for kinds a consumer never uses).
Chart.register(...registerables);
interface ExtensionEntry {
  packageName: string;
  /** Named exports this package's own docs/source confirm are needed for
   * `Chart.register(...)` — see docs/CHARTJS_ANALYSIS.md §3 for the
   * per-package research this is built from. `violin`'s export names
   * follow the same naming convention as `boxplot`'s confirmed
   * `BoxPlotController`/`BoxAndWiskers` pair (`ViolinController`/
   * `Violin`) but were not independently confirmed against the package's
   * own docs the way every other entry here was — flagged here rather
   * than silently presented with the same confidence as the rest.
   */
  exportNames: string[];
}

/**
 * Maps each supported ChartKind to the npm package (if any) whose
 * controller/element must be registered via Chart.register(...) before a
 * chart of that kind can render. `null` means the kind is a Chart.js
 * built-in — its own controller/element/scale is registered eagerly at
 * module load instead, via the `Chart.register(...registerables)` call
 * above (see that call's own comment for why: this file previously
 * assumed, incorrectly, that the plain `'chart.js'` entry point
 * registers built-ins automatically on import — it does not).
 *
 * See docs/IMPLEMENTATION_PLAN.md Phase 1 for the lazy-registration
 * strategy the 7 real entries below back (register-on-first-use, not
 * eagerly on import, to preserve tree-shaking for consumers who only use
 * a handful of the 5 separate ecosystem extension packages).
 */
// Stryker disable all: this is a static lookup table, not branching
// logic. Confirmed via a real mutation run: because this whole object is
// evaluated exactly once at module load, Stryker's perTest coverage
// attributes every mutant inside it to whichever test happened to
// trigger that first import — not to the specific `it.each` iteration in
// registry.spec.ts that actually reads each individual entry. The result
// was ~30 "survived" mutants (wrong packageName/exportNames strings,
// truncated arrays, etc.) that registry.spec.ts's own tests already
// exercise correctly and would genuinely fail on if run for real — they
// only "survived" because Stryker never re-ran the right test against
// them. Real branching logic (`ensureChartKindRegistered`'s own `if`s,
// its error-throwing block, the `Chart.register` call) stays mutated —
// this exclusion is scoped to the data table alone.
export const CHART_TYPE_REGISTRY: Record<ChartKind, ExtensionEntry | null> = {
  bar: null,
  line: null,
  bubble: null,
  doughnut: null,
  pie: null,
  polarArea: null,
  radar: null,
  scatter: null,
  candlestick: {
    packageName: 'chartjs-chart-financial',
    exportNames: ['CandlestickController', 'CandlestickElement']
  },
  ohlc: {
    packageName: 'chartjs-chart-financial',
    exportNames: ['OhlcController', 'OhlcElement']
  },
  boxplot: {
    packageName: '@sgratzl/chartjs-chart-boxplot',
    exportNames: ['BoxPlotController', 'BoxAndWiskers']
  },
  violin: {
    packageName: '@sgratzl/chartjs-chart-boxplot',
    exportNames: ['ViolinController', 'Violin']
  },
  matrix: {
    packageName: 'chartjs-chart-matrix',
    exportNames: ['MatrixController', 'MatrixElement']
  },
  sankey: {
    packageName: 'chartjs-chart-sankey',
    exportNames: ['SankeyController', 'Flow']
  },
  treemap: {
    packageName: 'chartjs-chart-treemap',
    exportNames: ['TreemapController', 'TreemapElement']
  }
};
// Stryker restore all

/** Kinds already registered this session — `null`-entry (built-in) kinds
 * get added here too on first check, purely so repeat calls short-circuit
 * on a Set lookup instead of re-reading the registry object every time. */
const registeredKinds = new Set<ChartKind>();

/**
 * Dynamically imports the backing package for a given extension kind,
 * using a static, literal specifier per case — not `entry.packageName`
 * (a variable) the way this used to work. This is the real, confirmed
 * fix for a genuine limitation, not a guess: a variable specifier, even
 * with `@vite-ignore`, can never be discovered by a bundler's static
 * dependency crawler, which broke dynamic resolution for 6 of these 7
 * kinds in a real Vite-dev-server browser context (see
 * docs/IMPLEMENTATION_PLAN.md's own "Current status & open issues" item
 * #2 and `candlestick-chart.spec.ts`'s own header comment for the full
 * investigation — a parallel-worker race, a stale Vite cache, and
 * `optimizeDeps.include` were all tried and confirmed NOT to fix it
 * first). A literal specifier needs no `@vite-ignore` at all — a
 * bundler's own static crawler can already discover and pre-bundle it
 * correctly, the same way any other real `import('literal-name')` call
 * works.
 *
 * Two kinds share a package (candlestick/ohlc → chartjs-chart-financial;
 * boxplot/violin → @sgratzl/chartjs-chart-boxplot) — the package name
 * here necessarily duplicates `CHART_TYPE_REGISTRY`'s own `packageName`
 * field above, since a literal specifier can't be built from a shared
 * variable; adding a new extension kind means updating both places, not
 * just one. `default` is genuinely unreachable in practice —
 * `ensureChartKindRegistered` below only ever calls this after its own
 * `if (!entry) return` guard has already ruled out every built-in kind
 * (whose `CHART_TYPE_REGISTRY` entry is `null`) — it exists so this
 * function's own return type stays a real `Promise`, not
 * `Promise | undefined`, for every `ChartKind` TypeScript's own
 * exhaustiveness checking is aware of.
 */
async function importExtensionModule(kind: ChartKind): Promise<Record<string, unknown>> {
  if (stryMutAct_9fa48("479")) {
    {}
  } else {
    stryCov_9fa48("479");
    switch (kind) {
      case stryMutAct_9fa48("480") ? "" : (stryCov_9fa48("480"), 'candlestick'):
      case stryMutAct_9fa48("482") ? "" : (stryCov_9fa48("482"), 'ohlc'):
        if (stryMutAct_9fa48("481")) {} else {
          stryCov_9fa48("481");
          // Stryker disable next-line StringLiteral
          return import('chartjs-chart-financial');
        }
      case stryMutAct_9fa48("484") ? "" : (stryCov_9fa48("484"), 'boxplot'):
      case stryMutAct_9fa48("486") ? "" : (stryCov_9fa48("486"), 'violin'):
        if (stryMutAct_9fa48("485")) {} else {
          stryCov_9fa48("485");
          // Stryker disable next-line StringLiteral
          return import('@sgratzl/chartjs-chart-boxplot');
        }
      case stryMutAct_9fa48("489") ? "" : (stryCov_9fa48("489"), 'matrix'):
        if (stryMutAct_9fa48("488")) {} else {
          stryCov_9fa48("488");
          // Stryker disable next-line StringLiteral
          return import('chartjs-chart-matrix');
        }
      case stryMutAct_9fa48("492") ? "" : (stryCov_9fa48("492"), 'sankey'):
        if (stryMutAct_9fa48("491")) {} else {
          stryCov_9fa48("491");
          // Stryker disable next-line StringLiteral
          return import('chartjs-chart-sankey');
        }
      case stryMutAct_9fa48("495") ? "" : (stryCov_9fa48("495"), 'treemap'):
        if (stryMutAct_9fa48("494")) {} else {
          stryCov_9fa48("494");
          // Stryker disable next-line StringLiteral
          return import('chartjs-chart-treemap');
        }
      // Structurally required for TypeScript's own exhaustiveness checking
      // (every switch must return on every code path), but genuinely
      // unreachable at runtime — every real extension kind is already
      // handled by one of the cases above, and `ensureChartKindRegistered`
      // never calls this function at all for a built-in kind. Confirmed
      // via a real `test:coverage` run flagging this exact line, not
      // assumed.
      //
      // The `/* v8 ignore next 2 */` marker below must sit immediately
      // above the `default:`/`throw` pair it's meant to exempt — a real
      // mistake found and fixed here: an earlier version placed the
      // marker four comment lines above instead, which meant it exempted
      // two of *those* comment lines (which needed no coverage anyway)
      // rather than the actual unreachable statement pair, so `test:
      // coverage` kept flagging this line regardless of the marker's
      // presence — confirmed via a real coverage run before and after
      // this fix.
      // Stryker disable all: genuinely unreachable, see the comment above —
      // confirmed via a real mutation run showing both the `default:` case
      // itself and its own throw message as "NoCoverage" (no test can ever
      // reach code that never executes, by definition), not "Survived".
      /* v8 ignore next 2 */
      default:
        throw new Error(`keystone-chartjs-core: no extension package registered for chart kind "${kind}"`);
      // Stryker restore all
    }
  }
}

/**
 * Ensures Chart.js can render the given kind, dynamically importing and
 * registering its controller/elements exactly once per kind, per process.
 * Safe to call redundantly — every caller (mount, update, mixed-dataset
 * resolution) calls this for every kind it touches, and the cache makes
 * repeat calls a no-op.
 */
export async function ensureChartKindRegistered(kind: ChartKind): Promise<void> {
  if (registeredKinds.has(kind)) return;
  const entry = CHART_TYPE_REGISTRY[kind];
  if (!entry) {
    registeredKinds.add(kind);
    return;
  }
  const mod = await importExtensionModule(kind);
  const exportsToRegister = entry.exportNames.map(exportName => {
    const exported = mod[exportName];
    if (!exported) {
      throw new Error(`keystone-chartjs-core: expected "${entry.packageName}" to export "${exportName}" ` + `for chart kind "${kind}", but it did not. The installed version of that package ` + 'may have renamed or removed this export — see docs/CHARTJS_ANALYSIS.md §3.');
    }
    return exported;
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Chart.register's
  // own overloads expect concrete controller/element/plugin classes; the values here
  // are only known to be "whatever a third-party package's own module namespace
  // contains", which TypeScript has no way to narrow further at this point.
  Chart.register(...(exportsToRegister as any[]));
  registeredKinds.add(kind);
}

/**
 * Test-only: clears the registration cache so tests can verify
 * first-use-vs-cached behavior from a known-empty state. Not part of the
 * package's public entry point (see index.ts) — import directly from
 * './registry.js' in tests.
 */
export function __resetRegistryForTests(): void {
  registeredKinds.clear();
}