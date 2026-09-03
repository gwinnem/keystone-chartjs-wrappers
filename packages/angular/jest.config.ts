import type { Config } from 'jest';

/**
 * Jest configuration for keystone-chartjs-angular's own unit tests —
 * replacing the earlier @analogjs/vite-plugin-angular + Vitest attempt,
 * which hit the same genuinely unresolved upstream ecosystem bug
 * keystone-dashboard-layout's own Angular package already ran into and
 * abandoned Vitest for (analogjs/analog#1502, angular/angular-cli#31732)
 * — confirmed directly against that project's real, working
 * jest.config.ts/setup-jest.ts/package.json, not guessed. This project's
 * own convention of a separate tests/unit/ directory (not KDL's own
 * colocated src/**\/*.spec.ts) is kept as-is — Jest's default testMatch
 * already picks up *.spec.ts anywhere under the project root, so no
 * explicit `roots`/`testMatch` override is needed for that difference.
 *
 * `jest-preset-angular` is the mature, long-established way to run
 * Angular's own `TestBed`-based specs under Jest — a single Node.js
 * process compiling via ts-jest/Angular's own Ivy-aware transform.
 *
 * `module.exports =`, not `export default` — confirmed via a real run:
 * this package's own `package.json` sets `"type": "commonjs"` (a
 * deliberate divergence from core/vue/react — see this package's own
 * package.json comment history), but the shared root
 * `tsconfig.base.json` sets `verbatimModuleSyntax: true` with
 * `module: "ESNext"`, which every package's own tsconfig inherits.
 * ts-node (needed here since Jest reads this file directly) enforces
 * that a file's actual module syntax matches its real runtime module
 * system under that setting — `export default` in a CommonJS-typed
 * file fails that check outright ("ECMAScript imports and exports
 * cannot be written in a CommonJS file under 'verbatimModuleSyntax'").
 * Plain `module.exports` sidesteps the check entirely, since it isn't
 * TypeScript module syntax at all.
 */
const config: Config = {
  preset: `jest-preset-angular`,
  testEnvironment: `jsdom`,
  setupFilesAfterEnv: [`<rootDir>/setup-jest.ts`],
  // Strips a trailing `.js` off any relative import specifier before
  // Jest's own resolver looks for the file — needed because
  // keystone-chartjs-core's own src/index.ts (and its sibling modules)
  // use the standard TS/ESM-style convention of importing from './x.js'
  // even though the real source file on disk is './x.ts' (the '.js' is
  // the eventual compiled-output extension, not a literal file that
  // exists yet). Vite/Vitest's own resolver understands this convention
  // natively; confirmed via a real run that Jest's default resolver
  // does not — without this, "Cannot find module './controller.js'"
  // for every such import core's own barrel makes.
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  // Project-wide floor — see packages/core/vitest.config.ts's own
  // comment; enforced identically across all four packages, just via
  // Jest's own `coverageThreshold` key here rather than Vitest's
  // `coverage.thresholds`.
  coverageThreshold: {
    global: {
      statements: 90,
      branches: 90,
      functions: 90,
      lines: 90,
    },
  },
  testPathIgnorePatterns: [
    `<rootDir>/node_modules/`,
    `<rootDir>/dist/`,
    // Stryker's own temp sandbox copies of this whole package — same
    // real, confirmed-necessary exclusion KDL's own jest.config.ts
    // documents (each concurrent mutation-testing worker gets its own
    // copy of every *.spec.ts file; without this, Jest happily
    // discovers and runs all of them too).
    `<rootDir>/.stryker-tmp/`,
    // Playwright's own e2e specs, once they exist under tests/e2e/ —
    // same reason KDL's own config excludes its own e2e/ directory:
    // @playwright/test's global `test`/`expect` and its own process/
    // worker orchestration cannot be loaded inside a Jest run at all.
    `<rootDir>/tests/e2e/`,
  ],
};

module.exports = config;
