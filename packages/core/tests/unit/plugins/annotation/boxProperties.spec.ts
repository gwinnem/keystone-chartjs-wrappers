import { describe, expect, it } from 'vitest';
import {
  getChartPoint,
  resolveBoxAndLabelProperties,
  resolveBoxProperties,
  resolveLineProperties,
  resolvePointProperties,
  retrieveScaleID,
} from '../../../../src/plugins/annotation/boxProperties.js';

// Testing the real box-model / scale-coordinate resolution directly
// (dissected from the real, installed package's own real, unminified
// ESM build — see geometry.ts's own header comment for the full
// dissection rationale).

function makeScale(overrides: Record<string, unknown> = {}) {
  return {
    id: 'x',
    axis: 'x',
    left: 0,
    right: 100,
    top: 0,
    bottom: 100,
    width: 100,
    height: 100,
    options: {},
    parse: (v: unknown) => Number(v),
    getPixelForValue: (v: number) => v,
    isHorizontal: () => true,
    ...overrides,
  };
}

function makeChart(scales: Record<string, unknown>, overrides: Record<string, unknown> = {}) {
  return {
    scales,
    chartArea: { left: 0, top: 0, right: 100, bottom: 100, width: 100, height: 100 },
    ctx: { measureText: (t: string) => ({ width: t.length * 6 }), font: '', save: () => {}, restore: () => {} },
    ...overrides,
  };
}

describe('retrieveScaleID', () => {
  it('returns the explicit scaleID option when set', () => {
    expect(retrieveScaleID({}, { xScaleID: 'myScale' }, 'xScaleID')).toBe('myScale');
  });

  it('falls back to searching real scales by matching axis when no explicit ID is set', () => {
    const scales = { x: makeScale({ axis: 'x' }) };
    expect(retrieveScaleID(scales as never, {}, 'xScaleID')).toBe('x');
  });

  it('falls back to the bare axis letter when no scale matches at all', () => {
    expect(retrieveScaleID({}, {}, 'xScaleID')).toBe('x');
  });

  it('always returns the raw scaleID option for the "scaleID" key, even if falsy', () => {
    expect(retrieveScaleID({}, { scaleID: 'lineScale' }, 'scaleID')).toBe('lineScale');
  });
});

describe('getChartPoint', () => {
  it('resolves a real chart-space point from xValue/yValue against matching scales', () => {
    const xScale = makeScale({ id: 'x', axis: 'x', getPixelForValue: (v: number) => v * 2 });
    const yScale = makeScale({ id: 'y', axis: 'y', getPixelForValue: (v: number) => v * 3 });
    const chart = makeChart({ x: xScale, y: yScale });
    const result = getChartPoint(chart as never, { xValue: 10, yValue: 5 });
    expect(result.x).toBe(20);
    expect(result.y).toBe(15);
  });

  it('falls back to the real chart area center when no scale matches at all', () => {
    const chart = makeChart({});
    const result = getChartPoint(chart as never, {});
    expect(result.x).toBe(50);
    expect(result.y).toBe(50);
  });
});

describe('resolveBoxProperties', () => {
  it('returns {} when neither axis has a real matching scale', () => {
    const chart = makeChart({});
    expect(resolveBoxProperties(chart as never, {})).toEqual({});
  });

  it('resolves a real box from xMin/xMax/yMin/yMax against real scales', () => {
    const xScale = makeScale({ id: 'x', axis: 'x', getPixelForValue: (v: number) => v });
    const yScale = makeScale({ id: 'y', axis: 'y', getPixelForValue: (v: number) => v });
    const chart = makeChart({ x: xScale, y: yScale });
    const result = resolveBoxProperties(chart as never, { xMin: 10, xMax: 40, yMin: 5, yMax: 25 });
    expect(result.x).toBe(10);
    expect(result.x2).toBe(40);
    expect(result.width).toBe(30);
  });

  it('falls back to the real chart area edge on an axis with no matching scale', () => {
    const yScale = makeScale({ id: 'y', axis: 'y', getPixelForValue: (v: number) => v });
    const chart = makeChart({ y: yScale });
    const result = resolveBoxProperties(chart as never, { yMin: 10, yMax: 20 });
    expect(result.x).toBe(0);
    expect(result.x2).toBe(100);
  });

  it('swaps min/max resolution for a real, reversed scale', () => {
    const xScale = makeScale({ id: 'x', axis: 'x', options: { reverse: true }, getPixelForValue: (v: number) => v });
    const yScale = makeScale({ id: 'y', axis: 'y', getPixelForValue: (v: number) => v });
    const chart = makeChart({ x: xScale, y: yScale });
    const result = resolveBoxProperties(chart as never, { xMin: 10, xMax: 40, yMin: 0, yMax: 20 });
    // Reversed: min resolves against the scale's own real "end" pixel,
    // max against its own real "start" — still normalized to x <= x2.
    expect(result.x).toBeLessThanOrEqual(result.x2!);
  });
});

describe('resolvePointProperties', () => {
  it('auto-derives radius from the smaller box dimension when not point-bound', () => {
    const xScale = makeScale({ id: 'x', axis: 'x', getPixelForValue: (v: number) => v });
    const yScale = makeScale({ id: 'y', axis: 'y', getPixelForValue: (v: number) => v });
    const chart = makeChart({ x: xScale, y: yScale });
    const result = resolvePointProperties(chart as never, { xMin: 0, xMax: 40, yMin: 0, yMax: 20, xAdjust: 0, yAdjust: 0 });
    expect(result.radius).toBeCloseTo(10, 5); // min(40,20)/2
  });

  it('uses the real, explicitly configured radius when given', () => {
    const xScale = makeScale({ id: 'x', axis: 'x', getPixelForValue: (v: number) => v });
    const yScale = makeScale({ id: 'y', axis: 'y', getPixelForValue: (v: number) => v });
    const chart = makeChart({ x: xScale, y: yScale });
    const result = resolvePointProperties(chart as never, { xMin: 0, xMax: 40, yMin: 0, yMax: 20, radius: 5, xAdjust: 0, yAdjust: 0 });
    expect(result.radius).toBe(5);
  });

  it('treats a real, explicit NaN radius the same as an unset one (auto-derives)', () => {
    const xScale = makeScale({ id: 'x', axis: 'x', getPixelForValue: (v: number) => v });
    const yScale = makeScale({ id: 'y', axis: 'y', getPixelForValue: (v: number) => v });
    const chart = makeChart({ x: xScale, y: yScale });
    const result = resolvePointProperties(chart as never, { xMin: 0, xMax: 40, yMin: 0, yMax: 20, radius: NaN, xAdjust: 0, yAdjust: 0 });
    expect(result.radius).toBeCloseTo(10, 5);
  });

  it('resolves a real circle directly around xValue/yValue when point-bound', () => {
    const xScale = makeScale({ id: 'x', axis: 'x', getPixelForValue: (v: number) => v });
    const yScale = makeScale({ id: 'y', axis: 'y', getPixelForValue: (v: number) => v });
    const chart = makeChart({ x: xScale, y: yScale });
    const result = resolvePointProperties(chart as never, { xValue: 50, yValue: 50, radius: 10, xAdjust: 0, yAdjust: 0 });
    expect(result.centerX).toBe(50);
    expect(result.centerY).toBe(50);
    expect(result.radius).toBe(10);
  });
});

describe('resolveLineProperties', () => {
  it('resolves a real, full-width horizontal line from a named scaleID', () => {
    const yScale = makeScale({ id: 'y', axis: 'y', isHorizontal: () => false, getPixelForValue: (v: number) => v });
    const chart = makeChart({ y: yScale }, { scales: { y: yScale } });
    const result = resolveLineProperties(chart as never, { scaleID: 'y', value: 30 });
    expect(result.y).toBe(30);
    expect(result.y2).toBe(30);
    expect(result.x).toBe(0);
    expect(result.x2).toBe(100);
  });

  it('resolves a real, limited line from xMin/xMax/yMin/yMax with no scaleID', () => {
    const xScale = makeScale({ id: 'x', axis: 'x', getPixelForValue: (v: number) => v });
    const chart = makeChart({ x: xScale });
    const result = resolveLineProperties(chart as never, { xMin: 10, xMax: 40 });
    expect(result.x).toBe(10);
    expect(result.x2).toBe(40);
  });

  it('limits both real axes independently when both scales are present', () => {
    const xScale = makeScale({ id: 'x', axis: 'x', getPixelForValue: (v: number) => v });
    const yScale = makeScale({ id: 'y', axis: 'y', getPixelForValue: (v: number) => v });
    const chart = makeChart({ x: xScale, y: yScale });
    const result = resolveLineProperties(chart as never, { xMin: 10, xMax: 40, yMin: 5, yMax: 25 });
    expect(result.x).toBe(10);
    expect(result.y).toBe(5);
  });
});

describe('resolveBoxAndLabelProperties', () => {
  it('resolves the real box plus a single, centered label sub-element', () => {
    const xScale = makeScale({ id: 'x', axis: 'x', getPixelForValue: (v: number) => v });
    const yScale = makeScale({ id: 'y', axis: 'y', getPixelForValue: (v: number) => v });
    const chart = makeChart({ x: xScale, y: yScale });
    const result = resolveBoxAndLabelProperties(chart as never, {
      xMin: 0,
      xMax: 40,
      yMin: 0,
      yMax: 20,
      borderWidth: 0,
      label: { content: 'hi', font: { size: 12 }, callout: { display: true }, padding: 4 },
    } as never);
    expect(result.elements).toHaveLength(1);
    expect((result.elements as { type: string }[])[0].type).toBe('label');
  });
});
