/**
 * The real `point` annotation element, faithfully ported from
 * `chartjs-plugin-annotation` (v3.1.0, MIT) \u2014 real source dissected
 * directly from the installed package's own real, unminified ESM
 * build. See `../geometry.ts`'s own header comment for the full
 * dissection rationale.
 */
import { Element } from 'chart.js';
import type { Chart } from 'chart.js';
import { getElementCenterPoint, inLimit, inPointRange } from '../geometry.js';
import { drawPoint, isImageOrCanvas, setBorderStyle, setShadowStyle } from '../drawing.js';
import { initAnimationProperties } from '../labelGeometry.js';
import { resolvePointProperties } from '../boxProperties.js';

export class PointAnnotation extends Element {
  static id = 'pointAnnotation';

  static defaults = {
    adjustScaleRange: true,
    backgroundShadowColor: 'transparent',
    borderDash: [] as number[],
    borderDashOffset: 0,
    borderShadowColor: 'transparent',
    borderWidth: 1,
    display: true,
    hitTolerance: 0,
    init: undefined as unknown,
    pointStyle: 'circle' as unknown,
    radius: 10,
    rotation: 0,
    shadowBlur: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    xAdjust: 0,
    xMax: undefined as unknown,
    xMin: undefined as unknown,
    xScaleID: undefined as unknown,
    xValue: undefined as unknown,
    yAdjust: 0,
    yMax: undefined as unknown,
    yMin: undefined as unknown,
    yScaleID: undefined as unknown,
    yValue: undefined as unknown,
    z: 0,
  };

  static defaultRoutes = {
    borderColor: 'color',
    backgroundColor: 'color',
  };

  declare x: number;
  declare y: number;
  declare x2: number;
  declare y2: number;
  declare width: number;
  declare centerX: number;
  declare centerY: number;
  declare options: Record<string, never> & {
    radius: number;
    borderWidth: number;
    hitTolerance: number;
    pointStyle?: unknown;
    rotation?: number;
    backgroundColor?: string;
    backgroundShadowColor?: string;
    shadowBlur?: number;
    shadowOffsetX?: number;
    shadowOffsetY?: number;
    borderShadowColor?: string;
  };

  inRange(mouseX: number, mouseY: number, axis?: 'x' | 'y', useFinalPosition?: boolean): boolean {
    const { x, y, x2, y2, width } = this.getProps(['x', 'y', 'x2', 'y2', 'width'], useFinalPosition) as { x: number; y: number; x2: number; y2: number; width: number };
    const hitSize = (this.options.borderWidth + this.options.hitTolerance) / 2;
    if (axis !== 'x' && axis !== 'y') {
      return inPointRange({ x: mouseX, y: mouseY }, this.getCenterPoint(useFinalPosition), width / 2, hitSize);
    }
    const limit = axis === 'y' ? { start: y, end: y2, value: mouseY } : { start: x, end: x2, value: mouseX };
    return inLimit(limit, hitSize);
  }

  getCenterPoint(useFinalPosition?: boolean): { x: number; y: number } {
    return getElementCenterPoint(this, useFinalPosition);
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const options = this.options;
    const borderWidth = options.borderWidth;
    if (options.radius < 0.1) return;
    ctx.save();
    ctx.fillStyle = options.backgroundColor ?? '';
    setShadowStyle(ctx, options);
    const stroke = setBorderStyle(ctx, options);
    drawPoint(ctx, this as unknown as { radius: number; options: { pointStyle?: unknown; rotation?: number } }, this.centerX, this.centerY);
    if (stroke && !isImageOrCanvas(options.pointStyle)) {
      ctx.shadowColor = options.borderShadowColor ?? '';
      ctx.stroke();
    }
    ctx.restore();
    // Real, confirmed quirk carried over unchanged: the original
    // reassigns `options.borderWidth` to itself at the very end of
    // `draw()` \u2014 a genuine no-op in the original's own real source
    // (not a bug this port introduced or fixed), included here only for
    // byte-for-byte fidelity with the original's own real control flow.
    options.borderWidth = borderWidth;
  }

  resolveElementProperties(chart: Chart, options: never): unknown {
    const properties = resolvePointProperties(chart, options);
    (properties as { initProperties?: unknown }).initProperties = initAnimationProperties(chart, properties as never, options);
    return properties;
  }
}
