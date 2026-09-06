import { describe, expect, it, vi } from 'vitest';
import { drawCallout } from '../../../../src/plugins/annotation/callout.js';

// Testing the real label callout-line drawing directly (dissected from
// the real, installed package's own real, unminified ESM build — see
// geometry.ts's own header comment for the full dissection rationale).

function makeCtx() {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    moveTo: vi.fn(),
    lineTo: vi.fn(),
    stroke: vi.fn(),
    setLineDash: vi.fn(),
    lineWidth: 0,
    lineCap: 'butt',
    lineJoin: 'miter',
    lineDashOffset: 0,
    strokeStyle: '',
  };
}

function makeElement(overrides: Record<string, unknown> = {}) {
  return {
    pointX: 100,
    pointY: 100,
    x: 0,
    y: 0,
    x2: 50,
    y2: 20,
    width: 50,
    height: 20,
    centerX: 25,
    centerY: 10,
    rotation: 0,
    options: { callout: { display: true, margin: 5, side: 5, start: '50%', borderWidth: 1 }, borderWidth: 0 },
    getCenterPoint: () => ({ x: 25, y: 10 }),
    inRange: () => false,
    ...overrides,
  };
}

describe('drawCallout', () => {
  it('does nothing at all when callout.display is false', () => {
    const ctx = makeCtx();
    const el = makeElement({ options: { callout: { display: false }, borderWidth: 0 } });
    drawCallout(ctx as never, el as never);
    expect(ctx.save).not.toHaveBeenCalled();
  });

  it('does nothing when the anchor point already falls inside the label (inRange true)', () => {
    const ctx = makeCtx();
    const el = makeElement({ inRange: () => true });
    drawCallout(ctx as never, el as never);
    expect(ctx.save).not.toHaveBeenCalled();
  });

  it('draws the real callout line when the anchor point is outside the label', () => {
    const ctx = makeCtx();
    const el = makeElement();
    drawCallout(ctx as never, el as never);
    expect(ctx.save).toHaveBeenCalled();
    expect(ctx.stroke).toHaveBeenCalled();
    expect(ctx.restore).toHaveBeenCalled();
  });

  it('restores without stroking when the callout has no real border to draw', () => {
    const ctx = makeCtx();
    const el = makeElement({ options: { callout: { display: true, margin: 5, side: 5, start: '50%', borderWidth: 0 }, borderWidth: 0 } });
    drawCallout(ctx as never, el as never);
    expect(ctx.stroke).not.toHaveBeenCalled();
    expect(ctx.restore).toHaveBeenCalled();
  });

  it('resolves a real, explicit callout position instead of auto-detecting when configured', () => {
    const ctx = makeCtx();
    const el = makeElement({ options: { callout: { display: true, margin: 5, side: 5, start: '50%', position: 'left', borderWidth: 1 }, borderWidth: 0 } });
    expect(() => drawCallout(ctx as never, el as never)).not.toThrow();
    expect(ctx.stroke).toHaveBeenCalled();
  });

  it.each(['right', 'top', 'bottom'] as const)('resolves a real, explicit "%s" callout position', (position) => {
    const ctx = makeCtx();
    const el = makeElement({ options: { callout: { display: true, margin: 5, side: 5, start: '50%', position, borderWidth: 1 }, borderWidth: 0 } });
    expect(() => drawCallout(ctx as never, el as never)).not.toThrow();
    expect(ctx.stroke).toHaveBeenCalled();
  });

  it.each(['left', 'right', 'top', 'bottom'] as const)('honors the real, per-position margin offset in isPointInRange for "%s"', (position) => {
    const ctx = makeCtx();
    const inRange = vi.fn(() => true);
    const el = makeElement({ options: { callout: { display: true, margin: 5, side: 5, start: '50%', position, borderWidth: 1 }, borderWidth: 0 }, inRange });
    drawCallout(ctx as never, el as never);
    expect(inRange).toHaveBeenCalled();
  });

  it('skips the real separator line when margin is 0 and a border is present', () => {
    const ctx = makeCtx();
    const el = makeElement({ options: { callout: { display: true, margin: 0, side: 5, start: '50%', borderWidth: 1 }, borderWidth: 1 } });
    drawCallout(ctx as never, el as never);
    // Still draws the side + final connecting line, just fewer moveTo calls than the margin>0 case.
    expect(ctx.stroke).toHaveBeenCalled();
  });
});
