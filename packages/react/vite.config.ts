/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';
import { resolve } from 'node:path';

// Single config file for both `vite build` (library mode) and `vitest`,
// same combined idiom as packages/vue/vite.config.ts.
export default defineConfig({
  plugins: [
    react(),
    dts({ include: ['src'], rollupTypes: false }),
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'KeystoneChartjsReact',
      fileName: (format) => `keystone-chartjs-react.${format === 'es' ? 'es.js' : 'umd.cjs'}`,
    },
    rollupOptions: {
      // react/react-dom/react/jsx-runtime stay external (peer
      // dependencies). keystone-chartjs-core is now bundled directly
      // into this package's own dist (per your explicit direction: core
      // is never published standalone, imported directly into each
      // framework package instead) — no longer listed here. chart.js
      // stays external too — see packages/vue/vite.config.ts's own
      // comment for the full reasoning (global registration state means
      // it needs to be a real, separate `peerDependency`, matching
      // vue-chartjs's own established convention, not bundled or listed
      // under regular `dependencies`).
      external: ['react', 'react-dom', 'react/jsx-runtime', 'chart.js'],
      output: {
        globals: { react: 'React', 'react-dom': 'ReactDOM' },
      },
    },
  },
  test: {
    environment: 'jsdom',
    include: ['tests/component/**/*.spec.tsx', 'tests/component/**/*.spec.ts'],
    coverage: {
      reporter: ['text', 'html', 'json'],
      // Project-wide floor — see packages/core/vitest.config.ts's own
      // comment; enforced identically across all four packages.
      thresholds: {
        statements: 90,
        branches: 90,
        functions: 90,
        lines: 90,
      },
    },
  },
});
