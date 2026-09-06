/**
 * The real `box` annotation element, faithfully ported from
 * `chartjs-plugin-annotation` (v3.1.0, MIT) \u2014 real source dissected
 * directly from the installed package's own real, unminified ESM
 * build. See `../geometry.ts`'s own header comment for the full
 * dissection rationale.
 *
 * A genuine Chart.js `Element` subclass (not just a plugin-drawn
 * shape) \u2014 registered via `Chart.register(annotationTypes)` in the
 * main plugin's own `afterRegister()` hook, the same way Chart.js's
 * own built-in elements (`ArcElement`, `BarElement`, \u2026) are.
 */
import { Element } from 'chart.js';
import type { Chart } from 'chart.js';
import { getElementCenterPoint, inBoxRange, rotated, toRadians } from '../geometry.js';
import { drawBox, translate } from '../drawing.js';
import { resolveBoxAndLabelProperties } from '../boxProperties.js';

export class BoxAnnotation extends Element {
  static id = 'boxAnnotation';

  static defaults = {
    adjustScaleRange: true,
    backgroundShadowColor: 'transparent',
    borderCapStyle: 'butt' as CanvasLineCap,
    borderDash: [] as number[],
    borderDashOffset: 0,
    borderJoinStyle: 'miter' as CanvasLineJoin,
    borderRadius: 0,
    borderShadowColor: 'transparent',
    borderWidth: 1,
    display: true,
    init: undefined as unknown,
    hitTolerance: 0,
    label: {
      backgroundColor: 'transparent',
      borderWidth: 0,
      callout: { display: false },
      color: 'black',
      content: null as unknown,
      display: false,
      drawTime: undefined as unknown,
      font: { family: undefined, lineHeight: undefined, size: undefined, style: undefined, weight: 'bold' },
      height: undefined as unknown,
      hitTolerance: undefined as unknown,
      opacity: undefined as unknown,
      padding: 6,
      position: 'center',
      rotation: undefined as unknown,
      textAlign: 'start',
      textStrokeColor: undefined as unknown,
      textStrokeWidth: 0,
      width: undefined as unknown,
      xAdjust: 0,
      yAdjust: 0,
      z: undefined as unknown,
    },
    rotation: 0,
    shadowBlur: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    xMax: undefined as unknown,
    xMin: undefined as unknown,
    xScaleID: undefined as unknown,
    yMax: undefined as unknown,
    yMin: undefined as unknown,
    yScaleID: undefined as unknown,
    z: 0,
  };

  static defaultRoutes = {
    borderColor: 'color',
    backgroundColor: 'color',
  };

  static descriptors = {
    label: { _fallback: true },
  };

  declare options: Record<string, never> & {
    rotation: number;
    borderWidth: number;
    borderCapStyle?: CanvasLineCap;
    borderDash?: number[];
    borderDashOffset?: number;
    borderJoinStyle?: CanvasLineJoin;
    borderColor?: string;
    borderRadius?: number;
    backgroundColor?: string;
    backgroundShadowColor?: string;
    borderShadowColor?: string;
    shadowBlur?: number;
    shadowOffsetX?: number;
    shadowOffsetY?: number;
    hitTolerance: number;
  };
  declare elements?: unknown[];

  inRange(mouseX: number, mouseY: number, axis?: 'x' | 'y', useFinalPosition?: boolean): boolean {
    const { x, y } = rotated({ x: mouseX, y: mouseY }, this.getCenterPoint(useFinalPosition), toRadians(-this.options.rotation));
    return inBoxRange({ x, y }, this.getProps(['x', 'y', 'x2', 'y2'], useFinalPosition) as never, axis, this.options);
  }

  getCenterPoint(useFinalPosition?: boolean): { x: number; y: number } {
    return getElementCenterPoint(this, useFinalPosition);
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.save();
    translate(ctx, this.getCenterPoint(), this.options.rotation);
    drawBox(ctx, this as unknown as { x: number; y: number; width: number; height: number }, this.options);
    ctx.restore();
  }

  get label(): unknown {
    return this.elements && this.elements[0];
  }

  resolveElementProperties(chart: Chart, options: never): unknown {
    return resolveBoxAndLabelProperties(chart, options);
  }
}
