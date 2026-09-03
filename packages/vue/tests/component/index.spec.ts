import { describe, expect, it } from 'vitest';

// index.ts's own re-export statement is real, executable code (it runs
// at module-load time) — Chart.spec.ts imports Chart.vue directly (the
// concrete file), so without a test that imports through the barrel
// itself, index.ts would show 0% coverage. Same exact gap, same fix, as
// packages/core/tests/unit/index.spec.ts's own contract test.
describe('index.ts (public entry point)', () => {
  it('re-exports the Chart component', async () => {
    const mod = await import('../../src/index.js');
    expect(mod.Chart).toBeTruthy();
  });
});
