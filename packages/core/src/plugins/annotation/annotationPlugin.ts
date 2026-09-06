/**
 * Local port of `chartjs-plugin-annotation` (v3.1.0, MIT, chartjs-
 * plugin-annotation contributors), supplied via
 * `Chart.register(annotationPlugin)` instead of a dependency \u2014 real
 * source dissected directly from the installed package's own real,
 * unminified ESM build (`dist/chartjs-plugin-annotation.esm.js` \u2014 the
 * published package ships no real `src/` of its own, only
 * `dist/*`/`types/*`, but the ESM build is genuinely unminified and
 * complete, making a precise, line-by-line dissection possible the
 * same way the installed `dist` output already was for `gradient`/
 * `autocolors`/`dataLabels`).
 *
 * By far the largest and most architecturally distinct port in this
 * project: seven real annotation *types* (`box`, `doughnutLabel`,
 * `ellipse`, `label`, `line`, `point`, `polygon`) are each their own
 * genuine Chart.js `Element` subclass (`../elements/*.ts`), registered
 * via `Chart.register(annotationTypes)` in this file's own
 * `afterRegister()` hook \u2014 the same real mechanism Chart.js's own
 * built-in elements (`ArcElement`, `BarElement`, \u2026) use, not merely a
 * plugin object drawing shapes on top of the chart.
 *
 * This file corresponds to the original's own top-level `index.js`:
 * resolving each annotation's own real, final options (against its own
 * element class's `defaults`/`defaultRoutes`, Chart.js's own real
 * scriptable-option resolution machinery), animating updates via
 * Chart.js's own real `Animations` class, and orchestrating draw order
 * across every annotation's own configured `drawTime`.
 *
 * A real, deliberate structural improvement over the original's own
 * design, not a behavior change: the original keys its own per-chart
 * bookkeeping in a plain `Map` (not even a `WeakMap`), relying entirely
 * on its own `afterDestroy` hook to `.delete()` the entry \u2014 this port
 * uses a `WeakMap` instead, matching the identical real improvement
 * `deferredPlugin.ts`'s/`dataLabelsPlugin.ts`'s own ports already made
 * for the same class of chart-keyed lookup.
 */
import { Chart, Animations, defaults as chartDefaults } from 'chart.js';
import type { ChartEvent, Plugin, UpdateMode } from 'chart.js';
import { clipArea, isArray, isFunction, isObject, unclipArea } from 'chart.js/helpers';
import { requireVersion } from './geometry.js';
import { getElements } from './interaction.js';
import { adjustScaleRange, verifyScaleOptions, type ScaleRangeAnnotation } from './scaleRange.js';
import { updateListeners, handleEvent, eventHooks, type EventState, type AnnotationElementLike } from './events.js';
import { updateHooks, invokeHook, elementHooks, type HooksState } from './hooks.js';
import { BoxAnnotation } from './elements/boxAnnotation.js';
import { DoughnutLabelAnnotation } from './elements/doughnutLabelAnnotation.js';
import { EllipseAnnotation } from './elements/ellipseAnnotation.js';
import { LabelAnnotation } from './elements/labelAnnotation.js';
import { LineAnnotation } from './elements/lineAnnotation.js';
import { PointAnnotation } from './elements/pointAnnotation.js';
import { PolygonAnnotation } from './elements/polygonAnnotation.js';

const version = '3.1.0';
void isFunction;

/** Every real annotation element class this plugin registers \u2014 keyed
 * by the real `type` string a consumer's own `annotations.<id>.type`
 * picks. */
const annotationTypes: Record<string, { new (): unknown; id: string; defaults: Record<string, unknown>; defaultRoutes?: Record<string, string>; descriptors?: Record<string, unknown> }> = {
  box: BoxAnnotation as never,
  doughnutLabel: DoughnutLabelAnnotation as never,
  ellipse: EllipseAnnotation as never,
  label: LabelAnnotation as never,
  line: LineAnnotation as never,
  point: PointAnnotation as never,
  polygon: PolygonAnnotation as never,
};

/** Real fallback for annotation elements' own scriptable options \u2014
 * for example a real `lineAnnotation` option is looked up through: the
 * annotation object itself (`options.plugins.annotation.
 * annotations[id]`), then per-kind element options
 * (`options.elements.lineAnnotation`), then per-kind element defaults
 * (`defaults.elements.lineAnnotation`), then this plugin's own real
 * defaults (`defaults.plugins.annotation.common`) \u2014 registered once,
 * at module load, matching the original's own real, identical
 * top-level side effect. */
Object.keys(annotationTypes).forEach((key) => {
  chartDefaults.describe(`elements.${annotationTypes[key].id}`, {
    _fallback: 'plugins.annotation.common',
  });
});

const directUpdater = { update: Object.assign };
const hooks = [...eventHooks, ...elementHooks];
const isNotDoughnutLabel = (annotation: { type?: string }) => annotation.type !== 'doughnutLabel';

function isIndexable(prop: string): boolean {
  return prop === 'color' || prop === 'font';
}

function resolveType(type = 'line'): string {
  if (annotationTypes[type]) return type;
  console.warn(`Unknown annotation type: '${type}', defaulting to 'line'`);
  return 'line';
}

function resolveValue(value: unknown, optDefs: unknown): unknown {
  return isObject(optDefs) ? resolveObj(value as never, optDefs as never) : value;
}

function resolveObj(resolver: Record<string, unknown>, defs: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const prop of Object.keys(defs)) {
    const optDefs = defs[prop];
    const value = resolver[prop];
    if (isIndexable(prop) && isArray(value)) {
      result[prop] = (value as unknown[]).map((item) => resolveValue(item, optDefs));
    } else {
      result[prop] = resolveValue(value, optDefs);
    }
  }
  return result;
}

interface ResolvedAnnotationOptions {
  id?: string;
  type: string;
  drawTime?: string;
  [key: string]: unknown;
}

function resolveAnnotationOptions(resolver: Record<string, unknown> & { type?: string; id?: string; drawTime?: string }): ResolvedAnnotationOptions {
  const elementClass = annotationTypes[resolveType(resolver.type)];
  const result: ResolvedAnnotationOptions = { type: resolver.type ?? 'line' };
  result.id = resolver.id;
  result.drawTime = resolver.drawTime;
  Object.assign(result, resolveObj(resolver, elementClass.defaults), resolveObj(resolver, elementClass.defaultRoutes ?? {}));
  for (const hook of hooks) {
    result[hook] = resolver[hook];
  }
  return result;
}

interface AnnotationElementInstance {
  x?: number;
  $context?: unknown;
  elements?: unknown;
  options?: unknown;
  resolveElementProperties(chart: Chart, resolver: unknown): Record<string, unknown>;
  [key: string]: unknown;
}

function getOrCreateElement(elements: (AnnotationElementInstance | undefined)[], index: number, type: string, initProperties?: unknown): AnnotationElementInstance {
  const ElementClass = annotationTypes[resolveType(type)];
  let element = elements[index];
  if (!element || !(element instanceof ElementClass)) {
    element = new ElementClass() as unknown as AnnotationElementInstance;
    Object.assign(element, initProperties);
    elements[index] = element;
  }
  return element;
}

function resolveAnimations(chart: Chart, animOpts: unknown, mode: UpdateMode): { update: typeof Object.assign } | Animations {
  if (mode === 'reset' || mode === 'none' || mode === 'resize') return directUpdater;
  return new Animations(chart as never, animOpts as never);
}

function updateSubElements(mainElement: AnnotationElementInstance, elementDefs: { type: string; optionScope: string; properties: Record<string, unknown>; initProperties?: unknown }[], resolver: Record<string, unknown>, animations: { update(el: unknown, properties: unknown): void }): void {
  const subElements = (mainElement.elements as (AnnotationElementInstance | undefined)[]) ?? ((mainElement.elements as unknown) = [] as never);
  (subElements as unknown[]).length = elementDefs.length;
  for (let i = 0; i < elementDefs.length; i++) {
    const definition = elementDefs[i];
    const properties = definition.properties as Record<string, unknown> & { options?: unknown };
    const subElement = getOrCreateElement(subElements as never, i, definition.type, definition.initProperties);
    const scopeResolver = resolver[definition.optionScope] as { override(def: unknown): Record<string, unknown> };
    const subResolver = scopeResolver.override(definition);
    properties.options = resolveAnnotationOptions(subResolver as never);
    animations.update(subElement, properties);
  }
}

function toSkip(properties: { x: number; y: number }): boolean {
  return isNaN(properties.x) || isNaN(properties.y);
}

function isDefinedNumber(value: unknown): boolean {
  return typeof value === 'number' && !isNaN(value);
}

function getContext(chart: Chart, element: AnnotationElementInstance, elements: (AnnotationElementInstance | undefined)[], annotation: Record<string, unknown> & { id?: string }): unknown {
  return (
    element.$context ??
    (element.$context = Object.assign(Object.create((chart as unknown as { getContext(): unknown }).getContext() as object), {
      element,
      get elements() {
        return elements.filter((el) => el && el.options);
      },
      id: annotation.id,
      type: 'annotation',
    }))
  );
}

function updateElements(chart: Chart, state: { annotations: Record<string, unknown>[]; elements: (AnnotationElementInstance | undefined)[] }, options: Record<string, unknown> & { animations?: unknown }, mode: UpdateMode): void {
  const animations = resolveAnimations(chart, options.animations, mode);
  const annotations = state.annotations;
  const elements = resyncElements(state.elements, annotations);

  for (let i = 0; i < annotations.length; i++) {
    const annotationOptions = annotations[i] as Record<string, unknown> & { type?: string; setContext(context: unknown): Record<string, unknown> };
    const element = getOrCreateElement(elements, i, annotationOptions.type ?? 'line');
    const resolver = annotationOptions.setContext(getContext(chart, element, elements, annotationOptions));
    const properties = element.resolveElementProperties(chart, resolver) as Record<string, unknown> & { x?: number; y?: number; skip?: boolean; elements?: unknown; initProperties?: unknown; options?: unknown };

    properties.skip = toSkip(properties as never);

    if ('elements' in properties) {
      updateSubElements(element, properties.elements as never, resolver, animations as never);
      delete properties.elements;
    }

    if (!isDefinedNumber(element.x)) {
      Object.assign(element, properties);
    }

    Object.assign(element, properties.initProperties);
    properties.options = resolveAnnotationOptions(resolver as never);

    (animations as { update(el: unknown, properties: unknown): void }).update(element, properties);
  }
}

function resyncElements(elements: (AnnotationElementInstance | undefined)[], annotations: unknown[]): (AnnotationElementInstance | undefined)[] {
  const count = annotations.length;
  const start = elements.length;
  if (start < count) {
    const add = count - start;
    elements.splice(start, 0, ...new Array<undefined>(add));
  } else if (start > count) {
    elements.splice(count, start - count);
  }
  return elements;
}

interface ChartState extends EventState, HooksState {
  elements: (AnnotationElementInstance | undefined)[];
}

const chartStates = new WeakMap<Chart, ChartState>();

function draw(chart: Chart, caller: string, clip: boolean): void {
  const { ctx, chartArea } = chart;
  const state = chartStates.get(chart);
  if (!state) return;

  if (clip) clipArea(ctx as never, chartArea as never);

  const drawableElements = getDrawableElements(state.visibleElements, caller).sort((a, b) => ((a.element.options as { z: number }).z ?? 0) - ((b.element.options as { z: number }).z ?? 0));
  for (const item of drawableElements) {
    drawElement(ctx, state, item);
  }

  if (clip) unclipArea(ctx as never);
}

interface DrawableItem {
  element: AnnotationElementInstance & { draw(ctx: CanvasRenderingContext2D): void; options: Record<string, unknown> };
  main?: boolean;
}

function getDrawableElements(elements: AnnotationElementLike[], caller: string): DrawableItem[] {
  const drawableElements: DrawableItem[] = [];
  for (const el of elements as unknown as (AnnotationElementInstance & { draw(ctx: CanvasRenderingContext2D): void; options: Record<string, unknown>; elements?: { options: Record<string, unknown>; draw(ctx: CanvasRenderingContext2D): void }[] })[]) {
    if (el.options.drawTime === caller) {
      drawableElements.push({ element: el as never, main: true });
    }
    if (el.elements && el.elements.length) {
      for (const sub of el.elements) {
        if (sub.options.display && sub.options.drawTime === caller) {
          drawableElements.push({ element: sub as never });
        }
      }
    }
  }
  return drawableElements;
}

function drawElement(ctx: CanvasRenderingContext2D, state: HooksState, item: DrawableItem): void {
  const el = item.element;
  if (item.main) {
    invokeHook(state, el as never, 'beforeDraw');
    el.draw(ctx);
    invokeHook(state, el as never, 'afterDraw');
  } else {
    el.draw(ctx);
  }
}

/**
 * Chart.js plugin drawing real lines, boxes, points, labels, polygons,
 * ellipses, and a real centered doughnut-label on the chart area.
 *
 * Registered via `Chart.register(annotationPlugin)`, with every real
 * annotation *element* additionally registered via
 * `Chart.register(annotationTypes)` in `afterRegister()` below.
 */
export const annotationPlugin = {
  id: 'annotation',

  version,

  beforeRegister(): void {
    requireVersion('chart.js', '4.0', Chart.version);
  },

  afterRegister(): void {
    Chart.register(Object.values(annotationTypes) as never);
  },

  afterUnregister(): void {
    Chart.unregister(Object.values(annotationTypes) as never);
  },

  beforeInit(chart: Chart): void {
    chartStates.set(chart, {
      annotations: [],
      elements: [],
      visibleElements: [],
      listeners: {},
      listened: false,
      moveListened: false,
      hooks: {},
      hooked: false,
      hovered: [],
    });
  },

  beforeUpdate(chart: Chart, _args: unknown, options: Record<string, unknown> & { annotations?: unknown }): void {
    const state = chartStates.get(chart);
    if (!state) return;
    const annotations: Record<string, unknown>[] = [];
    state.annotations = annotations;

    const annotationOptions = options.annotations;
    if (isObject(annotationOptions)) {
      Object.keys(annotationOptions as object).forEach((key) => {
        const value = (annotationOptions as Record<string, unknown>)[key];
        if (isObject(value)) {
          (value as Record<string, unknown>).id = key;
          annotations.push(value as never);
        }
      });
    } else if (isArray(annotationOptions)) {
      annotations.push(...(annotationOptions as Record<string, unknown>[]));
    }
    verifyScaleOptions(annotations.filter(isNotDoughnutLabel as never) as ScaleRangeAnnotation[], chart.scales);
  },

  afterDataLimits(chart: Chart, args: { scale: never }): void {
    const state = chartStates.get(chart);
    if (!state) return;
    adjustScaleRange(
      chart as never,
      args.scale,
      state.annotations.filter(isNotDoughnutLabel as never).filter((a) => (a as { display?: boolean }).display && (a as { adjustScaleRange?: boolean }).adjustScaleRange) as ScaleRangeAnnotation[],
    );
  },

  afterUpdate(chart: Chart, args: { mode: UpdateMode }, options: Record<string, unknown>): void {
    const state = chartStates.get(chart);
    if (!state) return;
    updateListeners(chart, state as never, options as never);
    updateElements(chart, state as never, options, args.mode);
    state.visibleElements = (state.elements as AnnotationElementInstance[]).filter((el) => el && !(el as { skip?: boolean }).skip && (el.options as { display?: boolean })?.display) as never;
    updateHooks(chart, state as never, options as never, state.visibleElements as never);
  },

  beforeDatasetsDraw(chart: Chart, _args: unknown, options: Record<string, unknown> & { clip?: boolean }): void {
    draw(chart, 'beforeDatasetsDraw', !!options.clip);
  },

  afterDatasetsDraw(chart: Chart, _args: unknown, options: Record<string, unknown> & { clip?: boolean }): void {
    draw(chart, 'afterDatasetsDraw', !!options.clip);
  },

  beforeDatasetDraw(chart: Chart, args: { index: number }, options: Record<string, unknown> & { clip?: boolean }): void {
    draw(chart, String(args.index), !!options.clip);
  },

  beforeDraw(chart: Chart, _args: unknown, options: Record<string, unknown> & { clip?: boolean }): void {
    draw(chart, 'beforeDraw', !!options.clip);
  },

  afterDraw(chart: Chart, _args: unknown, options: Record<string, unknown> & { clip?: boolean }): void {
    draw(chart, 'afterDraw', !!options.clip);
  },

  beforeEvent(chart: Chart, args: { event: ChartEvent; changed?: boolean }, options: Record<string, unknown>): void {
    const state = chartStates.get(chart);
    if (!state) return;
    if (handleEvent(state as never, args.event as never, options as never)) {
      args.changed = true;
    }
  },

  afterDestroy(chart: Chart): void {
    chartStates.delete(chart);
  },

  getAnnotations(chart: Chart): unknown[] {
    const state = chartStates.get(chart);
    return state ? state.elements : [];
  },

  // Only for testing, matching the original's own real, identically
  // underscore-prefixed testing-only method \u2014 delegates directly to
  // the real interaction-mode resolver every real click/hover event
  // dispatch already uses.
  _getAnnotationElementsAtEventForMode(visibleElements: never, event: never, options: never): unknown {
    return getElements(visibleElements, event, options);
  },

  defaults: {
    animations: {
      numbers: {
        properties: ['x', 'y', 'x2', 'y2', 'width', 'height', 'centerX', 'centerY', 'pointX', 'pointY', 'radius'],
        type: 'number',
      },
      colors: {
        properties: ['backgroundColor', 'borderColor'],
        type: 'color',
      },
    },
    clip: true,
    interaction: {
      mode: undefined,
      axis: undefined,
      intersect: undefined,
    },
    common: {
      drawTime: 'afterDatasetsDraw',
      init: false,
      label: {},
    },
  },

  descriptors: {
    _indexable: false,
    _scriptable: (prop: string) => !hooks.includes(prop) && prop !== 'init',
    annotations: {
      _allKeys: false,
      _fallback: (_prop: string, opts: { type?: string }) => `elements.${annotationTypes[resolveType(opts.type)].id}`,
    },
    interaction: {
      _fallback: true,
    },
    common: {
      label: {
        _indexable: isIndexable,
        _fallback: true,
      },
      _indexable: isIndexable,
    },
  },

  additionalOptionScopes: [''],
} as unknown as Plugin & { version: string };
