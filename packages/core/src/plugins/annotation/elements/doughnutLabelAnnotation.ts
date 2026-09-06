/**
 * The real `doughnutLabel` annotation element, faithfully ported from
 * `chartjs-plugin-annotation` (v3.1.0, MIT) \u2014 real source dissected
 * directly from the installed package's own real, unminified ESM
 * build. See `../geometry.ts`'s own header comment for the full
 * dissection rationale.
 *
 * Genuinely different from every other element type: not bound to a
 * scale or a fixed chart-space point at all \u2014 it finds the innermost
 * real doughnut ring on the chart (via `getSortedVisibleDatasetMetas`)
 * and centers itself inside that ring's own real, current inner
 * radius, auto-shrinking its own font if the configured content
 * doesn't fit (`autoFit`).
 */
import { Element, DoughnutController } from 'chart.js';
import type { Chart, ChartMeta } from 'chart.js';
import { getAngleFromPoint } from 'chart.js/helpers';
import { getElementCenterPoint, inLabelRange } from '../geometry.js';
import { drawLabel, measureLabelSize, setBorderStyle, translate } from '../drawing.js';
import { initAnimationProperties, measureLabelRectangle, shouldFit } from '../labelGeometry.js';

interface DoughnutLabelOptions {
  autoFit: boolean;
  autoHide: boolean;
  hitTolerance: number;
  spacing: number;
  borderWidth: number;
  position: unknown;
  xAdjust: number;
  yAdjust: number;
  rotation: number;
  display: boolean;
  content: unknown;
  backgroundColor?: string;
}

function isControllerVisible(chart: Chart, options: DoughnutLabelOptions, elements: { hidden?: boolean }[]): boolean {
  if (!options.autoHide) return true;
  for (let i = 0; i < elements.length; i++) {
    if (!elements[i].hidden && chart.getDataVisibility(i)) return true;
  }
  return false;
}

function getDatasetMeta(chart: Chart, options: DoughnutLabelOptions): (ChartMeta & { controller: { innerRadius: number } }) | undefined {
  return chart.getSortedVisibleDatasetMetas().reduce(
    (result: (ChartMeta & { controller: { innerRadius: number } }) | undefined, value) => {
      const controller = value.controller;
      if (
        controller instanceof DoughnutController &&
        isControllerVisible(chart, options, value.data as never) &&
        (!result || (controller as unknown as { innerRadius: number }).innerRadius < result.controller.innerRadius) &&
        (controller as unknown as { options: { circumference: number } }).options.circumference >= 90
      ) {
        return value as never;
      }
      return result;
    },
    undefined,
  );
}

function getAngles(y: number, centerX: number, centerY: number, radius: number): { _startAngle: number; _endAngle: number } {
  const yk2 = Math.pow(centerY - y, 2);
  const r2 = Math.pow(radius, 2);
  const b = centerX * -2;
  const c = Math.pow(centerX, 2) + yk2 - r2;
  const delta = Math.pow(b, 2) - 4 * c;
  if (delta <= 0) {
    return { _startAngle: 0, _endAngle: Math.PI * 2 };
  }
  const start = (-b - Math.sqrt(delta)) / 2;
  const end = (-b + Math.sqrt(delta)) / 2;
  return {
    _startAngle: getAngleFromPoint({ x: centerX, y: centerY }, { x: start, y }).angle,
    _endAngle: getAngleFromPoint({ x: centerX, y: centerY }, { x: end, y }).angle,
  };
}

function getControllerMeta(
  { chartArea }: { chartArea: { left: number; top: number; right: number; bottom: number } },
  options: DoughnutLabelOptions,
  meta: { controller: { innerRadius: number; offsetX: number; offsetY: number } },
) {
  const { left, top, right, bottom } = chartArea;
  const { innerRadius, offsetX, offsetY } = meta.controller;
  const x = (left + right) / 2 + offsetX;
  const y = (top + bottom) / 2 + offsetY;
  const square = {
    left: Math.max(x - innerRadius, left),
    right: Math.min(x + innerRadius, right),
    top: Math.max(y - innerRadius, top),
    bottom: Math.min(y + innerRadius, bottom),
  };
  const point = { x: (square.left + square.right) / 2, y: (square.top + square.bottom) / 2 };
  const space = options.spacing + options.borderWidth / 2;
  const _radius = innerRadius - space;
  const _counterclockwise = point.y > y;
  const side = _counterclockwise ? top + space : bottom - space;
  const angles = getAngles(side, x, y, _radius);
  return {
    controllerMeta: { _centerX: x, _centerY: y, _radius, _counterclockwise, ...angles },
    point,
    radius: Math.min(innerRadius, Math.min(square.right - square.left, square.bottom - square.top) / 2),
  };
}

function getFitRatio({ width, height }: { width: number; height: number }, radius: number): number {
  const hypo = Math.sqrt(Math.pow(width, 2) + Math.pow(height, 2));
  return (radius * 2) / hypo;
}

function drawBackground(ctx: CanvasRenderingContext2D, element: { _centerX: number; _centerY: number; _radius: number; _startAngle: number; _endAngle: number; _counterclockwise: boolean; options: DoughnutLabelOptions }): void {
  const { _centerX, _centerY, _radius, _startAngle, _endAngle, _counterclockwise, options } = element;
  ctx.save();
  const stroke = setBorderStyle(ctx, options as never);
  ctx.fillStyle = options.backgroundColor ?? '';
  ctx.beginPath();
  ctx.arc(_centerX, _centerY, _radius, _startAngle, _endAngle, _counterclockwise);
  ctx.closePath();
  ctx.fill();
  if (stroke) ctx.stroke();
  ctx.restore();
}

export class DoughnutLabelAnnotation extends Element {
  static id = 'doughnutLabelAnnotation';

  static defaults: DoughnutLabelOptions & Record<string, unknown> = {
    autoFit: true,
    autoHide: true,
    backgroundColor: 'transparent',
    backgroundShadowColor: 'transparent',
    borderColor: 'transparent',
    borderDash: [],
    borderDashOffset: 0,
    borderJoinStyle: 'miter',
    borderShadowColor: 'transparent',
    borderWidth: 0,
    color: 'black',
    content: null,
    display: true,
    font: { family: undefined, lineHeight: undefined, size: undefined, style: undefined, weight: undefined },
    height: undefined,
    hitTolerance: 0,
    init: undefined,
    opacity: undefined,
    position: 'center',
    rotation: 0,
    shadowBlur: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    spacing: 1,
    textAlign: 'center',
    textStrokeColor: undefined,
    textStrokeWidth: 0,
    width: undefined,
    xAdjust: 0,
    yAdjust: 0,
  };

  static defaultRoutes = {};

  declare rotation: number;
  declare _fitRatio: number;
  declare options: DoughnutLabelOptions;

  inRange(mouseX: number, mouseY: number, axis?: 'x' | 'y', useFinalPosition?: boolean): boolean {
    return inLabelRange(
      { x: mouseX, y: mouseY },
      { rect: this.getProps(['x', 'y', 'x2', 'y2'], useFinalPosition) as never, center: this.getCenterPoint(useFinalPosition) },
      axis,
      { rotation: this.rotation, borderWidth: 0, hitTolerance: this.options.hitTolerance },
    );
  }

  getCenterPoint(useFinalPosition?: boolean): { x: number; y: number } {
    return getElementCenterPoint(this, useFinalPosition);
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const options = this.options;
    if (!options.display || !options.content) return;
    drawBackground(ctx, this as never);
    ctx.save();
    translate(ctx, this.getCenterPoint(), this.rotation);
    drawLabel(ctx, this as never, options as never, this._fitRatio);
    ctx.restore();
  }

  resolveElementProperties(chart: Chart, options: DoughnutLabelOptions): unknown {
    const meta = getDatasetMeta(chart, options);
    if (!meta) return {};
    const { controllerMeta, point, radius } = getControllerMeta(chart, options, meta as never);
    let labelSize = measureLabelSize(chart.ctx as never, options as never);
    const _fitRatio = getFitRatio(labelSize, radius);
    if (shouldFit(options, _fitRatio)) {
      labelSize = { width: labelSize.width * _fitRatio, height: labelSize.height * _fitRatio };
    }
    const { position, xAdjust, yAdjust } = options;
    const boxSize = measureLabelRectangle(point, labelSize, { borderWidth: 0, position: position as never, xAdjust, yAdjust });
    return {
      initProperties: initAnimationProperties(chart, boxSize as never, options as never),
      ...boxSize,
      ...controllerMeta,
      rotation: options.rotation,
      _fitRatio,
    };
  }
}
