// Vue-specific ESLint config for packages/vue — extends the shared root
// config and layers in vue-eslint-parser + eslint-plugin-vue so .vue SFCs
// (Chart.vue) actually get linted, not just plain .ts files. See
// docs/IMPLEMENTATION_PLAN.md Phase 0.
import rootConfig from '../../eslint.config.js';
import vueParser from 'vue-eslint-parser';
import vuePlugin from 'eslint-plugin-vue';
import tsParser from '@typescript-eslint/parser';

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
    },
  },
];
