import { describe, expect, it, vi } from 'vitest';

// index.ts's own re-export statements are real, executable code — they
// just weren't exercised by any test before this file existed, since
// every other spec imports from the concrete module directly
// (../../src/controller.js etc.) rather than the public barrel. This is
// the barrel's own contract test: every symbol a consumer is meant to
// import from 'keystone-chartjs-core' actually resolves through it.
vi.mock('chart.js', () => ({
  Chart: { register: vi.fn() },
  registerables: [],
  // hierarchicalScale.ts (statically imported via plugins.ts -> index.ts
  // as of the local port) needs a real, extendable CategoryScale to
  // subclass, plus `defaults`/`registry` for its own static
  // afterRegister()/beforeDatasetsDraw() logic — none of which this
  // barrel-contract test's own assertions actually exercise, so minimal
  // stubs are enough to let the module graph load without error.
  CategoryScale: class CategoryScale {
    static defaults = {};
  },
  defaults: { color: '#666' },
  registry: { addPlugins: vi.fn() },
}));

describe('index.ts (public entry point)', () => {
  it('re-exports the chart lifecycle controller', async () => {
    const mod = await import('../../src/index.js');
    expect(mod.createChartController).toBeTypeOf('function');
  });

  it('re-exports the chart-kind registry', async () => {
    const mod = await import('../../src/index.js');
    expect(mod.CHART_TYPE_REGISTRY).toBeTypeOf('object');
    expect(mod.ensureChartKindRegistered).toBeTypeOf('function');
  });

  it('re-exports all three plugin helpers', async () => {
    const mod = await import('../../src/index.js');
    expect(mod.withZoom).toBeTypeOf('function');
    expect(mod.withAnnotation).toBeTypeOf('function');
    expect(mod.withDataLabels).toBeTypeOf('function');
  });
});
