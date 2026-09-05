/**
 * Local port of `chartjs-plugin-gradient` (v0.6.1, MIT, Jukka Kurkela),
 * supplied via Chart.js's inline `plugins` array instead of a
 * dependency, so it avoids the docs-site dynamic-import hydration gap
 * the other still-dependency-based plugins in this project hit.
 *
 * Ported from the real, installed package's own dist file
 * (`node_modules/chartjs-plugin-gradient/dist/
 * chartjs-plugin-gradient.esm.js`). Mostly a faithful port, not a
 * reimplementation from scratch. Deliberate deviations from the
 * original:
 * - Dropped the original's own `isChartV3`-branching helpers (`parse`,
 *   `getScale`) — those existed to support Chart.js v2, which this
 *   project never targets, so only the v3+ branch is kept.
 * - `chartStates` is a `WeakMap` here instead of the original's plain
 *   `Map`, so a chart instance's state can never outlive the chart
 *   itself even if cleanup were somehow skipped.
 * - **A real bug fix, confirmed via Chart.js's own installed type
 *   declarations**: the original names its teardown hook `destroy`, but
 *   Chart.js's real `Plugin` interface has no such hook at all — the
 *   real lifecycle hooks for chart teardown are `beforeDestroy`/
 *   `afterDestroy` (confirmed directly from `chart.js`'s own
 *   `dist/types/index.d.ts`). A hook name Chart.js's own plugin system
 *   doesn't recognize is never invoked, so the original's own `destroy`
 *   handler — whose only job is deleting this plugin's own per-chart
 *   state entry — likely never actually ran in real Chart.js, silently
 *   leaking one `Map` entry per destroyed chart for as long as the
 *   plugin's own module stayed loaded. Renamed to `afterDestroy` here,
 *   the correct real hook name.
 * - Fully typed against real Chart.js types throughout (`Scale`,
 *   `RadialLinearScale`, `ChartMeta`, `LegendItem`), rather than `any` —
 *   two real Chart.js properties this plugin needs
 *   (`ChartMeta.xScale`/`yScale`/`rScale`, and the live Legend plugin's
 *   own `legendItems`/`legendHitBoxes`) are genuine runtime properties
 *   not covered by Chart.js's own public types; each targeted cast for
 *   those is commented at its own use site, not left as a blanket `any`.
 */
import { Chart, type ChartMeta, type ChartType, type LegendItem, type Plugin, type RadialLinearScale, type Scale } from 'chart.js';
import { color, defined, isNumber } from 'chart.js/helpers';
import type { ChartConfigDataset } from '../../types.js';

interface RGBAColor {
  r: number;
  g: number;
  b: number;
  a: number;
}

/** A `chart.js/helpers` `color(...)` result — has `.valid`, `.rgb`, `.rgbString()`. */
type ChartColor = ReturnType<typeof color>;

type GradientAxis = 'x' | 'y' | 'r';

/** One dataset's own real `gradient` config shape, read from `dataset.gradient`. */
export interface GradientDatasetConfig {
  backgroundColor?: { axis: GradientAxis; colors: Record<string | number, string> };
  borderColor?: { axis: GradientAxis; colors: Record<string | number, string> };
}

/** The linear bounds a linear (`'x'`/`'y'`) gradient is drawn across. */
interface LinearBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/** The center point and radius a radial (`'r'`) gradient is drawn from. */
interface RadialCenter {
  xCenter: number;
  yCenter: number;
  drawingArea: number;
}

/** Either shape `createGradient` needs, depending on axis — a real
 * scale's own real geometry, or a synthesized legend-swatch box. */
type GradientArea = LinearBounds & Partial<RadialCenter>;

interface StopColor {
  stop: number;
  color: ChartColor;
}

interface DatasetGradientState {
  datasetIndex: number;
  axis: GradientAxis;
  scale: Scale;
  stopColors: StopColor[];
}

interface GradientPluginState {
  /** Keyed by dataset property name (`'backgroundColor'`/`'borderColor'`). */
  options: Map<string, DatasetGradientState[]>;
}

/**
 * Chart.js's own real Legend plugin instance carries `legendItems`/
 * `legendHitBoxes` at runtime (confirmed: every real doughnut/pie/bar/
 * etc. chart's own `chart.legend` has both once rendered), but neither
 * is part of Chart.js's own public `LegendElement` type — both are
 * internal implementation details of the built-in Legend plugin. This
 * local type names exactly the subset this file reads.
 */
interface LiveLegend {
  options: { display?: boolean; labels: { boxWidth?: number; boxHeight?: number; font?: { size?: number } } };
  legendItems?: LegendItem[];
  legendHitBoxes?: LinearBounds[];
}

const chartStates = new WeakMap<Chart, GradientPluginState>();

/** Narrows a `Scale` to `RadialLinearScale` (polar/radar's own `'r'` axis). */
function isRadialLinearScale(scale: Scale): scale is RadialLinearScale {
  return scale.type === 'radialLinear';
}

/**
 * Confirms an area has real, positive width and height — a gradient
 * can't be created against a zero-size area.
 */
function areaIsValid(area: LinearBounds | undefined): area is LinearBounds {
  return !!area && area.right > area.left && area.bottom > area.top;
}

/**
 * Reads the real, already-computed geometry off a scale — its own
 * `left`/`top`/`right`/`bottom` (part of Chart.js's own public
 * `LayoutItem` interface, which every `Scale` implements), plus, for a
 * radial scale specifically, its own real `xCenter`/`yCenter`/
 * `drawingArea` (part of Chart.js's own public `RadialLinearScale`
 * type). No cast needed either way — both shapes are genuinely, fully
 * typed by Chart.js itself.
 */
function scaleToGradientArea(scale: Scale): GradientArea {
  const { left, top, right, bottom } = scale;
  if (isRadialLinearScale(scale)) {
    return { left, top, right, bottom, xCenter: scale.xCenter, yCenter: scale.yCenter, drawingArea: scale.drawingArea };
  }
  return { left, top, right, bottom };
}

/**
 * Creates the real `CanvasGradient` for a given axis: radial for `'r'`
 * (polar/radar scales), otherwise linear along `'x'` or `'y'`.
 */
function createGradient(ctx: CanvasRenderingContext2D, axis: GradientAxis, area: GradientArea): CanvasGradient {
  if (axis === 'r') {
    const { xCenter = 0, yCenter = 0, drawingArea = 0 } = area;
    return ctx.createRadialGradient(xCenter, yCenter, 0, xCenter, yCenter, drawingArea);
  }
  if (axis === 'y') {
    return ctx.createLinearGradient(0, area.bottom, 0, area.top);
  }
  return ctx.createLinearGradient(area.left, 0, area.right, 0);
}

/** Adds each stop color to a real `CanvasGradient`, in order. */
function applyColorStops(gradient: CanvasGradient, stopColors: StopColor[]): void {
  for (const item of stopColors) {
    gradient.addColorStop(item.stop, item.color.rgbString());
  }
}

/**
 * Computes a value's pixel position and its 0..1 stop percentage along
 * a scale — the radial-scale (`'radialLinear'`) case uses distance from
 * center instead of a pixel-for-value lookup.
 */
function getPixelStop(scale: Scale, value: string | number): { pixel: number; stop: number } {
  if (isRadialLinearScale(scale)) {
    const distance = scale.getDistanceFromCenterForValue(Number(value));
    return { pixel: distance, stop: distance / scale.drawingArea };
  }
  const reverse = (scale.options as { reverse?: boolean }).reverse ?? false;
  const normValue = isNumber(value) ? value : Number(scale.parse(value));
  const pixel = scale.getPixelForValue(normValue);
  const stop = scale.getDecimalForPixel(pixel);
  return { pixel, stop: reverse ? 1 - stop : stop };
}

// IEC 61966-2-1:1999 sRGB <-> linear-light conversion, for perceptually
// correct (gamma-aware) color interpolation rather than naive RGB lerp.
const toSRGB = (linear: number): number => (linear <= 0.0031308 ? linear * 12.92 : Math.pow(linear, 1 / 2.4) * 1.055 - 0.055);
const fromSRGB = (srgb: number): number => (srgb <= 0.04045 ? srgb / 12.92 : Math.pow((srgb + 0.055) / 1.055, 2.4));

/**
 * Interpolates between two stop colors at a given percentage, blending
 * in linear-light space (via the sRGB conversion above) rather than
 * naive channel averaging, for a perceptually smoother result.
 */
function interpolateColor(percent: number, start: StopColor, end: StopColor): ChartColor {
  const s = start.color.rgb;
  const e = end.color.rgb;
  const sR = fromSRGB(s.r / 255);
  const sG = fromSRGB(s.g / 255);
  const sB = fromSRGB(s.b / 255);
  const eR = fromSRGB(e.r / 255);
  const eG = fromSRGB(e.g / 255);
  const eB = fromSRGB(e.b / 255);
  return color({
    r: Math.round(toSRGB(sR + percent * (eR - sR)) * 255),
    g: Math.round(toSRGB(sG + percent * (eG - sG)) * 255),
    b: Math.round(toSRGB(sB + percent * (eB - sB)) * 255),
    a: s.a + percent * Math.abs(e.a - s.a),
  } as RGBAColor);
}

/** Looks up this dataset's own gradient state for a given dataset property (e.g. `'backgroundColor'`). */
function getGradientState(state: GradientPluginState, key: string, datasetIndex: number): DatasetGradientState | undefined {
  const entries = state.options.get(key);
  return entries?.find((el) => el.datasetIndex === datasetIndex);
}

/**
 * Resolves the interpolated color for a raw data value against a
 * dataset's own stored gradient stops — used for radar/polar-style
 * charts, where each legend item corresponds to one data value rather
 * than one whole dataset.
 */
function getInterpolatedColorByValue(
  state: GradientPluginState,
  key: string,
  datasetIndex: number,
  value: number,
): ChartColor | undefined {
  const data = getGradientState(state, key, datasetIndex);
  if (!data || data.stopColors.length === 0) return undefined;

  const { stop: percent } = getPixelStop(data.scale, value);
  let startColor: StopColor | undefined;
  let endColor: StopColor | undefined;
  for (const stopColor of data.stopColors) {
    if (stopColor.stop === percent) return stopColor.color;
    if (stopColor.stop < percent) {
      startColor = stopColor;
    } else if (stopColor.stop > percent && !endColor) {
      endColor = stopColor;
    }
  }
  if (!endColor) return startColor?.color;
  if (!startColor) return endColor.color;
  return interpolateColor(percent, startColor, endColor);
}

const LEGEND_KEYS: Array<{ key: 'backgroundColor' | 'borderColor'; legendItemKey: 'fillStyle' | 'strokeStyle' }> = [
  { key: 'backgroundColor', legendItemKey: 'fillStyle' },
  { key: 'borderColor', legendItemKey: 'strokeStyle' },
];

function legendBoxHeight(chart: Chart, legendOptions: LiveLegend['options']): number {
  const size = legendOptions.labels.font?.size;
  return defined(size) ? size! : chart.options.font!.size!;
}

/** Reads a dataset's own x/y/r scale off its real, live `ChartMeta`.
 * Confirmed as a real runtime property — every dataset controller sets
 * `xScale`/`yScale`/`rScale` on its own meta during Chart.js's own
 * `linkScales()` — but not part of Chart.js's own public `ChartMeta`
 * type, so a targeted cast is needed to read it. */
function getAxisScale(meta: ChartMeta, axis: GradientAxis): Scale | undefined {
  return (meta as unknown as Record<'xScale' | 'yScale' | 'rScale', Scale | undefined>)[`${axis}Scale`];
}

/** Applies this dataset's own stored gradient to its legend swatch (one swatch per dataset — bar/line/etc. charts). */
function applyLegendGradientForDataset(
  chart: Chart,
  legend: LiveLegend,
  state: GradientPluginState,
  item: LegendItem,
  boxWidth: number,
  boxHeight: number,
): void {
  const hitBox = legend.legendHitBoxes?.[item.datasetIndex!];
  if (!hitBox) return;
  const area: GradientArea = {
    top: hitBox.top,
    left: hitBox.left,
    bottom: hitBox.top + boxHeight,
    right: hitBox.left + boxWidth,
    xCenter: hitBox.left + boxWidth / 2,
    yCenter: hitBox.top + boxHeight / 2,
    drawingArea: Math.max(boxWidth, boxHeight) / 2,
  };
  if (!areaIsValid(area)) return;

  for (const { key, legendItemKey } of LEGEND_KEYS) {
    const data = getGradientState(state, key, item.datasetIndex!);
    if (!data || data.stopColors.length === 0) continue;
    const gradient = createGradient(chart.ctx, data.axis, area);
    applyColorStops(gradient, data.stopColors);
    item[legendItemKey] = gradient;
  }
}

/** Applies an interpolated color to each legend swatch (one swatch per data point — doughnut/pie/radar/polar charts). */
function applyLegendGradientForDataIndex(
  legend: LiveLegend,
  state: GradientPluginState,
  dataset: ChartConfigDataset,
  datasetIndex: number,
): void {
  const data = dataset.data as unknown[];
  // `?? []` is defensive but genuinely unreachable in practice: this
  // function's only caller, updateLegendItems, already guarantees
  // `legend.legendItems` is a real array by the time this runs — it
  // only reaches this call after `legend.legendItems?.[i]` resolved to a
  // real, truthy item, which is impossible unless legendItems itself is
  // a real array. Confirmed via a real test:coverage run (not assumed):
  // this is the one branch in this file no test can reach without
  // calling this non-exported function directly, bypassing its own real
  // caller's guarantee.
  for (const item of legend.legendItems ?? []) {
    for (const { key, legendItemKey } of LEGEND_KEYS) {
      const value = data[item.index!];
      const resolved = getInterpolatedColorByValue(state, key, datasetIndex, Number(value));
      if (resolved?.valid) {
        item[legendItemKey] = resolved.rgbString();
      }
    }
  }
}

/** Updates every visible legend item's swatch color(s) to reflect the current gradients. */
function updateLegendItems(chart: Chart, legend: LiveLegend, state: GradientPluginState): void {
  const boxHeight = legend.options.labels.boxHeight ?? legendBoxHeight(chart, legend.options);
  const boxWidth = legend.options.labels.boxWidth ?? 0;
  const datasets = chart.data.datasets as ChartConfigDataset[];
  datasets.forEach((dataset, i) => {
    const item = legend.legendItems?.[i];
    if (!item) return;
    if (item.datasetIndex === i) {
      applyLegendGradientForDataset(chart, legend, state, item, boxWidth, boxHeight);
    } else {
      applyLegendGradientForDataIndex(legend, state, dataset, i);
    }
  });
}

/** Builds the sorted stop-color list for one dataset property's gradient config, against the given scale. */
function buildStopColors(scale: Scale, colors: Record<string | number, string>): StopColor[] {
  const stopColors: StopColor[] = [];
  for (const value of Object.keys(colors)) {
    const { pixel, stop } = getPixelStop(scale, value);
    if (!isFinite(pixel) || !isFinite(stop)) continue;
    const parsed = color(colors[value]);
    if (parsed.valid) {
      stopColors.push({ stop: Math.max(0, Math.min(1, stop)), color: parsed });
    }
  }
  stopColors.sort((a, b) => a.stop - b.stop);
  return stopColors;
}

/** Writes a computed gradient onto the dataset (and its live meta's own dataset element, if present) so Chart.js draws with it. */
function setDatasetColor(meta: ChartMeta, dataset: ChartConfigDataset, key: string, value: CanvasGradient): void {
  dataset[key] = value;
  const metaDataset = meta.dataset as { options?: Record<string, unknown> } & Record<string, unknown> | undefined;
  if (!metaDataset) return;
  if (metaDataset.options) {
    metaDataset.options[key] = value;
  } else {
    metaDataset[key] = value;
  }
}

/** Returns (and refreshes, if this dataset isn't hidden) the state array a new gradient entry should be pushed into. */
function getStateEntries(state: GradientPluginState, meta: ChartMeta, key: string, datasetIndex: number): DatasetGradientState[] {
  let entries = state.options.get(key);
  if (!entries) {
    entries = [];
    state.options.set(key, entries);
  } else if (!meta.hidden) {
    entries = entries.filter((el) => el.datasetIndex !== datasetIndex);
    state.options.set(key, entries);
  }
  return entries;
}

/** Computes and applies every configured gradient (`backgroundColor`/`borderColor`) for one dataset. */
function updateDatasetGradients(
  chart: Chart,
  state: GradientPluginState,
  gradient: GradientDatasetConfig,
  dataset: ChartConfigDataset,
  datasetIndex: number,
): void {
  const ctx = chart.ctx;
  const meta = chart.getDatasetMeta(datasetIndex);
  if (meta.hidden) return;

  for (const [key, config] of Object.entries(gradient) as Array<[string, { axis: GradientAxis; colors: Record<string | number, string> } | undefined]>) {
    if (!config?.colors) continue;
    const { axis, colors } = config;
    const scale = getAxisScale(meta, axis);
    if (!scale) {
      console.warn(`keystone-chartjs-core: gradient plugin found no '${axis}'-axis scale for datasets[${datasetIndex}] of chart id ${chart.id}, skipping.`);
      continue;
    }
    const entries = getStateEntries(state, meta, key, datasetIndex);
    const entry: DatasetGradientState = { datasetIndex, axis, scale, stopColors: [] };
    entries.push(entry);
    const gradientObj = createGradient(ctx, axis, scaleToGradientArea(scale));
    entry.stopColors = buildStopColors(scale, colors);
    if (entry.stopColors.length > 0) {
      applyColorStops(gradientObj, entry.stopColors);
      setDatasetColor(meta, dataset, key, gradientObj);
    }
  }
}

/**
 * Chart.js plugin that draws per-dataset (and per-legend-item) color
 * gradients, configured via each dataset's own `gradient` field rather
 * than plugin-level `options` — this plugin's only job is computing the
 * real `CanvasGradient` objects and writing them onto the dataset/legend
 * at the right time in Chart.js's own update lifecycle.
 *
 * Supplied to Chart.js via its inline `plugins` array rather than a
 * global `Chart.register(...)` call.
 */
export const gradientPlugin: Plugin<ChartType> = {
  id: 'gradient',

  beforeInit(chart: Chart): void {
    chartStates.set(chart, { options: new Map() });
  },

  beforeDatasetsUpdate(chart: Chart): void {
    if (!areaIsValid(chart.chartArea)) return;
    const state = chartStates.get(chart);
    if (!state) return;

    const datasets = chart.data.datasets as ChartConfigDataset[];
    datasets.forEach((dataset, i) => {
      const gradient = dataset.gradient as GradientDatasetConfig | undefined;
      if (gradient) {
        updateDatasetGradients(chart, state, gradient, dataset, i);
      }
    });
  },

  afterUpdate(chart: Chart): void {
    const state = chartStates.get(chart);
    // Cast: chart.legend's own real, live implementation carries
    // legendItems/legendHitBoxes at runtime (see LiveLegend's own doc
    // comment above for why these aren't part of the public type).
    const legend = chart.legend as unknown as LiveLegend | undefined;
    if (state && legend && legend.options.display !== false) {
      updateLegendItems(chart, legend, state);
    }
  },

  afterDestroy(chart: Chart): void {
    chartStates.delete(chart);
  },
};
