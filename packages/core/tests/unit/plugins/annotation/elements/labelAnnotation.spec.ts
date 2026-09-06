import { describe, expect, it, vi } from 'vitest';
import { LabelAnnotation } from '../../../../../src/plugins/annotation/elements/labelAnnotation.js';

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
    fillText: vi.fn(),
    strokeText: vi.fn(),
    setLineDash: vi.fn(),
    measureText: (t: string) => ({ width: t.length * 6 }),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    lineCap: 'butt',
    lineJoin: 'miter',
    lineDashOffset: 0,
    shadowColor: '',
    font: '',
    textAlign: 'start',
    textBaseline: 'alphabetic',
    miterLimit: 10,
  };
}

function makeLabel(props: Record<string, unknown> = {}, options: Record<string, unknown> = {}) {
  const label = new LabelAnnotation();
  Object.assign(label, { x: 0, y: 0, x2: 40, y2: 20, width: 40, height: 20, rotation: 0, ...props });
  (label as unknown as { options: Record<string, unknown> }).options = { display: true, content: 'hi', rotation: 0, borderWidth: 0, hitTolerance: 0, padding: 4, textAlign: 'start', font: {}, ...options };
  (label as unknown as { getProps: (keys: string[]) => Record<string, number> }).getProps = (keys: string[]) => {
    const self = label as unknown as Record<string, number>;
    const centerX = (self.x + self.x2) / 2;
    const centerY = (self.y + self.y2) / 2;
    const all: Record<string, number> = { x: self.x, y: self.y, x2: self.x2, y2: self.y2, centerX, centerY };
    return Object.fromEntries(keys.map((k) => [k, all[k]]));
  };
  return label;
}

describe('LabelAnnotation — static config', () => {
  it('has the real id and defaults', () => {
    expect(LabelAnnotation.id).toBe('labelAnnotation');
    expect(LabelAnnotation.defaults.display).toBe(true);
    expect(LabelAnnotation.defaults.callout.display).toBe(false);
  });
});

describe('LabelAnnotation#inRange', () => {
  it('detects a point inside the real label box', () => {
    const label = makeLabel({ x: 0, y: 0, x2: 40, y2: 20 });
    expect(label.inRange(20, 10)).toBe(true);
  });

  it('detects a point outside the real label box', () => {
    const label = makeLabel();
    expect(label.inRange(1000, 1000)).toBe(false);
  });
});

describe('LabelAnnotation#getCenterPoint', () => {
  it('returns real centerX/centerY', () => {
    const label = makeLabel();
    Object.assign(label, { centerX: 20, centerY: 10 });
    expect(label.getCenterPoint()).toEqual({ x: 20, y: 10 });
  });
});

describe('LabelAnnotation#draw', () => {
  it('draws the real label content when visible', () => {
    const ctx = makeCtx();
    const label = makeLabel({}, { display: true, content: 'hello', color: 'black' });
    label.draw(ctx as never);
    expect(ctx.fillText).toHaveBeenCalled();
  });

  it('does nothing at all when display is false', () => {
    const ctx = makeCtx();
    const label = makeLabel({}, { display: false });
    label.draw(ctx as never);
    expect(ctx.save).not.toHaveBeenCalled();
  });

  it('does nothing when content is falsy', () => {
    const ctx = makeCtx();
    const label = makeLabel({}, { content: null });
    label.draw(ctx as never);
    expect(ctx.save).not.toHaveBeenCalled();
  });

  it('does nothing when _visible is explicitly false', () => {
    const ctx = makeCtx();
    const label = makeLabel({ _visible: false });
    label.draw(ctx as never);
    expect(ctx.save).not.toHaveBeenCalled();
  });

  it('draws when _visible is explicitly true', () => {
    const ctx = makeCtx();
    const label = makeLabel({ _visible: true });
    label.draw(ctx as never);
    expect(ctx.save).toHaveBeenCalled();
  });
});

describe('LabelAnnotation#resolveElementProperties', () => {
  it('resolves a real point-bound label position', () => {
    const label = makeLabel();
    const chart = {
      scales: {
        x: { id: 'x', axis: 'x', left: 0, right: 100, options: {}, getPixelForValue: (v: number) => v },
        y: { id: 'y', axis: 'y', top: 0, bottom: 100, options: {}, getPixelForValue: (v: number) => v },
      },
      chartArea: { left: 0, top: 0, right: 100, bottom: 100 },
      ctx: makeCtx(),
    };
    const result = label.resolveElementProperties(chart as never, { xValue: 50, yValue: 50, content: 'hi', font: {}, padding: 4, borderWidth: 0, position: 'center', xAdjust: 0, yAdjust: 0 } as never) as Record<string, unknown>;
    expect(result.pointX).toBe(50);
    expect(result.pointY).toBe(50);
  });

  it('resolves a real box-centered label position when not point-bound', () => {
    const label = makeLabel();
    const chart = {
      scales: {
        x: { id: 'x', axis: 'x', left: 0, right: 100, options: {}, getPixelForValue: (v: number) => v },
        y: { id: 'y', axis: 'y', top: 0, bottom: 100, options: {}, getPixelForValue: (v: number) => v },
      },
      chartArea: { left: 0, top: 0, right: 100, bottom: 100 },
      ctx: makeCtx(),
    };
    const result = label.resolveElementProperties(chart as never, { xMin: 0, xMax: 40, yMin: 0, yMax: 20, content: 'hi', font: {}, padding: 4, borderWidth: 0, position: 'center', xAdjust: 0, yAdjust: 0 } as never) as Record<string, unknown>;
    expect(result).toHaveProperty('pointX');
  });
});
