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
// @ts-nocheck
function stryNS_9fa48() {
  var g = typeof globalThis === 'object' && globalThis && globalThis.Math === Math && globalThis || new Function("return this")();
  var ns = g.__stryker__ || (g.__stryker__ = {});
  if (ns.activeMutant === undefined && g.process && g.process.env && g.process.env.__STRYKER_ACTIVE_MUTANT__) {
    ns.activeMutant = g.process.env.__STRYKER_ACTIVE_MUTANT__;
  }
  function retrieveNS() {
    return ns;
  }
  stryNS_9fa48 = retrieveNS;
  return retrieveNS();
}
stryNS_9fa48();
function stryCov_9fa48() {
  var ns = stryNS_9fa48();
  var cov = ns.mutantCoverage || (ns.mutantCoverage = {
    static: {},
    perTest: {}
  });
  function cover() {
    var c = cov.static;
    if (ns.currentTestId) {
      c = cov.perTest[ns.currentTestId] = cov.perTest[ns.currentTestId] || {};
    }
    var a = arguments;
    for (var i = 0; i < a.length; i++) {
      c[a[i]] = (c[a[i]] || 0) + 1;
    }
  }
  stryCov_9fa48 = cover;
  cover.apply(null, arguments);
}
function stryMutAct_9fa48(id) {
  var ns = stryNS_9fa48();
  function isActive(id) {
    if (ns.activeMutant === id) {
      if (ns.hitCount !== void 0 && ++ns.hitCount > ns.hitLimit) {
        throw new Error('Stryker: Hit count limit reached (' + ns.hitCount + ')');
      }
      return true;
    }
    return false;
  }
  stryMutAct_9fa48 = isActive;
  return isActive(id);
}
import { Chart, type ChartMeta, type ChartType, type LegendItem, type Plugin, type RadialLinearScale, type Scale } from 'chart.js';
import { color, defined, isNumber } from 'chart.js/helpers';
import type { ChartConfigDataset } from './types.js';
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
  backgroundColor?: {
    axis: GradientAxis;
    colors: Record<string | number, string>;
  };
  borderColor?: {
    axis: GradientAxis;
    colors: Record<string | number, string>;
  };
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
  options: {
    display?: boolean;
    labels: {
      boxWidth?: number;
      boxHeight?: number;
      font?: {
        size?: number;
      };
    };
  };
  legendItems?: LegendItem[];
  legendHitBoxes?: LinearBounds[];
}
const chartStates = new WeakMap<Chart, GradientPluginState>();

/** Narrows a `Scale` to `RadialLinearScale` (polar/radar's own `'r'` axis). */
function isRadialLinearScale(scale: Scale): scale is RadialLinearScale {
  if (stryMutAct_9fa48("52")) {
    {}
  } else {
    stryCov_9fa48("52");
    return stryMutAct_9fa48("55") ? scale.type !== 'radialLinear' : stryMutAct_9fa48("54") ? false : stryMutAct_9fa48("53") ? true : (stryCov_9fa48("53", "54", "55"), scale.type === (stryMutAct_9fa48("56") ? "" : (stryCov_9fa48("56"), 'radialLinear')));
  }
}

/**
 * Confirms an area has real, positive width and height — a gradient
 * can't be created against a zero-size area.
 */
function areaIsValid(area: LinearBounds | undefined): area is LinearBounds {
  if (stryMutAct_9fa48("57")) {
    {}
  } else {
    stryCov_9fa48("57");
    return stryMutAct_9fa48("60") ? !!area && area.right > area.left || area.bottom > area.top : stryMutAct_9fa48("59") ? false : stryMutAct_9fa48("58") ? true : (stryCov_9fa48("58", "59", "60"), (stryMutAct_9fa48("62") ? !!area || area.right > area.left : stryMutAct_9fa48("61") ? true : (stryCov_9fa48("61", "62"), (stryMutAct_9fa48("63") ? !area : (stryCov_9fa48("63"), !(stryMutAct_9fa48("64") ? area : (stryCov_9fa48("64"), !area)))) && (stryMutAct_9fa48("67") ? area.right <= area.left : stryMutAct_9fa48("66") ? area.right >= area.left : stryMutAct_9fa48("65") ? true : (stryCov_9fa48("65", "66", "67"), area.right > area.left)))) && (stryMutAct_9fa48("70") ? area.bottom <= area.top : stryMutAct_9fa48("69") ? area.bottom >= area.top : stryMutAct_9fa48("68") ? true : (stryCov_9fa48("68", "69", "70"), area.bottom > area.top)));
  }
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
  if (stryMutAct_9fa48("71")) {
    {}
  } else {
    stryCov_9fa48("71");
    const {
      left,
      top,
      right,
      bottom
    } = scale;
    if (stryMutAct_9fa48("73") ? false : stryMutAct_9fa48("72") ? true : (stryCov_9fa48("72", "73"), isRadialLinearScale(scale))) {
      if (stryMutAct_9fa48("74")) {
        {}
      } else {
        stryCov_9fa48("74");
        return stryMutAct_9fa48("75") ? {} : (stryCov_9fa48("75"), {
          left,
          top,
          right,
          bottom,
          xCenter: scale.xCenter,
          yCenter: scale.yCenter,
          drawingArea: scale.drawingArea
        });
      }
    }
    return stryMutAct_9fa48("76") ? {} : (stryCov_9fa48("76"), {
      left,
      top,
      right,
      bottom
    });
  }
}

/**
 * Creates the real `CanvasGradient` for a given axis: radial for `'r'`
 * (polar/radar scales), otherwise linear along `'x'` or `'y'`.
 */
function createGradient(ctx: CanvasRenderingContext2D, axis: GradientAxis, area: GradientArea): CanvasGradient {
  if (stryMutAct_9fa48("77")) {
    {}
  } else {
    stryCov_9fa48("77");
    if (stryMutAct_9fa48("80") ? axis !== 'r' : stryMutAct_9fa48("79") ? false : stryMutAct_9fa48("78") ? true : (stryCov_9fa48("78", "79", "80"), axis === (stryMutAct_9fa48("81") ? "" : (stryCov_9fa48("81"), 'r')))) {
      if (stryMutAct_9fa48("82")) {
        {}
      } else {
        stryCov_9fa48("82");
        const {
          xCenter = 0,
          yCenter = 0,
          drawingArea = 0
        } = area;
        return ctx.createRadialGradient(xCenter, yCenter, 0, xCenter, yCenter, drawingArea);
      }
    }
    if (stryMutAct_9fa48("85") ? axis !== 'y' : stryMutAct_9fa48("84") ? false : stryMutAct_9fa48("83") ? true : (stryCov_9fa48("83", "84", "85"), axis === (stryMutAct_9fa48("86") ? "" : (stryCov_9fa48("86"), 'y')))) {
      if (stryMutAct_9fa48("87")) {
        {}
      } else {
        stryCov_9fa48("87");
        return ctx.createLinearGradient(0, area.bottom, 0, area.top);
      }
    }
    return ctx.createLinearGradient(area.left, 0, area.right, 0);
  }
}

/** Adds each stop color to a real `CanvasGradient`, in order. */
function applyColorStops(gradient: CanvasGradient, stopColors: StopColor[]): void {
  if (stryMutAct_9fa48("88")) {
    {}
  } else {
    stryCov_9fa48("88");
    for (const item of stopColors) {
      if (stryMutAct_9fa48("89")) {
        {}
      } else {
        stryCov_9fa48("89");
        gradient.addColorStop(item.stop, item.color.rgbString());
      }
    }
  }
}

/**
 * Computes a value's pixel position and its 0..1 stop percentage along
 * a scale — the radial-scale (`'radialLinear'`) case uses distance from
 * center instead of a pixel-for-value lookup.
 */
function getPixelStop(scale: Scale, value: string | number): {
  pixel: number;
  stop: number;
} {
  if (stryMutAct_9fa48("90")) {
    {}
  } else {
    stryCov_9fa48("90");
    if (stryMutAct_9fa48("92") ? false : stryMutAct_9fa48("91") ? true : (stryCov_9fa48("91", "92"), isRadialLinearScale(scale))) {
      if (stryMutAct_9fa48("93")) {
        {}
      } else {
        stryCov_9fa48("93");
        const distance = scale.getDistanceFromCenterForValue(Number(value));
        return stryMutAct_9fa48("94") ? {} : (stryCov_9fa48("94"), {
          pixel: distance,
          stop: stryMutAct_9fa48("95") ? distance * scale.drawingArea : (stryCov_9fa48("95"), distance / scale.drawingArea)
        });
      }
    }
    const reverse = stryMutAct_9fa48("96") ? (scale.options as {
      reverse?: boolean;
    }).reverse && false : (stryCov_9fa48("96"), (scale.options as {
      reverse?: boolean;
    }).reverse ?? (stryMutAct_9fa48("97") ? true : (stryCov_9fa48("97"), false)));
    const normValue = isNumber(value) ? value : Number(scale.parse(value));
    const pixel = scale.getPixelForValue(normValue);
    const stop = scale.getDecimalForPixel(pixel);
    return stryMutAct_9fa48("98") ? {} : (stryCov_9fa48("98"), {
      pixel,
      stop: reverse ? stryMutAct_9fa48("99") ? 1 + stop : (stryCov_9fa48("99"), 1 - stop) : stop
    });
  }
}

// IEC 61966-2-1:1999 sRGB <-> linear-light conversion, for perceptually
// correct (gamma-aware) color interpolation rather than naive RGB lerp.
const toSRGB = stryMutAct_9fa48("100") ? () => undefined : (stryCov_9fa48("100"), (() => {
  const toSRGB = (linear: number): number => (stryMutAct_9fa48("104") ? linear > 0.0031308 : stryMutAct_9fa48("103") ? linear < 0.0031308 : stryMutAct_9fa48("102") ? false : stryMutAct_9fa48("101") ? true : (stryCov_9fa48("101", "102", "103", "104"), linear <= 0.0031308)) ? stryMutAct_9fa48("105") ? linear / 12.92 : (stryCov_9fa48("105"), linear * 12.92) : stryMutAct_9fa48("106") ? Math.pow(linear, 1 / 2.4) * 1.055 + 0.055 : (stryCov_9fa48("106"), (stryMutAct_9fa48("107") ? Math.pow(linear, 1 / 2.4) / 1.055 : (stryCov_9fa48("107"), Math.pow(linear, stryMutAct_9fa48("108") ? 1 * 2.4 : (stryCov_9fa48("108"), 1 / 2.4)) * 1.055)) - 0.055);
  return toSRGB;
})());
const fromSRGB = stryMutAct_9fa48("109") ? () => undefined : (stryCov_9fa48("109"), (() => {
  const fromSRGB = (srgb: number): number => (stryMutAct_9fa48("113") ? srgb > 0.04045 : stryMutAct_9fa48("112") ? srgb < 0.04045 : stryMutAct_9fa48("111") ? false : stryMutAct_9fa48("110") ? true : (stryCov_9fa48("110", "111", "112", "113"), srgb <= 0.04045)) ? stryMutAct_9fa48("114") ? srgb * 12.92 : (stryCov_9fa48("114"), srgb / 12.92) : Math.pow(stryMutAct_9fa48("115") ? (srgb + 0.055) * 1.055 : (stryCov_9fa48("115"), (stryMutAct_9fa48("116") ? srgb - 0.055 : (stryCov_9fa48("116"), srgb + 0.055)) / 1.055), 2.4);
  return fromSRGB;
})());

/**
 * Interpolates between two stop colors at a given percentage, blending
 * in linear-light space (via the sRGB conversion above) rather than
 * naive channel averaging, for a perceptually smoother result.
 */
function interpolateColor(percent: number, start: StopColor, end: StopColor): ChartColor {
  if (stryMutAct_9fa48("117")) {
    {}
  } else {
    stryCov_9fa48("117");
    const s = start.color.rgb;
    const e = end.color.rgb;
    const sR = fromSRGB(stryMutAct_9fa48("118") ? s.r * 255 : (stryCov_9fa48("118"), s.r / 255));
    const sG = fromSRGB(stryMutAct_9fa48("119") ? s.g * 255 : (stryCov_9fa48("119"), s.g / 255));
    const sB = fromSRGB(stryMutAct_9fa48("120") ? s.b * 255 : (stryCov_9fa48("120"), s.b / 255));
    const eR = fromSRGB(stryMutAct_9fa48("121") ? e.r * 255 : (stryCov_9fa48("121"), e.r / 255));
    const eG = fromSRGB(stryMutAct_9fa48("122") ? e.g * 255 : (stryCov_9fa48("122"), e.g / 255));
    const eB = fromSRGB(stryMutAct_9fa48("123") ? e.b * 255 : (stryCov_9fa48("123"), e.b / 255));
    return color({
      r: Math.round(toSRGB(sR + percent * (eR - sR)) * 255),
      g: Math.round(toSRGB(sG + percent * (eG - sG)) * 255),
      b: Math.round(toSRGB(sB + percent * (eB - sB)) * 255),
      a: s.a + percent * Math.abs(e.a - s.a)
    } as RGBAColor);
  }
}

/** Looks up this dataset's own gradient state for a given dataset property (e.g. `'backgroundColor'`). */
function getGradientState(state: GradientPluginState, key: string, datasetIndex: number): DatasetGradientState | undefined {
  if (stryMutAct_9fa48("124")) {
    {}
  } else {
    stryCov_9fa48("124");
    const entries = state.options.get(key);
    return stryMutAct_9fa48("125") ? entries.find(el => el.datasetIndex === datasetIndex) : (stryCov_9fa48("125"), entries?.find(stryMutAct_9fa48("126") ? () => undefined : (stryCov_9fa48("126"), el => stryMutAct_9fa48("129") ? el.datasetIndex !== datasetIndex : stryMutAct_9fa48("128") ? false : stryMutAct_9fa48("127") ? true : (stryCov_9fa48("127", "128", "129"), el.datasetIndex === datasetIndex))));
  }
}

/**
 * Resolves the interpolated color for a raw data value against a
 * dataset's own stored gradient stops — used for radar/polar-style
 * charts, where each legend item corresponds to one data value rather
 * than one whole dataset.
 */
function getInterpolatedColorByValue(state: GradientPluginState, key: string, datasetIndex: number, value: number): ChartColor | undefined {
  if (stryMutAct_9fa48("130")) {
    {}
  } else {
    stryCov_9fa48("130");
    const data = getGradientState(state, key, datasetIndex);
    if (stryMutAct_9fa48("133") ? !data && data.stopColors.length === 0 : stryMutAct_9fa48("132") ? false : stryMutAct_9fa48("131") ? true : (stryCov_9fa48("131", "132", "133"), (stryMutAct_9fa48("134") ? data : (stryCov_9fa48("134"), !data)) || (stryMutAct_9fa48("136") ? data.stopColors.length !== 0 : stryMutAct_9fa48("135") ? false : (stryCov_9fa48("135", "136"), data.stopColors.length === 0)))) return undefined;
    const {
      stop: percent
    } = getPixelStop(data.scale, value);
    let startColor: StopColor | undefined;
    let endColor: StopColor | undefined;
    for (const stopColor of data.stopColors) {
      if (stryMutAct_9fa48("137")) {
        {}
      } else {
        stryCov_9fa48("137");
        if (stryMutAct_9fa48("140") ? stopColor.stop !== percent : stryMutAct_9fa48("139") ? false : stryMutAct_9fa48("138") ? true : (stryCov_9fa48("138", "139", "140"), stopColor.stop === percent)) return stopColor.color;
        if (stryMutAct_9fa48("144") ? stopColor.stop >= percent : stryMutAct_9fa48("143") ? stopColor.stop <= percent : stryMutAct_9fa48("142") ? false : stryMutAct_9fa48("141") ? true : (stryCov_9fa48("141", "142", "143", "144"), stopColor.stop < percent)) {
          if (stryMutAct_9fa48("145")) {
            {}
          } else {
            stryCov_9fa48("145");
            startColor = stopColor;
          }
        } else if (stryMutAct_9fa48("148") ? stopColor.stop > percent || !endColor : stryMutAct_9fa48("147") ? false : stryMutAct_9fa48("146") ? true : (stryCov_9fa48("146", "147", "148"), (stryMutAct_9fa48("151") ? stopColor.stop <= percent : stryMutAct_9fa48("150") ? stopColor.stop >= percent : stryMutAct_9fa48("149") ? true : (stryCov_9fa48("149", "150", "151"), stopColor.stop > percent)) && (stryMutAct_9fa48("152") ? endColor : (stryCov_9fa48("152"), !endColor)))) {
          if (stryMutAct_9fa48("153")) {
            {}
          } else {
            stryCov_9fa48("153");
            endColor = stopColor;
          }
        }
      }
    }
    if (stryMutAct_9fa48("156") ? false : stryMutAct_9fa48("155") ? true : stryMutAct_9fa48("154") ? endColor : (stryCov_9fa48("154", "155", "156"), !endColor)) return stryMutAct_9fa48("157") ? startColor.color : (stryCov_9fa48("157"), startColor?.color);
    if (stryMutAct_9fa48("160") ? false : stryMutAct_9fa48("159") ? true : stryMutAct_9fa48("158") ? startColor : (stryCov_9fa48("158", "159", "160"), !startColor)) return endColor.color;
    return interpolateColor(percent, startColor, endColor);
  }
}
const LEGEND_KEYS: Array<{
  key: 'backgroundColor' | 'borderColor';
  legendItemKey: 'fillStyle' | 'strokeStyle';
}> = stryMutAct_9fa48("161") ? [] : (stryCov_9fa48("161"), [stryMutAct_9fa48("162") ? {} : (stryCov_9fa48("162"), {
  key: stryMutAct_9fa48("163") ? "" : (stryCov_9fa48("163"), 'backgroundColor'),
  legendItemKey: stryMutAct_9fa48("164") ? "" : (stryCov_9fa48("164"), 'fillStyle')
}), stryMutAct_9fa48("165") ? {} : (stryCov_9fa48("165"), {
  key: stryMutAct_9fa48("166") ? "" : (stryCov_9fa48("166"), 'borderColor'),
  legendItemKey: stryMutAct_9fa48("167") ? "" : (stryCov_9fa48("167"), 'strokeStyle')
})]);
function legendBoxHeight(chart: Chart, legendOptions: LiveLegend['options']): number {
  if (stryMutAct_9fa48("168")) {
    {}
  } else {
    stryCov_9fa48("168");
    const size = stryMutAct_9fa48("169") ? legendOptions.labels.font.size : (stryCov_9fa48("169"), legendOptions.labels.font?.size);
    return defined(size) ? size! : chart.options.font!.size!;
  }
}

/** Reads a dataset's own x/y/r scale off its real, live `ChartMeta`.
 * Confirmed as a real runtime property — every dataset controller sets
 * `xScale`/`yScale`/`rScale` on its own meta during Chart.js's own
 * `linkScales()` — but not part of Chart.js's own public `ChartMeta`
 * type, so a targeted cast is needed to read it. */
function getAxisScale(meta: ChartMeta, axis: GradientAxis): Scale | undefined {
  if (stryMutAct_9fa48("170")) {
    {}
  } else {
    stryCov_9fa48("170");
    return (meta as unknown as Record<'xScale' | 'yScale' | 'rScale', Scale | undefined>)[stryMutAct_9fa48("171") ? `` : (stryCov_9fa48("171"), `${axis}Scale`)];
  }
}

/** Applies this dataset's own stored gradient to its legend swatch (one swatch per dataset — bar/line/etc. charts). */
function applyLegendGradientForDataset(chart: Chart, legend: LiveLegend, state: GradientPluginState, item: LegendItem, boxWidth: number, boxHeight: number): void {
  if (stryMutAct_9fa48("172")) {
    {}
  } else {
    stryCov_9fa48("172");
    const hitBox = stryMutAct_9fa48("173") ? legend.legendHitBoxes[item.datasetIndex!] : (stryCov_9fa48("173"), legend.legendHitBoxes?.[item.datasetIndex!]);
    if (stryMutAct_9fa48("176") ? false : stryMutAct_9fa48("175") ? true : stryMutAct_9fa48("174") ? hitBox : (stryCov_9fa48("174", "175", "176"), !hitBox)) return;
    const area: GradientArea = stryMutAct_9fa48("177") ? {} : (stryCov_9fa48("177"), {
      top: hitBox.top,
      left: hitBox.left,
      bottom: stryMutAct_9fa48("178") ? hitBox.top - boxHeight : (stryCov_9fa48("178"), hitBox.top + boxHeight),
      right: stryMutAct_9fa48("179") ? hitBox.left - boxWidth : (stryCov_9fa48("179"), hitBox.left + boxWidth),
      xCenter: stryMutAct_9fa48("180") ? hitBox.left - boxWidth / 2 : (stryCov_9fa48("180"), hitBox.left + (stryMutAct_9fa48("181") ? boxWidth * 2 : (stryCov_9fa48("181"), boxWidth / 2))),
      yCenter: stryMutAct_9fa48("182") ? hitBox.top - boxHeight / 2 : (stryCov_9fa48("182"), hitBox.top + (stryMutAct_9fa48("183") ? boxHeight * 2 : (stryCov_9fa48("183"), boxHeight / 2))),
      drawingArea: stryMutAct_9fa48("184") ? Math.max(boxWidth, boxHeight) * 2 : (stryCov_9fa48("184"), (stryMutAct_9fa48("185") ? Math.min(boxWidth, boxHeight) : (stryCov_9fa48("185"), Math.max(boxWidth, boxHeight))) / 2)
    });
    if (stryMutAct_9fa48("188") ? false : stryMutAct_9fa48("187") ? true : stryMutAct_9fa48("186") ? areaIsValid(area) : (stryCov_9fa48("186", "187", "188"), !areaIsValid(area))) return;
    for (const {
      key,
      legendItemKey
    } of LEGEND_KEYS) {
      if (stryMutAct_9fa48("189")) {
        {}
      } else {
        stryCov_9fa48("189");
        const data = getGradientState(state, key, item.datasetIndex!);
        if (stryMutAct_9fa48("192") ? !data && data.stopColors.length === 0 : stryMutAct_9fa48("191") ? false : stryMutAct_9fa48("190") ? true : (stryCov_9fa48("190", "191", "192"), (stryMutAct_9fa48("193") ? data : (stryCov_9fa48("193"), !data)) || (stryMutAct_9fa48("195") ? data.stopColors.length !== 0 : stryMutAct_9fa48("194") ? false : (stryCov_9fa48("194", "195"), data.stopColors.length === 0)))) continue;
        const gradient = createGradient(chart.ctx, data.axis, area);
        applyColorStops(gradient, data.stopColors);
        item[legendItemKey] = gradient;
      }
    }
  }
}

/** Applies an interpolated color to each legend swatch (one swatch per data point — doughnut/pie/radar/polar charts). */
function applyLegendGradientForDataIndex(legend: LiveLegend, state: GradientPluginState, dataset: ChartConfigDataset, datasetIndex: number): void {
  if (stryMutAct_9fa48("196")) {
    {}
  } else {
    stryCov_9fa48("196");
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
    for (const item of stryMutAct_9fa48("197") ? legend.legendItems && [] : (stryCov_9fa48("197"), legend.legendItems ?? (stryMutAct_9fa48("198") ? ["Stryker was here"] : (stryCov_9fa48("198"), [])))) {
      if (stryMutAct_9fa48("199")) {
        {}
      } else {
        stryCov_9fa48("199");
        for (const {
          key,
          legendItemKey
        } of LEGEND_KEYS) {
          if (stryMutAct_9fa48("200")) {
            {}
          } else {
            stryCov_9fa48("200");
            const value = data[item.index!];
            const resolved = getInterpolatedColorByValue(state, key, datasetIndex, Number(value));
            if (stryMutAct_9fa48("203") ? resolved.valid : stryMutAct_9fa48("202") ? false : stryMutAct_9fa48("201") ? true : (stryCov_9fa48("201", "202", "203"), resolved?.valid)) {
              if (stryMutAct_9fa48("204")) {
                {}
              } else {
                stryCov_9fa48("204");
                item[legendItemKey] = resolved.rgbString();
              }
            }
          }
        }
      }
    }
  }
}

/** Updates every visible legend item's swatch color(s) to reflect the current gradients. */
function updateLegendItems(chart: Chart, legend: LiveLegend, state: GradientPluginState): void {
  if (stryMutAct_9fa48("205")) {
    {}
  } else {
    stryCov_9fa48("205");
    const boxHeight = stryMutAct_9fa48("206") ? legend.options.labels.boxHeight && legendBoxHeight(chart, legend.options) : (stryCov_9fa48("206"), legend.options.labels.boxHeight ?? legendBoxHeight(chart, legend.options));
    const boxWidth = stryMutAct_9fa48("207") ? legend.options.labels.boxWidth && 0 : (stryCov_9fa48("207"), legend.options.labels.boxWidth ?? 0);
    const datasets = chart.data.datasets as ChartConfigDataset[];
    datasets.forEach((dataset, i) => {
      if (stryMutAct_9fa48("208")) {
        {}
      } else {
        stryCov_9fa48("208");
        const item = stryMutAct_9fa48("209") ? legend.legendItems[i] : (stryCov_9fa48("209"), legend.legendItems?.[i]);
        if (stryMutAct_9fa48("212") ? false : stryMutAct_9fa48("211") ? true : stryMutAct_9fa48("210") ? item : (stryCov_9fa48("210", "211", "212"), !item)) return;
        if (stryMutAct_9fa48("215") ? item.datasetIndex !== i : stryMutAct_9fa48("214") ? false : stryMutAct_9fa48("213") ? true : (stryCov_9fa48("213", "214", "215"), item.datasetIndex === i)) {
          if (stryMutAct_9fa48("216")) {
            {}
          } else {
            stryCov_9fa48("216");
            applyLegendGradientForDataset(chart, legend, state, item, boxWidth, boxHeight);
          }
        } else {
          if (stryMutAct_9fa48("217")) {
            {}
          } else {
            stryCov_9fa48("217");
            applyLegendGradientForDataIndex(legend, state, dataset, i);
          }
        }
      }
    });
  }
}

/** Builds the sorted stop-color list for one dataset property's gradient config, against the given scale. */
function buildStopColors(scale: Scale, colors: Record<string | number, string>): StopColor[] {
  if (stryMutAct_9fa48("218")) {
    {}
  } else {
    stryCov_9fa48("218");
    const stopColors: StopColor[] = stryMutAct_9fa48("219") ? ["Stryker was here"] : (stryCov_9fa48("219"), []);
    for (const value of Object.keys(colors)) {
      if (stryMutAct_9fa48("220")) {
        {}
      } else {
        stryCov_9fa48("220");
        const {
          pixel,
          stop
        } = getPixelStop(scale, value);
        if (stryMutAct_9fa48("223") ? !isFinite(pixel) && !isFinite(stop) : stryMutAct_9fa48("222") ? false : stryMutAct_9fa48("221") ? true : (stryCov_9fa48("221", "222", "223"), (stryMutAct_9fa48("224") ? isFinite(pixel) : (stryCov_9fa48("224"), !isFinite(pixel))) || (stryMutAct_9fa48("225") ? isFinite(stop) : (stryCov_9fa48("225"), !isFinite(stop))))) continue;
        const parsed = color(colors[value]);
        if (stryMutAct_9fa48("227") ? false : stryMutAct_9fa48("226") ? true : (stryCov_9fa48("226", "227"), parsed.valid)) {
          if (stryMutAct_9fa48("228")) {
            {}
          } else {
            stryCov_9fa48("228");
            stopColors.push(stryMutAct_9fa48("229") ? {} : (stryCov_9fa48("229"), {
              stop: stryMutAct_9fa48("230") ? Math.min(0, Math.min(1, stop)) : (stryCov_9fa48("230"), Math.max(0, stryMutAct_9fa48("231") ? Math.max(1, stop) : (stryCov_9fa48("231"), Math.min(1, stop)))),
              color: parsed
            }));
          }
        }
      }
    }
    stryMutAct_9fa48("232") ? stopColors : (stryCov_9fa48("232"), stopColors.sort(stryMutAct_9fa48("233") ? () => undefined : (stryCov_9fa48("233"), (a, b) => stryMutAct_9fa48("234") ? a.stop + b.stop : (stryCov_9fa48("234"), a.stop - b.stop))));
    return stopColors;
  }
}

/** Writes a computed gradient onto the dataset (and its live meta's own dataset element, if present) so Chart.js draws with it. */
function setDatasetColor(meta: ChartMeta, dataset: ChartConfigDataset, key: string, value: CanvasGradient): void {
  if (stryMutAct_9fa48("235")) {
    {}
  } else {
    stryCov_9fa48("235");
    dataset[key] = value;
    const metaDataset = meta.dataset as {
      options?: Record<string, unknown>;
    } & Record<string, unknown> | undefined;
    if (stryMutAct_9fa48("238") ? false : stryMutAct_9fa48("237") ? true : stryMutAct_9fa48("236") ? metaDataset : (stryCov_9fa48("236", "237", "238"), !metaDataset)) return;
    if (stryMutAct_9fa48("240") ? false : stryMutAct_9fa48("239") ? true : (stryCov_9fa48("239", "240"), metaDataset.options)) {
      if (stryMutAct_9fa48("241")) {
        {}
      } else {
        stryCov_9fa48("241");
        metaDataset.options[key] = value;
      }
    } else {
      if (stryMutAct_9fa48("242")) {
        {}
      } else {
        stryCov_9fa48("242");
        metaDataset[key] = value;
      }
    }
  }
}

/** Returns (and refreshes, if this dataset isn't hidden) the state array a new gradient entry should be pushed into. */
function getStateEntries(state: GradientPluginState, meta: ChartMeta, key: string, datasetIndex: number): DatasetGradientState[] {
  if (stryMutAct_9fa48("243")) {
    {}
  } else {
    stryCov_9fa48("243");
    let entries = state.options.get(key);
    if (stryMutAct_9fa48("246") ? false : stryMutAct_9fa48("245") ? true : stryMutAct_9fa48("244") ? entries : (stryCov_9fa48("244", "245", "246"), !entries)) {
      if (stryMutAct_9fa48("247")) {
        {}
      } else {
        stryCov_9fa48("247");
        entries = stryMutAct_9fa48("248") ? ["Stryker was here"] : (stryCov_9fa48("248"), []);
        state.options.set(key, entries);
      }
    } else if (stryMutAct_9fa48("251") ? false : stryMutAct_9fa48("250") ? true : stryMutAct_9fa48("249") ? meta.hidden : (stryCov_9fa48("249", "250", "251"), !meta.hidden)) {
      if (stryMutAct_9fa48("252")) {
        {}
      } else {
        stryCov_9fa48("252");
        entries = stryMutAct_9fa48("253") ? entries : (stryCov_9fa48("253"), entries.filter(stryMutAct_9fa48("254") ? () => undefined : (stryCov_9fa48("254"), el => stryMutAct_9fa48("257") ? el.datasetIndex === datasetIndex : stryMutAct_9fa48("256") ? false : stryMutAct_9fa48("255") ? true : (stryCov_9fa48("255", "256", "257"), el.datasetIndex !== datasetIndex))));
        state.options.set(key, entries);
      }
    }
    return entries;
  }
}

/** Computes and applies every configured gradient (`backgroundColor`/`borderColor`) for one dataset. */
function updateDatasetGradients(chart: Chart, state: GradientPluginState, gradient: GradientDatasetConfig, dataset: ChartConfigDataset, datasetIndex: number): void {
  if (stryMutAct_9fa48("258")) {
    {}
  } else {
    stryCov_9fa48("258");
    const ctx = chart.ctx;
    const meta = chart.getDatasetMeta(datasetIndex);
    if (stryMutAct_9fa48("260") ? false : stryMutAct_9fa48("259") ? true : (stryCov_9fa48("259", "260"), meta.hidden)) return;
    for (const [key, config] of Object.entries(gradient) as Array<[string, {
      axis: GradientAxis;
      colors: Record<string | number, string>;
    } | undefined]>) {
      if (stryMutAct_9fa48("261")) {
        {}
      } else {
        stryCov_9fa48("261");
        if (stryMutAct_9fa48("264") ? false : stryMutAct_9fa48("263") ? true : stryMutAct_9fa48("262") ? config?.colors : (stryCov_9fa48("262", "263", "264"), !(stryMutAct_9fa48("265") ? config.colors : (stryCov_9fa48("265"), config?.colors)))) continue;
        const {
          axis,
          colors
        } = config;
        const scale = getAxisScale(meta, axis);
        if (stryMutAct_9fa48("268") ? false : stryMutAct_9fa48("267") ? true : stryMutAct_9fa48("266") ? scale : (stryCov_9fa48("266", "267", "268"), !scale)) {
          if (stryMutAct_9fa48("269")) {
            {}
          } else {
            stryCov_9fa48("269");
            console.warn(stryMutAct_9fa48("270") ? `` : (stryCov_9fa48("270"), `keystone-chartjs-core: gradient plugin found no '${axis}'-axis scale for datasets[${datasetIndex}] of chart id ${chart.id}, skipping.`));
            continue;
          }
        }
        const entries = getStateEntries(state, meta, key, datasetIndex);
        const entry: DatasetGradientState = stryMutAct_9fa48("271") ? {} : (stryCov_9fa48("271"), {
          datasetIndex,
          axis,
          scale,
          stopColors: stryMutAct_9fa48("272") ? ["Stryker was here"] : (stryCov_9fa48("272"), [])
        });
        entries.push(entry);
        const gradientObj = createGradient(ctx, axis, scaleToGradientArea(scale));
        entry.stopColors = buildStopColors(scale, colors);
        if (stryMutAct_9fa48("276") ? entry.stopColors.length <= 0 : stryMutAct_9fa48("275") ? entry.stopColors.length >= 0 : stryMutAct_9fa48("274") ? false : stryMutAct_9fa48("273") ? true : (stryCov_9fa48("273", "274", "275", "276"), entry.stopColors.length > 0)) {
          if (stryMutAct_9fa48("277")) {
            {}
          } else {
            stryCov_9fa48("277");
            applyColorStops(gradientObj, entry.stopColors);
            setDatasetColor(meta, dataset, key, gradientObj);
          }
        }
      }
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
export const gradientPlugin: Plugin<ChartType> = stryMutAct_9fa48("278") ? {} : (stryCov_9fa48("278"), {
  id: stryMutAct_9fa48("279") ? "" : (stryCov_9fa48("279"), 'gradient'),
  beforeInit(chart: Chart): void {
    if (stryMutAct_9fa48("280")) {
      {}
    } else {
      stryCov_9fa48("280");
      chartStates.set(chart, stryMutAct_9fa48("281") ? {} : (stryCov_9fa48("281"), {
        options: new Map()
      }));
    }
  },
  beforeDatasetsUpdate(chart: Chart): void {
    if (stryMutAct_9fa48("282")) {
      {}
    } else {
      stryCov_9fa48("282");
      if (stryMutAct_9fa48("285") ? false : stryMutAct_9fa48("284") ? true : stryMutAct_9fa48("283") ? areaIsValid(chart.chartArea) : (stryCov_9fa48("283", "284", "285"), !areaIsValid(chart.chartArea))) return;
      const state = chartStates.get(chart);
      if (stryMutAct_9fa48("288") ? false : stryMutAct_9fa48("287") ? true : stryMutAct_9fa48("286") ? state : (stryCov_9fa48("286", "287", "288"), !state)) return;
      const datasets = chart.data.datasets as ChartConfigDataset[];
      datasets.forEach((dataset, i) => {
        if (stryMutAct_9fa48("289")) {
          {}
        } else {
          stryCov_9fa48("289");
          const gradient = dataset.gradient as GradientDatasetConfig | undefined;
          if (stryMutAct_9fa48("291") ? false : stryMutAct_9fa48("290") ? true : (stryCov_9fa48("290", "291"), gradient)) {
            if (stryMutAct_9fa48("292")) {
              {}
            } else {
              stryCov_9fa48("292");
              updateDatasetGradients(chart, state, gradient, dataset, i);
            }
          }
        }
      });
    }
  },
  afterUpdate(chart: Chart): void {
    if (stryMutAct_9fa48("293")) {
      {}
    } else {
      stryCov_9fa48("293");
      const state = chartStates.get(chart);
      // Cast: chart.legend's own real, live implementation carries
      // legendItems/legendHitBoxes at runtime (see LiveLegend's own doc
      // comment above for why these aren't part of the public type).
      const legend = chart.legend as unknown as LiveLegend | undefined;
      if (stryMutAct_9fa48("296") ? state && legend || legend.options.display !== false : stryMutAct_9fa48("295") ? false : stryMutAct_9fa48("294") ? true : (stryCov_9fa48("294", "295", "296"), (stryMutAct_9fa48("298") ? state || legend : stryMutAct_9fa48("297") ? true : (stryCov_9fa48("297", "298"), state && legend)) && (stryMutAct_9fa48("300") ? legend.options.display === false : stryMutAct_9fa48("299") ? true : (stryCov_9fa48("299", "300"), legend.options.display !== (stryMutAct_9fa48("301") ? true : (stryCov_9fa48("301"), false)))))) {
        if (stryMutAct_9fa48("302")) {
          {}
        } else {
          stryCov_9fa48("302");
          updateLegendItems(chart, legend, state);
        }
      }
    }
  },
  afterDestroy(chart: Chart): void {
    if (stryMutAct_9fa48("303")) {
      {}
    } else {
      stryCov_9fa48("303");
      chartStates.delete(chart);
    }
  }
});