/**
 * Scale min/max auto-adjustment, faithfully ported from
 * `chartjs-plugin-annotation` (v3.1.0, MIT) \u2014 real source dissected
 * directly from the installed package's own real, unminified ESM
 * build. See `geometry.ts`'s own header comment for the full
 * dissection rationale.
 *
 * When an annotation's own `adjustScaleRange` is true (the real
 * default for every box-like/line/point/polygon type), an annotation
 * placed beyond a scale's own natural data range extends that scale's
 * own `suggestedMin`/`suggestedMax` to make room for it \u2014 confirmed
 * real behavior: only applies when the scale itself hasn't already set
 * a real, explicit `min`/`max`/`suggestedMin`/`suggestedMax` of its own.
 */
import { defined, isFinite as chartIsFinite, isFunction, valueOrDefault } from 'chart.js/helpers';
import type { Scale } from 'chart.js';
import { retrieveScaleID } from './boxProperties.js';

export interface ScaleRangeAnnotation {
  id?: string;
  scaleID?: string;
  xScaleID?: string;
  yScaleID?: string;
  value?: unknown;
  endValue?: unknown;
  xMin?: unknown;
  xMax?: unknown;
  xValue?: unknown;
  yMin?: unknown;
  yMax?: unknown;
  yValue?: unknown;
}

/** Extends `scale`'s own real `suggestedMin`/`suggestedMax` to fit
 * every real annotation bound to it, if neither is already explicitly
 * set \u2014 calls the scale's own real `handleTickRangeOptions()` hook
 * afterwards when either value actually changed (confirmed real:
 * Chart.js's own scale implementations use this hook to re-derive
 * their own tick set from the new range). */
export function adjustScaleRange(chart: { scales: Record<string, Scale> }, scale: Scale, annotations: ScaleRangeAnnotation[]): void {
  const range = getScaleLimits(chart.scales, scale, annotations);
  let changed = changeScaleLimit(scale, range, 'min', 'suggestedMin');
  changed = changeScaleLimit(scale, range, 'max', 'suggestedMax') || changed;
  if (changed && isFunction((scale as unknown as { handleTickRangeOptions?: unknown }).handleTickRangeOptions)) {
    (scale as unknown as { handleTickRangeOptions(): void }).handleTickRangeOptions();
  }
}

export function verifyScaleOptions(annotations: ScaleRangeAnnotation[], scales: Record<string, Scale>): void {
  for (const annotation of annotations) {
    verifyScaleIDs(annotation, scales);
  }
}

function changeScaleLimit(scale: Scale, range: { min: number; max: number }, limit: 'min' | 'max', suggestedLimit: 'suggestedMin' | 'suggestedMax'): boolean {
  if (chartIsFinite(range[limit]) && !scaleLimitDefined(scale.options as unknown as Record<string, unknown>, limit, suggestedLimit)) {
    const changed = (scale as unknown as Record<string, number>)[limit] !== range[limit];
    (scale as unknown as Record<string, number>)[limit] = range[limit];
    return changed;
  }
  return false;
}

function scaleLimitDefined(scaleOptions: Record<string, unknown>, limit: string, suggestedLimit: string): boolean {
  return defined(scaleOptions[limit]) || defined(scaleOptions[suggestedLimit]);
}

function verifyScaleIDs(annotation: ScaleRangeAnnotation, scales: Record<string, Scale>): void {
  for (const key of ['scaleID', 'xScaleID', 'yScaleID'] as const) {
    const scaleID = retrieveScaleID(scales, annotation as never, key);
    if (scaleID && !scales[scaleID] && verifyProperties(annotation, key)) {
      console.warn(`No scale found with id '${scaleID}' for annotation '${annotation.id}'`);
    }
  }
}

function verifyProperties(annotation: ScaleRangeAnnotation, key: string): boolean {
  if (key === 'scaleID') return true;
  const axis = key.charAt(0);
  for (const prop of ['Min', 'Max', 'Value']) {
    if (defined((annotation as unknown as Record<string, unknown>)[axis + prop])) return true;
  }
  return false;
}

function getScaleLimits(scales: Record<string, Scale>, scale: Scale, annotations: ScaleRangeAnnotation[]): { min: number; max: number } {
  const axis = (scale as unknown as { axis: string }).axis;
  const scaleID = scale.id;
  const scaleIDOption = axis + 'ScaleID';
  const limits = {
    min: valueOrDefault(scale.min, Number.NEGATIVE_INFINITY),
    max: valueOrDefault(scale.max, Number.POSITIVE_INFINITY),
  };
  for (const annotation of annotations) {
    if (annotation.scaleID === scaleID) {
      updateLimits(annotation, scale, ['value', 'endValue'], limits);
    } else if (retrieveScaleID(scales, annotation as never, scaleIDOption as never) === scaleID) {
      updateLimits(annotation, scale, [axis + 'Min', axis + 'Max', axis + 'Value'], limits);
    }
  }
  return limits;
}

function updateLimits(annotation: ScaleRangeAnnotation, scale: Scale, props: string[], limits: { min: number; max: number }): void {
  for (const prop of props) {
    const raw = (annotation as unknown as Record<string, unknown>)[prop];
    if (defined(raw)) {
      const value = scale.parse(raw as never) as number;
      limits.min = Math.min(limits.min, value);
      limits.max = Math.max(limits.max, value);
    }
  }
}
