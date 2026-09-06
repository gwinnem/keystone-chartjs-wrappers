/**
 * Canvas drawing (frame + text) and element-type dispatch, faithfully
 * ported from `chartjs-plugin-datalabels` (v2.2.0, MIT) \u2014 real source
 * dissected directly from the installed package's own real, unminified
 * ESM build. See `utils.ts`'s own header comment for the full
 * dissection rationale.
 */
import { ArcElement, BarElement, PointElement, type Chart, type ChartMeta } from 'chart.js';
import { rasterize } from './utils.js';
import { positioners, type PositionerOrigin, type Positioner } from './positioners.js';

export interface LabelSize {
  width: number;
  height: number;
}

export interface LabelModel {
  align: string | number;
  anchor: 'start' | 'end' | 'center';
  area: { left: number; top: number; right: number; bottom: number };
  backgroundColor: string | null;
  borderColor: string | null;
  borderRadius: number;
  borderWidth: number;
  clamp: boolean;
  clip: boolean;
  color: string | undefined;
  display: boolean | 'auto';
  font: { string: string; lineHeight: number };
  lines: string[];
  offset: number;
  opacity: number;
  origin: PositionerOrigin;
  padding: { top: number; left: number; right: number; bottom: number; width: number; height: number };
  positioner: Positioner;
  rotation: number;
  size: LabelSize;
  textAlign: CanvasTextAlign;
  textShadowBlur: number;
  textShadowColor: string | undefined;
  textStrokeColor: string | undefined;
  textStrokeWidth: number;
}

export interface LabelRects {
  frame: { x: number; y: number; w: number; h: number };
  text: { x: number; y: number; w: number; h: number };
}

/** The real, two-part geometry (an outer "frame" \u2014 background +
 * border \u2014 and an inner "text" rect) a label's own already-computed
 * `model` resolves to, centered on `(0, 0)` \u2014 the label is translated
 * to its own real anchor point at draw time instead (see `Label.draw`
 * in `label.ts`). */
export function boundingRects(model: LabelModel): LabelRects {
  const borderWidth = model.borderWidth || 0;
  const padding = model.padding;
  const th = model.size.height;
  const tw = model.size.width;
  const tx = -tw / 2;
  const ty = -th / 2;
  return {
    frame: {
      x: tx - padding.left - borderWidth,
      y: ty - padding.top - borderWidth,
      w: tw + padding.width + borderWidth * 2,
      h: th + padding.height + borderWidth * 2,
    },
    text: { x: tx, y: ty, w: tw, h: th },
  };
}

/** The real scale-origin a label's own `point`/`bar`/`fallback`
 * positioner orients against \u2014 a radial scale's own real center for a
 * polar/radar element, or a linear scale's own real base pixel
 * (horizontal or vertical, per the element's own orientation)
 * otherwise. `null` for whichever axis has no real scale of its own at
 * all (confirmed real Chart.js runtime property, not part of its own
 * public `ChartMeta` type \u2014 the same class of gap this project's own
 * `gradientPlugin.ts` already casts for). */
export function getScaleOrigin(
  el: { horizontal?: boolean },
  context: { chart: Chart; datasetIndex: number },
): PositionerOrigin | null {
  const meta = context.chart.getDatasetMeta(context.datasetIndex) as ChartMeta & {
    vScale?: { xCenter?: number; yCenter?: number; getBasePixel(): number };
  };
  const scale = meta.vScale;
  if (!scale) return null;
  if (scale.xCenter !== undefined && scale.yCenter !== undefined) {
    return { x: scale.xCenter, y: scale.yCenter };
  }
  const pixel = scale.getBasePixel();
  return el.horizontal ? { x: pixel, y: null } : { x: null, y: pixel };
}

/** Resolves which real positioner applies to a given Chart.js element
 * instance \u2014 a genuine `instanceof` dispatch (confirmed real element
 * classes, not duck-typed), falling back to the generic rectangle
 * positioner for anything else. */
export function getPositioner(el: unknown): Positioner {
  if (el instanceof ArcElement) return positioners.arc as Positioner;
  if (el instanceof PointElement) return positioners.point as Positioner;
  if (el instanceof BarElement) return positioners.bar as Positioner;
  return positioners.fallback as Positioner;
}

function drawRoundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, radius: number): void {
  const HALF_PI = Math.PI / 2;
  if (radius) {
    const r = Math.min(radius, h / 2, w / 2);
    const left = x + r;
    const top = y + r;
    const right = x + w - r;
    const bottom = y + h - r;
    ctx.moveTo(x, top);
    if (left < right && top < bottom) {
      ctx.arc(left, top, r, -Math.PI, -HALF_PI);
      ctx.arc(right, top, r, -HALF_PI, 0);
      ctx.arc(right, bottom, r, 0, HALF_PI);
      ctx.arc(left, bottom, r, HALF_PI, Math.PI);
    } else if (left < right) {
      ctx.moveTo(left, y);
      ctx.arc(right, top, r, -HALF_PI, HALF_PI);
      ctx.arc(left, top, r, HALF_PI, Math.PI + HALF_PI);
    } else if (top < bottom) {
      ctx.arc(left, top, r, -Math.PI, 0);
      ctx.arc(left, bottom, r, 0, Math.PI);
    } else {
      ctx.arc(left, top, r, -Math.PI, Math.PI);
    }
    ctx.closePath();
    ctx.moveTo(x, y);
  } else {
    ctx.rect(x, y, w, h);
  }
}

/** Draws the label's own real background/border frame \u2014 a real
 * rounded rect (`borderRadius`), skipped entirely when neither a
 * background color nor a real, visible border is configured. */
export function drawFrame(ctx: CanvasRenderingContext2D, rect: LabelRects['frame'], model: LabelModel): void {
  const bgColor = model.backgroundColor;
  const borderColor = model.borderColor;
  const borderWidth = model.borderWidth;
  if (!bgColor && (!borderColor || !borderWidth)) return;

  ctx.beginPath();
  drawRoundedRect(
    ctx,
    rasterize(rect.x) + borderWidth / 2,
    rasterize(rect.y) + borderWidth / 2,
    rasterize(rect.w) - borderWidth,
    rasterize(rect.h) - borderWidth,
    model.borderRadius,
  );
  ctx.closePath();

  if (bgColor) {
    ctx.fillStyle = bgColor;
    ctx.fill();
  }
  if (borderColor && borderWidth) {
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = borderWidth;
    ctx.lineJoin = 'miter';
    ctx.stroke();
  }
}

function textGeometry(rect: LabelRects['text'], align: CanvasTextAlign, font: { lineHeight: number }): { h: number; w: number; x: number; y: number } {
  const h = font.lineHeight;
  const w = rect.w;
  let x = rect.x;
  const y = rect.y + h / 2;
  if (align === 'center') x += w / 2;
  else if (align === 'end' || align === 'right') x += w;
  return { h, w, x, y };
}

function drawTextLine(ctx: CanvasRenderingContext2D, text: string, cfg: { x: number; y: number; w: number; stroked: boolean; filled: boolean }): void {
  const shadow = ctx.shadowBlur;
  const x = rasterize(cfg.x);
  const y = rasterize(cfg.y);
  const w = rasterize(cfg.w);

  if (cfg.stroked) ctx.strokeText(text, x, y, w);
  if (cfg.filled) {
    if (shadow && cfg.stroked) ctx.shadowBlur = 0;
    ctx.fillText(text, x, y, w);
    if (shadow && cfg.stroked) ctx.shadowBlur = shadow;
  }
}

/** Draws every real text line, honoring the real fill/stroke/shadow
 * config \u2014 a no-op when there are no lines at all, or neither a fill
 * color nor a real stroke is configured. */
export function drawText(ctx: CanvasRenderingContext2D, lines: string[], rect: LabelRects['text'], model: LabelModel): void {
  const align = model.textAlign;
  const color = model.color;
  const filled = !!color;
  const font = model.font;
  const strokeColor = model.textStrokeColor;
  const strokeWidth = model.textStrokeWidth;
  const stroked = !!(strokeColor && strokeWidth);

  if (!lines.length || (!filled && !stroked)) return;

  const geometry = textGeometry(rect, align, font);

  ctx.font = font.string;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.shadowBlur = model.textShadowBlur;
  ctx.shadowColor = model.textShadowColor ?? '';

  if (filled) ctx.fillStyle = color!;
  if (stroked) {
    ctx.lineJoin = 'round';
    ctx.lineWidth = strokeWidth;
    ctx.strokeStyle = strokeColor!;
  }

  for (let i = 0; i < lines.length; ++i) {
    drawTextLine(ctx, lines[i], { stroked, filled, w: geometry.w, x: geometry.x, y: geometry.y + geometry.h * i });
  }
}
