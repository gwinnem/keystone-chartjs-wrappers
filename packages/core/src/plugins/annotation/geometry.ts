/**
 * Low-level geometric primitives, faithfully ported from
 * `chartjs-plugin-annotation` (v3.1.0, MIT, chartjs-plugin-annotation
 * contributors) \u2014 real source dissected directly from the installed
 * package's own real, unminified ESM build
 * (`dist/chartjs-plugin-annotation.esm.js` \u2014 the published package
 * ships no real `src/` of its own, only `dist/*`/`types/*`, but the ESM
 * build is genuinely unminified and complete, making a precise,
 * line-by-line dissection possible the same way the installed `dist`
 * output already was for `gradient`/`autocolors`/`dataLabels`).
 */

export interface Point2D {
  x: number;
  y: number;
}

/** Rotate `point` around `center` by `angle` (radians). */
export function rotated(point: Point2D, center: Point2D, angle: number): Point2D {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const cx = center.x;
  const cy = center.y;
  return {
    x: cx + cos * (point.x - cx) - sin * (point.y - cy),
    y: cy + sin * (point.x - cx) + cos * (point.y - cy),
  };
}

export const EPSILON = 0.001;
export const clamp = (x: number, from: number, to: number): number => Math.min(to, Math.max(from, x));

/** Marks every own key of `obj` clamped to the real `[from, to]` range,
 * mutating and returning the same object \u2014 used for real
 * `borderRadius` corner clamping (each corner independently clamped to
 * half the smaller box dimension). */
export function clampAll<T extends Record<string, number>>(obj: T, from: number, to: number): T {
  for (const key of Object.keys(obj)) {
    (obj as Record<string, number>)[key] = clamp(obj[key], from, to);
  }
  return obj;
}

export interface Limit {
  value: number;
  start: number;
  end: number;
}

/** A real 1D range test, with `hitSize` slack added on both ends \u2014
 * shared by every axis-constrained (`x`/`y`-only) hit test below. */
export function inLimit(limit: Limit, hitSize: number): boolean {
  return limit.value >= limit.start - hitSize && limit.value <= limit.end + hitSize;
}

/** Real circular hit test \u2014 point-to-center distance vs. `radius +
 * hitSize`, squared to avoid a real `Math.sqrt` call. */
export function inPointRange(point: Point2D | undefined, center: Point2D | undefined, radius: number, hitSize: number): boolean {
  if (!point || !center || radius <= 0) return false;
  return Math.pow(point.x - center.x, 2) + Math.pow(point.y - center.y, 2) <= Math.pow(radius + hitSize, 2);
}

export interface BoxRect {
  x: number;
  y: number;
  x2: number;
  y2: number;
}

export interface HitSizeOptions {
  borderWidth: number;
  hitTolerance: number;
}

/** Real axis-aware rectangle hit test \u2014 `axis` restricts the test to
 * just the x or y range (used by line-scale-limited elements), `EPSILON`
 * absorbs real floating-point rounding at the box's own exact edge. */
export function inBoxRange(point: Point2D, { x, y, x2, y2 }: BoxRect, axis: 'x' | 'y' | undefined, { borderWidth, hitTolerance }: HitSizeOptions): boolean {
  const hitSize = (borderWidth + hitTolerance) / 2;
  const inRangeX = point.x >= x - hitSize - EPSILON && point.x <= x2 + hitSize + EPSILON;
  const inRangeY = point.y >= y - hitSize - EPSILON && point.y <= y2 + hitSize + EPSILON;
  if (axis === 'x') return inRangeX;
  if (axis === 'y') return inRangeY;
  return inRangeX && inRangeY;
}

export interface RotatedLabelHitOptions extends HitSizeOptions {
  rotation: number;
}

/** Rotates `point` back into the label's own unrotated space (by
 * `-rotation`) before running the plain `inBoxRange` test above \u2014
 * shared by every label-bearing element's own real hit-testing. */
export function inLabelRange(
  point: Point2D,
  { rect, center }: { rect: BoxRect; center: Point2D },
  axis: 'x' | 'y' | undefined,
  { rotation, borderWidth, hitTolerance }: RotatedLabelHitOptions,
): boolean {
  const rotPoint = rotated(point, center, toRadians(-rotation));
  return inBoxRange(rotPoint, rect, axis, { borderWidth, hitTolerance });
}

/** Degrees \u2192 radians \u2014 re-declared locally rather than imported from
 * `chart.js/helpers` in every file that needs it; matches that helper's
 * own real formula exactly. */
export function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** `element.getProps(['centerX', 'centerY'], useFinalPosition)` \u2014 reads
 * the real, FINAL center point (bypassing in-flight animation
 * interpolation when `useFinalPosition` is true), shared by every
 * annotation element's own `getCenterPoint()`. */
export function getElementCenterPoint(element: { getProps(props: string[], final?: boolean): Record<string, number> }, useFinalPosition?: boolean): Point2D {
  const { centerX, centerY } = element.getProps(['centerX', 'centerY'], useFinalPosition);
  return { x: centerX, y: centerY };
}

/** Real semver-ish "is this installed version at least this new"
 * checker \u2014 used once, at plugin registration time, to enforce the
 * real Chart.js >= 4.0 requirement this plugin's own README documents. */
export function requireVersion(pkg: string, min: string, ver: string, strict = true): boolean {
  const parts = ver.split('.');
  let i = 0;
  for (const req of min.split('.')) {
    const act = parts[i++];
    if (parseInt(req, 10) < parseInt(act, 10)) break;
    if (isOlderPart(act, req)) {
      if (strict) {
        throw new Error(`${pkg} v${ver} is not supported. v${min} or newer is required.`);
      }
      return false;
    }
  }
  return true;
}

function isOlderPart(act: string, req: string): boolean {
  return req > act || (act.length > req.length && act.slice(0, req.length) === req);
}

export const isPercentString = (s: unknown): s is string => typeof s === 'string' && s.endsWith('%');
export const toPercent = (s: string): number => parseFloat(s) / 100;
export const toPositivePercent = (s: string): number => clamp(toPercent(s), 0, 1);

/** Resolves a real `'start'`/`'end'`/percent-string/number-fraction
 * position (e.g. a label's own `position`, or a line's own
 * `controlPoint`) against `size` \u2014 shared by label placement and
 * curve-control-point placement alike. */
export function getRelativePosition(size: number, position: number | string | undefined): number {
  if (position === 'start') return 0;
  if (position === 'end') return size;
  if (isPercentString(position)) return toPositivePercent(position) * size;
  return size / 2;
}

/** Resolves a real fixed-number-or-percent-of-`size` value \u2014 shared by
 * width/height/radius-style options across every element type.
 * `positivePercent = false` allows a genuinely *negative* percentage
 * (used for the line annotation's own `controlPoint`, which can curve
 * either direction). */
export function getSize(size: number, value: number | string | undefined, positivePercent = true): number {
  if (typeof value === 'number') return value;
  if (isPercentString(value)) return (positivePercent ? toPositivePercent(value) : toPercent(value)) * size;
  return size;
}
