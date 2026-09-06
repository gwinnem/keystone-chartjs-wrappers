/**
 * Local port of chartjs-plugin-datalabels (v2.2.0, MIT, chartjs-
 * plugin-datalabels contributors), supplied via
 * Chart.register(dataLabelsPlugin) instead of a dependency, so it
 * avoids the docs-site dynamic-import hydration gap the still-
 * dependency-based plugins in this project hit (item #4 in
 * docs/IMPLEMENTATION_PLAN.md).
 *
 * Real source dissected directly from the installed package's own
 * real, unminified ESM build (dist/chartjs-plugin-datalabels.esm.js -
 * the published package ships no real src/ of its own, only
 * dist/*\/types/*, but the ESM build is genuinely unminified and
 * complete, making a precise, line-by-line dissection possible here the
 * same way the installed dist output already was for gradient/
 * autocolors). Mirrored across utils.ts/positioners.ts/drawing.ts/
 * label.ts/layout.ts, matching the original's own real logical module
 * split, with this file corresponding to the original's own top-level
 * plugin.js.
 *
 * A real, non-trivial feature set found only by reading the source, not
 * fully apparent from the README alone: (1) real overlap detection -
 * display: 'auto' labels auto-hide via a genuine Separating Axis
 * Theorem hit-test against every other visible label's own rotated
 * bounding box (see layout.ts); (2) real click/enter/leave event
 * listeners, dispatched via a genuine hit-test against each label's own
 * current position, not the underlying data element's own hit area;
 * (3) real active-element (hover) integration - when Chart.js's own
 * active-elements set changes, every label on the affected element gets
 * its own context.active flag toggled (true on entering the active set,
 * false on leaving it - both directions, confirmed directly from the
 * original's own real update[1]/update[1] === 1 logic, not just the
 * "entering" half) and re-resolved; (4) real support for multiple,
 * independently-configured labels per data point (options.labels), each
 * with its own real event listeners keyed by label name.
 *
 * A real, deliberate structural improvement over the original's own
 * design, not a behavior change: the original stores its own real
 * per-chart bookkeeping (_actives, _listened, _listeners, _datasets,
 * _labels, _hovered, _dirty) and per-element label arrays as ad-hoc
 * properties monkey-patched directly onto the live chart instance and
 * its own data elements (chart.$datalabels, element.$datalabels) - this
 * port uses two module-level WeakMaps instead, keyed by the real
 * chart/element object, matching the same real improvement
 * deferredPlugin.ts's own port already made for an identical class of
 * pattern (chart.$deferred/element.$chartjs_deferred).
 *
 * Real, confirmed listener-map shape (three levels, not two): the
 * original's own real dispatchEvent() reads listeners[$groups.set]
 * (the dataset index) then [$groups.key] (the label key) - so the
 * chart-wide registry built up across every dataset's own
 * afterDatasetUpdate call is keyed event -> datasetIndex -> labelKey,
 * one level deeper than the per-dataset listeners configureDataset()
 * itself resolves (event -> labelKey).
 */
import { Chart, type ChartEvent, type ChartMeta, type Plugin } from 'chart.js';
import { callback, isObject, merge, each, isNullOrUndef } from 'chart.js/helpers';
import { Label } from './label.js';
import { layout } from './layout.js';
import { arrayDiff } from './utils.js';
import type { DataLabelsConfig, DataLabelsContext, ChartConfigDataset } from '../../types.js';

// ---- default value formatter ----

function defaultFormatter(value: unknown): string | null {
  if (isNullOrUndef(value)) return null;
  let label: unknown = value;
  if (isObject(value)) {
    const obj = value as Record<string, unknown>;
    if (!isNullOrUndef(obj.label)) {
      label = obj.label;
    } else if (!isNullOrUndef(obj.r)) {
      label = obj.r;
    } else {
      const keys = Object.keys(obj);
      label = keys.map((k) => `${k}: ${obj[k]}`).join(', ');
    }
  }
  return `${label}`;
}

/**
 * The real, complete set of plugin-level defaults - confirmed directly
 * from the installed package's own real defaults object, not
 * reconstructed from the README (which documents most, but not all, of
 * these).
 */
export const dataLabelsDefaults: DataLabelsConfig = {
  align: 'center',
  anchor: 'center',
  backgroundColor: null,
  borderColor: null,
  borderRadius: 0,
  borderWidth: 0,
  clamp: false,
  clip: false,
  color: undefined,
  display: true,
  font: { family: undefined, lineHeight: 1.2, size: undefined, style: undefined, weight: null },
  formatter: defaultFormatter,
  labels: undefined,
  listeners: {},
  offset: 4,
  opacity: 1,
  padding: { top: 4, right: 4, bottom: 4, left: 4 },
  rotation: 0,
  textAlign: 'start',
  textStrokeColor: undefined,
  textStrokeWidth: 0,
  textShadowBlur: 0,
  textShadowColor: undefined,
};

// ---- per-chart / per-element state, via WeakMaps (see this file's own header comment) ----

interface ListenerFn {
  (context: DataLabelsContext, event: ChartEvent): boolean | void;
}

/** One dataset's own real, resolved listeners, as returned by
 * configureDataset(): event -> labelKey -> fn. */
type DatasetListenerMap = Record<string, Record<string, ListenerFn>>;

/** The real, chart-wide listener registry state.listeners builds up
 * across every dataset: event -> datasetIndex (as a string) -> labelKey
 * -> fn. See this file's own header comment for why this needs one
 * more level of nesting than DatasetListenerMap above. */
type ChartListenerMap = Record<string, Record<string, Record<string, ListenerFn>>>;

interface ChartState {
  actives: unknown[];
  listened: boolean;
  listeners: ChartListenerMap;
  datasets: Label[][];
  labels: Label[];
  hovered?: Label | null;
  dirty?: boolean;
}

const chartStates = new WeakMap<Chart, ChartState>();
const elementLabels = new WeakMap<object, Label[]>();

const DEFAULT_KEY = '$default';

interface ResolvedDatasetConfig {
  labels: DataLabelsConfig[];
  listeners: DatasetListenerMap;
}

/**
 * Resolves one dataset's own real, final label config(s) -
 * dataset.datalabels === false disables the plugin for this dataset
 * entirely (returns null); true applies the plugin-level options
 * unchanged; an object is merged over options. Real support for
 * multiple named labels: options.labels (a {name: partial config} map)
 * produces one resolved config per real entry instead of a single
 * default one, each carrying its own _key for later listener lookup.
 */
function configureDataset(dataset: ChartConfigDataset, options: DataLabelsConfig): ResolvedDatasetConfig | null {
  let override = dataset.datalabels as DataLabelsConfig | boolean | undefined;
  if (override === false) return null;
  if (override === true) override = {};

  const merged = merge({}, [options, override ?? {}]) as DataLabelsConfig & {
    labels?: Record<string, (Partial<DataLabelsConfig> & { _key?: string }) | undefined>;
  };
  const namedLabels = merged.labels ?? {};
  const keys = Object.keys(namedLabels);
  delete merged.labels;

  const configs: (DataLabelsConfig & { _key?: string })[] = [];
  if (keys.length) {
    for (const key of keys) {
      const namedConfig = namedLabels[key];
      if (namedConfig) {
        // Cast needed: chart.js/helpers' own merge() signature returns a
        // union too complex for TS to reconcile with our own precise
        // DataLabelsConfig shape here - safe at runtime, merge() does a
        // plain, recursive object merge regardless of the static types
        // involved.
        configs.push(merge({}, [merged, namedConfig, { _key: key }]) as DataLabelsConfig & { _key?: string });
      }
    }
  } else {
    configs.push(merged);
  }

  const listeners: DatasetListenerMap = {};
  for (const config of configs) {
    each(config.listeners ?? {}, (fn: ListenerFn, event: string) => {
      listeners[event] = listeners[event] ?? {};
      listeners[event][config._key ?? DEFAULT_KEY] = fn;
    });
    delete config.listeners;
  }

  return { labels: configs, listeners };
}

function dispatchEvent(chart: Chart, listeners: Record<string, ListenerFn> | undefined, label: Label, event: ChartEvent): void {
  if (!listeners) return;
  const context = label.context;
  const groups = label.groups;
  if (!context || !groups) return;
  const fn = listeners[groups.key];
  if (!fn) return;

  // Cast needed: chart.js/helpers' own callback() signature expects a
  // generic (this: unknown, ...args: unknown[]) => unknown shape, which
  // doesn't line up with this file's own precisely-typed ListenerFn -
  // safe at runtime, callback() just invokes whatever function is
  // passed with the given args.
  if (callback(fn as never, [context, event]) === true) {
    // Users may tweak the given context in their own listener (e.g. to
    // highlight a hovered label) - re-update() with the (possibly
    // mutated) context and schedule a real redraw.
    const state = chartStates.get(chart);
    if (state) state.dirty = true;
    label.update(context);
  }
}

function dispatchMoveEvents(chart: Chart, listeners: ChartState['listeners'], previous: Label | null | undefined, label: Label | null, event: ChartEvent): void {
  if (!previous && !label) return;
  let enter = false;
  let leave = false;
  if (!previous) enter = true;
  else if (!label) leave = true;
  else if (previous !== label) {
    leave = true;
    enter = true;
  }
  if (leave && previous) dispatchEvent(chart, listeners.leave?.[previous.groups!.set], previous, event);
  if (enter && label) dispatchEvent(chart, listeners.enter?.[label.groups!.set], label, event);
}

function handleMoveEvents(chart: Chart, event: ChartEvent): void {
  const state = chartStates.get(chart);
  if (!state) return;
  const listeners = state.listeners;
  if (!listeners.enter && !listeners.leave) return;

  let label: Label | null = null;
  if (event.type === 'mousemove') {
    label = layout.lookup(state.labels, event as unknown as { x: number; y: number });
  } else if (event.type !== 'mouseout') {
    return;
  }

  const previous = state.hovered;
  state.hovered = label;
  dispatchMoveEvents(chart, listeners, previous, label, event);
}

function handleClickEvents(chart: Chart, event: ChartEvent): void {
  const state = chartStates.get(chart);
  if (!state) return;
  const handlers = state.listeners.click;
  const label = handlers && layout.lookup(state.labels, event as unknown as { x: number; y: number });
  if (label) dispatchEvent(chart, handlers[label.groups!.set], label, event);
}

/**
 * Chart.js plugin rendering a real, positioned label per data element
 * (or, via options.labels, several independently-configured labels per
 * element), with real overlap auto-hiding, real click/hover
 * interaction, and per-dataset opt-out (dataset.datalabels = false).
 *
 * Registered via Chart.register(dataLabelsPlugin).
 */
export const dataLabelsPlugin: Plugin = {
  id: 'datalabels',

  defaults: dataLabelsDefaults as unknown as Record<string, unknown>,

  beforeInit(chart: Chart): void {
    chartStates.set(chart, { actives: [], listened: false, listeners: {}, datasets: [], labels: [] });
  },

  beforeUpdate(chart: Chart): void {
    const state = chartStates.get(chart);
    if (!state) return;
    state.listened = false;
    state.listeners = {};
    state.datasets = [];
    state.labels = [];
  },

  afterDatasetUpdate(chart: Chart, args: { index: number; meta: ChartMeta }, options: DataLabelsConfig): void {
    const state = chartStates.get(chart);
    if (!state) return;
    const datasetIndex = args.index;
    const labels: Label[] = [];
    state.datasets[datasetIndex] = labels;

    const visible = chart.isDatasetVisible(datasetIndex);
    const dataset = chart.data.datasets[datasetIndex] as unknown as ChartConfigDataset;
    const config = configureDataset(dataset, options);
    const elements = args.meta.data ?? [];
    const ctx = chart.ctx;

    ctx.save();

    if (config) {
      for (let i = 0; i < elements.length; ++i) {
        const el = elements[i] as unknown as { skip?: boolean };
        elementLabels.set(el, []);

        if (visible && el && chart.getDataVisibility(i) && !el.skip) {
          for (const cfg of config.labels) {
            const key = (cfg as { _key?: string })._key;
            const label = new Label(cfg, ctx, el, i);
            label.groups = { set: String(datasetIndex), key: key ?? DEFAULT_KEY };
            label.context = {
              active: false,
              chart,
              dataIndex: i,
              dataset,
              datasetIndex,
            };
            label.update(label.context);
            elementLabels.get(el)!.push(label);
            labels.push(label);
          }
        }
      }
    }

    ctx.restore();

    if (config) {
      for (const event of Object.keys(config.listeners)) {
        state.listeners[event] = state.listeners[event] ?? {};
        state.listeners[event][String(datasetIndex)] = config.listeners[event];
        state.listened = true;
      }
    }
  },

  afterUpdate(chart: Chart): void {
    const state = chartStates.get(chart);
    if (!state) return;
    state.labels = layout.prepare(state.datasets);
  },

  // Draw labels on top of all dataset elements - the original's own
  // real, cited reasoning (see its own linked issues #29/#32): datasets
  // themselves are drawn earlier in the render pass, so labels drawn
  // per-dataset would sit under a later dataset's own elements.
  afterDatasetsDraw(chart: Chart): void {
    const state = chartStates.get(chart);
    if (!state) return;
    layout.draw(chart, state.labels);
  },

  beforeEvent(chart: Chart, args: { event: ChartEvent; replay: boolean; changed?: boolean; cancelable: true; inChartArea: boolean }): void {
    const state = chartStates.get(chart);
    // Real, confirmed perf guard from the original: if nothing on this
    // chart has any real listener registered at all, skip every
    // further computation for incoming events entirely.
    if (!state?.listened) return;
    const event = args.event;
    switch (event.type) {
      case 'mousemove':
      case 'mouseout':
        handleMoveEvents(chart, event);
        break;
      case 'click':
        handleClickEvents(chart, event);
        break;
    }
  },

  afterEvent(chart: Chart): void {
    const state = chartStates.get(chart);
    if (!state) return;
    const previous = state.actives;
    const actives = (state.actives = chart.getActiveElements());
    const updates = arrayDiff(previous, actives);

    // Real, confirmed from the original: BOTH directions are handled
    // here (update[1] is truthy for either 1 or -1), setting
    // context.active to true on entering the active set and false on
    // leaving it - not just the "entering" half.
    for (const [entry, direction] of updates) {
      const element = (entry as { element: object }).element;
      const labels = elementLabels.get(element) ?? [];
      for (const label of labels) {
        if (label.context) {
          label.context.active = direction === 1;
          label.update(label.context);
        }
      }
    }

    if (state.dirty || updates.length) {
      layout.update(state.labels);
      chart.render();
    }
    state.dirty = undefined;
  },
};
