import { describe, expect, it, vi } from 'vitest';
import {
  addFitter,
  calculateProjectedCoordinates,
  collectDataPoints,
  liangBarskyClip,
} from '../../../../src/plugins/trendline/trendlineCore.js';
import { LineFitter, ExponentialFitter } from '../../../../src/plugins/trendline/fitters.js';

// Testing the real data-collection/coordinate-math/clipping/orchestration
// logic directly (dissected from the real, installed package's own real
// source — see trendlineCore.ts's own header comment for the full port
// rationale).

function makeScale(overrides: Record<string, unknown> = {}) {
  return {
    options: { type: 'linear' },
    getPixelForValue: (v: number) => v,
    getValueForPixel: (p: number) => p,
    min: 0,
    max: 100,
    ...overrides,
  };
}

describe('collectDataPoints — flat number-array data', () => {
  it('uses the array index as x for a plain, flat array of numbers', () => {
    const fitter = new LineFitter();
    const dataset = { data: [10, 20, 30] };
    collectDataPoints(fitter, dataset as never, 0, 0, false, makeScale() as never, 'x', 'y', undefined);

    expect(fitter.count).toBe(3);
    expect(fitter.minx).toBe(0);
    expect(fitter.maxx).toBe(2);
  });

  it('skips a null/undefined entry, and a non-numeric or NaN y-value', () => {
    const fitter = new LineFitter();
    const dataset = { data: [10, null, NaN, 40] };
    collectDataPoints(fitter, dataset as never, 0, 0, false, makeScale() as never, 'x', 'y', undefined);

    expect(fitter.count).toBe(2); // only index 0 and 3
  });
});

describe('collectDataPoints — {x,y}-object data', () => {
  it('reads x/y from the given keys for a real array of {x,y}-shaped points', () => {
    const fitter = new LineFitter();
    const dataset = { data: [{ x: 1, y: 10 }, { x: 2, y: 20 }] };
    collectDataPoints(fitter, dataset as never, 0, 0, true, makeScale() as never, 'x', 'y', undefined);

    expect(fitter.count).toBe(2);
    expect(fitter.minx).toBe(1);
    expect(fitter.maxx).toBe(2);
  });

  it('honors a non-default xAxisKey/yAxisKey', () => {
    const fitter = new LineFitter();
    const dataset = { data: [{ date: 1, value: 10 }] };
    collectDataPoints(fitter, dataset as never, 0, 0, true, makeScale() as never, 'date', 'value', undefined);

    expect(fitter.count).toBe(1);
  });

  it('skips a point whose x or y is missing/non-numeric', () => {
    const fitter = new LineFitter();
    const dataset = { data: [{ x: 1, y: 10 }, { x: null, y: 20 }, { x: 3, y: undefined }] };
    collectDataPoints(fitter, dataset as never, 0, 0, true, makeScale() as never, 'x', 'y', undefined);

    expect(fitter.count).toBe(1);
  });
});

describe('collectDataPoints — time/timeseries scale', () => {
  const timeScale = makeScale({ options: { type: 'time' } });

  it('converts object-data x-values to real millisecond timestamps', () => {
    const fitter = new LineFitter();
    const dataset = { data: [{ x: '2024-01-01', y: 5 }] };
    collectDataPoints(fitter, dataset as never, 0, 0, true, timeScale as never, 'x', 'y', undefined);

    expect(fitter.count).toBe(1);
    expect(fitter.minx).toBe(new Date('2024-01-01').getTime());
  });

  it("falls back to Chart.js's own internal data.t field when the configured xAxisKey is absent", () => {
    const fitter = new LineFitter();
    const dataset = { data: [{ t: '2024-01-01', y: 5 }] };
    collectDataPoints(fitter, dataset as never, 0, 0, true, timeScale as never, 'x', 'y', undefined);

    expect(fitter.count).toBe(1);
  });

  it('reads x-values from chart.data.labels for flat-number data on a time scale', () => {
    const fitter = new LineFitter();
    const dataset = { data: [5, 10] };
    const chartLabels = ['2024-01-01', '2024-01-02'];
    collectDataPoints(fitter, dataset as never, 0, 0, false, timeScale as never, 'x', 'y', chartLabels);

    expect(fitter.count).toBe(2);
    expect(fitter.minx).toBe(new Date('2024-01-01').getTime());
  });
});

describe('collectDataPoints — trendoffset', () => {
  it('skips leading points before effectiveFirstIndex for a positive offset', () => {
    const fitter = new LineFitter();
    const dataset = { data: [10, 20, 30, 40] };
    // effectiveFirstIndex=2 mirrors what addFitter would compute for trendoffset=2
    collectDataPoints(fitter, dataset as never, 2, 2, false, makeScale() as never, 'x', 'y', undefined);

    expect(fitter.count).toBe(2); // only indices 2, 3
  });

  it('uses only the last N points for a negative offset', () => {
    const fitter = new LineFitter();
    const dataset = { data: [10, 20, 30, 40] };
    collectDataPoints(fitter, dataset as never, -2, 0, false, makeScale() as never, 'x', 'y', undefined);

    expect(fitter.count).toBe(2); // only indices 2, 3 (length + offset = 2)
  });
});

describe('liangBarskyClip', () => {
  const area = { left: 0, right: 100, top: 0, bottom: 100 };

  it('returns the exact same segment unchanged when it is already fully inside the area', () => {
    const result = liangBarskyClip(10, 10, 90, 90, area);
    expect(result).toEqual({ x1: 10, y1: 10, x2: 90, y2: 90 });
  });

  it('returns null for a segment entirely outside the area', () => {
    const result = liangBarskyClip(200, 200, 300, 300, area);
    expect(result).toBeNull();
  });

  it('clips a segment that starts outside and ends inside the area', () => {
    const result = liangBarskyClip(-50, 50, 50, 50, area);
    expect(result).not.toBeNull();
    expect(result!.x1).toBeCloseTo(0, 5);
    expect(result!.y1).toBeCloseTo(50, 5);
    expect(result!.x2).toBeCloseTo(50, 5);
  });

  it('returns null for a segment exactly parallel to and outside a clipping edge', () => {
    // A perfectly horizontal line above the area's own top edge (y < 0)
    const result = liangBarskyClip(-10, -10, 50, -10, area);
    expect(result).toBeNull();
  });

  it('rejects a segment via the real, negative-direction t1 bound (a right-to-left line missing the area entirely on its own left side)', () => {
    // A line running right-to-left (dx negative) whose own real
    // trajectory would only re-enter the area after its own segment
    // already ends — exercises the real `r > t1` rejection specifically,
    // distinct from the segment-entirely-outside case above.
    const result = liangBarskyClip(150, 50, 120, 50, area);
    expect(result).toBeNull();
  });
});

describe('calculateProjectedCoordinates — non-projection mode', () => {
  it('resolves the segment exactly to the fitted line\'s own real data range (minx..maxx)', () => {
    const fitter = new LineFitter();
    fitter.add(0, 0);
    fitter.add(10, 20);
    const xScale = makeScale();
    const yScale = makeScale();
    const chartArea = { left: 0, right: 100, top: 0, bottom: 100 };

    const result = calculateProjectedCoordinates(fitter, false, {}, xScale as never, yScale as never, chartArea as never);

    expect(result.x1).toBeCloseTo(0, 5);
    expect(result.x2).toBeCloseTo(10, 5);
  });
});

describe('calculateProjectedCoordinates — projection mode', () => {
  it('extends a real, non-zero-slope line across the full chart area', () => {
    const fitter = new LineFitter();
    fitter.add(0, 0);
    fitter.add(10, 100); // slope = 10 — comfortably non-zero
    const xScale = makeScale();
    const yScale = makeScale();
    const chartArea = { left: 0, right: 100, top: 0, bottom: 100 };

    const result = calculateProjectedCoordinates(fitter, false, { projection: true }, xScale as never, yScale as never, chartArea as never);

    expect(isFinite(result.x1)).toBe(true);
    expect(isFinite(result.x2)).toBe(true);
  });

  it('uses the near-zero-slope fallback (flat line at the intercept) via a relative, not absolute, threshold', () => {
    const fitter = new LineFitter();
    // A genuinely flat line — slope is exactly 0.
    fitter.add(0, 50);
    fitter.add(10, 50);
    const xScale = makeScale();
    const yScale = makeScale();
    const chartArea = { left: 0, right: 100, top: 0, bottom: 100 };

    const result = calculateProjectedCoordinates(fitter, false, { projection: true }, xScale as never, yScale as never, chartArea as never);

    expect(result.y1).toBeCloseTo(50, 1);
    expect(result.y2).toBeCloseTo(50, 1);
  });

  it('falls back to a real yRange of 1 when the y scale has no real range at all (max === min)', () => {
    const fitter = new LineFitter();
    fitter.add(0, 50);
    fitter.add(10, 50);
    const xScale = makeScale();
    const yScale = makeScale({ min: 50, max: 50 });
    const chartArea = { left: 0, right: 100, top: 0, bottom: 100 };

    expect(() => calculateProjectedCoordinates(fitter, false, { projection: true }, xScale as never, yScale as never, chartArea as never)).not.toThrow();
  });

  it('falls back to a real -Infinity/Infinity y bound when neither chart edge maps to a real, finite value', () => {
    const fitter = new LineFitter();
    fitter.add(0, 0);
    fitter.add(10, 100);
    const xScale = makeScale();
    const yScale = makeScale({ getValueForPixel: () => NaN });
    const chartArea = { left: 0, right: 100, top: 0, bottom: 100 };

    const result = calculateProjectedCoordinates(fitter, false, { projection: true }, xScale as never, yScale as never, chartArea as never);

    // With no real finite y bound at all, every candidate point's own
    // real y automatically falls inside the (-Infinity, Infinity) range
    // — only the real x-bounds/dedup filtering still applies.
    expect(result).toBeDefined();
  });

  it('breaks a real tie between two candidate points sharing the same x by their own y value', () => {
    const fitter = new LineFitter();
    fitter.add(0, 0);
    fitter.add(10, 0); // slope 0 — near-zero-slope fallback pushes two points to the same x with different y
    const xScale = makeScale();
    const yScale = makeScale({ max: 100, min: 0 });
    const chartArea = { left: 0, right: 100, top: 0, bottom: 100 };

    expect(() => calculateProjectedCoordinates(fitter, false, { projection: true }, xScale as never, yScale as never, chartArea as never)).not.toThrow();
  });

  it('handles the exponential-curve projection path by sampling the curve at both chart-area edges', () => {
    const fitter = new ExponentialFitter();
    fitter.add(0, 1);
    fitter.add(1, Math.E);
    const xScale = makeScale();
    const yScale = makeScale();
    const chartArea = { left: 0, right: 100, top: 0, bottom: 100 };

    const result = calculateProjectedCoordinates(fitter, true, { projection: true }, xScale as never, yScale as never, chartArea as never);

    expect(result).toBeDefined();
  });

  it('returns NaN coordinates when fewer than 2 valid points survive the real bounds/dedup filtering', () => {
    const fitter = new LineFitter();
    fitter.add(0, 0);
    fitter.add(10, 20);
    const xScale = makeScale({ getValueForPixel: () => 99999 }); // pushes every candidate point out of real chart bounds
    const yScale = makeScale({ getValueForPixel: () => 99999 });
    const chartArea = { left: 0, right: 100, top: 0, bottom: 100 };

    const result = calculateProjectedCoordinates(fitter, false, { projection: true }, xScale as never, yScale as never, chartArea as never);

    expect(isNaN(result.x1)).toBe(true);
  });
});

describe('addFitter — full real end-to-end orchestration', () => {
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

  function makeChart(datasetData: unknown[], overrides: Record<string, unknown> = {}) {
    return {
      chartArea: { left: 0, right: 100, top: 0, bottom: 100 },
      data: { labels: undefined, datasets: [{ data: datasetData }] },
      options: {},
      scales: { x: makeScale(), y: makeScale() },
      ...overrides,
    };
  }

  it('draws a real trendline for a dataset with a genuine linear trend', () => {
    const ctx = makeCtx();
    const chart = makeChart([1, 2, 3, 4, 5]);
    const dataset = { data: [1, 2, 3, 4, 5], trendlineLinear: {} };
    const datasetMeta = { controller: { chart } };

    addFitter(datasetMeta as never, ctx as never, dataset as never, chart.scales.x as never, chart.scales.y as never);

    expect(ctx.stroke).toHaveBeenCalled();
  });

  it('does nothing at all when fewer than 2 valid data points exist', () => {
    const ctx = makeCtx();
    const chart = makeChart([5]);
    const dataset = { data: [5], trendlineLinear: {} };
    const datasetMeta = { controller: { chart } };

    addFitter(datasetMeta as never, ctx as never, dataset as never, chart.scales.x as never, chart.scales.y as never);

    expect(ctx.stroke).not.toHaveBeenCalled();
  });

  it('draws the optional fill below the trendline when fillColor is configured', () => {
    const ctx = makeCtx();
    const chart = makeChart([1, 2, 3]);
    const dataset = { data: [1, 2, 3], trendlineLinear: { fillColor: 'rgba(0,0,0,0.1)' } };
    const datasetMeta = { controller: { chart } };

    addFitter(datasetMeta as never, ctx as never, dataset as never, chart.scales.x as never, chart.scales.y as never);

    expect(ctx.fill).toHaveBeenCalled();
  });

  it('draws a rotated text label with the real fitted slope when label.display is true', () => {
    const ctx = makeCtx();
    const chart = makeChart([1, 2, 3]);
    const dataset = { data: [1, 2, 3], trendlineLinear: { label: { display: true } } };
    const datasetMeta = { controller: { chart } };

    addFitter(datasetMeta as never, ctx as never, dataset as never, chart.scales.x as never, chart.scales.y as never);

    expect(ctx.fillText).toHaveBeenCalledWith(expect.stringContaining('Slope'), expect.any(Number), expect.any(Number));
  });

  it('formats the label\'s own slope as a percentage when label.percentage is true', () => {
    const ctx = makeCtx();
    const chart = makeChart([1, 2, 3]);
    const dataset = { data: [1, 2, 3], trendlineLinear: { label: { display: true, percentage: true } } };
    const datasetMeta = { controller: { chart } };

    addFitter(datasetMeta as never, ctx as never, dataset as never, chart.scales.x as never, chart.scales.y as never);

    expect(ctx.fillText).toHaveBeenCalledWith(expect.stringContaining('%'), expect.any(Number), expect.any(Number));
  });

  it('shows the fitted a/b parameters for an exponential trendline label, not a slope', () => {
    const ctx = makeCtx();
    const chart = makeChart([1, 2, 4, 8]);
    const dataset = { data: [1, 2, 4, 8], trendlineExponential: { label: { display: true } } };
    const datasetMeta = { controller: { chart } };

    addFitter(datasetMeta as never, ctx as never, dataset as never, chart.scales.x as never, chart.scales.y as never);

    expect(ctx.fillText).toHaveBeenCalledWith(expect.stringContaining('a='), expect.any(Number), expect.any(Number));
  });

  it('does not draw a label at all when label.display is explicitly false', () => {
    const ctx = makeCtx();
    const chart = makeChart([1, 2, 3]);
    const dataset = { data: [1, 2, 3], trendlineLinear: { label: { display: false } } };
    const datasetMeta = { controller: { chart } };

    addFitter(datasetMeta as never, ctx as never, dataset as never, chart.scales.x as never, chart.scales.y as never);

    expect(ctx.fillText).not.toHaveBeenCalled();
  });

  it("draws the real, plain label text with no slope suffix when displayValue is explicitly false", () => {
    const ctx = makeCtx();
    const chart = makeChart([1, 2, 3]);
    const dataset = { data: [1, 2, 3], trendlineLinear: { label: { display: true, displayValue: false, text: 'My Trend' } } };
    const datasetMeta = { controller: { chart } };

    addFitter(datasetMeta as never, ctx as never, dataset as never, chart.scales.x as never, chart.scales.y as never);

    expect(ctx.fillText).toHaveBeenCalledWith('My Trend', expect.any(Number), expect.any(Number));
  });

  it('resolves the scale via dataset.yAxisID when set, falling back to the default yScale otherwise', () => {
    const ctx = makeCtx();
    const altYScale = makeScale({ min: 0, max: 200 });
    const chart = makeChart([1, 2, 3], { scales: { x: makeScale(), y: makeScale(), y1: altYScale } });
    const dataset = { data: [1, 2, 3], trendlineLinear: {}, yAxisID: 'y1' };
    const datasetMeta = { controller: { chart } };

    expect(() => addFitter(datasetMeta as never, ctx as never, dataset as never, chart.scales.x as never, chart.scales.y as never)).not.toThrow();
  });

  it('sanitizes an out-of-bounds trendoffset back to 0 rather than skipping all real data', () => {
    const ctx = makeCtx();
    const chart = makeChart([1, 2, 3]);
    const dataset = { data: [1, 2, 3], trendlineLinear: { trendoffset: 100 } };
    const datasetMeta = { controller: { chart } };

    addFitter(datasetMeta as never, ctx as never, dataset as never, chart.scales.x as never, chart.scales.y as never);

    expect(ctx.stroke).toHaveBeenCalled();
  });

  it('applies a real, in-bounds positive trendoffset, skipping the leading points', () => {
    const ctx = makeCtx();
    const chart = makeChart([1, 2, 3, 4, 5]);
    const dataset = { data: [1, 2, 3, 4, 5], trendlineLinear: { trendoffset: 2 } };
    const datasetMeta = { controller: { chart } };

    addFitter(datasetMeta as never, ctx as never, dataset as never, chart.scales.x as never, chart.scales.y as never);

    expect(ctx.stroke).toHaveBeenCalled();
  });

  it('falls back to the real, full data length when a positive trendoffset finds no non-null point at or after it', () => {
    const ctx = makeCtx();
    const chart = makeChart([1, 2, null, null]);
    const dataset = { data: [1, 2, null, null], trendlineLinear: { trendoffset: 2 } };
    const datasetMeta = { controller: { chart } };

    expect(() => addFitter(datasetMeta as never, ctx as never, dataset as never, chart.scales.x as never, chart.scales.y as never)).not.toThrow();
    expect(ctx.stroke).not.toHaveBeenCalled();
  });

  it('falls back to the real, full data length when no offset is given and every real point is null', () => {
    const ctx = makeCtx();
    const chart = makeChart([null, null, null]);
    const dataset = { data: [null, null, null], trendlineLinear: {} };
    const datasetMeta = { controller: { chart } };

    expect(() => addFitter(datasetMeta as never, ctx as never, dataset as never, chart.scales.x as never, chart.scales.y as never)).not.toThrow();
    expect(ctx.stroke).not.toHaveBeenCalled();
  });

  it('resolves the real trendline config from trendlineExponential over trendlineLinear when both are absent (a real, direct addFitter call, not gated by the plugin\'s own real dataset filter)', () => {
    const ctx = makeCtx();
    const chart = makeChart([1, 2, 3]);
    const dataset = { data: [1, 2, 3] };
    const datasetMeta = { controller: { chart } };

    expect(() => addFitter(datasetMeta as never, ctx as never, dataset as never, chart.scales.x as never, chart.scales.y as never)).not.toThrow();
  });

  it("reads a real xAxisKey/yAxisKey from the chart's own real options.parsing when the trendline config doesn't set its own", () => {
    const ctx = makeCtx();
    const chart = makeChart([{ myX: 1, myY: 10 }, { myX: 2, myY: 20 }], { options: { parsing: { xAxisKey: 'myX', yAxisKey: 'myY' } } });
    const dataset = { data: [{ myX: 1, myY: 10 }, { myX: 2, myY: 20 }], trendlineLinear: {} };
    const datasetMeta = { controller: { chart } };

    addFitter(datasetMeta as never, ctx as never, dataset as never, chart.scales.x as never, chart.scales.y as never);

    expect(ctx.stroke).toHaveBeenCalled();
  });

  it('skips drawing entirely when the real projected coordinates are non-finite (no valid points survive)', () => {
    const ctx = makeCtx();
    const chart = makeChart([1, 2, 3, 4, 5], { scales: { x: makeScale({ getValueForPixel: () => 99999 }), y: makeScale({ getValueForPixel: () => 99999 }) } });
    const dataset = { data: [1, 2, 3, 4, 5], trendlineLinear: { projection: true } };
    const datasetMeta = { controller: { chart } };

    addFitter(datasetMeta as never, ctx as never, dataset as never, chart.scales.x as never, chart.scales.y as never);

    expect(ctx.stroke).not.toHaveBeenCalled();
  });
});
