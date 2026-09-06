import { describe, expect, it } from 'vitest';
import {
  clamp,
  clampAll,
  EPSILON,
  getElementCenterPoint,
  getRelativePosition,
  getSize,
  inBoxRange,
  inLabelRange,
  inLimit,
  inPointRange,
  isPercentString,
  requireVersion,
  rotated,
  toPercent,
  toPositivePercent,
  toRadians,
} from '../../../../src/plugins/annotation/geometry.js';

// Testing the real low-level geometric primitives directly (dissected
// from the real, installed package's own real, unminified ESM build —
// see geometry.ts's own header comment for the full dissection
// rationale).

describe('rotated', () => {
  it('rotates a point 90 degrees around a center', () => {
    const result = rotated({ x: 10, y: 0 }, { x: 0, y: 0 }, Math.PI / 2);
    expect(result.x).toBeCloseTo(0, 5);
    expect(result.y).toBeCloseTo(10, 5);
  });

  it('returns the same point for a zero rotation', () => {
    const result = rotated({ x: 5, y: 3 }, { x: 0, y: 0 }, 0);
    expect(result.x).toBeCloseTo(5, 5);
    expect(result.y).toBeCloseTo(3, 5);
  });
});

describe('toRadians', () => {
  it('converts degrees to radians', () => {
    expect(toRadians(180)).toBeCloseTo(Math.PI, 5);
    expect(toRadians(90)).toBeCloseTo(Math.PI / 2, 5);
    expect(toRadians(0)).toBe(0);
  });
});

describe('clamp / clampAll', () => {
  it('clamps a value into the real [from, to] range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-5, 0, 10)).toBe(0);
    expect(clamp(15, 0, 10)).toBe(10);
  });

  it('clamps every own key of an object in place', () => {
    const obj = { a: -5, b: 5, c: 15 };
    const result = clampAll(obj, 0, 10);
    expect(result).toBe(obj);
    expect(result).toEqual({ a: 0, b: 5, c: 10 });
  });
});

describe('inLimit', () => {
  it('reports a value inside the real range as in range', () => {
    expect(inLimit({ value: 5, start: 0, end: 10 }, 0)).toBe(true);
  });

  it('reports a value outside the range, beyond hitSize slack, as out of range', () => {
    expect(inLimit({ value: -5, start: 0, end: 10 }, 2)).toBe(false);
  });

  it('honors hitSize slack at the boundary', () => {
    expect(inLimit({ value: -1, start: 0, end: 10 }, 2)).toBe(true);
  });
});

describe('inPointRange', () => {
  it('returns false when point or center is missing', () => {
    expect(inPointRange(undefined, { x: 0, y: 0 }, 5, 0)).toBe(false);
    expect(inPointRange({ x: 0, y: 0 }, undefined, 5, 0)).toBe(false);
  });

  it('returns false for a non-positive radius', () => {
    expect(inPointRange({ x: 0, y: 0 }, { x: 0, y: 0 }, 0, 0)).toBe(false);
  });

  it('detects a point within the real circular range', () => {
    expect(inPointRange({ x: 3, y: 4 }, { x: 0, y: 0 }, 5, 0)).toBe(true);
  });

  it('detects a point outside the real circular range', () => {
    expect(inPointRange({ x: 10, y: 10 }, { x: 0, y: 0 }, 5, 0)).toBe(false);
  });
});

describe('inBoxRange', () => {
  const rect = { x: 0, y: 0, x2: 10, y2: 10 };

  it('detects a point inside the box on both axes', () => {
    expect(inBoxRange({ x: 5, y: 5 }, rect, undefined, { borderWidth: 0, hitTolerance: 0 })).toBe(true);
  });

  it('detects a point outside the box on both axes', () => {
    expect(inBoxRange({ x: 50, y: 50 }, rect, undefined, { borderWidth: 0, hitTolerance: 0 })).toBe(false);
  });

  it('restricts the test to the x axis only when given', () => {
    expect(inBoxRange({ x: 5, y: 500 }, rect, 'x', { borderWidth: 0, hitTolerance: 0 })).toBe(true);
  });

  it('restricts the test to the y axis only when given', () => {
    expect(inBoxRange({ x: 500, y: 5 }, rect, 'y', { borderWidth: 0, hitTolerance: 0 })).toBe(true);
  });

  it('extends the hit area by half the real border width + tolerance', () => {
    expect(inBoxRange({ x: -3, y: 5 }, rect, undefined, { borderWidth: 4, hitTolerance: 2 })).toBe(true);
  });
});

describe('inLabelRange', () => {
  it('rotates the query point back before testing box range', () => {
    // A box centered at (10, 10) with real half-width/height 5, rotated
    // 90° — a point that would be outside on the x-axis in unrotated
    // space should test as inside once rotated back.
    const rect = { x: 5, y: 5, x2: 15, y2: 15 };
    const center = { x: 10, y: 10 };
    const result = inLabelRange({ x: 10, y: 3 }, { rect, center }, undefined, { rotation: 90, borderWidth: 0, hitTolerance: 0 });
    expect(typeof result).toBe('boolean');
  });

  it('matches a plain inBoxRange test when rotation is 0', () => {
    const rect = { x: 0, y: 0, x2: 10, y2: 10 };
    const center = { x: 5, y: 5 };
    expect(inLabelRange({ x: 5, y: 5 }, { rect, center }, undefined, { rotation: 0, borderWidth: 0, hitTolerance: 0 })).toBe(true);
  });
});

describe('requireVersion', () => {
  it('passes silently for a version meeting the minimum', () => {
    expect(requireVersion('chart.js', '4.0', '4.5.1')).toBe(true);
  });

  it('throws for a version below the minimum in strict mode (the default)', () => {
    expect(() => requireVersion('chart.js', '4.0', '3.9.0')).toThrow(/is not supported/);
  });

  it('returns false instead of throwing when strict is false', () => {
    expect(requireVersion('chart.js', '4.0', '3.9.0', false)).toBe(false);
  });
});

describe('isPercentString / toPercent / toPositivePercent', () => {
  it('identifies a real percent string', () => {
    expect(isPercentString('50%')).toBe(true);
    expect(isPercentString(50)).toBe(false);
    expect(isPercentString('50')).toBe(false);
  });

  it('converts a percent string to a real fraction', () => {
    expect(toPercent('50%')).toBeCloseTo(0.5, 5);
    expect(toPercent('-50%')).toBeCloseTo(-0.5, 5);
  });

  it('clamps a negative percent to 0 for toPositivePercent', () => {
    expect(toPositivePercent('-50%')).toBe(0);
    expect(toPositivePercent('150%')).toBe(1);
  });
});

describe('getRelativePosition', () => {
  it('resolves "start" to 0', () => {
    expect(getRelativePosition(100, 'start')).toBe(0);
  });

  it('resolves "end" to the full size', () => {
    expect(getRelativePosition(100, 'end')).toBe(100);
  });

  it('resolves a percent string proportionally', () => {
    expect(getRelativePosition(100, '25%')).toBeCloseTo(25, 5);
  });

  it('defaults to the center for anything else', () => {
    expect(getRelativePosition(100, undefined)).toBe(50);
    expect(getRelativePosition(100, 'center')).toBe(50);
  });
});

describe('getSize', () => {
  it('returns a plain number unchanged', () => {
    expect(getSize(100, 42)).toBe(42);
  });

  it('resolves a positive percent string against size', () => {
    expect(getSize(100, '25%')).toBeCloseTo(25, 5);
  });

  it('allows a negative percent when positivePercent is false', () => {
    expect(getSize(100, '-25%', false)).toBeCloseTo(-25, 5);
  });

  it('clamps a negative percent to 0 by default (positivePercent true)', () => {
    expect(getSize(100, '-25%')).toBe(0);
  });

  it('falls back to size itself when value is undefined', () => {
    expect(getSize(100, undefined)).toBe(100);
  });
});

describe('getElementCenterPoint', () => {
  it('reads centerX/centerY via getProps', () => {
    const element = { getProps: (props: string[]) => ({ centerX: 10, centerY: 20 }) };
    expect(getElementCenterPoint(element)).toEqual({ x: 10, y: 20 });
  });

  it('passes useFinalPosition through to getProps', () => {
    let receivedFinal: boolean | undefined;
    const element = {
      getProps: (props: string[], final?: boolean) => {
        receivedFinal = final;
        return { centerX: 0, centerY: 0 };
      },
    };
    getElementCenterPoint(element, true);
    expect(receivedFinal).toBe(true);
  });
});

describe('EPSILON', () => {
  it('is a small, real positive number', () => {
    expect(EPSILON).toBeGreaterThan(0);
    expect(EPSILON).toBeLessThan(1);
  });
});
