import { describe, expect, it, vi } from 'vitest';
import { boundingRects, drawFrame, drawText, getPositioner, getScaleOrigin } from '../../../../src/plugins/dataLabels/drawing.js';
import { ArcElement, BarElement, PointElement } from 'chart.js';

// Testing the real canvas drawing / element-type dispatch logic
// directly (dissected from the real, installed package's own real,
// unminified ESM build — see utils.ts's own header comment for the
// full dissection rationale).

function makeCtx() {
  return {
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    arc: vi.fn(),
    rect: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    strokeText: vi.fn(),
    fillText: vi.fn(),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    lineJoin: '',
    font: '',
    textAlign: '',
    textBaseline: '',
    shadowBlur: 0,
    shadowColor: '',
  };
}

describe('boundingRects', () => {
  it('computes a real frame padded by borderWidth + padding, centered on (0,0)', () => {
    const model = {
      size: { width: 40, height: 20 },
      padding: { top: 2, left: 3, right: 3, bottom: 2, width: 6, height: 4 },
      borderWidth: 1,
    } as never;

    const result = boundingRects(model);

    expect(result.text).toEqual({ x: -20, y: -10, w: 40, h: 20 });
    expect(result.frame.w).toBeCloseTo(40 + 6 + 2, 5);
    expect(result.frame.h).toBeCloseTo(20 + 4 + 2, 5);
  });
});

describe('getScaleOrigin', () => {
  it('returns null when the dataset has no vScale at all', () => {
    const chart = { getDatasetMeta: () => ({}) };
    expect(getScaleOrigin({}, { chart: chart as never, datasetIndex: 0 })).toBeNull();
  });

  it('returns the real radial center for a polar/radar-style scale', () => {
    const chart = { getDatasetMeta: () => ({ vScale: { xCenter: 50, yCenter: 60 } }) };
    expect(getScaleOrigin({}, { chart: chart as never, datasetIndex: 0 })).toEqual({ x: 50, y: 60 });
  });

  it('returns a real horizontal base pixel for a horizontal bar element', () => {
    const chart = { getDatasetMeta: () => ({ vScale: { getBasePixel: () => 42 } }) };
    expect(getScaleOrigin({ horizontal: true }, { chart: chart as never, datasetIndex: 0 })).toEqual({ x: 42, y: null });
  });

  it('returns a real vertical base pixel for a non-horizontal element', () => {
    const chart = { getDatasetMeta: () => ({ vScale: { getBasePixel: () => 42 } }) };
    expect(getScaleOrigin({ horizontal: false }, { chart: chart as never, datasetIndex: 0 })).toEqual({ x: null, y: 42 });
  });
});

describe('getPositioner', () => {
  it('resolves the arc positioner for a real ArcElement instance', () => {
    expect(getPositioner(Object.create(ArcElement.prototype))).toBeTypeOf('function');
  });

  it('resolves distinct positioners for Arc/Point/Bar/fallback', () => {
    const arc = getPositioner(Object.create(ArcElement.prototype));
    const point = getPositioner(Object.create(PointElement.prototype));
    const bar = getPositioner(Object.create(BarElement.prototype));
    const fallback = getPositioner({});

    expect(arc).not.toBe(point);
    expect(point).not.toBe(bar);
    expect(bar).not.toBe(fallback);
  });
});

describe('drawFrame', () => {
  it('skips drawing entirely when neither a background nor a real border is configured', () => {
    const ctx = makeCtx();
    drawFrame(ctx as never, { x: 0, y: 0, w: 10, h: 10 }, { backgroundColor: null, borderColor: null, borderWidth: 0, borderRadius: 0 } as never);
    expect(ctx.beginPath).not.toHaveBeenCalled();
  });

  it('fills when a real background color is configured', () => {
    const ctx = makeCtx();
    drawFrame(ctx as never, { x: 0, y: 0, w: 10, h: 10 }, { backgroundColor: 'red', borderColor: null, borderWidth: 0, borderRadius: 0 } as never);
    expect(ctx.fill).toHaveBeenCalled();
    expect(ctx.fillStyle).toBe('red');
  });

  it('strokes when a real border color + width are configured', () => {
    const ctx = makeCtx();
    drawFrame(ctx as never, { x: 0, y: 0, w: 10, h: 10 }, { backgroundColor: null, borderColor: 'blue', borderWidth: 2, borderRadius: 0 } as never);
    expect(ctx.stroke).toHaveBeenCalled();
    expect(ctx.strokeStyle).toBe('blue');
  });

  it('draws a real rounded rect when borderRadius is set', () => {
    const ctx = makeCtx();
    drawFrame(ctx as never, { x: 0, y: 0, w: 10, h: 10 }, { backgroundColor: 'red', borderColor: null, borderWidth: 0, borderRadius: 4 } as never);
    expect(ctx.arc).toHaveBeenCalled();
  });

  it('draws a real, flat (zero-height) rounded rect as a single wide arc pair', () => {
    const ctx = makeCtx();
    drawFrame(ctx as never, { x: 0, y: 0, w: 10, h: 0 }, { backgroundColor: 'red', borderColor: null, borderWidth: 0, borderRadius: 4 } as never);
    expect(ctx.arc).toHaveBeenCalled();
  });

  it('draws a real, narrow (zero-width) rounded rect as a single tall arc pair', () => {
    const ctx = makeCtx();
    drawFrame(ctx as never, { x: 0, y: 0, w: 0, h: 10 }, { backgroundColor: 'red', borderColor: null, borderWidth: 0, borderRadius: 4 } as never);
    expect(ctx.arc).toHaveBeenCalled();
  });

  it('draws a real, fully degenerate (zero-size) rounded rect as a single circle', () => {
    const ctx = makeCtx();
    drawFrame(ctx as never, { x: 0, y: 0, w: 0, h: 0 }, { backgroundColor: 'red', borderColor: null, borderWidth: 0, borderRadius: 4 } as never);
    expect(ctx.arc).toHaveBeenCalled();
  });
});

describe('drawText', () => {
  it('does nothing when there are no lines at all', () => {
    const ctx = makeCtx();
    drawText(ctx as never, [], { x: 0, y: 0, w: 10, h: 10 }, { color: 'red', textAlign: 'start', font: { lineHeight: 12 } } as never);
    expect(ctx.fillText).not.toHaveBeenCalled();
  });

  it('does nothing when neither a fill color nor a real stroke is configured', () => {
    const ctx = makeCtx();
    drawText(ctx as never, ['hi'], { x: 0, y: 0, w: 10, h: 10 }, { color: undefined, textStrokeColor: undefined, textStrokeWidth: 0, textAlign: 'start', font: { lineHeight: 12 } } as never);
    expect(ctx.fillText).not.toHaveBeenCalled();
    expect(ctx.strokeText).not.toHaveBeenCalled();
  });

  it('fills real text when a color is configured', () => {
    const ctx = makeCtx();
    drawText(ctx as never, ['hello'], { x: 0, y: 0, w: 10, h: 10 }, { color: 'red', textAlign: 'start', font: { lineHeight: 12, string: '12px Arial' }, textShadowBlur: 0, textShadowColor: undefined } as never);
    expect(ctx.fillText).toHaveBeenCalledWith('hello', expect.any(Number), expect.any(Number), expect.any(Number));
  });

  it('strokes real text when textStrokeColor + textStrokeWidth are configured', () => {
    const ctx = makeCtx();
    drawText(ctx as never, ['hello'], { x: 0, y: 0, w: 10, h: 10 }, { color: undefined, textStrokeColor: 'blue', textStrokeWidth: 2, textAlign: 'start', font: { lineHeight: 12, string: '12px Arial' }, textShadowBlur: 0, textShadowColor: undefined } as never);
    expect(ctx.strokeText).toHaveBeenCalled();
  });

  it('draws one call per real line, offset by lineHeight', () => {
    const ctx = makeCtx();
    drawText(ctx as never, ['a', 'b'], { x: 0, y: 0, w: 10, h: 10 }, { color: 'red', textAlign: 'start', font: { lineHeight: 12, string: '12px Arial' }, textShadowBlur: 0, textShadowColor: undefined } as never);
    expect(ctx.fillText).toHaveBeenCalledTimes(2);
  });
});
