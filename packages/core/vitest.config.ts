/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';

// Framework-agnostic — no Vue/React/Angular plugin needed. jsdom because
// keystone-chartjs-core's controller.ts constructs a real Chart.js
// instance against an HTMLCanvasElement; Chart.js needs a DOM (even a
// jsdom one, which has no real 2D canvas context — real controller tests
// will likely need a canvas-context mock/stub, not a real render) to
// construct at all.
export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['tests/unit/**/*.spec.ts'],
    coverage: {
      reporter: ['text', 'html', 'json'],
      provider: 'v8',
      // Scoped to this package's own source, not everything the v8
      // provider's default `all: true` behavior would otherwise sweep in
      // (confirmed via a real run: `stryker.config.mjs` at the package
      // root was showing up as 0%-covered "application code" simply
      // because nothing excluded it — it's a mutation-testing config
      // file, not source).
      include: ['src/**/*.ts'],
      // types.ts is excluded deliberately, not to dodge the floor: it is
      // 100% type-only declarations (interfaces/type aliases), which TS
      // erases entirely at compile time — there is no runtime statement
      // for v8 to ever instrument, so it can only ever report 0%, which
      // is a tooling artifact, not untested logic. Every other file under
      // src/ has real runtime code and stays in scope.
      exclude: ['src/types.ts'],
      // Project-wide floor: every package enforces this via
      // coverage.thresholds, not just an aspirational number in docs —
      // `vitest run --coverage` fails the run if any metric dips below.
      thresholds: {
        statements: 90,
        branches: 90,
        functions: 90,
        lines: 90,
      },
    },
  },
});
