import { describe, expect, it, vi } from 'vitest';
import {
  drawBox,
  drawLabel,
  drawPoint,
  isImageOrCanvas,
  measureLabelSize,
  setBorderStyle,
  setShadowStyle,
  translate,
} from '../../../../src/plugins/annotation/drawing.js';

// Testing the real canvas drawing primitives directly (dissected from
// the real, installed package's own real, unminified ESM build — see
// geometry.ts's own header comment for the full dissection rationale).

function makeCtx() {
  const gradient = { addColorStop: vi.fn() };
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
    drawImage: vi.fn(),
    setLineDash: vi.fn(),
    measureText: (text: string) => ({ width: text.length * 6 }),
    createLinearGradient: vi.fn(() => gradient),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    lineCap: 'butt',
    lineJoin: 'miter',
    lineDashOffset: 0,
    shadowColor: '',
    shadowBlur: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    globalAlpha: 1,
    font: '',
    textAlign: 'start',
    textBaseline: 'alphabetic',
    miterLimit: 10,
  };
}

describe('isImageOrCanvas', () => {
  it('identifies a real HTMLImageElement-like tag', () => {
    expect(isImageOrCanvas({ toString: () => '[object HTMLImageElement]' })).toBe(true);
  });

  it('identifies a real HTMLCanvasElement-like tag', () => {
    expect(isImageOrCanvas({ toString: () => '[object HTMLCanvasElement]' })).toBe(true);
  });

  it('is false for a plain object, string, or null', () => {
    expect(isImageOrCanvas({})).toBe(false);
    expect(isImageOrCanvas('circle')).toBe(false);
    expect(isImageOrCanvas(null)).toBe(false);
  });
});

describe('translate', () => {
  it('applies a real translate/rotate/translate sequence when rotation is set', () => {
    const ctx = makeCtx();
    translate(ctx as never, { x: 10, y: 20 }, 45);
    expect(ctx.translate).toHaveBeenCalledTimes(2);
    expect(ctx.rotate).toHaveBeenCalledTimes(1);
  });

  it('does nothing at all when rotation is 0/falsy', () => {
    const ctx = makeCtx();
    translate(ctx as never, { x: 10, y: 20 }, 0);
    expect(ctx.translate).not.toHaveBeenCalled();
    expect(ctx.rotate).not.toHaveBeenCalled();
  });
});

describe('setBorderStyle', () => {
  it('applies real stroke styling and returns true when borderWidth is set', () => {
    const ctx = makeCtx();
    const result = setBorderStyle(ctx as never, { borderWidth: 2, borderColor: 'red' });
    expect(result).toBe(true);
    expect(ctx.lineWidth).toBe(2);
    expect(ctx.strokeStyle).toBe('red');
  });

  it('does nothing and returns undefined when borderWidth is 0', () => {
    const ctx = makeCtx();
    const result = setBorderStyle(ctx as never, { borderWidth: 0 });
    expect(result).toBeUndefined();
  });

  it('does nothing when options itself is undefined', () => {
    const ctx = makeCtx();
    expect(setBorderStyle(ctx as never, undefined)).toBeUndefined();
  });
});

describe('setShadowStyle', () => {
  it('applies real shadow properties from options, defaulting missing ones', () => {
    const ctx = makeCtx();
    setShadowStyle(ctx as never, { shadowBlur: 5 });
    expect(ctx.shadowBlur).toBe(5);
    expect(ctx.shadowOffsetX).toBe(0);
  });
});

describe('measureLabelSize', () => {
  it('measures real text content via the widest line', () => {
    const ctx = makeCtx();
    const result = measureLabelSize(ctx as never, { content: ['short', 'a longer line'], font: { size: 12 } });
    expect(result.width).toBeGreaterThan(0);
    expect(result.height).toBeGreaterThan(0);
  });

  it('measures real/configured image dimensions for image content', () => {
    const ctx = makeCtx();
    const img = { toString: () => '[object HTMLImageElement]', width: 100, height: 50 };
    const result = measureLabelSize(ctx as never, { content: img, width: 40, font: {} });
    expect(result.width).toBe(40); // configured overrides intrinsic
    expect(result.height).toBe(50); // falls back to intrinsic
  });

  it('memoizes identical text/font/stroke combinations', () => {
    const ctx = makeCtx();
    const opts = { content: 'hello', font: { size: 12 }, textStrokeWidth: 0 };
    const first = measureLabelSize(ctx as never, opts);
    const second = measureLabelSize(ctx as never, opts);
    expect(first).toBe(second);
  });
});

describe('drawBox', () => {
  it('draws a real rounded rect and fills when a background color is set', () => {
    const ctx = makeCtx();
    drawBox(ctx as never, { x: 0, y: 0, width: 40, height: 20 }, { backgroundColor: 'blue', borderRadius: 4 });
    expect(ctx.fill).toHaveBeenCalled();
    expect(ctx.fillStyle).toBe('blue');
  });

  it('strokes when a real border is configured', () => {
    const ctx = makeCtx();
    drawBox(ctx as never, { x: 0, y: 0, width: 40, height: 20 }, { backgroundColor: 'blue', borderWidth: 2, borderColor: 'black' });
    expect(ctx.stroke).toHaveBeenCalled();
  });
});

describe('drawLabel', () => {
  it('draws real image content via drawImage', () => {
    const ctx = makeCtx();
    const img = { toString: () => '[object HTMLImageElement]', style: { opacity: '1' } };
    drawLabel(ctx as never, { x: 0, y: 0, width: 40, height: 20 }, { content: img, textAlign: 'center', font: {} });
    expect(ctx.drawImage).toHaveBeenCalled();
  });

  it('draws real text content via fillText when a color is set', () => {
    const ctx = makeCtx();
    drawLabel(ctx as never, { x: 0, y: 0, width: 40, height: 20 }, { content: 'hello', color: 'black', textAlign: 'center', font: { size: 12 } });
    expect(ctx.fillText).toHaveBeenCalled();
  });

  it('strokes real text when textStrokeWidth is set', () => {
    const ctx = makeCtx();
    drawLabel(ctx as never, { x: 0, y: 0, width: 40, height: 20 }, { content: 'hello', textStrokeWidth: 2, textStrokeColor: 'red', textAlign: 'center', font: { size: 12 } });
    expect(ctx.strokeText).toHaveBeenCalled();
  });

  it('draws each real line of multi-line content separately', () => {
    const ctx = makeCtx();
    drawLabel(ctx as never, { x: 0, y: 0, width: 40, height: 20 }, { content: ['line 1', 'line 2'], color: 'black', textAlign: 'center', font: { size: 12 } });
    expect(ctx.fillText).toHaveBeenCalledTimes(2);
  });
});

describe('drawPoint', () => {
  it('draws real image pointStyle content via drawImage', () => {
    const ctx = makeCtx();
    const img = { toString: () => '[object HTMLImageElement]', width: 20, height: 20 };
    drawPoint(ctx as never, { radius: 10, options: { pointStyle: img } }, 5, 5);
    expect(ctx.drawImage).toHaveBeenCalled();
  });

  it('does nothing for a non-positive radius', () => {
    const ctx = makeCtx();
    drawPoint(ctx as never, { radius: 0, options: {} }, 5, 5);
    expect(ctx.fill).not.toHaveBeenCalled();
  });

  it('draws a real default circle for an unrecognized/absent pointStyle', () => {
    const ctx = makeCtx();
    drawPoint(ctx as never, { radius: 10, options: {} }, 5, 5);
    expect(ctx.arc).toHaveBeenCalled();
    expect(ctx.fill).toHaveBeenCalled();
  });

  it.each(['triangle', 'rect', 'rectRounded', 'rectRot', 'cross', 'crossRot', 'star', 'line', 'dash'])('draws the real "%s" point style without throwing', (style) => {
    const ctx = makeCtx();
    expect(() => drawPoint(ctx as never, { radius: 10, options: { pointStyle: style } }, 5, 5)).not.toThrow();
    expect(ctx.fill).toHaveBeenCalled();
  });

  it('draws an unrotated square for "rect" with no rotation', () => {
    const ctx = makeCtx();
    drawPoint(ctx as never, { radius: 10, options: { pointStyle: 'rect' } }, 5, 5);
    expect(ctx.rect).toHaveBeenCalled();
  });

  it('draws a rotated diamond for "rect" with a real rotation set', () => {
    const ctx = makeCtx();
    drawPoint(ctx as never, { radius: 10, options: { pointStyle: 'rect', rotation: 45 } }, 5, 5);
    expect(ctx.rect).not.toHaveBeenCalled();
    expect(ctx.lineTo).toHaveBeenCalled();
  });
});
