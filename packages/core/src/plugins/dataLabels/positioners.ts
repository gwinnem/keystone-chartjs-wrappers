/**
 * Per-element-type anchor-point resolution, faithfully ported from
 * `chartjs-plugin-datalabels` (v2.2.0, MIT) \u2014 real source dissected
 * directly from the installed package's own real, unminified ESM
 * build. See `utils.ts`'s own header comment for the full dissection
 * rationale.
 *
 * Each real Chart.js element type (`ArcElement`, `PointElement`,
 * `BarElement`, or anything else \u2014 the real `fallback` case) has its
 * own genuinely different notion of "where does this label anchor by
 * default": an arc's own start/end angle bisector at a given radius, a
 * point's own radius in whichever direction the label is oriented, a
 * bar's own real base-to-tip span, or (for anything else) a plain
 * `x/y/width/height` rectangle. `compute()` below then resolves the
 * real `anchor`/`align`/`clamp` config against whichever of those four
 * segments the caller's own positioner produced \u2014 shared logic every
 * positioner funnels through.
 */
import type { ArcElement, ChartArea } from 'chart.js';

export interface Vector2D {
  x: number;
  y: number;
}

export interface OrientedVector extends Vector2D {
  vx: number;
  vy: number;
}

/** The real per-element-type origin a label's own orientation is
 * computed relative to \u2014 `null` on an axis with no real linear scale
 * at all (radar/polar), matching `orient()`'s own real fallback below. */
export interface PositionerOrigin {
  x: number | null;
  y: number | null;
}

/** The real unit vector from `origin` towards `point` \u2014 falls back to
 * a real, fixed vertical/horizontal direction when either coordinate of
 * `origin` is `null` (the original's own real "no scale on that axis"
 * case, e.g. a radar/polar point with no real linear origin at all). */
export function orient(point: Vector2D, origin: PositionerOrigin): Vector2D {
  if (origin.x === null) return { x: 0, y: -1 };
  if (origin.y === null) return { x: 1, y: 0 };
  const dx = point.x - origin.x;
  const dy = point.y - origin.y;
  const length = Math.sqrt(dx * dx + dy * dy);
  return { x: length ? dx / length : 0, y: length ? dy / length : -1 };
}

/** Resolves the real `align` config (a named direction, `'start'`/
 * `'end'` relative to the segment's own natural orientation, or a real
 * clockwise angle in degrees) against the segment's own real
 * orientation vector \u2014 the original's own real, complete branch set,
 * unchanged. */
export function aligned(x: number, y: number, vx: number, vy: number, align: string | number): OrientedVector {
  switch (align) {
    case 'center':
      return { x, y, vx: 0, vy: 0 };
    case 'bottom':
      return { x, y, vx: 0, vy: 1 };
    case 'right':
      return { x, y, vx: 1, vy: 0 };
    case 'left':
      return { x, y, vx: -1, vy: 0 };
    case 'top':
      return { x, y, vx: 0, vy: -1 };
    case 'start':
      return { x, y, vx: -vx, vy: -vy };
    case 'end':
      return { x, y, vx, vy };
    default: {
      const radians = (align as number) * (Math.PI / 180);
      return { x, y, vx: Math.cos(radians), vy: Math.sin(radians) };
    }
  }
}

// ---- Cohen\u2013Sutherland line clipping ----
// https://en.wikipedia.org/wiki/Cohen%E2%80%93Sutherland_algorithm

const R_INSIDE = 0;
const R_LEFT = 1;
const R_RIGHT = 2;
const R_BOTTOM = 4;
const R_TOP = 8;

interface Segment {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

function region(x: number, y: number, rect: ChartArea): number {
  let res = R_INSIDE;
  if (x < rect.left) res |= R_LEFT;
  else if (x > rect.right) res |= R_RIGHT;
  if (y < rect.top) res |= R_TOP;
  else if (y > rect.bottom) res |= R_BOTTOM;
  return res;
}

/** Clips `segment` to the real chart area's own rectangular bounds \u2014
 * the real Cohen\u2013Sutherland algorithm, unchanged, used by `compute()`
 * below when `clamp: true` keeps a label's own anchor point inside the
 * visible chart area even if its own natural anchor would otherwise
 * fall outside it (e.g. a very thin bar/arc slice). */
export function clipped(segment: Segment, area: ChartArea): Segment {
  let { x0, y0, x1, y1 } = segment;
  let r0 = region(x0, y0, area);
  let r1 = region(x1, y1, area);

  // eslint-disable-next-line no-constant-condition -- a genuine,
  // bounded loop: each iteration strictly narrows the segment against
  // one real clipping edge, terminating once both endpoints share a
  // region or are both inside, matching the original's own real,
  // identical shape.
  while (true) {
    if (!(r0 | r1) || r0 & r1) break;

    const r = r0 || r1;
    let x = 0;
    let y = 0;

    if (r & R_TOP) {
      x = x0 + ((x1 - x0) * (area.top - y0)) / (y1 - y0);
      y = area.top;
    } else if (r & R_BOTTOM) {
      x = x0 + ((x1 - x0) * (area.bottom - y0)) / (y1 - y0);
      y = area.bottom;
    } else if (r & R_RIGHT) {
      y = y0 + ((y1 - y0) * (area.right - x0)) / (x1 - x0);
      x = area.right;
    } else if (r & R_LEFT) {
      y = y0 + ((y1 - y0) * (area.left - x0)) / (x1 - x0);
      x = area.left;
    }

    if (r === r0) {
      x0 = x;
      y0 = y;
      r0 = region(x0, y0, area);
    } else {
      x1 = x;
      y1 = y;
      r1 = region(x1, y1, area);
    }
  }

  return { x0, x1, y0, y1 };
}

export interface PositionerConfig {
  anchor: 'start' | 'end' | 'center';
  align: string | number;
  clamp: boolean;
  area: ChartArea;
  /** The origin a point/bar/fallback element's own orientation is
   * computed relative to \u2014 unused by the `arc` positioner, whose own
   * orientation comes from its own start/end angle instead. */
  origin: PositionerOrigin;
}

/** Resolves the real anchor point (per `config.anchor`) along
 * `range` \u2014 optionally clamped to the real chart area first \u2014 then
 * applies `config.align` against it via `aligned()` above. Shared by
 * every real positioner below. */
function compute(range: Segment & { vx: number; vy: number }, config: PositionerConfig): OrientedVector {
  const segment = config.clamp ? clipped(range, config.area) : range;
  let x: number;
  let y: number;
  if (config.anchor === 'start') {
    x = segment.x0;
    y = segment.y0;
  } else if (config.anchor === 'end') {
    x = segment.x1;
    y = segment.y1;
  } else {
    x = (segment.x0 + segment.x1) / 2;
    y = (segment.y0 + segment.y1) / 2;
  }
  return aligned(x, y, range.vx, range.vy, config.align);
}

export const positioners = {
  /** An arc's own real bisector angle, between its own inner and outer
   * radius. */
  arc(el: ArcElement, config: PositionerConfig): OrientedVector {
    const angle = (el.startAngle + el.endAngle) / 2;
    const vx = Math.cos(angle);
    const vy = Math.sin(angle);
    const r0 = el.innerRadius;
    const r1 = el.outerRadius;
    return compute(
      { x0: el.x + vx * r0, y0: el.y + vy * r0, x1: el.x + vx * r1, y1: el.y + vy * r1, vx, vy },
      config,
    );
  },

  /** A point's own real radius, oriented towards/away from the scale's
   * own origin (`config.origin`). */
  point(el: { x: number; y: number; options: { radius: number } }, config: PositionerConfig): OrientedVector {
    const v = orient(el, config.origin);
    const rx = v.x * el.options.radius;
    const ry = v.y * el.options.radius;
    return compute({ x0: el.x - rx, y0: el.y - ry, x1: el.x + rx, y1: el.y + ry, vx: v.x, vy: v.y }, config);
  },

  /** A bar's own real base-to-tip span, along whichever axis it's
   * drawn on. */
  bar(el: { x: number; y: number; base: number; horizontal?: boolean }, config: PositionerConfig): OrientedVector {
    const v = orient(el, config.origin);
    let x = el.x;
    let y = el.y;
    let sx = 0;
    let sy = 0;
    if (el.horizontal) {
      x = Math.min(el.x, el.base);
      sx = Math.abs(el.base - el.x);
    } else {
      y = Math.min(el.y, el.base);
      sy = Math.abs(el.base - el.y);
    }
    return compute({ x0: x, y0: y + sy, x1: x + sx, y1: y, vx: v.x, vy: v.y }, config);
  },

  /** Any other real Chart.js element \u2014 a plain `x/y/width/height`
   * rectangle. */
  fallback(el: { x: number; y: number; width?: number; height?: number }, config: PositionerConfig): OrientedVector {
    const v = orient(el, config.origin);
    return compute({ x0: el.x, y0: el.y, x1: el.x + (el.width ?? 0), y1: el.y + (el.height ?? 0), vx: v.x, vy: v.y }, config);
  },
};

export type Positioner = (el: never, config: PositionerConfig) => OrientedVector;
