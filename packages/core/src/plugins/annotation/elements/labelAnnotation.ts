/**
 * The real `label` annotation element, faithfully ported from
 * `chartjs-plugin-annotation` (v3.1.0, MIT) \u2014 real source dissected
 * directly from the installed package's own real, unminified ESM
 * build. See `../geometry.ts`'s own header comment for the full
 * dissection rationale.
 */
import { Element } from 'chart.js';
import type { Chart } from 'chart.js';
import { defined, toPadding } from 'chart.js/helpers';
import { getElementCenterPoint, inLabelRange } from '../geometry.js';
import { drawBox, drawLabel, measureLabelSize, translate } from '../drawing.js';
import { drawCallout } from '../callout.js';
import { getChartPoint, resolveBoxProperties } from '../boxProperties.js';
import { initAnimationProperties, isBoundToPoint, measureLabelRectangle } from '../labelGeometry.js';

function getLabelSize({ x, y, width, height, options }: { x: number; y: number; width: number; height: number; options: { borderWidth: number; padding: unknown } }) {
  const hBorderWidth = options.borderWidth / 2;
  const padding = toPadding(options.padding as never);
  return {
    x: x + padding.left + hBorderWidth,
    y: y + padding.top + hBorderWidth,
    width: width - padding.left - padding.right - options.borderWidth,
    height: height - padding.top - padding.bottom - options.borderWidth,
  };
}

export class LabelAnnotation extends Element {
  static id = 'labelAnnotation';

  static defaults = {
    adjustScaleRange: true,
    backgroundColor: 'transparent',
    backgroundShadowColor: 'transparent',
    borderCapStyle: 'butt' as CanvasLineCap,
    borderDash: [] as number[],
    borderDashOffset: 0,
    borderJoinStyle: 'miter' as CanvasLineJoin,
    borderRadius: 0,
    borderShadowColor: 'transparent',
    borderWidth: 0,
    callout: {
      borderCapStyle: 'butt' as CanvasLineCap,
      borderColor: undefined as unknown,
      borderDash: [] as number[],
      borderDashOffset: 0,
      borderJoinStyle: 'miter' as CanvasLineJoin,
      borderWidth: 1,
      display: false,
      margin: 5,
      position: 'auto',
      side: 5,
      start: '50%',
    },
    color: 'black',
    content: null as unknown,
    display: true,
    font: { family: undefined, lineHeight: undefined, size: undefined, style: undefined, weight: undefined },
    height: undefined as unknown,
    hitTolerance: 0,
    init: undefined as unknown,
    opacity: undefined as unknown,
    padding: 6,
    position: 'center',
    rotation: 0,
    shadowBlur: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    textAlign: 'center',
    textStrokeColor: undefined as unknown,
    textStrokeWidth: 0,
    width: undefined as unknown,
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
  };

  declare rotation: number;
  declare _visible?: boolean;
  declare options: Record<string, never> & {
    display?: boolean;
    content: unknown;
    rotation: number;
    borderWidth: number;
    hitTolerance: number;
    padding: unknown;
  };

  inRange(mouseX: number, mouseY: number, axis?: 'x' | 'y', useFinalPosition?: boolean): boolean {
    return inLabelRange(
      { x: mouseX, y: mouseY },
      { rect: this.getProps(['x', 'y', 'x2', 'y2'], useFinalPosition) as never, center: this.getCenterPoint(useFinalPosition) },
      axis,
      { rotation: this.rotation, borderWidth: this.options.borderWidth, hitTolerance: this.options.hitTolerance },
    );
  }

  getCenterPoint(useFinalPosition?: boolean): { x: number; y: number } {
    return getElementCenterPoint(this, useFinalPosition);
  }

  draw(ctx: CanvasRenderingContext2D): void {
    const options = this.options;
    const visible = !defined(this._visible) || this._visible;
    if (!options.display || !options.content || !visible) return;
    ctx.save();
    translate(ctx, this.getCenterPoint(), this.rotation);
    drawCallout(ctx, this as never);
    drawBox(ctx, this as unknown as { x: number; y: number; width: number; height: number }, options as never);
    drawLabel(ctx, getLabelSize(this as never), options as never);
    ctx.restore();
  }

  resolveElementProperties(chart: Chart, options: never): unknown {
    let point: { x: number; y: number };
    if (!isBoundToPoint(options)) {
      const { centerX, centerY } = resolveBoxProperties(chart, options) as { centerX: number; centerY: number };
      point = { x: centerX, y: centerY };
    } else {
      point = getChartPoint(chart, options);
    }
    const opts = options as unknown as { padding: unknown };
    const padding = toPadding(opts.padding as never);
    const labelSize = measureLabelSize(chart.ctx as never, options as never);
    const boxSize = measureLabelRectangle(point, labelSize, options as never, padding as never);
    return {
      initProperties: initAnimationProperties(chart, boxSize as never, options),
      pointX: point.x,
      pointY: point.y,
      ...boxSize,
      rotation: (options as unknown as { rotation: number }).rotation,
    };
  }
}
