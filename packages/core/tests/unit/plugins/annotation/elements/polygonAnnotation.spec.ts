import { describe, expect, it, vi } from 'vitest';
import { PolygonAnnotation } from '../../../../../src/plugins/annotation/elements/polygonAnnotation.js';

function makeCtx() {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    setLineDash: vi.fn(),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    shadowColor: '',
  };
}

function makePolyPoint(x: number, y: number, bX: number, bY: number) {
  return { x, y, bX, bY, getProps: () => ({ bX, bY }) };
}

function makePolygon(elements: unknown[], options: Record<string, unknown> = {}) {
  const poly = new PolygonAnnotation();
  Object.assign(poly, { centerX: 10, centerY: 10 });
  (poly as unknown as { elements: unknown[] }).elements = elements;
  (poly as unknown as { options: Record<string, unknown> }).options = { radius: 10, rotation: 0, borderWidth: 1, hitTolerance: 0, sides: 3, ...options };
  return poly;
}

describe('PolygonAnnotation — static config', () => {
  it('has the real id and defaults', () => {
    expect(PolygonAnnotation.id).toBe('polygonAnnotation');
    expect(PolygonAnnotation.defaults.sides).toBe(3);
  });
});

describe('PolygonAnnotation#inRange', () => {
  it('returns false for a real radius below 0.1', () => {
    const poly = makePolygon([makePolyPoint(0, 0, 0, 0), makePolyPoint(10, 10, 10, 10)], { radius: 0.05 });
    expect(poly.inRange(5, 5)).toBe(false);
  });

  it('returns false with fewer than 2 real points', () => {
    const poly = makePolygon([makePolyPoint(0, 0, 0, 0)]);
    expect(poly.inRange(5, 5)).toBe(false);
  });

  it('detects a point inside a real triangle', () => {
    const poly = makePolygon([makePolyPoint(10, 0, 10, 0), makePolyPoint(0, 20, 0, 20), makePolyPoint(20, 20, 20, 20)]);
    expect(poly.inRange(10, 15)).toBe(true);
  });

  it('detects a point outside a real triangle', () => {
    const poly = makePolygon([makePolyPoint(10, 0, 10, 0), makePolyPoint(0, 20, 0, 20), makePolyPoint(20, 20, 20, 20)]);
    expect(poly.inRange(1000, 1000)).toBe(false);
  });

  it('restricts the real test to a single axis when given', () => {
    const poly = makePolygon([makePolyPoint(0, 0, 0, 0), makePolyPoint(10, 10, 10, 10)]);
    expect(typeof poly.inRange(5, 5, 'x')).toBe('boolean');
  });
});

describe('PolygonAnnotation#draw', () => {
  it('draws a real filled/stroked polygon path across every point', () => {
    const ctx = makeCtx();
    const poly = makePolygon([makePolyPoint(0, 0, 0, 0), makePolyPoint(10, 0, 10, 0), makePolyPoint(5, 10, 5, 10)], { backgroundColor: 'blue', borderWidth: 2, borderColor: 'black' });
    poly.draw(ctx as never);
    expect(ctx.moveTo).toHaveBeenCalledTimes(1);
    expect(ctx.lineTo).toHaveBeenCalledTimes(2);
    expect(ctx.fill).toHaveBeenCalled();
    expect(ctx.stroke).toHaveBeenCalled();
  });
});

describe('PolygonAnnotation#resolveElementProperties', () => {
  it('builds one real sub-element per configured side', () => {
    const poly = makePolygon([]);
    const chart = {
      scales: { x: { id: 'x', axis: 'x', left: 0, right: 100, options: {}, getPixelForValue: (v: number) => v }, y: { id: 'y', axis: 'y', top: 0, bottom: 100, options: {}, getPixelForValue: (v: number) => v } },
      chartArea: { left: 0, top: 0, right: 100, bottom: 100 },
    };
    const result = poly.resolveElementProperties(chart as never, { xMin: 0, xMax: 40, yMin: 0, yMax: 40, sides: 5, rotation: 0, xAdjust: 0, yAdjust: 0 } as never) as { elements: unknown[] };
    expect(result.elements).toHaveLength(5);
  });
});
