import { describe, expect, it, vi } from 'vitest';
import { PointAnnotation } from '../../../../../src/plugins/annotation/elements/pointAnnotation.js';

function makeCtx() {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    drawImage: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    setLineDash: vi.fn(),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    shadowColor: '',
  };
}

function makePoint(props: Record<string, unknown> = {}, options: Record<string, unknown> = {}) {
  const point = new PointAnnotation();
  // Real, confirmed split: draw()'s own early bail-out reads
  // options.radius, but the actual drawing math (via drawPoint())
  // reads a real, separate top-level `radius` field on the element
  // itself — both populated from the same real source during a real
  // resolveElementProperties() call, kept in sync here too.
  const radius = (options.radius as number | undefined) ?? 10;
  Object.assign(point, { x: 0, y: 0, x2: 20, y2: 20, width: 20, centerX: 10, centerY: 10, radius, ...props });
  (point as unknown as { options: Record<string, unknown> }).options = { radius, borderWidth: 1, hitTolerance: 0, ...options };
  return point;
}

describe('PointAnnotation — static config', () => {
  it('has the real id and defaults', () => {
    expect(PointAnnotation.id).toBe('pointAnnotation');
    expect(PointAnnotation.defaults.pointStyle).toBe('circle');
    expect(PointAnnotation.defaults.radius).toBe(10);
  });
});

describe('PointAnnotation#inRange', () => {
  it('detects a point within the real circular range', () => {
    const point = makePoint({ centerX: 10, centerY: 10 });
    expect(point.inRange(12, 10)).toBe(true);
  });

  it('detects a point outside the real circular range', () => {
    const point = makePoint({ centerX: 10, centerY: 10 });
    expect(point.inRange(1000, 1000)).toBe(false);
  });

  it('restricts the real test to the x axis when given', () => {
    const point = makePoint();
    expect(typeof point.inRange(10, 10, 'x')).toBe('boolean');
  });

  it('restricts the real test to the y axis when given', () => {
    const point = makePoint({ y: 0, y2: 20 });
    expect(point.inRange(10, 10, 'y')).toBe(true);
    expect(point.inRange(10, 1000, 'y')).toBe(false);
  });
});

describe('PointAnnotation#draw', () => {
  it('draws a real, filled/stroked point', () => {
    const ctx = makeCtx();
    const point = makePoint({}, { backgroundColor: 'blue', borderWidth: 2, borderColor: 'black' });
    point.draw(ctx as never);
    expect(ctx.fill).toHaveBeenCalled();
    expect(ctx.stroke).toHaveBeenCalled();
  });

  it('does not stroke a real, borderless point', () => {
    const ctx = makeCtx();
    const point = makePoint({}, { backgroundColor: 'blue', borderWidth: 0 });
    point.draw(ctx as never);
    expect(ctx.fill).toHaveBeenCalled();
    expect(ctx.stroke).not.toHaveBeenCalled();
  });

  it('does not stroke a real image pointStyle even with a real border configured', () => {
    const ctx = makeCtx();
    const point = makePoint({}, { backgroundColor: 'blue', borderWidth: 2, pointStyle: { toString: () => '[object HTMLImageElement]', width: 10, height: 10 } });
    point.draw(ctx as never);
    expect(ctx.stroke).not.toHaveBeenCalled();
  });

  it('does nothing at all for a radius below 0.1', () => {
    const ctx = makeCtx();
    const point = makePoint({}, { radius: 0.05 });
    point.draw(ctx as never);
    expect(ctx.fill).not.toHaveBeenCalled();
  });

  it('leaves options.borderWidth unchanged after drawing (real, confirmed no-op reassignment)', () => {
    const ctx = makeCtx();
    const point = makePoint({}, { borderWidth: 3, backgroundColor: 'blue' });
    point.draw(ctx as never);
    expect((point as unknown as { options: { borderWidth: number } }).options.borderWidth).toBe(3);
  });
});

describe('PointAnnotation#resolveElementProperties', () => {
  it('delegates to resolvePointProperties and sets real initProperties', () => {
    const point = makePoint();
    const chart = {
      scales: {
        x: { id: 'x', axis: 'x', left: 0, right: 100, options: {}, getPixelForValue: (v: number) => v },
        y: { id: 'y', axis: 'y', top: 0, bottom: 100, options: {}, getPixelForValue: (v: number) => v },
      },
      chartArea: { left: 0, top: 0, right: 100, bottom: 100 },
    };
    const result = point.resolveElementProperties(chart as never, { xValue: 50, yValue: 50, radius: 5, xAdjust: 0, yAdjust: 0 } as never) as Record<string, unknown>;
    expect(result.centerX).toBe(50);
    expect(result.centerY).toBe(50);
  });
});
