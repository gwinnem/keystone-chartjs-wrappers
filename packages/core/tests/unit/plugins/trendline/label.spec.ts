import { describe, expect, it, vi } from 'vitest';
import { addTrendlineLabel } from '../../../../src/plugins/trendline/label.js';

// Testing the real rotated-label drawing logic directly (dissected from
// the real, installed package's own real source — see label.ts's own
// header comment for the full port rationale).

function makeCtx() {
  return {
    font: '',
    fillStyle: '',
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    fillText: vi.fn(),
    measureText: vi.fn(() => ({ width: 40 })),
  };
}

describe('addTrendlineLabel', () => {
  it('sets the real font/fillStyle from the given family/size/color before measuring or drawing', () => {
    const ctx = makeCtx();
    addTrendlineLabel({ ctx: ctx as never, label: 'Trendline', x1: 0, y1: 0, x2: 100, y2: 0, angle: 0, labelColor: 'red', family: 'Arial', size: 14, offset: 5 });

    expect(ctx.font).toBe('14px Arial');
    expect(ctx.fillStyle).toBe('red');
  });

  it('translates to the real segment midpoint and rotates to the segment angle before drawing', () => {
    const ctx = makeCtx();
    addTrendlineLabel({ ctx: ctx as never, label: 'Trendline', x1: 0, y1: 0, x2: 100, y2: 50, angle: Math.PI / 4, labelColor: 'red', family: 'Arial', size: 14, offset: 5 });

    expect(ctx.translate).toHaveBeenCalledWith(50, 25);
    expect(ctx.rotate).toHaveBeenCalledWith(Math.PI / 4);
  });

  it('centers the label horizontally using its own measured width, and applies the given offset vertically', () => {
    const ctx = makeCtx();
    ctx.measureText = vi.fn(() => ({ width: 40 })) as never;
    addTrendlineLabel({ ctx: ctx as never, label: 'Trendline', x1: 0, y1: 0, x2: 100, y2: 0, angle: 0, labelColor: 'red', family: 'Arial', size: 14, offset: 7 });

    expect(ctx.fillText).toHaveBeenCalledWith('Trendline', -20, 7);
  });

  it('saves and restores the canvas state around the real translate/rotate/draw sequence', () => {
    const ctx = makeCtx();
    addTrendlineLabel({ ctx: ctx as never, label: 'Trendline', x1: 0, y1: 0, x2: 100, y2: 0, angle: 0, labelColor: 'red', family: 'Arial', size: 14, offset: 5 });

    expect(ctx.save).toHaveBeenCalled();
    expect(ctx.restore).toHaveBeenCalled();
  });
});
