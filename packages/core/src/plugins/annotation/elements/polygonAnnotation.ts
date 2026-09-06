/**
 * The real `polygon` annotation element, faithfully ported from
 * `chartjs-plugin-annotation` (v3.1.0, MIT) \u2014 real source dissected
 * directly from the installed package's own real, unminified ESM
 * build. See `../geometry.ts`'s own header comment for the full
 * dissection rationale.
 */
import { Element } from 'chart.js';
import type { Chart } from 'chart.js';
import { getElementCenterPoint, rotated, toRadians } from '../geometry.js';
import { setBorderStyle, setShadowStyle } from '../drawing.js';
import { initAnimationProperties } from '../labelGeometry.js';
import { resolvePointProperties } from '../boxProperties.js';

const RAD_PER_DEG = Math.PI / 180;

interface PolygonPointElement {
  x: number;
  y: number;
  bX: number;
  bY: number;
  getProps(props: string[], useFinalPosition?: boolean): Record<string, number>;
}

function buildPointElement({ centerX, centerY }: { centerX: number; centerY: number }, { radius, borderWidth, hitTolerance }: { radius: number; borderWidth: number; hitTolerance: number }, rad: number) {
  const hitSize = (borderWidth + hitTolerance) / 2;
  const sin = Math.sin(rad);
  const cos = Math.cos(rad);
  const point = { x: centerX + sin * radius, y: centerY - cos * radius };
  return {
    type: 'point',
    optionScope: 'point',
    properties: {
      x: point.x,
      y: point.y,
      centerX: point.x,
      centerY: point.y,
      bX: centerX + sin * (radius + hitSize),
      bY: centerY - cos * (radius + hitSize),
    },
  };
}

function pointIsInPolygon(points: PolygonPointElement[], x: number, y: number, useFinalPosition?: boolean): boolean {
  let isInside = false;
  let A = points[points.length - 1].getProps(['bX', 'bY'], useFinalPosition);
  for (const point of points) {
    const B = point.getProps(['bX', 'bY'], useFinalPosition);
    if (B.bY > y !== A.bY > y && x < ((A.bX - B.bX) * (y - B.bY)) / (A.bY - B.bY) + B.bX) {
      isInside = !isInside;
    }
    A = B;
  }
  return isInside;
}

export class PolygonAnnotation extends Element {
  static id = 'polygonAnnotation';

  static defaults = {
    adjustScaleRange: true,
    backgroundShadowColor: 'transparent',
    borderCapStyle: 'butt' as CanvasLineCap,
    borderDash: [] as number[],
    borderDashOffset: 0,
    borderJoinStyle: 'miter' as CanvasLineJoin,
    borderShadowColor: 'transparent',
    borderWidth: 1,
    display: true,
    hitTolerance: 0,
    init: undefined as unknown,
    point: { radius: 0 },
    radius: 10,
    rotation: 0,
    shadowBlur: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    sides: 3,
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

  declare elements: PolygonPointElement[];
  declare options: Record<string, never> & {
    radius: number;
    rotation: number;
    borderWidth: number;
    hitTolerance: number;
    backgroundColor?: string;
    backgroundShadowColor?: string;
    borderShadowColor?: string;
    shadowBlur?: number;
    shadowOffsetX?: number;
    shadowOffsetY?: number;
    sides: number;
  };

  inRange(mouseX: number, mouseY: number, axis?: 'x' | 'y', useFinalPosition?: boolean): boolean {
    if (axis !== 'x' && axis !== 'y') {
      return this.options.radius >= 0.1 && this.elements.length > 1 && pointIsInPolygon(this.elements, mouseX, mouseY, useFinalPosition);
    }
    const rotatedPoint = rotated({ x: mouseX, y: mouseY }, this.getCenterPoint(useFinalPosition), toRadians(-this.options.rotation));
    const axisPoints = this.elements.map((point) => (axis === 'y' ? point.bY : point.bX));
    const start = Math.min(...axisPoints);
    const end = Math.max(...axisPoints);
    return rotatedPoint[axis] >= start && rotatedPoint[axis] <= end;
  }

  getCenterPoint(useFinalPosition?: boolean): { x: number; y: number } {
    return getElementCenterPoint(this, useFinalPosition);
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const { elements, options } = this;
    ctx.save();
    ctx.beginPath();
    ctx.fillStyle = options.backgroundColor ?? '';
    setShadowStyle(ctx, options);
    const stroke = setBorderStyle(ctx, options);
    let first = true;
    for (const el of elements) {
      if (first) {
        ctx.moveTo(el.x, el.y);
        first = false;
      } else {
        ctx.lineTo(el.x, el.y);
      }
    }
    ctx.closePath();
    ctx.fill();
    if (stroke) {
      ctx.shadowColor = options.borderShadowColor ?? '';
      ctx.stroke();
    }
    ctx.restore();
  }

  resolveElementProperties(chart: Chart, options: never): unknown {
    const properties = resolvePointProperties(chart, options) as { centerX: number; centerY: number; elements?: unknown[] };
    const opts = options as unknown as { sides: number; rotation: number };
    const { sides, rotation } = opts;
    const elements: unknown[] = [];
    const angle = (2 * Math.PI) / sides;
    let rad = rotation * RAD_PER_DEG;
    for (let i = 0; i < sides; i++, rad += angle) {
      const elProps = buildPointElement(properties, options as never, rad) as unknown as { initProperties?: unknown };
      elProps.initProperties = initAnimationProperties(chart, properties as never, options);
      elements.push(elProps);
    }
    properties.elements = elements;
    return properties;
  }
}
