import { describe, expect, it, vi } from 'vitest';

// index.ts's own re-export statements are real, executable code — they
// just weren't exercised by any test before this file existed, since
// every other spec imports from the concrete module directly
// (../../src/controller.js etc.) rather than the public barrel. This is
// the barrel's own contract test: every symbol a consumer is meant to
// import from 'keystone-chartjs-core' actually resolves through it.
vi.mock('chart.js', () => ({ Chart: { register: vi.fn() }, registerables: [] }));

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
