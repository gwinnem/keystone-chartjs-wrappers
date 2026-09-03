// Angular-specific ESLint config for packages/angular — extends the
// shared root config and layers in angular-eslint (the official
// flat-config package, replacing the older @angular-eslint/* + tslint
// setup) for template-binding/decorator-usage rules the base TS config
// has no way to check. See docs/IMPLEMENTATION_PLAN.md Phase 0.
import rootConfig from '../../eslint.config.js';
import angular from 'angular-eslint';

export default [
  ...rootConfig,
  {
    files: ['**/*.ts'],
    extends: [...angular.configs.tsRecommended],
    processor: angular.processInlineTemplates,
    rules: {
      '@angular-eslint/component-selector': [
        'error',
        { type: 'element', prefix: 'keystone', style: 'kebab-case' },
      ],
    },
  },
  {
    files: ['**/*.html'],
    extends: [...angular.configs.templateRecommended],
  },
];
