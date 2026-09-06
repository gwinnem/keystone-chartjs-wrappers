/**
 * The real `ellipse` annotation element, faithfully ported from
 * `chartjs-plugin-annotation` (v3.1.0, MIT) \u2014 real source dissected
 * directly from the installed package's own real, unminified ESM
 * build. See `../geometry.ts`'s own header comment for the full
 * dissection rationale.
 */
import { Element } from 'chart.js';
import type { Chart } from 'chart.js';
import { EPSILON, getElementCenterPoint, rotated, toRadians } from '../geometry.js';
import { setBorderStyle, setShadowStyle } from '../drawing.js';
import { resolveBoxAndLabelProperties } from '../boxProperties.js';
import { BoxAnnotation } from './boxAnnotation.js';

function pointInEllipse(p: { x: number; y: number }, ellipse: { width: number; height: number; centerX: number; centerY: number }, rotation: number, hitSize: number): boolean {
  const { width, height, centerX, centerY } = ellipse;
  const xRadius = width / 2;
  const yRadius = height / 2;
  if (xRadius <= 0 || yRadius <= 0) return false;
  // https://stackoverflow.com/questions/7946187/point-and-ellipse-rotated-position-test-algorithm
  const angle = toRadians(rotation || 0);
  const cosAngle = Math.cos(angle);
  const sinAngle = Math.sin(angle);
  const a = Math.pow(cosAngle * (p.x - centerX) + sinAngle * (p.y - centerY), 2);
  const b = Math.pow(sinAngle * (p.x - centerX) - cosAngle * (p.y - centerY), 2);
  return a / Math.pow(xRadius + hitSize, 2) + b / Math.pow(yRadius + hitSize, 2) <= 1.0001;
}

export class EllipseAnnotation extends Element {
  static id = 'ellipseAnnotation';

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
    label: { ...BoxAnnotation.defaults.label },
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

  declare width: number;
  declare height: number;
  declare centerX: number;
  declare centerY: number;
  declare options: Record<string, never> & {
    rotation: number;
    borderWidth: number;
    hitTolerance: number;
    backgroundColor?: string;
    borderColor?: string;
    borderShadowColor?: string;
    backgroundShadowColor?: string;
    shadowBlur?: number;
    shadowOffsetX?: number;
    shadowOffsetY?: number;
  };
  declare elements?: unknown[];

  inRange(mouseX: number, mouseY: number, axis?: 'x' | 'y', useFinalPosition?: boolean): boolean {
    const rotation = this.options.rotation;
    const hitSize = (this.options.borderWidth + this.options.hitTolerance) / 2;
    if (axis !== 'x' && axis !== 'y') {
      return pointInEllipse({ x: mouseX, y: mouseY }, this.getProps(['width', 'height', 'centerX', 'centerY'], useFinalPosition) as never, rotation, hitSize);
    }
    const { x, y, x2, y2 } = this.getProps(['x', 'y', 'x2', 'y2'], useFinalPosition) as { x: number; y: number; x2: number; y2: number };
    const limit = axis === 'y' ? { start: y, end: y2 } : { start: x, end: x2 };
    const rotatedPoint = rotated({ x: mouseX, y: mouseY }, this.getCenterPoint(useFinalPosition), toRadians(-rotation));
    return rotatedPoint[axis] >= limit.start - hitSize - EPSILON && rotatedPoint[axis] <= limit.end + hitSize + EPSILON;
  }

  getCenterPoint(useFinalPosition?: boolean): { x: number; y: number } {
    return getElementCenterPoint(this, useFinalPosition);
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const { width, height, centerX, centerY, options } = this;
    ctx.save();
    // translate() below intentionally not imported separately — same
    // real per-annotation-center rotation `BoxAnnotation`'s own draw()
    // uses, applied inline here since the original itself repeats this
    // exact three-line pattern rather than sharing a helper across
    // element `draw()` methods.
    if (options.rotation) {
      const center = this.getCenterPoint();
      ctx.translate(center.x, center.y);
      ctx.rotate(toRadians(options.rotation));
      ctx.translate(-center.x, -center.y);
    }
    setShadowStyle(ctx, options);
    ctx.beginPath();
    ctx.fillStyle = options.backgroundColor ?? '';
    const stroke = setBorderStyle(ctx, options);
    ctx.ellipse(centerX, centerY, height / 2, width / 2, Math.PI / 2, 0, 2 * Math.PI);
    ctx.fill();
    if (stroke) {
      ctx.shadowColor = options.borderShadowColor ?? '';
      ctx.stroke();
    }
    ctx.restore();
  }

  get label(): unknown {
    return this.elements && this.elements[0];
  }

  resolveElementProperties(chart: Chart, options: never): unknown {
    return resolveBoxAndLabelProperties(chart, options);
  }
}
