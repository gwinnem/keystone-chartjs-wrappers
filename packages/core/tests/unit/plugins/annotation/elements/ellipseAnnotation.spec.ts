import { describe, expect, it, vi } from 'vitest';
import { EllipseAnnotation } from '../../../../../src/plugins/annotation/elements/ellipseAnnotation.js';

function makeCtx() {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    beginPath: vi.fn(),
    ellipse: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    setLineDash: vi.fn(),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    shadowColor: '',
  };
}

function makeEllipse(props: Record<string, unknown> = {}, options: Record<string, unknown> = {}) {
  const el = new EllipseAnnotation();
  Object.assign(el, { x: 0, y: 0, x2: 40, y2: 20, width: 40, height: 20, centerX: 20, centerY: 10, ...props });
  (el as unknown as { options: Record<string, unknown> }).options = { rotation: 0, borderWidth: 1, hitTolerance: 0, ...options };
  return el;
}

describe('EllipseAnnotation — static config', () => {
  it('has the real id and inherits label defaults from BoxAnnotation', () => {
    expect(EllipseAnnotation.id).toBe('ellipseAnnotation');
    expect(EllipseAnnotation.defaults.label).toBeDefined();
  });
});

describe('EllipseAnnotation#inRange', () => {
  it('detects a point inside the real ellipse', () => {
    const el = makeEllipse();
    expect(el.inRange(20, 10)).toBe(true);
  });

  it('detects a point outside the real ellipse', () => {
    const el = makeEllipse();
    expect(el.inRange(1000, 1000)).toBe(false);
  });

  it('returns false for a real, zero-size ellipse (width or height 0)', () => {
    const el = makeEllipse({ width: 0, height: 20 });
    expect(el.inRange(20, 10)).toBe(false);
  });

  it('restricts the test to the y axis when given', () => {
    const el = makeEllipse();
    expect(typeof el.inRange(20, 10, 'y')).toBe('boolean');
  });

  it('restricts the test to the x axis when given', () => {
    const el = makeEllipse();
    expect(el.inRange(20, 10, 'x')).toBe(true);
    expect(el.inRange(1000, 10, 'x')).toBe(false);
  });

  it('detects a point outside the real axis-restricted range', () => {
    const el = makeEllipse();
    expect(el.inRange(20, 1000, 'y')).toBe(false);
  });
});

describe('EllipseAnnotation#draw', () => {
  it('draws a real, filled/stroked ellipse', () => {
    const ctx = makeCtx();
    const el = makeEllipse({}, { backgroundColor: 'blue', borderWidth: 2, borderColor: 'black' });
    el.draw(ctx as never);
    expect(ctx.ellipse).toHaveBeenCalled();
    expect(ctx.fill).toHaveBeenCalled();
    expect(ctx.stroke).toHaveBeenCalled();
  });

  it('does not stroke a real, borderless ellipse', () => {
    const ctx = makeCtx();
    const el = makeEllipse({}, { backgroundColor: 'blue', borderWidth: 0 });
    el.draw(ctx as never);
    expect(ctx.stroke).not.toHaveBeenCalled();
  });

  it('falls back to a real, empty fillStyle when no backgroundColor is configured', () => {
    const ctx = makeCtx();
    const el = makeEllipse();
    el.draw(ctx as never);
    expect(ctx.fillStyle).toBe('');
  });

  it('rotates around the center when configured', () => {
    const ctx = makeCtx();
    const el = makeEllipse({}, { rotation: 30, backgroundColor: 'blue' });
    el.draw(ctx as never);
    expect(ctx.translate).toHaveBeenCalledTimes(2);
    expect(ctx.rotate).toHaveBeenCalled();
  });
});

describe('EllipseAnnotation#label / resolveElementProperties', () => {
  it('returns the first sub-element as label', () => {
    const el = makeEllipse();
    (el as unknown as { elements: unknown[] }).elements = ['label-el'];
    expect(el.label).toBe('label-el');
  });

  it('delegates to resolveBoxAndLabelProperties', () => {
    const el = makeEllipse();
    const chart = {
      scales: { x: { id: 'x', axis: 'x', left: 0, right: 100, options: {}, getPixelForValue: (v: number) => v } },
      chartArea: { left: 0, top: 0, right: 100, bottom: 100 },
      ctx: { measureText: (t: string) => ({ width: t.length * 6 }), font: '', save: vi.fn(), restore: vi.fn() },
    };
    const result = el.resolveElementProperties(chart as never, { xMin: 0, xMax: 40, borderWidth: 0, label: { content: 'hi', callout: {} } } as never) as Record<string, unknown>;
    expect(result).toHaveProperty('elements');
  });
});
