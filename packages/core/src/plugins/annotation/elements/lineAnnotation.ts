/**
 * The real `line` annotation element, faithfully ported from
 * `chartjs-plugin-annotation` (v3.1.0, MIT) \u2014 real source dissected
 * directly from the installed package's own real, unminified ESM
 * build. See `../geometry.ts`'s own header comment for the full
 * dissection rationale.
 *
 * The most complex of the seven element types: a real straight-or-
 * curved line, optional arrow heads on either end, and an optional
 * label positioned anywhere along the line's own real length
 * (including along a real quadratic Bezier curve, not just a straight
 * segment) \u2014 confirmed real, genuinely non-trivial geometry, not a
 * simplified approximation.
 */
import { Element } from 'chart.js';
import type { Chart } from 'chart.js';
import { distanceBetweenPoints, toDegrees, toPadding } from 'chart.js/helpers';
import { EPSILON, getElementCenterPoint, getRelativePosition, getSize, inLimit, rotated, toRadians } from '../geometry.js';
import { measureLabelSize, setBorderStyle, setShadowStyle } from '../drawing.js';
import { resolveLineProperties } from '../boxProperties.js';
import { initAnimationProperties } from '../labelGeometry.js';
import { LabelAnnotation } from './labelAnnotation.js';

// ---- pure geometry helpers ----

const pointInLine = (p1: { x: number; y: number }, p2: { x: number; y: number }, t: number) => ({ x: p1.x + t * (p2.x - p1.x), y: p1.y + t * (p2.y - p1.y) });
const interpolateX = (y: number, p1: { x: number; y: number }, p2: { x: number; y: number }) => pointInLine(p1, p2, Math.abs((y - p1.y) / (p2.y - p1.y))).x;
const interpolateY = (x: number, p1: { x: number; y: number }, p2: { x: number; y: number }) => pointInLine(p1, p2, Math.abs((x - p1.x) / (p2.x - p1.x))).y;
const sqr = (v: number) => v * v;
const rangeLimit = (mouseX: number, mouseY: number, { x, y, x2, y2 }: { x: number; y: number; x2: number; y2: number }, axis: 'x' | 'y') =>
  axis === 'y' ? { start: Math.min(y, y2), end: Math.max(y, y2), value: mouseY } : { start: Math.min(x, x2), end: Math.max(x, x2), value: mouseX };
// http://www.independent-software.com/determining-coordinates-on-a-html-canvas-bezier-curve.html
const coordInCurve = (start: number, cp: number, end: number, t: number) => (1 - t) * (1 - t) * start + 2 * (1 - t) * t * cp + t * t * end;
const pointInCurve = (start: { x: number; y: number }, cp: { x: number; y: number }, end: { x: number; y: number }, t: number) => ({ x: coordInCurve(start.x, cp.x, end.x, t), y: coordInCurve(start.y, cp.y, end.y, t) });
const coordAngleInCurve = (start: number, cp: number, end: number, t: number) => 2 * (1 - t) * (cp - start) + 2 * t * (end - cp);
const angleInCurve = (start: { x: number; y: number }, cp: { x: number; y: number }, end: { x: number; y: number }, t: number) =>
  -Math.atan2(coordAngleInCurve(start.x, cp.x, end.x, t), coordAngleInCurve(start.y, cp.y, end.y, t)) + 0.5 * Math.PI;

function isLineInArea({ x, y, x2, y2 }: { x: number; y: number; x2: number; y2: number }, { top, right, bottom, left }: { top: number; right: number; bottom: number; left: number }): boolean {
  return !((x < left && x2 < left) || (x > right && x2 > right) || (y < top && y2 < top) || (y > bottom && y2 > bottom));
}

function limitPointToArea({ x, y }: { x: number; y: number }, p2: { x: number; y: number }, { top, right, bottom, left }: { top: number; right: number; bottom: number; left: number }) {
  if (x < left) {
    y = interpolateY(left, { x, y }, p2);
    x = left;
  }
  if (x > right) {
    y = interpolateY(right, { x, y }, p2);
    x = right;
  }
  if (y < top) {
    x = interpolateX(top, { x, y }, p2);
    y = top;
  }
  if (y > bottom) {
    x = interpolateX(bottom, { x, y }, p2);
    y = bottom;
  }
  return { x, y };
}

function limitLineToArea(p1: { x: number; y: number }, p2: { x: number; y: number }, area: { top: number; right: number; bottom: number; left: number }) {
  const { x, y } = limitPointToArea(p1, p2, area);
  const { x: x2, y: y2 } = limitPointToArea(p2, p1, area);
  return { x, y, x2, y2, width: Math.abs(x2 - x), height: Math.abs(y2 - y) };
}

function intersects(element: { getProps(props: string[], useFinalPosition?: boolean): Record<string, number> }, { mouseX, mouseY }: { mouseX: number; mouseY: number }, epsilon = EPSILON, useFinalPosition?: boolean): boolean {
  // Adapted from https://stackoverflow.com/a/6853926/25507
  const { x: x1, y: y1, x2, y2 } = element.getProps(['x', 'y', 'x2', 'y2'], useFinalPosition);
  const dx = x2 - x1;
  const dy = y2 - y1;
  const lenSq = sqr(dx) + sqr(dy);
  const t = lenSq === 0 ? -1 : ((mouseX - x1) * dx + (mouseY - y1) * dy) / lenSq;

  let xx: number, yy: number;
  if (t < 0) {
    xx = x1;
    yy = y1;
  } else if (t > 1) {
    xx = x2;
    yy = y2;
  } else {
    xx = x1 + t * dx;
    yy = y1 + t * dy;
  }
  return sqr(mouseX - xx) + sqr(mouseY - yy) <= epsilon;
}

function isOnLabel(element: { label: { options: { display?: boolean }; inRange(x: number, y: number, axis?: 'x' | 'y', useFinalPosition?: boolean): boolean } }, { mouseX, mouseY }: { mouseX: number; mouseY: number }, useFinalPosition?: boolean, axis?: 'x' | 'y'): boolean {
  const label = element.label;
  return !!label.options.display && label.inRange(mouseX, mouseY, axis, useFinalPosition);
}

function inAxisRange(element: { getProps(props: string[], useFinalPosition?: boolean): Record<string, number>; label: never }, { mouseX, mouseY }: { mouseX: number; mouseY: number }, axis: 'x' | 'y', { hitSize, useFinalPosition }: { hitSize: number; useFinalPosition?: boolean }): boolean {
  const limit = rangeLimit(mouseX, mouseY, element.getProps(['x', 'y', 'x2', 'y2'], useFinalPosition) as never, axis);
  return inLimit(limit, hitSize) || isOnLabel(element as never, { mouseX, mouseY }, useFinalPosition, axis);
}

// ---- arrow heads ----

interface ArrowHeadOptions {
  display?: boolean;
  length?: number;
  width?: number;
  fill?: boolean;
  backgroundColor?: string;
  borderColor?: string;
  borderShadowColor?: string;
}

function getArrowHeads(line: { options: { arrowHeads?: { start?: ArrowHeadOptions; end?: ArrowHeadOptions }; borderWidth: number } }) {
  const options = line.options;
  const arrowStartOpts = options.arrowHeads && options.arrowHeads.start;
  const arrowEndOpts = options.arrowHeads && options.arrowHeads.end;
  return {
    startOpts: arrowStartOpts,
    endOpts: arrowEndOpts,
    startAdjust: getLineAdjust(line, arrowStartOpts),
    endAdjust: getLineAdjust(line, arrowEndOpts),
  };
}

function getLineAdjust(line: { options: { borderWidth: number } }, arrowOpts: ArrowHeadOptions | undefined): number {
  if (!arrowOpts || !arrowOpts.display) return 0;
  const { length = 0, width = 0 } = arrowOpts;
  const adjust = line.options.borderWidth / 2;
  const p1 = { x: length, y: width + adjust };
  const p2 = { x: 0, y: adjust };
  return Math.abs(interpolateX(0, p1, p2));
}

function drawArrowHead(ctx: CanvasRenderingContext2D, offset: number, adjust: number, arrowOpts: ArrowHeadOptions | undefined): void {
  if (!arrowOpts || !arrowOpts.display) return;
  const { length = 0, width = 0, fill, backgroundColor, borderColor } = arrowOpts;
  const arrowOffsetX = Math.abs(offset - length) + adjust;
  ctx.beginPath();
  setShadowStyle(ctx, arrowOpts as never);
  setBorderStyle(ctx, arrowOpts as never);
  ctx.moveTo(arrowOffsetX, -width);
  ctx.lineTo(offset + adjust, 0);
  ctx.lineTo(arrowOffsetX, width);
  if (fill === true) {
    ctx.fillStyle = backgroundColor || borderColor || '';
    ctx.closePath();
    ctx.fill();
    ctx.shadowColor = 'transparent';
  } else {
    ctx.shadowColor = arrowOpts.borderShadowColor ?? '';
  }
  ctx.stroke();
}

function resolveControlPoint(value: unknown): { x: number | string; y: number | string } {
  if (value && typeof value === 'object') {
    const obj = value as { x?: number | string; y?: number | string };
    return { x: obj.x ?? 0, y: obj.y ?? 0 };
  }
  const resolved = (value as number | string) ?? 0;
  return { x: resolved, y: resolved };
}

function getControlPoint(properties: { x: number; y: number; x2: number; y2: number; centerX: number; centerY: number }, options: { controlPoint: unknown }, distance: number): { x: number; y: number } {
  const { x, y, x2, y2, centerX, centerY } = properties;
  const angle = Math.atan2(y2 - y, x2 - x);
  const cp = resolveControlPoint(options.controlPoint);
  const point = {
    x: centerX + getSize(distance, cp.x, false),
    y: centerY + getSize(distance, cp.y, false),
  };
  return rotated(point, { x: centerX, y: centerY }, angle);
}

function drawArrowHeadOnCurve(ctx: CanvasRenderingContext2D, { x, y }: { x: number; y: number }, { angle, adjust }: { angle: number; adjust: number }, arrowOpts: ArrowHeadOptions | undefined): void {
  if (!arrowOpts || !arrowOpts.display) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  drawArrowHead(ctx, 0, -adjust, arrowOpts);
  ctx.restore();
}

function drawCurve(ctx: CanvasRenderingContext2D, element: { x: number; y: number; x2: number; y2: number; options: { borderShadowColor?: string } } & { cp: { x: number; y: number }; path?: Path2D; ctx?: CanvasRenderingContext2D }, cp: { x: number; y: number }, length: number): void {
  const { x, y, x2, y2, options } = element;
  const { startOpts, endOpts, startAdjust, endAdjust } = getArrowHeads(element as never);
  const p1 = { x, y };
  const p2 = { x: x2, y: y2 };
  const startAngle = angleInCurve(p1, cp, p2, 0);
  const endAngle = angleInCurve(p1, cp, p2, 1) - Math.PI;
  const ps = pointInCurve(p1, cp, p2, startAdjust / length);
  const pe = pointInCurve(p1, cp, p2, 1 - endAdjust / length);

  const path = new Path2D();
  ctx.beginPath();
  path.moveTo(ps.x, ps.y);
  path.quadraticCurveTo(cp.x, cp.y, pe.x, pe.y);
  ctx.shadowColor = options.borderShadowColor ?? '';
  ctx.stroke(path);
  element.path = path;
  element.ctx = ctx;
  drawArrowHeadOnCurve(ctx, ps, { angle: startAngle, adjust: startAdjust }, startOpts);
  drawArrowHeadOnCurve(ctx, pe, { angle: endAngle, adjust: endAdjust }, endOpts);
}

// ---- real label-along-a-line positioning ----

function rotatedSize(width: number, height: number, rotation: number): { w: number; h: number } {
  const cos = Math.cos(rotation);
  const sin = Math.sin(rotation);
  return { w: Math.abs(width * cos) + Math.abs(height * sin), h: Math.abs(width * sin) + Math.abs(height * cos) };
}

function spaceAround(properties: { x: number; x2: number; y: number; y2: number }, chartArea: { top: number; left: number; bottom: number; right: number }) {
  const { x, x2, y, y2 } = properties;
  const t = Math.min(y, y2) - chartArea.top;
  const l = Math.min(x, x2) - chartArea.left;
  const b = chartArea.bottom - Math.max(y, y2);
  const r = chartArea.right - Math.max(x, x2);
  return { x: Math.min(l, r), y: Math.min(t, b), dx: l <= r ? 1 : -1, dy: t <= b ? 1 : -1 };
}

function calculateTAdjust(lineSize: { w: number; h: number }, sizes: { labelSize: { w: number; h: number }; padding: { left: number; top: number } }, space: { x: number; y: number; dx: number; dy: number }): number {
  const { labelSize, padding } = sizes;
  const lineW = lineSize.w * space.dx;
  const lineH = lineSize.h * space.dy;
  const x = lineW > 0 && (labelSize.w / 2 + padding.left - space.x) / lineW;
  const y = lineH > 0 && (labelSize.h / 2 + padding.top - space.y) / lineH;
  return Math.max(0, Math.min(0.25, Math.max(x || 0, y || 0)));
}

function calculateT(
  properties: { x: number; y: number; x2: number; y2: number },
  label: { position: number | string },
  sizes: { labelSize: { w: number; h: number }; padding: { left: number; top: number } },
  chartArea: { top: number; left: number; bottom: number; right: number },
): number {
  let t: number;
  const space = spaceAround(properties, chartArea);
  if (label.position === 'start') {
    t = calculateTAdjust({ w: properties.x2 - properties.x, h: properties.y2 - properties.y }, sizes, space);
  } else if (label.position === 'end') {
    t = 1 - calculateTAdjust({ w: properties.x - properties.x2, h: properties.y - properties.y2 }, sizes, space);
  } else {
    t = getRelativePosition(1, label.position);
  }
  return t;
}

function adjustLabelCoordinate(coordinate: number, labelSizes: { size: number; min: number; max: number; padding: number }): number {
  const { size, min, max, padding } = labelSizes;
  const halfSize = size / 2;
  if (size > max - min) return (max + min) / 2;
  if (min >= coordinate - padding - halfSize) coordinate = min + padding + halfSize;
  if (max <= coordinate + padding + halfSize) coordinate = max - padding - halfSize;
  return coordinate;
}

function calculateAutoRotation(properties: { x: number; y: number; x2: number; y2: number }): number {
  const { x, y, x2, y2 } = properties;
  const rotation = Math.atan2(y2 - y, x2 - x);
  return rotation > Math.PI / 2 ? rotation - Math.PI : rotation < Math.PI / -2 ? rotation + Math.PI : rotation;
}

interface LineLabelProperties {
  x: number;
  y: number;
  x2: number;
  y2: number;
  cp?: { x: number; y: number };
}

function calculateLabelPosition(
  properties: LineLabelProperties,
  label: { xAdjust: number; yAdjust: number; rotation: number | 'auto'; position: number | string },
  sizes: { width: number; height: number; padding: { left: number; top: number } },
  chartArea: { top: number; left: number; bottom: number; right: number },
) {
  const { width, height, padding } = sizes;
  const { xAdjust, yAdjust } = label;
  const p1 = { x: properties.x, y: properties.y };
  const p2 = { x: properties.x2, y: properties.y2 };
  const rotation = label.rotation === 'auto' ? calculateAutoRotation(properties) : toRadians(label.rotation);
  const size = rotatedSize(width, height, rotation);
  const t = calculateT(properties, label as never, { labelSize: size, padding }, chartArea);
  const pt = properties.cp ? pointInCurve(p1, properties.cp, p2, t) : pointInLine(p1, p2, t);
  const xCoordinateSizes = { size: size.w, min: chartArea.left, max: chartArea.right, padding: padding.left };
  const yCoordinateSizes = { size: size.h, min: chartArea.top, max: chartArea.bottom, padding: padding.top };
  const centerX = adjustLabelCoordinate(pt.x, xCoordinateSizes) + xAdjust;
  const centerY = adjustLabelCoordinate(pt.y, yCoordinateSizes) + yAdjust;
  return {
    x: centerX - width / 2,
    y: centerY - height / 2,
    x2: centerX + width / 2,
    y2: centerY + height / 2,
    centerX,
    centerY,
    pointX: pt.x,
    pointY: pt.y,
    width,
    height,
    rotation: toDegrees(rotation),
  };
}

function resolveLabelElementProperties(chart: Chart, properties: LineLabelProperties, options: { borderWidth: number; padding: unknown; xAdjust: number; yAdjust: number; rotation: number | 'auto'; position: number | string; [key: string]: unknown }) {
  const borderWidth = options.borderWidth;
  const padding = toPadding(options.padding as never);
  const textSize = measureLabelSize(chart.ctx as never, options as never);
  const width = textSize.width + padding.width + borderWidth;
  const height = textSize.height + padding.height + borderWidth;
  return calculateLabelPosition(properties, options as never, { width, height, padding: padding as never }, chart.chartArea);
}

// ---- the real element ----

const arrowHeadsDefaults: ArrowHeadOptions = {
  backgroundColor: undefined,
  backgroundShadowColor: undefined,
  borderColor: undefined,
  borderDash: undefined,
  borderDashOffset: undefined,
  borderShadowColor: undefined,
  borderWidth: undefined,
  display: undefined,
  fill: undefined,
  length: undefined,
  shadowBlur: undefined,
  shadowOffsetX: undefined,
  shadowOffsetY: undefined,
  width: undefined,
} as never;

export class LineAnnotation extends Element {
  static id = 'lineAnnotation';

  static defaults = {
    adjustScaleRange: true,
    arrowHeads: {
      display: false,
      end: { ...arrowHeadsDefaults },
      fill: false,
      length: 12,
      start: { ...arrowHeadsDefaults },
      width: 6,
    },
    borderDash: [] as number[],
    borderDashOffset: 0,
    borderShadowColor: 'transparent',
    borderWidth: 2,
    curve: false,
    controlPoint: { y: '-50%' },
    display: true,
    endValue: undefined as unknown,
    init: undefined as unknown,
    hitTolerance: 0,
    label: {
      backgroundColor: 'rgba(0,0,0,0.8)',
      backgroundShadowColor: 'transparent',
      borderCapStyle: 'butt' as CanvasLineCap,
      borderColor: 'black',
      borderDash: [] as number[],
      borderDashOffset: 0,
      borderJoinStyle: 'miter' as CanvasLineJoin,
      borderRadius: 6,
      borderShadowColor: 'transparent',
      borderWidth: 0,
      callout: { ...LabelAnnotation.defaults.callout },
      color: '#fff',
      content: null as unknown,
      display: false,
      drawTime: undefined as unknown,
      font: { family: undefined, lineHeight: undefined, size: undefined, style: undefined, weight: 'bold' },
      height: undefined as unknown,
      hitTolerance: undefined as unknown,
      opacity: undefined as unknown,
      padding: 6,
      position: 'center',
      rotation: 0 as number | 'auto',
      shadowBlur: 0,
      shadowOffsetX: 0,
      shadowOffsetY: 0,
      textAlign: 'center',
      textStrokeColor: undefined as unknown,
      textStrokeWidth: 0,
      width: undefined as unknown,
      xAdjust: 0,
      yAdjust: 0,
      z: undefined as unknown,
    },
    scaleID: undefined as unknown,
    shadowBlur: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    value: undefined as unknown,
    xMax: undefined as unknown,
    xMin: undefined as unknown,
    xScaleID: undefined as unknown,
    yMax: undefined as unknown,
    yMin: undefined as unknown,
    yScaleID: undefined as unknown,
    z: 0,
  };

  static descriptors = {
    arrowHeads: { start: { _fallback: true }, end: { _fallback: true }, _fallback: true },
  };

  static defaultRoutes = {
    borderColor: 'color',
  };

  declare x: number;
  declare y: number;
  declare x2: number;
  declare y2: number;
  declare cp?: { x: number; y: number };
  declare path?: Path2D;
  declare ctx?: CanvasRenderingContext2D;
  declare elements?: unknown[];
  declare options: Record<string, never> & {
    borderWidth: number;
    hitTolerance: number;
    curve?: boolean;
    controlPoint?: unknown;
    arrowHeads?: { start?: ArrowHeadOptions; end?: ArrowHeadOptions };
    borderShadowColor?: string;
    backgroundShadowColor?: string;
    shadowBlur?: number;
    shadowOffsetX?: number;
    shadowOffsetY?: number;
  };

  inRange(mouseX: number, mouseY: number, axis?: 'x' | 'y', useFinalPosition?: boolean): boolean {
    const hitSize = (this.options.borderWidth + this.options.hitTolerance) / 2;
    if (axis !== 'x' && axis !== 'y') {
      const point = { mouseX, mouseY };
      const path = this.path;
      const ctx = this.ctx;
      if (path && ctx) {
        setBorderStyle(ctx, this.options);
        ctx.lineWidth += this.options.hitTolerance;
        const chart = (this as unknown as { $context: { chart: Chart } }).$context.chart;
        const mx = mouseX * (chart as unknown as { currentDevicePixelRatio: number }).currentDevicePixelRatio;
        const my = mouseY * (chart as unknown as { currentDevicePixelRatio: number }).currentDevicePixelRatio;
        const result = ctx.isPointInStroke(path, mx, my) || isOnLabel(this as never, point, useFinalPosition);
        ctx.restore();
        return result;
      }
      const epsilon = sqr(hitSize);
      return intersects(this, point, epsilon, useFinalPosition) || isOnLabel(this as never, point, useFinalPosition);
    }
    return inAxisRange(this as never, { mouseX, mouseY }, axis, { hitSize, useFinalPosition });
  }

  getCenterPoint(useFinalPosition?: boolean): { x: number; y: number } {
    return getElementCenterPoint(this, useFinalPosition);
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const { x, y, x2, y2, cp, options } = this;

    ctx.save();
    if (!setBorderStyle(ctx, options)) {
      ctx.restore();
      return;
    }
    setShadowStyle(ctx, options);

    const length = Math.sqrt(Math.pow(x2 - x, 2) + Math.pow(y2 - y, 2));
    if (options.curve && cp) {
      drawCurve(ctx, this as never, cp, length);
      ctx.restore();
      return;
    }
    const { startOpts, endOpts, startAdjust, endAdjust } = getArrowHeads(this as never);
    const angle = Math.atan2(y2 - y, x2 - x);
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.beginPath();
    ctx.moveTo(0 + startAdjust, 0);
    ctx.lineTo(length - endAdjust, 0);
    ctx.shadowColor = options.borderShadowColor ?? '';
    ctx.stroke();
    drawArrowHead(ctx, 0, startAdjust, startOpts);
    drawArrowHead(ctx, length, -endAdjust, endOpts);
    ctx.restore();
  }

  get label(): unknown {
    return this.elements && this.elements[0];
  }

  resolveElementProperties(chart: Chart, options: never): unknown {
    const area = resolveLineProperties(chart, options);
    const { x, y, x2, y2 } = area;
    const inside = isLineInArea(area, chart.chartArea);
    const properties: Record<string, unknown> = inside ? limitLineToArea({ x, y }, { x: x2, y: y2 }, chart.chartArea) : { x, y, x2, y2, width: Math.abs(x2 - x), height: Math.abs(y2 - y) };
    properties.centerX = (x2 + x) / 2;
    properties.centerY = (y2 + y) / 2;
    properties.initProperties = initAnimationProperties(chart, properties as never, options);
    const opts = options as unknown as { curve?: boolean; controlPoint?: unknown; label: Record<string, unknown> };
    if (opts.curve) {
      const p1 = { x: properties.x as number, y: properties.y as number };
      const p2 = { x: properties.x2 as number, y: properties.y2 as number };
      properties.cp = getControlPoint(properties as never, opts as never, distanceBetweenPoints(p1, p2));
    }
    const labelProperties = resolveLabelElementProperties(chart, properties as never, opts.label as never) as unknown as Record<string, unknown> & { _visible?: boolean };
    labelProperties._visible = inside;

    properties.elements = [
      {
        type: 'label',
        optionScope: 'label',
        properties: labelProperties,
        initProperties: properties.initProperties,
      },
    ];
    return properties;
  }
}
