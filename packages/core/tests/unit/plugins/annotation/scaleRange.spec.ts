import { describe, expect, it, vi } from 'vitest';
import { adjustScaleRange, verifyScaleOptions } from '../../../../src/plugins/annotation/scaleRange.js';

// Testing the real scale min/max auto-adjustment logic directly
// (dissected from the real, installed package's own real, unminified
// ESM build — see geometry.ts's own header comment for the full
// dissection rationale).

function makeScale(overrides: Record<string, unknown> = {}) {
  return {
    id: 'x',
    axis: 'x',
    min: 0,
    max: 100,
    options: {},
    parse: (v: unknown) => Number(v),
    handleTickRangeOptions: vi.fn(),
    ...overrides,
  };
}

describe('adjustScaleRange', () => {
  it('extends suggestedMax to fit an annotation beyond the real current max', () => {
    const scale = makeScale();
    const chart = { scales: { x: scale } };
    adjustScaleRange(chart as never, scale as never, [{ scaleID: 'x', value: 150 }]);
    expect((scale as unknown as { max: number }).max).toBe(150);
    expect(scale.handleTickRangeOptions).toHaveBeenCalled();
  });

  it('does not shrink the scale for an annotation within the real current range', () => {
    const scale = makeScale();
    const chart = { scales: { x: scale } };
    adjustScaleRange(chart as never, scale as never, [{ scaleID: 'x', value: 50 }]);
    expect((scale as unknown as { max: number }).max).toBe(100);
  });

  it('does not touch max when the scale already has a real explicit max/suggestedMax set', () => {
    const scale = makeScale({ options: { max: 100 } });
    const chart = { scales: { x: scale } };
    adjustScaleRange(chart as never, scale as never, [{ scaleID: 'x', value: 500 }]);
    expect((scale as unknown as { max: number }).max).toBe(100);
  });

  it('does not call handleTickRangeOptions when nothing actually changed', () => {
    const scale = makeScale();
    const chart = { scales: { x: scale } };
    adjustScaleRange(chart as never, scale as never, []);
    expect(scale.handleTickRangeOptions).not.toHaveBeenCalled();
  });

  it('extends the axis-specific min/max (xMin/xMax) for annotations bound by axis rather than scaleID', () => {
    const scale = makeScale();
    const chart = { scales: { x: scale } };
    adjustScaleRange(chart as never, scale as never, [{ xScaleID: 'x', xMax: 200 }]);
    expect((scale as unknown as { max: number }).max).toBe(200);
  });
});

describe('verifyScaleOptions', () => {
  it('warns when an annotation references a scale ID that does not exist', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    verifyScaleOptions([{ id: 'a1', scaleID: 'missingScale' }], {});
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('missingScale'));
    warn.mockRestore();
  });

  it('does not warn when the referenced scale exists', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    verifyScaleOptions([{ id: 'a1', scaleID: 'x' }], { x: makeScale() as never });
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('does not warn for an annotation with no real scale-bound properties at all', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    verifyScaleOptions([{ id: 'a1' }], {});
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });
});
