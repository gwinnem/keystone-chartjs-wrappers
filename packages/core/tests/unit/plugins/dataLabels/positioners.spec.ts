import { describe, expect, it } from 'vitest';
import { aligned, clipped, orient, positioners } from '../../../../src/plugins/dataLabels/positioners.js';

// Testing the real per-element-type anchor-point resolution directly
// (dissected from the real, installed package's own real, unminified
// ESM build — see utils.ts's own header comment for the full
// dissection rationale).

describe('orient', () => {
  it('returns the real unit vector from origin towards point', () => {
    const result = orient({ x: 10, y: 0 }, { x: 0, y: 0 });
    expect(result.x).toBeCloseTo(1, 5);
    expect(result.y).toBeCloseTo(0, 5);
  });

  it('falls back to a fixed vertical direction when origin.x is null', () => {
    expect(orient({ x: 5, y: 5 }, { x: null, y: 0 })).toEqual({ x: 0, y: -1 });
  });

  it('falls back to a fixed horizontal direction when origin.y is null', () => {
    expect(orient({ x: 5, y: 5 }, { x: 0, y: null })).toEqual({ x: 1, y: 0 });
  });

  it('returns a zero vector when point equals origin (zero-length)', () => {
    expect(orient({ x: 3, y: 3 }, { x: 3, y: 3 })).toEqual({ x: 0, y: -1 });
  });
});

describe('aligned', () => {
  it.each([
    ['center', { vx: 0, vy: 0 }],
    ['bottom', { vx: 0, vy: 1 }],
    ['right', { vx: 1, vy: 0 }],
    ['left', { vx: -1, vy: 0 }],
    ['top', { vx: 0, vy: -1 }],
  ])('resolves the named direction "%s"', (align, expected) => {
    const result = aligned(1, 2, 0.5, 0.5, align);
    expect(result).toMatchObject(expected);
  });

  it('flips the given orientation vector for "start"', () => {
    const result = aligned(1, 2, 0.5, 0.5, 'start');
    expect(result.vx).toBe(-0.5);
    expect(result.vy).toBe(-0.5);
  });

  it('keeps the natural orientation for "end"', () => {
    const result = aligned(1, 2, 0.5, 0.5, 'end');
    expect(result.vx).toBe(0.5);
    expect(result.vy).toBe(0.5);
  });

  it('resolves a real clockwise angle in degrees', () => {
    const result = aligned(0, 0, 0, 0, 90);
    expect(result.vx).toBeCloseTo(0, 5);
    expect(result.vy).toBeCloseTo(1, 5);
  });
});

describe('clipped', () => {
  const area = { left: 0, right: 100, top: 0, bottom: 100 };

  it('returns the segment unchanged when already fully inside', () => {
    expect(clipped({ x0: 10, y0: 10, x1: 90, y1: 90 }, area)).toEqual({ x0: 10, y0: 10, x1: 90, y1: 90 });
  });

  it('clips a segment extending past the right edge', () => {
    const result = clipped({ x0: 50, y0: 50, x1: 200, y1: 50 }, area);
    expect(result.x1).toBeCloseTo(100, 5);
  });

  it('clips a segment extending past the top edge', () => {
    const result = clipped({ x0: 50, y0: -50, x1: 50, y1: 50 }, area);
    expect(result.y0).toBeCloseTo(0, 5);
  });
});

describe('positioners.arc', () => {
  it('anchors at the bisector angle between inner and outer radius', () => {
    const el = { x: 0, y: 0, startAngle: 0, endAngle: Math.PI / 2, innerRadius: 0, outerRadius: 10 };
    const config = { anchor: 'end' as const, align: 'end' as const, clamp: false, area: { left: -100, right: 100, top: -100, bottom: 100 }, origin: { x: 0, y: 0 } };

    const result = positioners.arc(el as never, config);

    expect(result.x).toBeCloseTo(10 * Math.cos(Math.PI / 4), 5);
    expect(result.y).toBeCloseTo(10 * Math.sin(Math.PI / 4), 5);
  });
});

describe('positioners.point', () => {
  it('anchors along the real radius, oriented away from the origin', () => {
    const el = { x: 20, y: 0, options: { radius: 5 } };
    const config = { anchor: 'end' as const, align: 'end' as const, clamp: false, area: { left: -100, right: 100, top: -100, bottom: 100 }, origin: { x: 0, y: 0 } };

    const result = positioners.point(el, config);

    expect(result.x).toBeCloseTo(25, 5);
  });
});

describe('positioners.bar', () => {
  it('anchors at the real bar tip for a vertical bar', () => {
    const el = { x: 10, y: 5, base: 20 };
    const config = { anchor: 'end' as const, align: 'end' as const, clamp: false, area: { left: -100, right: 100, top: -100, bottom: 100 }, origin: { x: null, y: 20 } };

    const result = positioners.bar(el, config);

    expect(result.y).toBeCloseTo(5, 5);
  });

  it('anchors correctly for a horizontal bar', () => {
    const el = { x: 30, y: 10, base: 5, horizontal: true };
    const config = { anchor: 'end' as const, align: 'end' as const, clamp: false, area: { left: -100, right: 100, top: -100, bottom: 100 }, origin: { x: 5, y: null } };

    const result = positioners.bar(el, config);

    expect(result.x).toBeCloseTo(30, 5);
  });
});

describe('positioners.fallback', () => {
  it('anchors at the real x/y/width/height rectangle far corner', () => {
    const el = { x: 0, y: 0, width: 40, height: 20 };
    const config = { anchor: 'end' as const, align: 'end' as const, clamp: false, area: { left: -100, right: 100, top: -100, bottom: 100 }, origin: { x: null, y: null } };

    const result = positioners.fallback(el, config);

    expect(result.x).toBeCloseTo(40, 5);
    expect(result.y).toBeCloseTo(20, 5);
  });

  it('defaults width/height to 0 when absent', () => {
    const el = { x: 5, y: 5 };
    const config = { anchor: 'end' as const, align: 'end' as const, clamp: false, area: { left: -100, right: 100, top: -100, bottom: 100 }, origin: { x: null, y: null } };

    const result = positioners.fallback(el, config);

    expect(result.x).toBeCloseTo(5, 5);
    expect(result.y).toBeCloseTo(5, 5);
  });
});
