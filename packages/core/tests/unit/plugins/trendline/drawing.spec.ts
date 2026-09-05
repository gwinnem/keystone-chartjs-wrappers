import { describe, expect, it, vi } from 'vitest';
import { drawTrendline, fillBelowTrendline, getScales, setLineStyle } from '../../../../src/plugins/trendline/drawing.js';

// Testing the real canvas drawing/scale-resolution logic directly
// (dissected from the real, installed package's own real source — see
// drawing.ts's own header comment for the full port rationale).

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
    strokeStyle: '',
    fillStyle: '',
    __gradient: gradient,
  };
}

describe('getScales', () => {
  it('resolves the real horizontal scale as xScale and the vertical one as yScale, regardless of key order', () => {
    const xScale = { isHorizontal: () => true };
    const yScale = { isHorizontal: () => false };
    const chart = { scales: { y: yScale, x: xScale } };

    const result = getScales(chart as never);

    expect(result.xScale).toBe(xScale);
    expect(result.yScale).toBe(yScale);
  });

  it('returns undefined for whichever scale is missing entirely', () => {
    const xScale = { isHorizontal: () => true };
    const result = getScales({ scales: { x: xScale } } as never);

    expect(result.xScale).toBe(xScale);
    expect(result.yScale).toBeUndefined();
  });
});

describe('setLineStyle', () => {
  it.each([
    ['dotted', [2, 2]],
    ['dashed', [8, 3]],
    ['dashdot', [8, 3, 2, 3]],
    ['solid', []],
    ['anything-else', []],
  ])('sets the real, documented dash pattern for "%s"', (style, expected) => {
    const ctx = makeCtx();
    setLineStyle(ctx as never, style);
    expect(ctx.setLineDash).toHaveBeenCalledWith(expected);
  });
});

describe('drawTrendline', () => {
  it('draws a real linear gradient stroke between the two given points', () => {
    const ctx = makeCtx();
    drawTrendline({ ctx: ctx as never, x1: 0, y1: 0, x2: 100, y2: 50, colorMin: 'red', colorMax: 'blue' });

    expect(ctx.createLinearGradient).toHaveBeenCalledWith(0, 0, 100, 50);
    expect(ctx.__gradient.addColorStop).toHaveBeenCalledWith(0, 'red');
    expect(ctx.__gradient.addColorStop).toHaveBeenCalledWith(1, 'blue');
    expect(ctx.stroke).toHaveBeenCalled();
  });

  it('falls back to a solid colorMin stroke for a degenerate (near-zero-length) segment', () => {
    const ctx = makeCtx();
    drawTrendline({ ctx: ctx as never, x1: 10, y1: 10, x2: 10.001, y2: 10.001, colorMin: 'red', colorMax: 'blue' });

    expect(ctx.createLinearGradient).not.toHaveBeenCalled();
    expect(ctx.strokeStyle).toBe('red');
    expect(ctx.stroke).toHaveBeenCalled();
  });

  it('falls back to a solid colorMin stroke if gradient creation itself throws', () => {
    const ctx = makeCtx();
    ctx.createLinearGradient = vi.fn(() => {
      throw new Error('boom');
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    drawTrendline({ ctx: ctx as never, x1: 0, y1: 0, x2: 100, y2: 0, colorMin: 'red', colorMax: 'blue' });

    expect(ctx.strokeStyle).toBe('red');
    expect(ctx.stroke).toHaveBeenCalled();
    warn.mockRestore();
  });

  it('warns and skips drawing entirely when any coordinate is non-finite', () => {
    const ctx = makeCtx();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    drawTrendline({ ctx: ctx as never, x1: NaN, y1: 0, x2: 100, y2: 0, colorMin: 'red', colorMax: 'blue' });

    expect(ctx.beginPath).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});

describe('fillBelowTrendline', () => {
  it('fills the real quadrilateral area between the trendline and the chart bottom', () => {
    const ctx = makeCtx();
    fillBelowTrendline(ctx as never, 0, 10, 100, 20, 200, 'rgba(0,0,0,0.2)');

    expect(ctx.fillStyle).toBe('rgba(0,0,0,0.2)');
    expect(ctx.fill).toHaveBeenCalled();
  });

  it('warns and skips filling entirely when any coordinate is non-finite', () => {
    const ctx = makeCtx();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    fillBelowTrendline(ctx as never, 0, 10, 100, NaN, 200, 'rgba(0,0,0,0.2)');

    expect(ctx.fill).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
});
