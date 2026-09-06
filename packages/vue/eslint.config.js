// Vue-specific ESLint config for packages/vue — extends the shared root
// config and layers in vue-eslint-parser + eslint-plugin-vue so .vue SFCs
// (Chart.vue) actually get linted, not just plain .ts files. See
// docs/IMPLEMENTATION_PLAN.md Phase 0.
import rootConfig from '../../eslint.config.js';
import vueParser from 'vue-eslint-parser';
import vuePlugin from 'eslint-plugin-vue';
import tsParser from '@typescript-eslint/parser';
import globals from 'globals';

export default [
  ...rootConfig,
  ...vuePlugin.configs['flat/recommended'],
  {
    files: ['**/*.vue'],
    languageOptions: {
      parser: vueParser,
      parserOptions: {
        parser: tsParser,
        sourceType: 'module',
      },
      // The root config's own browser globals (globals.browser) only
      // apply to **/*.ts,**/*.tsx — .vue files got none at all, so a
      // real, correct type like `HTMLCanvasElement` (Chart.vue's own
      // canvas ref type) was flagged as an undefined global. Confirmed
      // directly: this is what real lint runs against this repo's own
      // .vue files surfaced, once eslint-plugin-vue's own version
      // mismatch (see this file's own devDependency) stopped crashing
      // before it could reach this file at all.
      globals: {
        ...globals.browser,
      },
    },
    rules: {
      // `Chart` is this library's own deliberate, single-word public API
      // — `<Chart type="bar">` is the whole point (see
      // docs/IMPLEMENTATION_PLAN.md Phase 2's "one component, not
      // per-type components" decision). eslint-plugin-vue's own
      // `flat/recommended` config enables this rule by default (aimed at
      // preventing collisions with native/reserved HTML elements), which
      // doesn't apply here — renaming the component to satisfy it would
      // break the actual public API.
      'vue/multi-word-component-names': 'off',
    },
  },
];
