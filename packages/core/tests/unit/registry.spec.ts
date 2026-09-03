import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('chart.js', () => ({
  Chart: { register: vi.fn() },
  registerables: [],
}));
vi.mock('chartjs-chart-financial', () => ({
  CandlestickController: { id: 'candlestick' },
  CandlestickElement: {},
  OhlcController: { id: 'ohlc' },
  OhlcElement: {},
}));
vi.mock('@sgratzl/chartjs-chart-boxplot', () => ({
  BoxPlotController: { id: 'boxplot' },
  BoxAndWiskers: {},
  ViolinController: { id: 'violin' },
  Violin: {},
}));
vi.mock('chartjs-chart-matrix', () => ({
  MatrixController: { id: 'matrix' },
  MatrixElement: {},
}));
vi.mock('chartjs-chart-sankey', () => ({
  SankeyController: { id: 'sankey' },
  Flow: {},
}));
vi.mock('chartjs-chart-treemap', () => ({
  TreemapController: { id: 'treemap' },
  TreemapElement: {},
}));

import { Chart } from 'chart.js';
import { __resetRegistryForTests, ensureChartKindRegistered } from '../../src/registry.js';

const registerMock = vi.mocked(Chart.register);

beforeEach(() => {
  __resetRegistryForTests();
  registerMock.mockClear();
});

describe('ensureChartKindRegistered', () => {
  it('does not register anything for a Chart.js built-in kind', async () => {
    await ensureChartKindRegistered('bar');
    expect(registerMock).not.toHaveBeenCalled();
  });

  it('is a no-op the second time a built-in kind is requested too', async () => {
    await ensureChartKindRegistered('line');
    await ensureChartKindRegistered('line');
    expect(registerMock).not.toHaveBeenCalled();
  });

  it.each([
    ['candlestick', ['CandlestickController', 'CandlestickElement']],
    ['ohlc', ['OhlcController', 'OhlcElement']],
    ['boxplot', ['BoxPlotController', 'BoxAndWiskers']],
    ['violin', ['ViolinController', 'Violin']],
    ['matrix', ['MatrixController', 'MatrixElement']],
    ['sankey', ['SankeyController', 'Flow']],
    ['treemap', ['TreemapController', 'TreemapElement']],
  ] as const)('registers %s on first use, with both of its expected exports', async (kind) => {
    await ensureChartKindRegistered(kind);
    expect(registerMock).toHaveBeenCalledTimes(1);
    expect(registerMock.mock.calls[0]).toHaveLength(2);
  });

  it('caches registration — a second request for the same extension kind does not re-register', async () => {
    await ensureChartKindRegistered('treemap');
    await ensureChartKindRegistered('treemap');
    expect(registerMock).toHaveBeenCalledTimes(1);
  });

  it('registers each distinct kind independently — two different extension kinds both register', async () => {
    await ensureChartKindRegistered('sankey');
    await ensureChartKindRegistered('matrix');
    expect(registerMock).toHaveBeenCalledTimes(2);
  });

  it('throws a clear error when the backing package is missing an expected export', async () => {
    vi.resetModules();
    vi.doMock('chartjs-chart-financial', () => ({
      CandlestickController: { id: 'candlestick' },
      // CandlestickElement is explicitly present with an `undefined`
      // value (not omitted entirely) — Vitest's own mock wrapper throws
      // its own "No X export is defined on the mock" error the moment ANY
      // key absent from the factory's returned object is accessed at all
      // (confirmed via a real run), which would mask the registry's own
      // error-handling this test is actually meant to exercise. An
      // explicit `undefined` value satisfies Vitest's own completeness
      // check while still being falsy, so `registry.ts`'s own
      // `if (!exported)` guard is what actually fires here.
      CandlestickElement: undefined,
    }));

    const fresh = await import('../../src/registry.js');
    await expect(fresh.ensureChartKindRegistered('candlestick')).rejects.toThrow(
      // The full message, not just its opening clause — a real mutation
      // run showed the trailing segments ("for chart kind ...", "may
      // have renamed or removed this export...") surviving when only the
      // first clause was checked, since mutating text that comes AFTER
      // whatever a shorter regex already anchors on doesn't affect
      // whether that shorter regex still matches.
      /expected "chartjs-chart-financial" to export "CandlestickElement" for chart kind "candlestick", but it did not\. The installed version of that package may have renamed or removed this export/,
    );
  });
});
