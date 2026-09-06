/**
 * Hit-testing interaction modes, faithfully ported from
 * `chartjs-plugin-annotation` (v3.1.0, MIT) \u2014 real source dissected
 * directly from the installed package's own real, unminified ESM
 * build. See `geometry.ts`'s own header comment for the full
 * dissection rationale.
 */
import { distanceBetweenPoints } from 'chart.js/helpers';

export interface AnnotationLikeElement {
  _index?: number;
  inRange(x: number, y: number, axis?: 'x' | 'y', useFinalPosition?: boolean): boolean;
  getCenterPoint(useFinalPosition?: boolean): { x: number; y: number };
}

export interface ChartEventLike {
  x: number | null;
  y: number | null;
}

export interface InteractionOptions {
  mode?: 'point' | 'nearest' | 'x' | 'y';
  axis?: 'x' | 'y';
  intersect?: boolean;
}

function inRangeByAxis<T extends AnnotationLikeElement>(element: T, event: ChartEventLike, axis: string | undefined): boolean {
  if (axis !== 'x' && axis !== 'y') {
    return element.inRange(event.x!, event.y!, 'x', true) || element.inRange(event.x!, event.y!, 'y', true);
  }
  return element.inRange(event.x!, event.y!, axis, true);
}

function getPointByAxis(event: ChartEventLike, center: { x: number; y: number }, axis: string | undefined): { x: number; y: number } {
  if (axis === 'x') return { x: event.x!, y: center.y };
  if (axis === 'y') return { x: center.x, y: event.y! };
  return center;
}

function filterElements<T extends AnnotationLikeElement>(visibleElements: T[], event: ChartEventLike, options: InteractionOptions): T[] {
  return visibleElements.filter((element) => (options.intersect ? element.inRange(event.x!, event.y!) : inRangeByAxis(element, event, options.axis)));
}

function getNearestItem<T extends AnnotationLikeElement>(visibleElements: T[], event: ChartEventLike, options: InteractionOptions): T[] {
  let minDistance = Number.POSITIVE_INFINITY;

  return filterElements(visibleElements, event, options)
    .reduce((nearestItems: T[], element) => {
      const center = element.getCenterPoint();
      const evenPoint = getPointByAxis(event, center, options.axis);
      const distance = distanceBetweenPoints(event as { x: number; y: number }, evenPoint);
      if (distance < minDistance) {
        nearestItems = [element];
        minDistance = distance;
      } else if (distance === minDistance) {
        // Multiple items at the same real distance — sort by size below.
        nearestItems.push(element);
      }
      return nearestItems;
    }, [])
    .sort((a, b) => (a._index ?? 0) - (b._index ?? 0))
    .slice(0, 1);
}

/** The real four interaction modes a consumer can pick via
 * `options.interaction.mode` \u2014 `point` intersection-only, `nearest`
 * (closest single element), or an axis-constrained `x`/`y` hit test
 * honoring `options.interaction.intersect`. */
export const interaction = {
  modes: {
    point<T extends AnnotationLikeElement>(visibleElements: T[], event: ChartEventLike): T[] {
      return filterElements(visibleElements, event, { intersect: true });
    },
    nearest<T extends AnnotationLikeElement>(visibleElements: T[], event: ChartEventLike, options: InteractionOptions): T[] {
      return getNearestItem(visibleElements, event, options);
    },
    x<T extends AnnotationLikeElement>(visibleElements: T[], event: ChartEventLike, options: InteractionOptions): T[] {
      return filterElements(visibleElements, event, { intersect: options.intersect, axis: 'x' });
    },
    y<T extends AnnotationLikeElement>(visibleElements: T[], event: ChartEventLike, options: InteractionOptions): T[] {
      return filterElements(visibleElements, event, { intersect: options.intersect, axis: 'y' });
    },
  },
};

/** Resolves which real mode function applies (falling back to
 * `nearest`, the original's own real default when an unknown/absent
 * mode is given) and runs it. */
export function getElements<T extends AnnotationLikeElement>(visibleElements: T[], event: ChartEventLike, options: InteractionOptions): T[] {
  const mode = (options.mode && interaction.modes[options.mode]) || interaction.modes.nearest;
  return mode(visibleElements, event, options);
}
