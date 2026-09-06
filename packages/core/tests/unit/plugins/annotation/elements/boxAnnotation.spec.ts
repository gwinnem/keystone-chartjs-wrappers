import { describe, expect, it, vi } from 'vitest';
import { BoxAnnotation } from '../../../../../src/plugins/annotation/elements/boxAnnotation.js';

// Testing the real BoxAnnotation element directly (dissected from the
// real, installed package's own real, unminified ESM build — see
// ../geometry.ts's own header comment for the full dissection
// rationale).

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
    arc: vi.fn(),
    rect: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    setLineDash: vi.fn(),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    lineCap: 'butt',
    lineJoin: 'miter',
    lineDashOffset: 0,
    shadowColor: '',
  };
}

function makeBox(props: Record<string, unknown> = {}, options: Record<string, unknown> = {}) {
  const box = new BoxAnnotation();
  Object.assign(box, { x: 0, y: 0, x2: 40, y2: 20, width: 40, height: 20, centerX: 20, centerY: 10, ...props });
  (box as unknown as { options: Record<string, unknown> }).options = { rotation: 0, borderWidth: 1, hitTolerance: 0, ...options };
  return box;
}

describe('BoxAnnotation — static config', () => {
  it('has the real id, defaults, defaultRoutes, and descriptors', () => {
    expect(BoxAnnotation.id).toBe('boxAnnotation');
    expect(BoxAnnotation.defaults.borderWidth).toBe(1);
    expect(BoxAnnotation.defaultRoutes).toEqual({ borderColor: 'color', backgroundColor: 'color' });
    expect(BoxAnnotation.descriptors.label).toEqual({ _fallback: true });
  });
});

describe('BoxAnnotation#inRange', () => {
  it('detects a point inside the real, unrotated box', () => {
    const box = makeBox();
    expect(box.inRange(20, 10)).toBe(true);
  });

  it('detects a point outside the box', () => {
    const box = makeBox();
    expect(box.inRange(500, 500)).toBe(false);
  });

  it('rotates the query point before testing when rotation is set', () => {
    const box = makeBox({}, { rotation: 45 });
    expect(() => box.inRange(20, 10)).not.toThrow();
  });
});

describe('BoxAnnotation#getCenterPoint', () => {
  it('returns the real centerX/centerY', () => {
    const box = makeBox({ centerX: 20, centerY: 10 });
    expect(box.getCenterPoint()).toEqual({ x: 20, y: 10 });
  });
});

describe('BoxAnnotation#draw', () => {
  it('draws a real, filled/stroked box', () => {
    const ctx = makeCtx();
    const box = makeBox({}, { backgroundColor: 'blue', borderWidth: 2, borderColor: 'black' });
    box.draw(ctx as never);
    expect(ctx.save).toHaveBeenCalled();
    expect(ctx.fill).toHaveBeenCalled();
    expect(ctx.stroke).toHaveBeenCalled();
    expect(ctx.restore).toHaveBeenCalled();
  });

  it('applies real rotation around the center when configured', () => {
    const ctx = makeCtx();
    const box = makeBox({}, { rotation: 45, backgroundColor: 'blue' });
    box.draw(ctx as never);
    expect(ctx.translate).toHaveBeenCalledTimes(2);
    expect(ctx.rotate).toHaveBeenCalled();
  });
});

describe('BoxAnnotation#label', () => {
  it('returns the first real sub-element when present', () => {
    const box = makeBox();
    (box as unknown as { elements: unknown[] }).elements = ['label-el'];
    expect(box.label).toBe('label-el');
  });

  it('returns undefined when there are no sub-elements', () => {
    const box = makeBox();
    expect(box.label).toBeUndefined();
  });
});

describe('BoxAnnotation#resolveElementProperties', () => {
  it('delegates to the real resolveBoxAndLabelProperties helper', () => {
    const box = makeBox();
    const chart = {
      scales: { x: { id: 'x', axis: 'x', left: 0, right: 100, options: {}, getPixelForValue: (v: number) => v } },
      chartArea: { left: 0, top: 0, right: 100, bottom: 100 },
      ctx: { measureText: (t: string) => ({ width: t.length * 6 }), font: '', save: vi.fn(), restore: vi.fn() },
    };
    const result = box.resolveElementProperties(chart as never, { xMin: 0, xMax: 40, borderWidth: 0, label: { content: 'hi', callout: {} } } as never) as Record<string, unknown>;
    expect(result).toHaveProperty('elements');
  });
});
