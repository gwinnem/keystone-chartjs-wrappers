// ESLint config for packages/core — just the shared root config, no
// framework-specific layering needed (unlike packages/vue's own
// eslint.config.js, which adds vue-eslint-parser + eslint-plugin-vue
// for .vue SFCs). Exists as its own explicit file, rather than relying
// on ESLint's implicit upward directory search to find the root
// eslint.config.js two levels up — that implicit search hung
// indefinitely (no CPU activity, confirmed directly) when `eslint .`
// was run from this directory on Windows, even though the same lint
// step completed fine in CI's own Linux runners. An explicit local
// config removes the ambiguity regardless of the exact platform-specific
// cause.
import rootConfig from '../../eslint.config.js';

export default [...rootConfig];
