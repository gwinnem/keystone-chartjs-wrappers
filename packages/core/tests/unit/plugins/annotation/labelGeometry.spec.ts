import { describe, expect, it, vi } from 'vitest';
import {
  calculateTextAlignment,
  defaultInitAnimation,
  initAnimationProperties,
  isBoundToPoint,
  loadHooks,
  measureLabelRectangle,
  shouldFit,
  toFonts,
  toPosition,
} from '../../../../src/plugins/annotation/labelGeometry.js';

// Testing the real label geometry/measurement helpers directly
// (dissected from the real, installed package's own real, unminified
// ESM build — see geometry.ts's own header comment for the full
// dissection rationale).

describe('calculateTextAlignment', () => {
  it('centers text within the real width when textAlign is "center"', () => {
    expect(calculateTextAlignment({ x: 10, width: 40 }, { textAlign: 'center' })).toBe(30);
  });

  it('aligns to the real right/end edge for "end"/"right"', () => {
    expect(calculateTextAlignment({ x: 10, width: 40 }, { textAlign: 'end' })).toBe(50);
    expect(calculateTextAlignment({ x: 10, width: 40 }, { textAlign: 'right' })).toBe(50);
  });

  it('defaults to the real left/start edge for anything else', () => {
    expect(calculateTextAlignment({ x: 10, width: 40 }, { textAlign: 'start' })).toBe(10);
  });
});

describe('toPosition', () => {
  it('applies a single value to both axes', () => {
    expect(toPosition('start')).toEqual({ x: 'start', y: 'start' });
  });

  it('resolves an independent {x, y} object', () => {
    expect(toPosition({ x: 'start', y: 'end' })).toEqual({ x: 'start', y: 'end' });
  });

  it('defaults to "center" when nothing is given', () => {
    expect(toPosition(undefined)).toEqual({ x: 'center', y: 'center' });
  });

  it('fills a missing axis in a partial {x} object with the default', () => {
    expect(toPosition({ x: 'start' })).toEqual({ x: 'start', y: 'center' });
  });
});

describe('measureLabelRectangle', () => {
  it('computes a real rect centered on the anchor point by default', () => {
    const result = measureLabelRectangle({ x: 100, y: 100 }, { width: 40, height: 20 }, { borderWidth: 0, position: 'center', xAdjust: 0, yAdjust: 0 });
    expect(result.centerX).toBeCloseTo(100, 5);
    expect(result.centerY).toBeCloseTo(100, 5);
    expect(result.width).toBe(40);
    expect(result.height).toBe(20);
  });

  it('adds real padding and borderWidth to the measured size', () => {
    const result = measureLabelRectangle({ x: 0, y: 0 }, { width: 40, height: 20 }, { borderWidth: 4, position: 'center', xAdjust: 0, yAdjust: 0 }, { width: 10, height: 6 });
    expect(result.width).toBe(40 + 10 + 4);
    expect(result.height).toBe(20 + 6 + 4);
  });

  it('applies xAdjust/yAdjust as a real offset', () => {
    const withAdjust = measureLabelRectangle({ x: 0, y: 0 }, { width: 10, height: 10 }, { borderWidth: 0, position: 'center', xAdjust: 5, yAdjust: -5 });
    const without = measureLabelRectangle({ x: 0, y: 0 }, { width: 10, height: 10 }, { borderWidth: 0, position: 'center', xAdjust: 0, yAdjust: 0 });
    expect(withAdjust.x).toBeCloseTo(without.x + 5, 5);
    expect(withAdjust.y).toBeCloseTo(without.y - 5, 5);
  });
});

describe('shouldFit', () => {
  it('is false when autoFit is not set', () => {
    expect(shouldFit(undefined, 0.5)).toBe(false);
    expect(shouldFit({}, 0.5)).toBe(false);
  });

  it('is false when the fit ratio is already >= 1', () => {
    expect(shouldFit({ autoFit: true }, 1)).toBe(false);
    expect(shouldFit({ autoFit: true }, 1.5)).toBe(false);
  });

  it('is true when autoFit is on and the ratio is genuinely below 1', () => {
    expect(shouldFit({ autoFit: true }, 0.5)).toBe(true);
  });
});

describe('toFonts', () => {
  it('wraps a single font object into a real one-element array', () => {
    const result = toFonts({ font: { size: 12 } });
    expect(result).toHaveLength(1);
  });

  it('preserves a real array of fonts, one per line', () => {
    const result = toFonts({ font: [{ size: 12 }, { size: 14 }] });
    expect(result).toHaveLength(2);
  });

  it('shrinks font size proportionally when autoFit triggers shouldFit', () => {
    const result = toFonts({ font: { size: 20 }, autoFit: true }, 0.5);
    expect(result[0].size).toBe(10);
  });

  it('leaves font size untouched when the fit ratio is >= 1', () => {
    const result = toFonts({ font: { size: 20 }, autoFit: true }, 1);
    expect(result[0].size).toBe(20);
  });
});

describe('isBoundToPoint', () => {
  it('is true when xValue is set', () => {
    expect(isBoundToPoint({ xValue: 5 })).toBe(true);
  });

  it('is true when yValue is set', () => {
    expect(isBoundToPoint({ yValue: 5 })).toBe(true);
  });

  it('is false when neither is set', () => {
    expect(isBoundToPoint({})).toBe(false);
    expect(isBoundToPoint(undefined)).toBe(false);
  });
});

describe('defaultInitAnimation', () => {
  it('gives box/label/doughnutLabel/polygon a real zero-size box at their own center', () => {
    for (const type of ['box', 'label', 'doughnutLabel', 'polygon']) {
      const result = defaultInitAnimation[type]({ centerX: 10, centerY: 20 });
      expect(result).toEqual({ x: 10, y: 20, x2: 10, y2: 20, width: 0, height: 0 });
    }
  });

  it('gives line a real zero-size box at its own start point', () => {
    const result = defaultInitAnimation.line({ x: 5, y: 6 });
    expect(result).toEqual({ x: 5, y: 6, x2: 5, y2: 6, width: 0, height: 0 });
  });

  it('gives point/ellipse a real zero-radius circle at their own center', () => {
    const result = defaultInitAnimation.point({ centerX: 10, centerY: 20 });
    expect(result).toEqual({ centerX: 10, centerY: 20, radius: 0, width: 0, height: 0 });
  });
});

describe('initAnimationProperties', () => {
  it('returns undefined when init is falsy', () => {
    expect(initAnimationProperties({} as never, { centerX: 0, centerY: 0 }, {})).toBeUndefined();
  });

  it('applies the real default shape for the resolved type when init is true', () => {
    const result = initAnimationProperties({} as never, { centerX: 5, centerY: 5 }, { init: true, type: 'box' });
    expect(result).toEqual({ x: 5, y: 5, x2: 5, y2: 5, width: 0, height: 0 });
  });

  it('calls a real init function and applies the default when it returns true', () => {
    const initFn = vi.fn(() => true);
    const result = initAnimationProperties({} as never, { centerX: 1, centerY: 1 }, { init: initFn, type: 'box' });
    expect(initFn).toHaveBeenCalled();
    expect(result).toEqual({ x: 1, y: 1, x2: 1, y2: 1, width: 0, height: 0 });
  });

  it('uses a real custom properties object returned by an init function', () => {
    const custom = { x: 99, y: 99 };
    const result = initAnimationProperties({} as never, { centerX: 1, centerY: 1 }, { init: () => custom });
    expect(result).toEqual(custom);
  });

  it('returns undefined when the init function returns neither true nor an object', () => {
    const result = initAnimationProperties({} as never, { centerX: 1, centerY: 1 }, { init: () => false });
    expect(result).toBeUndefined();
  });
});

describe('loadHooks', () => {
  it('activates and stores every real function-valued hook', () => {
    const container: Record<string, unknown> = {};
    const fn = vi.fn();
    const activated = loadHooks({ click: fn }, ['click', 'enter'], container);
    expect(activated).toBe(true);
    expect(container.click).toBe(fn);
  });

  it('is false when no real hook is a function', () => {
    const container: Record<string, unknown> = {};
    expect(loadHooks({}, ['click', 'enter'], container)).toBe(false);
  });

  it('removes a previously-set hook that is no longer defined', () => {
    const container: Record<string, unknown> = { click: vi.fn() };
    loadHooks({}, ['click'], container);
    expect(container.click).toBeUndefined();
  });
});
