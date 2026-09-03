// React-specific ESLint config for packages/react — extends the shared
// root config and layers in eslint-plugin-react-hooks so Chart.tsx's
// useEffect dependency array (a known placeholder gap — see
// docs/IMPLEMENTATION_PLAN.md Phase 3) gets flagged by the rules-of-hooks
// linter as it's fixed, not just caught by manual review.
import rootConfig from '../../eslint.config.js';
import reactHooks from 'eslint-plugin-react-hooks';

export default [
  ...rootConfig,
  {
    files: ['**/*.tsx', '**/*.ts'],
    plugins: {
      'react-hooks': reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
    },
  },
];
