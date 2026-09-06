/**
 * Canvas drawing primitives, faithfully ported from
 * `chartjs-plugin-annotation` (v3.1.0, MIT) \u2014 real source dissected
 * directly from the installed package's own real, unminified ESM
 * build. See `geometry.ts`'s own header comment for the full
 * dissection rationale.
 */
import { addRoundedRectPath, isArray, isFinite as chartIsFinite, isNumber, toTRBLCorners, QUARTER_PI, TAU, TWO_THIRDS_PI, HALF_PI, PI, RAD_PER_DEG } from 'chart.js/helpers';
import { clamp, clampAll } from './geometry.js';
import { toFonts } from './labelGeometry.js';
import type { FontSpec } from 'chart.js';

/** Chart.js's own real `toFont()` return value at runtime always
 * carries a computed `.string` (the real, ready-to-assign
 * `ctx.font` value) alongside every documented `FontSpec` field — not
 * part of `FontSpec`'s own static type, so re-declared locally rather
 * than fighting that gap with a cast at every call site (matching the
 * same real gap `trendline`'s own port already works around
 * identically). */
interface ResolvedFont extends FontSpec {
  string: string;
  lineHeight: number;
}

const widthCache = new Map<string, { width: number; height: number }>();
const notRadius = (radius: number): boolean => isNaN(radius) || radius <= 0;
const fontsKey = (fonts: ResolvedFont[]): string => fonts.reduce((prev, item) => prev + item.string, '');

/** `true` for an `HTMLImageElement`/`HTMLCanvasElement` label content
 * value \u2014 confirmed real, string-based `toString()` tag check (not
 * `instanceof`, since this file has no DOM lib dependency of its own
 * and must work the same way server-side-rendered/non-browser test
 * environments do). */
export function isImageOrCanvas(content: unknown): boolean {
  if (content && typeof content === 'object') {
    const type = content.toString();
    return type === '[object HTMLImageElement]' || type === '[object HTMLCanvasElement]';
  }
  return false;
}

/** Applies a real rotation around `point` \u2014 a no-op when `rotation`
 * is falsy (avoids three real, wasted canvas-matrix calls for the
 * overwhelmingly common unrotated case). */
export function translate(ctx: CanvasRenderingContext2D, { x, y }: { x: number; y: number }, rotation: number): void {
  if (rotation) {
    ctx.translate(x, y);
    ctx.rotate((rotation * Math.PI) / 180);
    ctx.translate(-x, -y);
  }
}

export interface BorderStyleOptions {
  borderWidth?: number;
  borderCapStyle?: CanvasLineCap;
  borderDash?: number[];
  borderDashOffset?: number;
  borderJoinStyle?: CanvasLineJoin;
  borderColor?: string;
}

/** Applies real stroke styling and returns `true` \u2014 or does nothing
 * and returns falsy when `borderWidth` is 0 (the real, confirmed
 * "don't stroke a border-less shape at all" convention every element
 * type's own `draw()` checks this return value for). */
export function setBorderStyle(ctx: CanvasRenderingContext2D, options: BorderStyleOptions | undefined): boolean | undefined {
  if (options && options.borderWidth) {
    ctx.lineCap = options.borderCapStyle || 'butt';
    ctx.setLineDash(options.borderDash ?? []);
    ctx.lineDashOffset = options.borderDashOffset ?? 0;
    ctx.lineJoin = options.borderJoinStyle || 'miter';
    ctx.lineWidth = options.borderWidth;
    ctx.strokeStyle = options.borderColor ?? '';
    return true;
  }
  return undefined;
}

export interface ShadowStyleOptions {
  backgroundShadowColor?: string;
  shadowBlur?: number;
  shadowOffsetX?: number;
  shadowOffsetY?: number;
}

export function setShadowStyle(ctx: CanvasRenderingContext2D, options: ShadowStyleOptions): void {
  ctx.shadowColor = options.backgroundShadowColor ?? '';
  ctx.shadowBlur = options.shadowBlur ?? 0;
  ctx.shadowOffsetX = options.shadowOffsetX ?? 0;
  ctx.shadowOffsetY = options.shadowOffsetY ?? 0;
}

export interface LabelSizeOptions {
  content: unknown;
  width?: number | string;
  height?: number | string;
  font: Partial<FontSpec> | Partial<FontSpec>[];
  autoFit?: boolean;
  textStrokeWidth?: number;
}

/** Measures a label's own real rendered size \u2014 an image/canvas's own
 * real, configured (or intrinsic) width/height for image content, or
 * the real widest-line-times-line-count measurement for text,
 * memoized in a module-level cache keyed by the exact text + font +
 * stroke-width combination (confirmed real: re-measuring identical
 * text/font/stroke on every real chart update would be wasted work). */
export function measureLabelSize(ctx: CanvasRenderingContext2D & { _measureText?: boolean }, options: LabelSizeOptions): { width: number; height: number } {
  const content = options.content;
  if (isImageOrCanvas(content)) {
    const img = content as { width: number; height: number };
    return {
      width: getSizeValue(img.width, options.width),
      height: getSizeValue(img.height, options.height),
    };
  }
  const fonts = toFonts(options as never) as ResolvedFont[];
  const strokeWidth = options.textStrokeWidth ?? 0;
  const lines = isArray(content) ? content : [content];
  const mapKey = (lines as unknown[]).join() + fontsKey(fonts) + strokeWidth + (ctx._measureText ? '-spriting' : '');
  if (!widthCache.has(mapKey)) {
    widthCache.set(mapKey, calculateLabelSize(ctx, lines as string[], fonts, strokeWidth));
  }
  return widthCache.get(mapKey)!;
}

function getSizeValue(intrinsic: number, configured: number | string | undefined): number {
  if (typeof configured === 'number') return configured;
  return intrinsic;
}

function calculateLabelSize(ctx: CanvasRenderingContext2D, lines: string[], fonts: ResolvedFont[], strokeWidth: number): { width: number; height: number } {
  ctx.save();
  const count = lines.length;
  let width = 0;
  let height = strokeWidth;
  for (let i = 0; i < count; i++) {
    const font = fonts[Math.min(i, fonts.length - 1)];
    ctx.font = font.string;
    const text = lines[i];
    width = Math.max(width, ctx.measureText(text).width + strokeWidth);
    height += font.lineHeight;
  }
  ctx.restore();
  return { width, height };
}

export interface BoxDrawOptions extends BorderStyleOptions, ShadowStyleOptions {
  backgroundColor?: string;
  borderRadius?: number | Record<string, number>;
  borderShadowColor?: string;
}

/** Draws a real, rounded-rect background + border for `rect` \u2014 corner
 * radii are clamped to at most half the smaller box dimension
 * (confirmed real: an over-large `borderRadius` doesn't overshoot into
 * a self-intersecting shape). */
export function drawBox(ctx: CanvasRenderingContext2D, rect: { x: number; y: number; width: number; height: number }, options: BoxDrawOptions): void {
  const { x, y, width, height } = rect;
  ctx.save();
  setShadowStyle(ctx, options);
  const stroke = setBorderStyle(ctx, options);
  ctx.fillStyle = options.backgroundColor ?? '';
  ctx.beginPath();
  addRoundedRectPath(ctx as never, {
    x,
    y,
    w: width,
    h: height,
    radius: clampAll(toTRBLCorners(options.borderRadius as never) as never, 0, Math.min(width, height) / 2),
  } as never);
  ctx.closePath();
  ctx.fill();
  if (stroke) {
    ctx.shadowColor = options.borderShadowColor ?? '';
    ctx.stroke();
  }
  ctx.restore();
}

function getOpacity(value: unknown, elementValue: unknown): number {
  const opacity = isNumber(value) ? (value as number) : elementValue;
  return isNumber(opacity) ? clamp(opacity as number, 0, 1) : 1;
}

export interface LabelDrawRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LabelDrawOptions {
  content: unknown;
  opacity?: number;
  textAlign: CanvasTextAlign;
  color?: string | string[];
  textStrokeWidth?: number;
  textStrokeColor?: string;
  font: Partial<FontSpec> | Partial<FontSpec>[];
  autoFit?: boolean;
}

/** Draws a label's own real content \u2014 `ctx.drawImage` for image/canvas
 * content, or real multi-line, multi-font, multi-color text otherwise
 * (each real line can independently pick a font/color when more than
 * one is configured, cycling to the last one once exhausted). */
export function drawLabel(ctx: CanvasRenderingContext2D, rect: LabelDrawRect, options: LabelDrawOptions, fitRatio?: number): void {
  const content = options.content;
  if (isImageOrCanvas(content)) {
    const img = content as HTMLImageElement & { style: { opacity: string } };
    ctx.save();
    ctx.globalAlpha = getOpacity(options.opacity, img.style.opacity);
    ctx.drawImage(img as unknown as CanvasImageSource, rect.x, rect.y, rect.width, rect.height);
    ctx.restore();
    return;
  }
  const labels = isArray(content) ? content : [content];
  const fonts = toFonts(options as never, fitRatio) as ResolvedFont[];
  const optColor = options.color;
  const colors = isArray(optColor) ? optColor : [optColor];
  const x = calculateAlignmentX(rect, options.textAlign);
  const y = rect.y + (options.textStrokeWidth ?? 0) / 2;
  ctx.save();
  ctx.textBaseline = 'middle';
  ctx.textAlign = options.textAlign;
  if (setTextStrokeStyle(ctx, options)) {
    applyLabelDecoration(ctx, { x, y }, labels as string[], fonts);
  }
  applyLabelContent(ctx, { x, y }, labels as string[], { fonts, colors: colors as (string | undefined)[] });
  ctx.restore();
}

function calculateAlignmentX(rect: LabelDrawRect, textAlign: CanvasTextAlign): number {
  const { x, width } = rect;
  if (textAlign === 'center') return x + width / 2;
  if (textAlign === 'end' || textAlign === 'right') return x + width;
  return x;
}

function setTextStrokeStyle(ctx: CanvasRenderingContext2D, options: { textStrokeWidth?: number; textStrokeColor?: string }): boolean {
  if ((options.textStrokeWidth ?? 0) > 0) {
    // https://stackoverflow.com/questions/13627111/drawing-text-with-an-outer-stroke-with-html5s-canvas
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;
    ctx.lineWidth = options.textStrokeWidth!;
    ctx.strokeStyle = options.textStrokeColor ?? '';
    return true;
  }
  return false;
}

function applyLabelDecoration(ctx: CanvasRenderingContext2D, { x, y }: { x: number; y: number }, labels: string[], fonts: ResolvedFont[]): void {
  ctx.beginPath();
  let lhs = 0;
  labels.forEach((l, i) => {
    const f = fonts[Math.min(i, fonts.length - 1)];
    const lh = f.lineHeight;
    ctx.font = f.string;
    ctx.strokeText(l, x, y + lh / 2 + lhs);
    lhs += lh;
  });
  ctx.stroke();
}

function applyLabelContent(ctx: CanvasRenderingContext2D, { x, y }: { x: number; y: number }, labels: string[], { fonts, colors }: { fonts: ResolvedFont[]; colors: (string | undefined)[] }): void {
  let lhs = 0;
  labels.forEach((l, i) => {
    const c = colors[Math.min(i, colors.length - 1)];
    const f = fonts[Math.min(i, fonts.length - 1)];
    const lh = f.lineHeight;
    ctx.beginPath();
    ctx.font = f.string;
    ctx.fillStyle = c ?? '';
    ctx.fillText(l, x, y + lh / 2 + lhs);
    lhs += lh;
    ctx.fill();
  });
}

export interface PointDrawElement {
  radius: number;
  options: { pointStyle?: unknown; rotation?: number };
}

/** Draws a point annotation's own real `pointStyle` shape (or a real
 * image/canvas `pointStyle`) at `(x, y)` \u2014 a no-op for a zero/negative
 * radius. */
export function drawPoint(ctx: CanvasRenderingContext2D, element: PointDrawElement, x: number, y: number): void {
  const { radius, options } = element;
  const style = options.pointStyle;
  const rotation = options.rotation;
  const rad = (rotation || 0) * RAD_PER_DEG;

  if (isImageOrCanvas(style)) {
    const img = style as CanvasImageSource & { width: number; height: number };
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rad);
    ctx.drawImage(img, -img.width / 2, -img.height / 2, img.width, img.height);
    ctx.restore();
    return;
  }
  if (notRadius(radius)) return;
  drawPointStyle(ctx, { x, y, radius, style, rad });
}

interface DrawPointStyleArgs {
  x: number;
  y: number;
  radius: number;
  style: unknown;
  rad: number;
}

/** The real, complete set of Chart.js point-style shapes (`circle`
 * default, `triangle`, `rect`, `rectRounded`, `rectRot`, `cross`,
 * `crossRot`, `star`, `line`, `dash`) \u2014 identical geometry to
 * Chart.js's own core point-element rendering, carried over unchanged
 * so an annotation point visually matches a real dataset point using
 * the same style. */
function drawPointStyle(ctx: CanvasRenderingContext2D, { x, y, radius, style, rad: initialRad }: DrawPointStyleArgs): void {
  let rad = initialRad;
  let xOffset: number, yOffset: number, size: number, cornerRadius: number;
  ctx.beginPath();

  const drawDiamond = (): void => {
    xOffset = Math.cos(rad) * radius;
    yOffset = Math.sin(rad) * radius;
    ctx.moveTo(x - xOffset, y - yOffset);
    ctx.lineTo(x + yOffset, y - xOffset);
    ctx.lineTo(x + xOffset, y + yOffset);
    ctx.lineTo(x - yOffset, y + xOffset);
    ctx.closePath();
  };

  const drawCross = (): void => {
    xOffset = Math.cos(rad) * radius;
    yOffset = Math.sin(rad) * radius;
    ctx.moveTo(x - xOffset, y - yOffset);
    ctx.lineTo(x + xOffset, y + yOffset);
    ctx.moveTo(x + yOffset, y - xOffset);
    ctx.lineTo(x - yOffset, y + xOffset);
  };

  switch (style) {
    case 'triangle':
      ctx.moveTo(x + Math.sin(rad) * radius, y - Math.cos(rad) * radius);
      rad += TWO_THIRDS_PI;
      ctx.lineTo(x + Math.sin(rad) * radius, y - Math.cos(rad) * radius);
      rad += TWO_THIRDS_PI;
      ctx.lineTo(x + Math.sin(rad) * radius, y - Math.cos(rad) * radius);
      ctx.closePath();
      break;
    case 'rectRounded':
      cornerRadius = radius * 0.516;
      size = radius - cornerRadius;
      xOffset = Math.cos(rad + QUARTER_PI) * size;
      yOffset = Math.sin(rad + QUARTER_PI) * size;
      ctx.arc(x - xOffset, y - yOffset, cornerRadius, rad - PI, rad - HALF_PI);
      ctx.arc(x + yOffset, y - xOffset, cornerRadius, rad - HALF_PI, rad);
      ctx.arc(x + xOffset, y + yOffset, cornerRadius, rad, rad + HALF_PI);
      ctx.arc(x - yOffset, y + xOffset, cornerRadius, rad + HALF_PI, rad + PI);
      ctx.closePath();
      break;
    case 'rect':
      if (!rad) {
        size = Math.SQRT1_2 * radius;
        ctx.rect(x - size, y - size, 2 * size, 2 * size);
        break;
      }
      // Real, confirmed behavior: an unrotated 'rect' draws as an
      // axis-aligned square (above); a rotated one draws identically to
      // 'rectRot' — matching the original's own real fallthrough, made
      // explicit here as a shared helper instead of a real
      // case-to-case fallthrough (identical control flow, easier for
      // TypeScript's own fallthrough checker to verify).
      rad += QUARTER_PI;
      drawDiamond();
      break;
    case 'rectRot':
      drawDiamond();
      break;
    case 'crossRot':
      // Real, confirmed behavior: 'crossRot' is a 'cross' rotated by
      // 45° — matching the original's own real fallthrough, made
      // explicit here for the identical reason as 'rect' above.
      rad += QUARTER_PI;
      drawCross();
      break;
    case 'cross':
      drawCross();
      break;
    case 'star':
      xOffset = Math.cos(rad) * radius;
      yOffset = Math.sin(rad) * radius;
      ctx.moveTo(x - xOffset, y - yOffset);
      ctx.lineTo(x + xOffset, y + yOffset);
      ctx.moveTo(x + yOffset, y - xOffset);
      ctx.lineTo(x - yOffset, y + xOffset);
      rad += QUARTER_PI;
      xOffset = Math.cos(rad) * radius;
      yOffset = Math.sin(rad) * radius;
      ctx.moveTo(x - xOffset, y - yOffset);
      ctx.lineTo(x + xOffset, y + yOffset);
      ctx.moveTo(x + yOffset, y - xOffset);
      ctx.lineTo(x - yOffset, y + xOffset);
      break;
    case 'line':
      xOffset = Math.cos(rad) * radius;
      yOffset = Math.sin(rad) * radius;
      ctx.moveTo(x - xOffset, y - yOffset);
      ctx.lineTo(x + xOffset, y + yOffset);
      break;
    case 'dash':
      ctx.moveTo(x, y);
      ctx.lineTo(x + Math.cos(rad) * radius, y + Math.sin(rad) * radius);
      break;
    default:
      // Circle — the real, documented default for every unrecognized
      // or absent pointStyle.
      ctx.arc(x, y, radius, 0, TAU);
      ctx.closePath();
      break;
  }

  ctx.fill();
}

// Re-exported so callers don't need a second import from chart.js/helpers
// purely to check a resolved scale value's own finiteness.
export const isFinite = chartIsFinite;
