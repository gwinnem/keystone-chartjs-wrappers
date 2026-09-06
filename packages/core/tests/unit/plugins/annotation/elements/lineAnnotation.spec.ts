import { describe, expect, it, vi } from 'vitest';
import { LineAnnotation } from '../../../../../src/plugins/annotation/elements/lineAnnotation.js';

// jsdom's own real Canvas 2D context has no native Path2D constructor
// at all (the same class of "jsdom has no real 2D context" gap already
// documented for zoomPlugin.ts's own accepted setPointerCapture
// survivor) — a minimal, real-enough stub is sufficient here, since
// this file's own real drawCurve() logic only calls moveTo/
// quadraticCurveTo on it before handing the same object straight back
// to ctx.stroke(path).
class FakePath2D {
  moveTo(): void {}
  quadraticCurveTo(): void {}
}
(globalThis as unknown as { Path2D: unknown }).Path2D = FakePath2D;

function makeCtx() {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    setLineDash: vi.fn(),
    measureText: (t: string) => ({ width: t.length * 6 }),
    isPointInStroke: vi.fn(() => false),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    lineCap: 'butt',
    lineJoin: 'miter',
    lineDashOffset: 0,
    shadowColor: '',
    font: '',
    textAlign: 'start',
    textBaseline: 'alphabetic',
  };
}

function makeLine(props: Record<string, unknown> = {}, options: Record<string, unknown> = {}) {
  const line = new LineAnnotation();
  Object.assign(line, { x: 0, y: 0, x2: 100, y2: 0, ...props });
  (line as unknown as { options: Record<string, unknown> }).options = { borderWidth: 2, hitTolerance: 0, ...options };
  (line as unknown as { getProps: (keys: string[]) => Record<string, number> }).getProps = (keys: string[]) => {
    const self = line as unknown as Record<string, number>;
    const all: Record<string, number> = { x: self.x, y: self.y, x2: self.x2, y2: self.y2 };
    return Object.fromEntries(keys.map((k) => [k, all[k]]));
  };
  // LineAnnotation's own real `label` is a getter reading
  // `this.elements?.[0]` — set the backing `elements` array instead of
  // the (unassignable) getter itself.
  (line as unknown as { elements: unknown[] }).elements = [{ options: { display: false }, inRange: () => false }];
  return line;
}

describe('LineAnnotation — static config', () => {
  it('has the real id and defaults', () => {
    expect(LineAnnotation.id).toBe('lineAnnotation');
    expect(LineAnnotation.defaults.borderWidth).toBe(2);
    expect(LineAnnotation.defaults.curve).toBe(false);
  });
});

describe('LineAnnotation#getCenterPoint', () => {
  it('returns the real center point via getProps', () => {
    const line = makeLine();
    (line as unknown as { getProps: () => Record<string, number> }).getProps = () => ({ centerX: 50, centerY: 0 });
    expect(line.getCenterPoint()).toEqual({ x: 50, y: 0 });
  });
});

describe('LineAnnotation#inRange', () => {
  it('detects a point close to a real, unrotated straight line (intersects fallback)', () => {
    const line = makeLine({ x: 0, y: 0, x2: 100, y2: 0 });
    expect(line.inRange(50, 0)).toBe(true);
  });

  it('detects a point far from the real line as out of range', () => {
    const line = makeLine({ x: 0, y: 0, x2: 100, y2: 0 });
    expect(line.inRange(50, 1000)).toBe(false);
  });

  it('restricts the test to the x axis when given', () => {
    const line = makeLine({ x: 0, y: 0, x2: 100, y2: 0 });
    expect(line.inRange(50, 1000, 'x')).toBe(true);
  });

  it('restricts the test to the y axis when given', () => {
    const line = makeLine({ x: 0, y: 0, x2: 100, y2: 0 });
    expect(line.inRange(1000, 0, 'y')).toBe(true);
  });

  it('uses the real cached path + isPointInStroke when a path/ctx are set (post-draw state)', () => {
    const line = makeLine({ x: 0, y: 0, x2: 100, y2: 0 });
    const ctx = makeCtx();
    (line as unknown as { path: unknown; ctx: unknown }).path = {};
    (line as unknown as { path: unknown; ctx: unknown }).ctx = ctx;
    (line as unknown as { $context: unknown }).$context = { chart: { currentDevicePixelRatio: 1 } };
    ctx.isPointInStroke = vi.fn(() => true);
    expect(line.inRange(50, 0)).toBe(true);
    expect(ctx.isPointInStroke).toHaveBeenCalled();
  });

  it('handles a real point that projects before the line’s own start (t < 0)', () => {
    const line = makeLine({ x: 0, y: 0, x2: 100, y2: 0 });
    expect(line.inRange(-1000, 0)).toBe(false);
  });

  it('falls back to a real, visible, hit label when the stroke itself misses', () => {
    const line = makeLine({ x: 0, y: 0, x2: 100, y2: 0 });
    const ctx = makeCtx();
    (line as unknown as { path: unknown; ctx: unknown }).path = {};
    (line as unknown as { path: unknown; ctx: unknown }).ctx = ctx;
    (line as unknown as { $context: unknown }).$context = { chart: { currentDevicePixelRatio: 1 } };
    ctx.isPointInStroke = vi.fn(() => false);
    (line as unknown as { elements: unknown[] }).elements = [{ options: { display: true }, inRange: () => true }];
    expect(line.inRange(50, 0)).toBe(true);
  });

  it('falls back to a real, visible, hit label when the plain intersects() test misses (no cached path)', () => {
    const line = makeLine({ x: 0, y: 0, x2: 100, y2: 0 });
    (line as unknown as { elements: unknown[] }).elements = [{ options: { display: true }, inRange: () => true }];
    expect(line.inRange(1000, 1000)).toBe(true);
  });
});

describe('LineAnnotation#draw', () => {
  it('draws a real straight line with no arrow heads by default', () => {
    const ctx = makeCtx();
    const line = makeLine({ x: 0, y: 0, x2: 100, y2: 0 }, { borderWidth: 2, borderColor: 'black' });
    line.draw(ctx as never);
    expect(ctx.stroke).toHaveBeenCalled();
  });

  it('does nothing at all when borderWidth is 0 (no real border to draw)', () => {
    const ctx = makeCtx();
    const line = makeLine({}, { borderWidth: 0 });
    line.draw(ctx as never);
    expect(ctx.stroke).not.toHaveBeenCalled();
  });

  it('draws real arrow heads when configured', () => {
    const ctx = makeCtx();
    const line = makeLine({ x: 0, y: 0, x2: 100, y2: 0 }, { borderWidth: 2, arrowHeads: { end: { display: true, length: 10, width: 5 } } });
    line.draw(ctx as never);
    expect(ctx.moveTo).toHaveBeenCalled();
  });

  it('fills a real arrow head when fill is true', () => {
    const ctx = makeCtx();
    const line = makeLine({ x: 0, y: 0, x2: 100, y2: 0 }, { borderWidth: 2, arrowHeads: { end: { display: true, length: 10, width: 5, fill: true, backgroundColor: 'red' } } });
    line.draw(ctx as never);
    expect(ctx.fill).toHaveBeenCalled();
    expect(ctx.fillStyle).toBe('red');
  });

  it('draws real arrow heads on both ends when curve is enabled', () => {
    const ctx = makeCtx();
    const line = makeLine(
      { x: 0, y: 0, x2: 100, y2: 0, cp: { x: 50, y: -30 } },
      { curve: true, borderWidth: 2, arrowHeads: { start: { display: true, length: 8, width: 4 }, end: { display: true, length: 8, width: 4, fill: true } } },
    );
    line.draw(ctx as never);
    expect(ctx.translate).toHaveBeenCalled();
    expect(ctx.rotate).toHaveBeenCalled();
  });
});

describe('LineAnnotation#resolveElementProperties', () => {
  it('resolves a real, full-width line from a named scaleID', () => {
    const line = makeLine();
    const yScale = { id: 'y', axis: 'y', isHorizontal: () => false, getPixelForValue: (v: number) => v, parse: (v: unknown) => Number(v) };
    const chart = {
      scales: { y: yScale },
      chartArea: { left: 0, top: 0, right: 100, bottom: 100 },
      ctx: makeCtx(),
    };
    const result = line.resolveElementProperties(chart as never, {
      scaleID: 'y',
      value: 30,
      label: { content: 'hi', font: {}, padding: 4, borderWidth: 0, position: 'center', xAdjust: 0, yAdjust: 0, rotation: 0 },
    } as never) as Record<string, unknown>;
    expect(result.y).toBe(30);
    expect(result.elements).toHaveLength(1);
  });

  it('resolves a real curve control point when curve is enabled', () => {
    const line = makeLine();
    const xScale = { id: 'x', axis: 'x', left: 0, right: 100, options: {}, getPixelForValue: (v: number) => v, parse: (v: unknown) => Number(v) };
    const chart = {
      scales: { x: xScale },
      chartArea: { left: 0, top: 0, right: 100, bottom: 100 },
      ctx: makeCtx(),
    };
    const result = line.resolveElementProperties(chart as never, {
      xMin: 0,
      xMax: 100,
      curve: true,
      controlPoint: { y: '-50%' },
      label: { content: 'hi', font: {}, padding: 4, borderWidth: 0, position: 'center', xAdjust: 0, yAdjust: 0, rotation: 0 },
    } as never) as Record<string, unknown>;
    expect(result).toHaveProperty('cp');
  });

  it('resolves a real curve control point given a plain-number controlPoint (not an {x,y} object)', () => {
    const line = makeLine();
    const xScale = { id: 'x', axis: 'x', left: 0, right: 100, options: {}, getPixelForValue: (v: number) => v, parse: (v: unknown) => Number(v) };
    const chart = {
      scales: { x: xScale },
      chartArea: { left: 0, top: 0, right: 100, bottom: 100 },
      ctx: makeCtx(),
    };
    const result = line.resolveElementProperties(chart as never, {
      xMin: 0,
      xMax: 100,
      curve: true,
      controlPoint: '-25%',
      label: { content: 'hi', font: {}, padding: 4, borderWidth: 0, position: 'center', xAdjust: 0, yAdjust: 0, rotation: 0 },
    } as never) as Record<string, unknown>;
    expect(result).toHaveProperty('cp');
  });

  it('marks a line entirely outside the real chart area as not inside (isLineInArea false)', () => {
    const line = makeLine();
    const xScale = { id: 'x', axis: 'x', left: 0, right: 100, options: {}, getPixelForValue: (v: number) => v + 1000, parse: (v: unknown) => Number(v) };
    const chart = {
      scales: { x: xScale },
      chartArea: { left: 0, top: 0, right: 100, bottom: 100 },
      ctx: makeCtx(),
    };
    const result = line.resolveElementProperties(chart as never, {
      xMin: 0,
      xMax: 10,
      label: { content: 'hi', font: {}, padding: 4, borderWidth: 0, position: 'center', xAdjust: 0, yAdjust: 0, rotation: 0 },
    } as never) as Record<string, unknown> & { elements: { properties: { _visible?: boolean } }[] };
    expect(result.elements[0].properties._visible).toBe(false);
  });

  it('clips a real line partially outside the chart area to its own real edges', () => {
    const line = makeLine();
    const xScale = { id: 'x', axis: 'x', left: 0, right: 100, options: {}, getPixelForValue: (v: number) => v, parse: (v: unknown) => Number(v) };
    const yScale = { id: 'y', axis: 'y', top: 0, bottom: 100, options: {}, getPixelForValue: (v: number) => v, parse: (v: unknown) => Number(v) };
    const chart = {
      scales: { x: xScale, y: yScale },
      chartArea: { left: 0, top: 0, right: 100, bottom: 100 },
      ctx: makeCtx(),
    };
    // A line running from (-50, -50) to (150, 150) — diagonally through
    // the chart area, clipped on all four real edges in turn.
    const result = line.resolveElementProperties(chart as never, {
      xMin: -50,
      xMax: 150,
      yMin: -50,
      yMax: 150,
      label: { content: 'hi', font: {}, padding: 4, borderWidth: 0, position: 'center', xAdjust: 0, yAdjust: 0, rotation: 0 },
    } as never) as Record<string, unknown>;
    expect(result.x).toBeGreaterThanOrEqual(0);
    expect(result.y).toBeGreaterThanOrEqual(0);
  });

  it('clips a real, purely vertical line against the top and bottom chart edges', () => {
    const line = makeLine();
    const xScale = { id: 'x', axis: 'x', left: 0, right: 100, options: {}, getPixelForValue: (v: number) => v, parse: (v: unknown) => Number(v) };
    const yScale = { id: 'y', axis: 'y', top: 0, bottom: 100, options: {}, getPixelForValue: (v: number) => v, parse: (v: unknown) => Number(v) };
    const chart = {
      scales: { x: xScale, y: yScale },
      chartArea: { left: 0, top: 0, right: 100, bottom: 100 },
      ctx: makeCtx(),
    };
    // A vertical line at x=50, extending from above the top edge to
    // below the bottom edge — real x stays in range on both ends, only
    // the real y<top/y>bottom clamping branches trigger.
    const result = line.resolveElementProperties(chart as never, {
      xMin: 50,
      xMax: 50,
      yMin: -50,
      yMax: 150,
      label: { content: 'hi', font: {}, padding: 4, borderWidth: 0, position: 'center', xAdjust: 0, yAdjust: 0, rotation: 0 },
    } as never) as Record<string, unknown>;
    expect(result.y).toBe(0);
    expect(result.y2).toBe(100);
  });

  it("resolves a real label anchored at the line's own start", () => {
    const line = makeLine();
    const yScale = { id: 'y', axis: 'y', isHorizontal: () => false, getPixelForValue: (v: number) => v, parse: (v: unknown) => Number(v) };
    const chart = {
      scales: { y: yScale },
      chartArea: { left: 0, top: 0, right: 100, bottom: 100 },
      ctx: makeCtx(),
    };
    const result = line.resolveElementProperties(chart as never, {
      scaleID: 'y',
      value: 30,
      label: { content: 'hi', font: {}, padding: 4, borderWidth: 0, position: 'start', xAdjust: 0, yAdjust: 0, rotation: 0 },
    } as never) as Record<string, unknown>;
    expect(result).toHaveProperty('elements');
  });

  it("resolves a real label anchored at the line's own end", () => {
    const line = makeLine();
    const yScale = { id: 'y', axis: 'y', isHorizontal: () => false, getPixelForValue: (v: number) => v, parse: (v: unknown) => Number(v) };
    const chart = {
      scales: { y: yScale },
      chartArea: { left: 0, top: 0, right: 100, bottom: 100 },
      ctx: makeCtx(),
    };
    const result = line.resolveElementProperties(chart as never, {
      scaleID: 'y',
      value: 30,
      label: { content: 'hi', font: {}, padding: 4, borderWidth: 0, position: 'end', xAdjust: 0, yAdjust: 0, rotation: 0 },
    } as never) as Record<string, unknown>;
    expect(result).toHaveProperty('elements');
  });

  it('resolves a real label with an explicit numeric rotation (not "auto")', () => {
    const line = makeLine();
    const yScale = { id: 'y', axis: 'y', isHorizontal: () => false, getPixelForValue: (v: number) => v, parse: (v: unknown) => Number(v) };
    const chart = {
      scales: { y: yScale },
      chartArea: { left: 0, top: 0, right: 100, bottom: 100 },
      ctx: makeCtx(),
    };
    const result = line.resolveElementProperties(chart as never, {
      scaleID: 'y',
      value: 30,
      label: { content: 'hi', font: {}, padding: 4, borderWidth: 0, position: 'center', xAdjust: 0, yAdjust: 0, rotation: 45 },
    } as never) as Record<string, unknown> & { elements: { properties: { rotation: number } }[] };
    expect(result.elements[0].properties.rotation).toBeCloseTo(45, 5);
  });

  it('resolves a real label with "auto" rotation following the real line angle', () => {
    const line = makeLine();
    const yScale = { id: 'y', axis: 'y', isHorizontal: () => false, getPixelForValue: (v: number) => v, parse: (v: unknown) => Number(v) };
    const chart = {
      scales: { y: yScale },
      chartArea: { left: 0, top: 0, right: 100, bottom: 100 },
      ctx: makeCtx(),
    };
    const result = line.resolveElementProperties(chart as never, {
      scaleID: 'y',
      value: 30,
      label: { content: 'hi', font: {}, padding: 4, borderWidth: 0, position: 'center', xAdjust: 0, yAdjust: 0, rotation: 'auto' },
    } as never) as Record<string, unknown>;
    expect(result).toHaveProperty('elements');
  });
});
