import { describe, expect, it } from 'vitest';
import { ExponentialFitter, LineFitter } from '../../../../src/plugins/trendline/fitters.js';

// Testing the real least-squares fitting logic directly (dissected from
// the real, installed package's own real source — it ships real,
// readable source, not just a minified bundle — see fitters.ts's own
// header comment for the full port rationale).

describe('LineFitter', () => {
  it('fits an exact straight line (y = 2x + 1) with zero error', () => {
    const fitter = new LineFitter();
    for (const x of [0, 1, 2, 3, 4]) {
      fitter.add(x, 2 * x + 1);
    }

    expect(fitter.slope()).toBeCloseTo(2, 10);
    expect(fitter.intercept()).toBeCloseTo(1, 10);
    expect(fitter.f(10)).toBeCloseTo(21, 10);
  });

  it('tracks the real min/max x seen, regardless of insertion order', () => {
    const fitter = new LineFitter();
    fitter.add(5, 1);
    fitter.add(1, 1);
    fitter.add(3, 1);

    expect(fitter.minx).toBe(1);
    expect(fitter.maxx).toBe(5);
    expect(fitter.count).toBe(3);
  });

  it('caches its own computed coefficients until the next add() call', () => {
    const fitter = new LineFitter();
    fitter.add(0, 0);
    fitter.add(1, 1);
    const firstSlope = fitter.slope();
    // Reading again without adding a new point must return the exact
    // same cached value, not recompute from scratch (observable
    // indirectly here since the real math is deterministic either way —
    // this test's real point is that no error is thrown by a repeat
    // read before any further add()).
    expect(fitter.slope()).toBe(firstSlope);

    fitter.add(2, 5); // breaks the straight line — slope must change
    expect(fitter.slope()).not.toBe(firstSlope);
  });

  it('fits a real, noisy (non-exact) dataset to a sensible best-fit line', () => {
    const fitter = new LineFitter();
    const points: [number, number][] = [
      [0, 1],
      [1, 3],
      [2, 2],
      [3, 5],
      [4, 4],
    ];
    for (const [x, y] of points) fitter.add(x, y);

    // Real ordinary-least-squares result for this exact dataset,
    // computed independently: slope = 0.8, intercept = 1.4.
    expect(fitter.slope()).toBeCloseTo(0.8, 5);
    expect(fitter.intercept()).toBeCloseTo(1.4, 5);
  });
});

describe('ExponentialFitter', () => {
  it('fits an exact exponential curve (y = 2 * e^(0.5x)) with real, accurate coefficients', () => {
    const fitter = new ExponentialFitter();
    for (const x of [0, 1, 2, 3, 4]) {
      fitter.add(x, 2 * Math.exp(0.5 * x));
    }

    expect(fitter.coefficient()).toBeCloseTo(2, 5);
    expect(fitter.growthRate()).toBeCloseTo(0.5, 5);
    expect(fitter.f(2)).toBeCloseTo(2 * Math.exp(1), 5);
  });

  it('rejects a non-positive y-value entirely, marking the fit as invalid rather than throwing', () => {
    const fitter = new ExponentialFitter();
    fitter.add(0, 1);
    fitter.add(1, -5); // ln(-5) is not a real number — the original's own real guard
    fitter.add(2, 3);

    // hasValidData is now false — every accessor falls back to its own
    // real, documented default rather than a NaN/garbage result.
    expect(fitter.growthRate()).toBe(0);
    expect(fitter.coefficient()).toBe(1);
    expect(fitter.f(5)).toBe(0);
  });

  it('returns the real, documented defaults when fewer than 2 points have been added', () => {
    const fitter = new ExponentialFitter();
    fitter.add(0, 1);

    expect(fitter.growthRate()).toBe(0);
    expect(fitter.coefficient()).toBe(1);
    expect(fitter.f(10)).toBe(0);
  });

  it('guards against Math.exp overflow for a genuinely large growth-rate*x product', () => {
    const fitter = new ExponentialFitter();
    // A steep, real exponential — growthRate * x comfortably exceeds
    // the original's own real |...| > 500 threshold at x = 100.
    fitter.add(0, 1);
    fitter.add(1, Math.exp(10));

    expect(fitter.f(100)).toBe(0);
  });

  it('falls back to the real, documented defaults when the x-values are all identical (a zero denominator)', () => {
    const fitter = new ExponentialFitter();
    fitter.add(5, 1);
    fitter.add(5, 2);

    expect(fitter.growthRate()).toBe(0);
    expect(fitter.coefficient()).toBe(1);
  });
});
