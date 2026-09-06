// Flat ESLint config shared across all packages.
// Framework-specific rules (vue-eslint-parser, eslint-plugin-react-hooks,
// @angular-eslint) should be layered in per-package once each package's
// source exists — see docs/IMPLEMENTATION_PLAN.md Phase 0.
import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import prettier from 'eslint-plugin-prettier';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        sourceType: 'module',
      },
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      prettier,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      'prettier/prettier': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      // TypeScript's own compiler already checks every identifier is
      // defined — more accurately than this plain ESLint core rule can,
      // since `no-undef` has no concept of TypeScript's own type-only
      // globals (`CanvasLineCap`, `CanvasTextAlign`, `EventListener`,
      // etc., from TS's own DOM lib declarations) and flags them as
      // undefined even though they're real, valid types — confirmed
      // directly: this is exactly what surfaced once lint could finally
      // complete a full pass. This is typescript-eslint's own standard,
      // documented guidance for TS files, not a one-off workaround.
      'no-undef': 'off',
    },
  },
  {
    // Plain .js/.mjs/.cjs files (build/tooling scripts — e.g.
    // analyze-mutants.js, stryker.config.mjs) aren't matched by the
    // **/*.ts,**/*.tsx block above at all, so they got zero declared
    // globals and fell back to bare `js.configs.recommended` alone —
    // `console`, a real Node global, was flagged as undefined as a
    // result.
    files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
  {
    // Test files get a relaxed `no-explicit-any` (warn, not error) —
    // real, pre-existing usage across this monorepo's test suites is
    // extensive (294 confirmed occurrences in
    // packages/core/tests/unit/plugins/zoom/zoomPlugin.spec.ts alone,
    // once lint could finally complete a full pass), almost entirely
    // casting complex DOM/Chart.js internals (mocked event objects,
    // partial chart/scale instances) that would need substantial,
    // risky rewrites to type precisely for zero real benefit — a
    // common, accepted convention: production `src/` code stays at
    // 'error' (unchanged, inherited from tseslint's own recommended
    // config above), test code gets the pragmatic relaxation.
    files: ['**/tests/**', '**/*.spec.ts', '**/*.spec.tsx', '**/*.test.ts', '**/*.test.tsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
    },
  },
  {
    // `.stryker-tmp` (every package with mutation testing has one, not
    // just core) holds a full copy of that package's own source tree per
    // sandbox — confirmed directly: 12 separate sandbox-*/ directories
    // in packages/core/.stryker-tmp alone. Without this, `eslint .` tries
    // to traverse and lint every single one, which hung indefinitely on
    // Windows (no CPU activity — an extreme case of the well-known
    // Windows-vs-Linux filesystem-traversal performance gap over many
    // small, deeply-nested files) even though the same command completed
    // in CI's own Linux runners.
    ignores: [
      '**/dist/**',
      '**/coverage/**',
      '**/node_modules/**',
      '**/reports/**',
      '**/.stryker-tmp/**',
      'docs/site/**',
    ],
  },
];
