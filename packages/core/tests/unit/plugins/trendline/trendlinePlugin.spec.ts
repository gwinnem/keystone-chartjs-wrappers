import { describe, expect, it, vi } from 'vitest';
import { trendlinePlugin } from '../../../../src/plugins/trendline/trendlinePlugin.js';

// Testing the real plugin object's own lifecycle hooks directly
// (dissected from the real, installed package's own real source — see
// trendlinePlugin.ts's own header comment for the full port rationale,
// including the real, undocumented order/alwaysShowTrendline/legend
// features found only by reading the source).

function makeCtx() {
  const gradient = { addColorStop: vi.fn() };
  return {
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    closePath: vi.fn(),
    stroke: vi.fn(),
    fill: vi.fn(),
    setLineDash: vi.fn(),
    createLinearGradient: vi.fn(() => gradient),
    measureText: vi.fn(() => ({ width: 10 })),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    fillText: vi.fn(),
    strokeStyle: '',
    fillStyle: '',
    font: '',
    lineWidth: 0,
  };
}

function makeScale() {
  return {
    options: { type: 'linear' },
    isHorizontal: () => true,
    getPixelForValue: (v: number) => v,
    getValueForPixel: (p: number) => p,
    min: 0,
    max: 100,
  };
}

function makeChart(datasets: Record<string, unknown>[], overrides: Record<string, unknown> = {}) {
  const ctx = makeCtx();
  const xScale = makeScale();
  const yScale = { ...makeScale(), isHorizontal: () => false };
  const metas = datasets.map(() => ({ controller: { chart: undefined as unknown } }));
  const chart: Record<string, unknown> = {
    ctx,
    chartArea: { left: 0, right: 100, top: 0, bottom: 100 },
    data: { datasets },
    options: {},
    scales: { x: xScale, y: yScale },
    canvas: { getAttribute: () => null, setAttribute: vi.fn(), hasAttribute: () => false },
    isDatasetVisible: () => true,
    getDatasetMeta: (i: number) => metas[i],
    legend: undefined,
    ...overrides,
  };
  metas.forEach((meta) => {
    meta.controller.chart = chart;
  });
  return chart;
}

describe('trendlinePlugin — real shape', () => {
  it('has the real, expected id and every documented lifecycle hook', () => {
    expect(trendlinePlugin).toMatchObject({
      id: 'chartjs-plugin-trendline',
      afterDatasetsDraw: expect.any(Function),
      afterInit: expect.any(Function),
      afterUpdate: expect.any(Function),
      beforeInit: expect.any(Function),
    });
  });
});

describe('trendlinePlugin.afterDatasetsDraw', () => {
  it('does nothing when neither a real horizontal nor vertical scale can be resolved', () => {
    const chart = makeChart([{ data: [1, 2, 3], trendlineLinear: {} }], { scales: {} });
    expect(() => trendlinePlugin.afterDatasetsDraw!(chart as never, {} as never, {})).not.toThrow();
  });

  it('draws a real trendline for a dataset with a genuine linear trend', () => {
    const chart = makeChart([{ data: [1, 2, 3, 4, 5], trendlineLinear: {} }]);
    trendlinePlugin.afterDatasetsDraw!(chart as never, {} as never, {});
    expect((chart.ctx as ReturnType<typeof makeCtx>).stroke).toHaveBeenCalled();
  });

  it('skips a dataset entirely once hidden, unless alwaysShowTrendline is set', () => {
    const chart = makeChart([{ data: [1, 2, 3, 4, 5], trendlineLinear: {} }], { isDatasetVisible: () => false });
    trendlinePlugin.afterDatasetsDraw!(chart as never, {} as never, {});
    expect((chart.ctx as ReturnType<typeof makeCtx>).stroke).not.toHaveBeenCalled();
  });

  it("still draws a hidden dataset's own trendline when alwaysShowTrendline is set — a real, undocumented feature", () => {
    const chart = makeChart([{ data: [1, 2, 3, 4, 5], trendlineLinear: {}, alwaysShowTrendline: true }], { isDatasetVisible: () => false });
    trendlinePlugin.afterDatasetsDraw!(chart as never, {} as never, {});
    expect((chart.ctx as ReturnType<typeof makeCtx>).stroke).toHaveBeenCalled();
  });

  it('skips a dataset with fewer than 2 real data points, even with a real trendline config', () => {
    const chart = makeChart([{ data: [5], trendlineLinear: {} }]);
    trendlinePlugin.afterDatasetsDraw!(chart as never, {} as never, {});
    expect((chart.ctx as ReturnType<typeof makeCtx>).stroke).not.toHaveBeenCalled();
  });

  it('draws both a zero-order and a real ordered dataset without throwing (order-0 pushed last)', () => {
    const chart = makeChart([
      { label: 'zero-order', data: [1, 2, 3], trendlineLinear: { colorMin: 'red', colorMax: 'red' } },
      { label: 'order-2', data: [1, 2, 3], order: 2, trendlineLinear: { colorMin: 'blue', colorMax: 'blue' } },
    ]);

    trendlinePlugin.afterDatasetsDraw!(chart as never, {} as never, {});

    expect((chart.ctx as ReturnType<typeof makeCtx>).createLinearGradient).toHaveBeenCalledTimes(2);
  });

  it('sorts a real ordered dataset before a zero-order one regardless of their own original array position', () => {
    // The reverse array order from the test above — exercises the real
    // comparator's own other branch (`orderB === 0 && orderA !== 0`).
    const chart = makeChart([
      { label: 'order-2', data: [1, 2, 3], order: 2, trendlineLinear: { colorMin: 'blue', colorMax: 'blue' } },
      { label: 'zero-order', data: [1, 2, 3], trendlineLinear: { colorMin: 'red', colorMax: 'red' } },
    ]);

    expect(() => trendlinePlugin.afterDatasetsDraw!(chart as never, {} as never, {})).not.toThrow();
    expect((chart.ctx as ReturnType<typeof makeCtx>).createLinearGradient).toHaveBeenCalledTimes(2);
  });

  it('resets the canvas line dash to solid after every dataset has been drawn', () => {
    const chart = makeChart([{ data: [1, 2, 3], trendlineLinear: { lineStyle: 'dotted' } }]);
    trendlinePlugin.afterDatasetsDraw!(chart as never, {} as never, {});
    expect((chart.ctx as ReturnType<typeof makeCtx>).setLineDash).toHaveBeenLastCalledWith([]);
  });

  it('ignores a dataset with neither trendlineLinear nor trendlineExponential set', () => {
    const chart = makeChart([{ data: [1, 2, 3] }]);
    expect(() => trendlinePlugin.afterDatasetsDraw!(chart as never, {} as never, {})).not.toThrow();
    expect((chart.ctx as ReturnType<typeof makeCtx>).stroke).not.toHaveBeenCalled();
  });
});

describe('trendlinePlugin.afterInit / afterUpdate', () => {
  it('applies real canvas accessibility attributes on afterInit', () => {
    const chart = makeChart([{ data: [1, 2, 3], trendlineLinear: {} }]);
    trendlinePlugin.afterInit!(chart as never, {} as never, {});
    expect((chart.canvas as { setAttribute: ReturnType<typeof vi.fn> }).setAttribute).toHaveBeenCalledWith('role', 'img');
  });

  it('applies real canvas accessibility attributes on afterUpdate too', () => {
    const chart = makeChart([{ data: [1, 2, 3], trendlineLinear: {} }]);
    trendlinePlugin.afterUpdate!(chart as never, {} as never, {});
    expect((chart.canvas as { setAttribute: ReturnType<typeof vi.fn> }).setAttribute).toHaveBeenCalledWith('role', 'img');
  });

  it('does not throw when the chart has no real canvas at all', () => {
    const chart = makeChart([{ data: [1, 2, 3], trendlineLinear: {} }], { canvas: null });
    expect(() => trendlinePlugin.afterInit!(chart as never, {} as never, {})).not.toThrow();
  });
});

describe('trendlinePlugin.beforeInit — real legend integration', () => {
  it('does nothing at all when no dataset has a real legend sub-config', () => {
    const chart = makeChart([{ data: [1, 2, 3], trendlineLinear: {} }], {
      legend: { options: { labels: { generateLabels: vi.fn(() => []) } } },
    });
    trendlinePlugin.beforeInit!(chart as never, {} as never, {});
    expect((chart.legend as { options: { labels: { generateLabels: unknown } } }).options.labels.generateLabels).toEqual(expect.any(Function));
  });

  it('does nothing when the chart has no real legend at all', () => {
    const chart = makeChart([{ data: [1, 2, 3], trendlineLinear: { legend: { display: true } } }], { legend: undefined });
    expect(() => trendlinePlugin.beforeInit!(chart as never, {} as never, {})).not.toThrow();
  });

  it('appends a real legend item, additively, for a dataset with a real legend sub-config', () => {
    const originalGenerateLabels = vi.fn(() => [{ text: 'Real Data' }]);
    const chart = makeChart(
      [{ label: 'Revenue', data: [1, 2, 3], trendlineLinear: { legend: { text: 'Trend' } } }],
      { legend: { options: { labels: { generateLabels: originalGenerateLabels } } } },
    );

    trendlinePlugin.beforeInit!(chart as never, {} as never, {});
    const patchedGenerateLabels = (chart.legend as { options: { labels: { generateLabels: (c: unknown) => unknown[] } } }).options.labels.generateLabels;
    const labels = patchedGenerateLabels(chart);

    expect(labels).toEqual([{ text: 'Real Data' }, expect.objectContaining({ text: 'Trend' })]);
  });

  it('does not add a legend item for a dataset whose legend sub-config is explicitly display: false', () => {
    const originalGenerateLabels = vi.fn(() => []);
    const chart = makeChart(
      [{ label: 'Revenue', data: [1, 2, 3], trendlineLinear: { legend: { display: false } } }],
      { legend: { options: { labels: { generateLabels: originalGenerateLabels } } } },
    );

    trendlinePlugin.beforeInit!(chart as never, {} as never, {});

    expect((chart.legend as { options: { labels: { generateLabels: unknown } } }).options.labels.generateLabels).toBe(originalGenerateLabels);
  });

  it("falls back to the real dataset's own label/borderColor when the legend sub-config omits text/strokeStyle", () => {
    const originalGenerateLabels = vi.fn(() => []);
    const chart = makeChart(
      [{ label: 'Revenue', data: [1, 2, 3], borderColor: 'green', trendlineLinear: { legend: { display: true } } }],
      { legend: { options: { labels: { generateLabels: originalGenerateLabels } } } },
    );

    trendlinePlugin.beforeInit!(chart as never, {} as never, {});
    const patchedGenerateLabels = (chart.legend as { options: { labels: { generateLabels: (c: unknown) => Record<string, unknown>[] } } }).options.labels.generateLabels;
    const labels = patchedGenerateLabels(chart);

    expect(labels[0]).toMatchObject({ text: 'Revenue', strokeStyle: 'green' });
  });

  it("falls back to the real legend sub-config's own color/width when strokeStyle/lineWidth are absent", () => {
    const originalGenerateLabels = vi.fn(() => []);
    const chart = makeChart(
      [{ label: 'Revenue', data: [1, 2, 3], trendlineLinear: { legend: { color: 'purple', width: 3 } } }],
      { legend: { options: { labels: { generateLabels: originalGenerateLabels } } } },
    );

    trendlinePlugin.beforeInit!(chart as never, {} as never, {});
    const patchedGenerateLabels = (chart.legend as { options: { labels: { generateLabels: (c: unknown) => Record<string, unknown>[] } } }).options.labels.generateLabels;
    const labels = patchedGenerateLabels(chart);

    expect(labels[0]).toMatchObject({ strokeStyle: 'purple', lineWidth: 3 });
  });
});
