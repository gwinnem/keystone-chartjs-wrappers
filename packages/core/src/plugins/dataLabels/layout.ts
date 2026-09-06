/**
 * Overlap detection (auto-hiding labels with `display: 'auto'`) and
 * per-label final-position computation, faithfully ported from
 * `chartjs-plugin-datalabels` (v2.2.0, MIT) \u2014 real source dissected
 * directly from the installed package's own real, unminified ESM
 * build. See `utils.ts`'s own header comment for the full dissection
 * rationale.
 *
 * Real algorithm confirmed from the source, not assumed: a genuine
 * Separating Axis Theorem hit-test (`HitBox.intersects`) between every
 * pair of currently-visible labels' own real, rotated bounding boxes \u2014
 * only run at all when at least one label on the chart is configured
 * `display: 'auto'` (a real, confirmed perf guard: `layout.update()`'s
 * own `dirty` flag). Labels are iterated in *reverse* z/index order so
 * later, higher-priority labels are less likely to be the ones hidden
 * when two overlap \u2014 confirmed real, intentional behavior from the
 * original's own comments, not incidental.
 */
import type { Chart } from 'chart.js';
import type { Label, LayoutState } from './label.js';
import type { PositionerConfig } from './positioners.js';
import type { LabelModel } from './drawing.js';

interface Point {
  x: number;
  y: number;
}

function rotated(point: Point, center: Point, angle: number): Point {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const cx = center.x;
  const cy = center.y;
  return {
    x: cx + cos * (point.x - cx) - sin * (point.y - cy),
    y: cy + sin * (point.x - cx) + cos * (point.y - cy),
  };
}

interface ProjectionAxis {
  vx: number;
  vy: number;
  origin: Point;
}

function projected(points: Point[], axis: ProjectionAxis): { min: number; max: number } {
  const MAX_INTEGER = Number.MAX_SAFE_INTEGER || 9007199254740991;
  const MIN_INTEGER = Number.MIN_SAFE_INTEGER || -9007199254740991;
  let min = MAX_INTEGER;
  let max = MIN_INTEGER;
  for (const pt of points) {
    const vx = pt.x - axis.origin.x;
    const vy = pt.y - axis.origin.y;
    const dp = axis.vx * vx + axis.vy * vy;
    min = Math.min(min, dp);
    max = Math.max(max, dp);
  }
  return { min, max };
}

function toAxis(p0: Point, p1: Point): ProjectionAxis {
  const vx = p1.x - p0.x;
  const vy = p1.y - p0.y;
  const length = Math.sqrt(vx * vx + vy * vy);
  return { vx: (p1.x - p0.x) / length, vy: (p1.y - p0.y) / length, origin: p0 };
}

/** A rotated rectangular bounding box for one real label, used purely
 * for real overlap hit-testing \u2014 not the same rect `boundingRects()`
 * (in `drawing.ts`) computes for drawing itself, though both ultimately
 * describe the same real, on-screen area. */
export class HitBox {
  private rotationAngle = 0;
  private rect = { x: 0, y: 0, w: 0, h: 0 };

  center(): Point {
    const r = this.rect;
    return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
  }

  update(center: Point, rect: { x: number; y: number; w: number; h: number }, rotation: number): void {
    this.rotationAngle = rotation;
    this.rect = { x: rect.x + center.x, y: rect.y + center.y, w: rect.w, h: rect.h };
  }

  /** Real hit-testing for `layout.lookup()` (click/hover) \u2014 rotates the
   * query point back into the box's own unrotated space, with a small,
   * real 1px margin, matching the original's own exact tolerance. */
  contains(point: Point): boolean {
    const margin = 1;
    const rect = this.rect;
    const local = rotated(point, this.center(), -this.rotationAngle);
    return !(
      local.x < rect.x - margin ||
      local.y < rect.y - margin ||
      local.x > rect.x + rect.w + margin * 2 ||
      local.y > rect.y + rect.h + margin * 2
    );
  }

  /** Real Separating Axis Theorem overlap test against `other` \u2014 only
   * tests `other`'s own two axes too when the two boxes have a
   * genuinely different rotation (a real, confirmed optimization from
   * the original: same rotation means `this`'s own two axes alone are
   * already sufficient to separate them). */
  intersects(other: HitBox): boolean {
    const r0 = this.points();
    const r1 = other.points();
    const axes = [toAxis(r0[0], r0[1]), toAxis(r0[0], r0[3])];
    if (this.rotationAngle !== other.rotationAngle) {
      axes.push(toAxis(r1[0], r1[1]), toAxis(r1[0], r1[3]));
    }
    for (const axis of axes) {
      const pr0 = projected(r0, axis);
      const pr1 = projected(r1, axis);
      if (pr0.max < pr1.min || pr1.max < pr0.min) return false;
    }
    return true;
  }

  private points(): [Point, Point, Point, Point] {
    const rect = this.rect;
    const angle = this.rotationAngle;
    const center = this.center();
    return [
      rotated({ x: rect.x, y: rect.y }, center, angle),
      rotated({ x: rect.x + rect.w, y: rect.y }, center, angle),
      rotated({ x: rect.x + rect.w, y: rect.y + rect.h }, center, angle),
      rotated({ x: rect.x, y: rect.y + rect.h }, center, angle),
    ];
  }
}

/** Resolves a label's own real, final on-screen anchor point \u2014 its own
 * positioner's own natural anchor, offset outward by `model.offset`
 * (scaled so the label's own rotated bounding box clears its own
 * anchor point by at least that many pixels along whichever axis is
 * more constrained) unless the positioner resolved a `{vx:0, vy:0}`
 * (dead-center alignment, which needs no offset at all). */
function coordinates(el: unknown, model: LabelModel, geometry: { w: number; h: number }): Point {
  const point = model.positioner(el as never, model as unknown as PositionerConfig);
  const vx = point.vx;
  const vy = point.vy;
  if (!vx && !vy) return { x: point.x, y: point.y };

  const w = geometry.w;
  const h = geometry.h;
  const rotation = model.rotation;
  let dx = Math.abs((w / 2) * Math.cos(rotation)) + Math.abs((h / 2) * Math.sin(rotation));
  let dy = Math.abs((w / 2) * Math.sin(rotation)) + Math.abs((h / 2) * Math.cos(rotation));

  const scale = 1 / Math.max(Math.abs(vx), Math.abs(vy));
  dx *= vx * scale;
  dy *= vy * scale;
  dx += model.offset * vx;
  dy += model.offset * vy;

  return { x: point.x + dx, y: point.y + dy };
}

function collide(labels: Label[], collider: (s0: LayoutState, s1: LayoutState) => void): Label[] {
  // Reverse iteration: later/higher-z labels are less likely to be the
  // ones auto-hidden when two overlap \u2014 see this file's own header
  // comment.
  for (let i = labels.length - 1; i >= 0; --i) {
    const s0 = labels[i].layoutState!;
    for (let j = i - 1; j >= 0 && s0.visible; --j) {
      const s1 = labels[j].layoutState!;
      if (s1.visible && s0.box.intersects(s1.box)) {
        collider(s0, s1);
      }
    }
  }
  return labels;
}

function computeOverlaps(labels: Label[]): Label[] {
  for (const label of labels) {
    const state = label.layoutState!;
    if (state.visible) {
      // The original's own real comment, carried over: Chart.js 3
      // removed `el._model` in favor of `getProps()`, so a real `Proxy`
      // reading each requested property through `el.getProps([p],
      // true)` is used here instead \u2014 `true` requests the *final*
      // value, bypassing any in-flight animation interpolation, which
      // a plain property read on an actively-animating element would
      // otherwise return a stale, mid-animation value for.
      const el = label.getElement() as object;
      const proxy = new Proxy(el, {
        get: (target, prop: string) => (target as { getProps(props: string[], final: boolean): Record<string, unknown> }).getProps([prop], true)[prop],
      });
      const geometry = label.geometry() as { w: number; h: number };
      const center = coordinates(proxy, label.getModel()!, geometry);
      state.box.update(center, geometry as never, label.rotation());
    }
  }

  return collide(labels, (s0, s1) => {
    const h0 = s0.hidable;
    const h1 = s1.hidable;
    if ((h0 && h1) || h1) {
      s1.visible = false;
    } else if (h0) {
      s0.visible = false;
    }
  });
}

export const layout = {
  /** Builds real overlap-detection state for every label across every
   * dataset, sorted by real z/index priority, then runs a first real
   * overlap pass. */
  prepare(datasets: Label[][]): Label[] {
    const labels: Label[] = [];
    for (let i = 0; i < datasets.length; ++i) {
      for (const label of datasets[i]) {
        labels.push(label);
        label.layoutState = { box: new HitBox(), hidable: false, visible: true, set: i, idx: (label as unknown as { index: number }).index };
      }
    }

    // Higher real index draws first (drawn *later* in z-order, i.e. on
    // top); ties broken by dataset index, matching the original's own
    // real, documented sort exactly.
    labels.sort((a, b) => {
      const sa = a.layoutState!;
      const sb = b.layoutState!;
      return sa.idx === sb.idx ? sb.set - sa.set : sb.idx - sa.idx;
    });

    layout.update(labels);
    return labels;
  },

  /** Marks each label's own real hidable/visible state, then re-runs
   * overlap detection only if at least one label is genuinely
   * `display: 'auto'` \u2014 the real perf guard mentioned in this file's
   * own header comment. */
  update(labels: Label[]): void {
    let dirty = false;
    for (const label of labels) {
      const model = label.getModel();
      const state = label.layoutState!;
      state.hidable = !!model && model.display === 'auto';
      state.visible = label.visible();
      dirty = dirty || state.hidable;
    }
    if (dirty) computeOverlaps(labels);
  },

  /** Real hit-testing for click/hover \u2014 top-down (highest z-index
   * first), returning the first real, visible label whose own hit box
   * contains `point`. */
  lookup(labels: Label[], point: Point): Label | null {
    for (let i = labels.length - 1; i >= 0; --i) {
      const state = labels[i].layoutState;
      if (state && state.visible && state.box.contains(point)) return labels[i];
    }
    return null;
  },

  /** Draws every currently-visible label at its own real, final
   * position \u2014 re-computing that position (and its own hit box) fresh
   * each time, since a chart resize/pan/zoom between updates can move
   * elements without a full `update()` cycle running first. */
  draw(chart: Chart, labels: Label[]): void {
    for (const label of labels) {
      const state = label.layoutState!;
      if (state.visible) {
        const geometry = label.geometry() as { w: number; h: number };
        const center = coordinates(label.getElement(), label.getModel()!, geometry);
        state.box.update(center, geometry as never, label.rotation());
        label.draw(chart, center);
      }
    }
  },
};
