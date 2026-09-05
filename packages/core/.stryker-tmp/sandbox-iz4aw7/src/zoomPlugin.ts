/**
 * Local port of `chartjs-plugin-zoom` (v2.2.0, MIT, chartjs-plugin-zoom
 * Contributors), supplied via Chart.js's inline `plugins` array instead
 * of a dependency, so it avoids the docs-site dynamic-import hydration
 * gap the other still-dependency-based plugins in this project hit —
 * see docs/ZOOM_PLUGIN_PORT_PLAN.md for the full scope analysis behind
 * this port, written before implementation started.
 *
 * **Scope decision, made explicitly rather than silently**: the
 * original plugin drives pinch-zoom and drag-to-pan through Hammer.js,
 * which is itself unmaintained (confirmed via a real, open upstream
 * issue, already flagged in `docs/CHARTJS_ANALYSIS.md` §6). This port
 * drops Hammer.js entirely, but does *not* drop the two features it
 * drove — pinch-zoom and interactive pan are both reimplemented here
 * directly on top of the standards-based **Pointer Events API**
 * (`pointerdown`/`pointermove`/`pointerup`/`pointercancel`), which
 * unifies mouse/touch/pen input with no external dependency at all.
 * Mouse input is explicitly excluded from this pointer-event path (see
 * `pointerDown`'s own `pointerType === 'mouse'` check) — mouse drag-to-
 * zoom-rectangle and wheel-zoom keep using the separate, original
 * mouse-event handlers below, unchanged.
 *
 * **A real, honest finding from dissecting the original source**: the
 * original plugin has no mouse-only drag-to-pan mechanism at all —
 * `pan()` was only ever invoked from Hammer's own `handlePan()` (driven
 * by `Hammer.Pan()`, which recognized both touch *and* mouse-pointer
 * drags identically). This port's own pointer-event-based pan is
 * touch/pen-only for that reason — mouse users get `chart.pan()` as a
 * callable, programmatic method only (useful for a consumer's own
 * custom pan buttons/controls, as the docs site's own example does),
 * not an interactive drag gesture, matching what the original's own
 * mouse-input behavior genuinely was.
 *
 * Every other real function below (the zoom/pan math per scale type,
 * scale-limit bookkeeping, drag-rectangle geometry, wheel/mousedown/
 * mouseup event handling) is a faithful port of the original's own real
 * logic, dissected directly from the installed package's own dist file
 * (`node_modules/chartjs-plugin-zoom/dist/chartjs-plugin-zoom.esm.js`).
 *
 * Fully typed against real Chart.js types throughout. Two deliberate
 * departures from directly reusing Chart.js's own helper functions,
 * both to avoid fighting generic-inference edge cases that added no
 * real type safety of their own:
 * - `chart.js/helpers`' own `callback()`/`each()` have generic
 *   signatures tuned for Chart.js's own internal call sites; several
 *   real call sites here (a scale-type-keyed function dispatch, a
 *   `Record | Array` union passed to iterate) hit genuine TypeScript
 *   inference failures against them (confirmed via a real `tsc
 *   --noEmit` run, not assumed) with no real type-safety loss from
 *   using a simpler local equivalent instead ({@link invoke}, plain
 *   `Object.values()`/`for...of`).
 * - A local {@link ScreenPoint} type is used instead of Chart.js's own
 *   public `Point` type for on-screen pixel coordinates (mouse
 *   position, drag-rectangle corners, scale centers) — Chart.js's own
 *   `Point` allows `x`/`y` to be `null` (meant for missing *data*
 *   points on a chart, not screen coordinates), which doesn't apply
 *   here and would otherwise force null-checks with no real value at
 *   every use site.
 *
 * One genuine runtime-vs-public-type gap remains, handled via
 * {@link LiveScale}: Chart.js's own public `Scale` type (from
 * `types/index.d.ts`) omits several real runtime properties this
 * plugin genuinely needs (`chart`, the current computed `min`/`max`,
 * `getLabels()`) — confirmed real via Chart.js's own JSDoc-derived
 * implementation class (`dist/core/core.scale.d.ts`), which is a
 * different, internal declaration from the public `Scale` type and
 * isn't what `import { Scale } from 'chart.js'` resolves to.
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
import type { Chart, ChartArea, ChartType, Plugin, Scale } from 'chart.js';
import { _isPointInArea, getRelativePosition } from 'chart.js/helpers';

/** Chart.js doesn't export its own update-mode string-literal union
 * under a stable public name — derived directly from `Chart['update']`'s
 * own real parameter type instead of guessing at one. */
type UpdateMode = Parameters<Chart['update']>[0];

/** See this file's own header comment for why this extends the public `Scale` type. */
interface LiveScale extends Scale {
  chart: Chart;
  min: number;
  max: number;
  getLabels(): string[];
}

/** On-screen pixel coordinates — see this file's own header comment for
 * why this isn't Chart.js's own public `Point` type. */
interface ScreenPoint {
  x: number;
  y: number;
}

/** Calls `fn` with `args` if it's a real function, otherwise a no-op —
 * see this file's own header comment for why this replaces
 * `chart.js/helpers`' own `callback()` here. */
function invoke<R>(fn: ((...args: never[]) => R) | undefined, args: unknown[]): R | undefined {
  if (stryMutAct_9fa48("515")) {
    {}
  } else {
    stryCov_9fa48("515");
    return (stryMutAct_9fa48("518") ? typeof fn !== 'function' : stryMutAct_9fa48("517") ? false : stryMutAct_9fa48("516") ? true : (stryCov_9fa48("516", "517", "518"), typeof fn === (stryMutAct_9fa48("519") ? "" : (stryCov_9fa48("519"), 'function')))) ? (fn as (...a: unknown[]) => R)(...args) : undefined;
  }
}
type ZoomDirection = 'x' | 'y';
type ZoomMode = ZoomDirection | 'xy' | ((ctx: {
  chart: Chart;
}) => string);
interface ScaleLimits {
  min?: number | 'original';
  max?: number | 'original';
  minRange?: number;
}
export interface ZoomPluginOptions {
  limits?: Record<string, ScaleLimits>;
  pan?: {
    enabled?: boolean;
    mode?: ZoomMode;
    modifierKey?: string | null;
    threshold?: number;
    onPan?: (ctx: {
      chart: Chart;
    }) => void;
    onPanStart?: (ctx: {
      chart: Chart;
      event: Event;
      point: ScreenPoint;
    }) => void | false;
    onPanComplete?: (ctx: {
      chart: Chart;
    }) => void;
    onPanRejected?: (ctx: {
      chart: Chart;
      event: Event;
    }) => void;
  };
  zoom?: {
    wheel?: {
      enabled?: boolean;
      speed?: number;
      modifierKey?: string | null;
    };
    drag?: {
      enabled?: boolean;
      backgroundColor?: string;
      borderColor?: string;
      borderWidth?: number;
      threshold?: number;
      maintainAspectRatio?: boolean;
      drawTime?: 'beforeDatasetsDraw' | 'afterDatasetsDraw' | 'beforeDraw' | 'afterDraw';
      modifierKey?: string | null;
    };
    /** Two-finger pinch-zoom, via the Pointer Events API — see this
     * file's own header comment for why this replaces the original
     * package's own Hammer.js-driven pinch gesture. `false`/omitted by
     * default, matching the original's own opt-in default. */
    pinch?: {
      enabled?: boolean;
    };
    mode?: ZoomMode;
    scaleMode?: ZoomMode;
    overScaleMode?: ZoomMode;
    onZoom?: (ctx: {
      chart: Chart;
      trigger: string;
    }) => void;
    onZoomStart?: (ctx: {
      chart: Chart;
      event: Event;
      point: ScreenPoint;
    }) => void | false;
    onZoomComplete?: (ctx: {
      chart: Chart;
    }) => void;
    onZoomRejected?: (ctx: {
      chart: Chart;
      event: Event;
    }) => void;
  };
}
interface ScaleLimitSnapshot {
  scale: number;
  options: number | undefined;
}
interface ZoomPluginState {
  originalScaleLimits: Record<string, {
    min: ScaleLimitSnapshot;
    max: ScaleLimitSnapshot;
  }>;
  updatedScaleLimits: Record<string, {
    min: number;
    max: number;
  }>;
  handlers: Record<string, (EventListener & {
    target?: EventTarget;
  }) | (() => void)>;
  panDelta: Record<string, number>;
  dragging: boolean;
  panning: boolean;
  dragStart?: MouseEvent | null;
  dragEnd?: MouseEvent | null;
  filterNextClick?: boolean;
  options: ZoomPluginOptions;
  /** Active touch/pen pointers currently down on the canvas, keyed by
   * `pointerId` — drives single-finger pan (1 active pointer) and
   * two-finger pinch-zoom (2 active pointers) via the Pointer Events
   * API. Mouse input never populates this map at all (see
   * `pointerDown`'s own explicit `pointerType === 'mouse'` exclusion) —
   * mouse drag/wheel keep using the separate, pre-existing mouse-event
   * handlers above. */
  pointers: Map<number, ScreenPoint>;
  /** The position the sole tracked pointer went down at, while a
   * single-finger gesture hasn't yet crossed `pan.threshold` — cleared
   * once panning genuinely starts (or the gesture is explicitly
   * rejected by `pan.onPanStart`). This is what finally gives
   * `pan.threshold`/`onPanStart`/`onPanRejected` real, working meaning
   * again (previously dead configuration with no gesture to apply to —
   * see this file's own header comment). */
  panStart?: ScreenPoint;
  /** Set while exactly two pointers are down and pinch-zoom is active —
   * `lastDistance` is the finger-to-finger distance as of the last
   * processed `pointermove`, used to compute each move's own
   * *incremental* zoom ratio (matching the wheel handler's own
   * per-tick relative zoom) rather than a ratio against the gesture's
   * starting distance, which would zoom relative to the wrong baseline
   * after the very first move. */
  pinch?: {
    lastDistance: number;
  };
}
const chartStates = new WeakMap<Chart, ZoomPluginState>();
function getState(chart: Chart): ZoomPluginState {
  if (stryMutAct_9fa48("520")) {
    {}
  } else {
    stryCov_9fa48("520");
    let state = chartStates.get(chart);
    if (stryMutAct_9fa48("523") ? false : stryMutAct_9fa48("522") ? true : stryMutAct_9fa48("521") ? state : (stryCov_9fa48("521", "522", "523"), !state)) {
      if (stryMutAct_9fa48("524")) {
        {}
      } else {
        stryCov_9fa48("524");
        state = stryMutAct_9fa48("525") ? {} : (stryCov_9fa48("525"), {
          originalScaleLimits: {},
          updatedScaleLimits: {},
          handlers: {},
          panDelta: {},
          dragging: stryMutAct_9fa48("526") ? true : (stryCov_9fa48("526"), false),
          panning: stryMutAct_9fa48("527") ? true : (stryCov_9fa48("527"), false),
          options: {},
          pointers: new Map()
        });
        chartStates.set(chart, state);
      }
    }
    return state;
  }
}
function removeState(chart: Chart): void {
  if (stryMutAct_9fa48("528")) {
    {}
  } else {
    stryCov_9fa48("528");
    chartStates.delete(chart);
  }
}
function liveScales(chart: Chart): LiveScale[] {
  if (stryMutAct_9fa48("529")) {
    {}
  } else {
    stryCov_9fa48("529");
    return Object.values(chart.scales as unknown as Record<string, LiveScale>);
  }
}

// ---- direction/mode helpers ----

function getModifierKey(opts: {
  enabled?: boolean;
  modifierKey?: string | null;
} | undefined): string | null | undefined {
  if (stryMutAct_9fa48("530")) {
    {}
  } else {
    stryCov_9fa48("530");
    return (stryMutAct_9fa48("533") ? opts || opts.enabled : stryMutAct_9fa48("532") ? false : stryMutAct_9fa48("531") ? true : (stryCov_9fa48("531", "532", "533"), opts && opts.enabled)) ? opts.modifierKey : undefined;
  }
}
function keyPressed(key: string | null | undefined, event: MouseEvent): boolean {
  if (stryMutAct_9fa48("534")) {
    {}
  } else {
    stryCov_9fa48("534");
    return stryMutAct_9fa48("537") ? !!key || !!(event as unknown as Record<string, boolean>)[`${key}Key`] : stryMutAct_9fa48("536") ? false : stryMutAct_9fa48("535") ? true : (stryCov_9fa48("535", "536", "537"), (stryMutAct_9fa48("538") ? !key : (stryCov_9fa48("538"), !(stryMutAct_9fa48("539") ? key : (stryCov_9fa48("539"), !key)))) && (stryMutAct_9fa48("540") ? !(event as unknown as Record<string, boolean>)[`${key}Key`] : (stryCov_9fa48("540"), !(stryMutAct_9fa48("541") ? (event as unknown as Record<string, boolean>)[`${key}Key`] : (stryCov_9fa48("541"), !(event as unknown as Record<string, boolean>)[stryMutAct_9fa48("542") ? `` : (stryCov_9fa48("542"), `${key}Key`)])))));
  }
}
function keyNotPressed(key: string | null | undefined, event: MouseEvent): boolean {
  if (stryMutAct_9fa48("543")) {
    {}
  } else {
    stryCov_9fa48("543");
    return stryMutAct_9fa48("546") ? !!key || !(event as unknown as Record<string, boolean>)[`${key}Key`] : stryMutAct_9fa48("545") ? false : stryMutAct_9fa48("544") ? true : (stryCov_9fa48("544", "545", "546"), (stryMutAct_9fa48("547") ? !key : (stryCov_9fa48("547"), !(stryMutAct_9fa48("548") ? key : (stryCov_9fa48("548"), !key)))) && (stryMutAct_9fa48("549") ? (event as unknown as Record<string, boolean>)[`${key}Key`] : (stryCov_9fa48("549"), !(event as unknown as Record<string, boolean>)[stryMutAct_9fa48("550") ? `` : (stryCov_9fa48("550"), `${key}Key`)])));
  }
}
function directionEnabled(mode: ZoomMode | undefined, dir: ZoomDirection, chart: Chart): boolean {
  if (stryMutAct_9fa48("551")) {
    {}
  } else {
    stryCov_9fa48("551");
    if (stryMutAct_9fa48("554") ? mode !== undefined : stryMutAct_9fa48("553") ? false : stryMutAct_9fa48("552") ? true : (stryCov_9fa48("552", "553", "554"), mode === undefined)) return stryMutAct_9fa48("555") ? false : (stryCov_9fa48("555"), true);
    if (stryMutAct_9fa48("558") ? typeof mode !== 'string' : stryMutAct_9fa48("557") ? false : stryMutAct_9fa48("556") ? true : (stryCov_9fa48("556", "557", "558"), typeof mode === (stryMutAct_9fa48("559") ? "" : (stryCov_9fa48("559"), 'string')))) return stryMutAct_9fa48("562") ? mode.indexOf(dir) === -1 : stryMutAct_9fa48("561") ? false : stryMutAct_9fa48("560") ? true : (stryCov_9fa48("560", "561", "562"), mode.indexOf(dir) !== (stryMutAct_9fa48("563") ? +1 : (stryCov_9fa48("563"), -1)));
    if (stryMutAct_9fa48("566") ? typeof mode !== 'function' : stryMutAct_9fa48("565") ? false : stryMutAct_9fa48("564") ? true : (stryCov_9fa48("564", "565", "566"), typeof mode === (stryMutAct_9fa48("567") ? "" : (stryCov_9fa48("567"), 'function')))) return stryMutAct_9fa48("570") ? mode({
      chart
    }).indexOf(dir) === -1 : stryMutAct_9fa48("569") ? false : stryMutAct_9fa48("568") ? true : (stryCov_9fa48("568", "569", "570"), mode(stryMutAct_9fa48("571") ? {} : (stryCov_9fa48("571"), {
      chart
    })).indexOf(dir) !== (stryMutAct_9fa48("572") ? +1 : (stryCov_9fa48("572"), -1)));
    return stryMutAct_9fa48("573") ? true : (stryCov_9fa48("573"), false);
  }
}
function directionsEnabled(mode: ZoomMode | undefined, chart: Chart): {
  x: boolean;
  y: boolean;
} {
  if (stryMutAct_9fa48("574")) {
    {}
  } else {
    stryCov_9fa48("574");
    const resolved = (stryMutAct_9fa48("577") ? typeof mode !== 'function' : stryMutAct_9fa48("576") ? false : stryMutAct_9fa48("575") ? true : (stryCov_9fa48("575", "576", "577"), typeof mode === (stryMutAct_9fa48("578") ? "" : (stryCov_9fa48("578"), 'function')))) ? mode(stryMutAct_9fa48("579") ? {} : (stryCov_9fa48("579"), {
      chart
    })) : mode;
    if (stryMutAct_9fa48("582") ? typeof resolved !== 'string' : stryMutAct_9fa48("581") ? false : stryMutAct_9fa48("580") ? true : (stryCov_9fa48("580", "581", "582"), typeof resolved === (stryMutAct_9fa48("583") ? "" : (stryCov_9fa48("583"), 'string')))) {
      if (stryMutAct_9fa48("584")) {
        {}
      } else {
        stryCov_9fa48("584");
        return stryMutAct_9fa48("585") ? {} : (stryCov_9fa48("585"), {
          x: stryMutAct_9fa48("588") ? resolved.indexOf('x') === -1 : stryMutAct_9fa48("587") ? false : stryMutAct_9fa48("586") ? true : (stryCov_9fa48("586", "587", "588"), resolved.indexOf(stryMutAct_9fa48("589") ? "" : (stryCov_9fa48("589"), 'x')) !== (stryMutAct_9fa48("590") ? +1 : (stryCov_9fa48("590"), -1))),
          y: stryMutAct_9fa48("593") ? resolved.indexOf('y') === -1 : stryMutAct_9fa48("592") ? false : stryMutAct_9fa48("591") ? true : (stryCov_9fa48("591", "592", "593"), resolved.indexOf(stryMutAct_9fa48("594") ? "" : (stryCov_9fa48("594"), 'y')) !== (stryMutAct_9fa48("595") ? +1 : (stryCov_9fa48("595"), -1)))
        });
      }
    }
    return stryMutAct_9fa48("596") ? {} : (stryCov_9fa48("596"), {
      x: stryMutAct_9fa48("597") ? true : (stryCov_9fa48("597"), false),
      y: stryMutAct_9fa48("598") ? true : (stryCov_9fa48("598"), false)
    });
  }
}
function debounce(fn: () => void, delay: number): () => number {
  if (stryMutAct_9fa48("599")) {
    {}
  } else {
    stryCov_9fa48("599");
    let timeout: ReturnType<typeof setTimeout>;
    return function debounced(): number {
      if (stryMutAct_9fa48("600")) {
        {}
      } else {
        stryCov_9fa48("600");
        clearTimeout(timeout);
        timeout = setTimeout(fn, delay);
        return delay;
      }
    };
  }
}
function getScaleUnderPoint(point: ScreenPoint, chart: Chart): LiveScale | null {
  if (stryMutAct_9fa48("601")) {
    {}
  } else {
    stryCov_9fa48("601");
    for (const scale of liveScales(chart)) {
      if (stryMutAct_9fa48("602")) {
        {}
      } else {
        stryCov_9fa48("602");
        if (stryMutAct_9fa48("605") ? point.y >= scale.top && point.y <= scale.bottom && point.x >= scale.left || point.x <= scale.right : stryMutAct_9fa48("604") ? false : stryMutAct_9fa48("603") ? true : (stryCov_9fa48("603", "604", "605"), (stryMutAct_9fa48("607") ? point.y >= scale.top && point.y <= scale.bottom || point.x >= scale.left : stryMutAct_9fa48("606") ? true : (stryCov_9fa48("606", "607"), (stryMutAct_9fa48("609") ? point.y >= scale.top || point.y <= scale.bottom : stryMutAct_9fa48("608") ? true : (stryCov_9fa48("608", "609"), (stryMutAct_9fa48("612") ? point.y < scale.top : stryMutAct_9fa48("611") ? point.y > scale.top : stryMutAct_9fa48("610") ? true : (stryCov_9fa48("610", "611", "612"), point.y >= scale.top)) && (stryMutAct_9fa48("615") ? point.y > scale.bottom : stryMutAct_9fa48("614") ? point.y < scale.bottom : stryMutAct_9fa48("613") ? true : (stryCov_9fa48("613", "614", "615"), point.y <= scale.bottom)))) && (stryMutAct_9fa48("618") ? point.x < scale.left : stryMutAct_9fa48("617") ? point.x > scale.left : stryMutAct_9fa48("616") ? true : (stryCov_9fa48("616", "617", "618"), point.x >= scale.left)))) && (stryMutAct_9fa48("621") ? point.x > scale.right : stryMutAct_9fa48("620") ? point.x < scale.right : stryMutAct_9fa48("619") ? true : (stryCov_9fa48("619", "620", "621"), point.x <= scale.right)))) {
          if (stryMutAct_9fa48("622")) {
            {}
          } else {
            stryCov_9fa48("622");
            return scale;
          }
        }
      }
    }
    return null;
  }
}
function getEnabledScalesByPoint(options: {
  mode?: ZoomMode;
  scaleMode?: ZoomMode;
  overScaleMode?: ZoomMode;
} | undefined, point: ScreenPoint, chart: Chart): LiveScale[] {
  if (stryMutAct_9fa48("623")) {
    {}
  } else {
    stryCov_9fa48("623");
    const {
      mode = stryMutAct_9fa48("624") ? "" : (stryCov_9fa48("624"), 'xy'),
      scaleMode,
      overScaleMode
    } = stryMutAct_9fa48("625") ? options && {} : (stryCov_9fa48("625"), options ?? {});
    const scale = getScaleUnderPoint(point, chart);
    const enabled = directionsEnabled(mode, chart);
    const scaleEnabled = directionsEnabled(scaleMode, chart);
    if (stryMutAct_9fa48("627") ? false : stryMutAct_9fa48("626") ? true : (stryCov_9fa48("626", "627"), overScaleMode)) {
      if (stryMutAct_9fa48("628")) {
        {}
      } else {
        stryCov_9fa48("628");
        const overScaleEnabled = directionsEnabled(overScaleMode, chart);
        for (const axis of ['x', 'y'] as const) {
          if (stryMutAct_9fa48("629")) {
            {}
          } else {
            stryCov_9fa48("629");
            if (stryMutAct_9fa48("631") ? false : stryMutAct_9fa48("630") ? true : (stryCov_9fa48("630", "631"), overScaleEnabled[axis])) {
              if (stryMutAct_9fa48("632")) {
                {}
              } else {
                stryCov_9fa48("632");
                scaleEnabled[axis] = enabled[axis];
                enabled[axis] = stryMutAct_9fa48("633") ? true : (stryCov_9fa48("633"), false);
              }
            }
          }
        }
      }
    }
    if (stryMutAct_9fa48("636") ? scale || scaleEnabled[scale.axis as 'x' | 'y'] : stryMutAct_9fa48("635") ? false : stryMutAct_9fa48("634") ? true : (stryCov_9fa48("634", "635", "636"), scale && scaleEnabled[scale.axis as 'x' | 'y'])) {
      if (stryMutAct_9fa48("637")) {
        {}
      } else {
        stryCov_9fa48("637");
        return stryMutAct_9fa48("638") ? [] : (stryCov_9fa48("638"), [scale]);
      }
    }
    return stryMutAct_9fa48("639") ? liveScales(chart) : (stryCov_9fa48("639"), liveScales(chart).filter(stryMutAct_9fa48("640") ? () => undefined : (stryCov_9fa48("640"), scaleItem => enabled[scaleItem.axis as 'x' | 'y'])));
  }
}

// ---- zoom/pan math, per scale type ----

function zoomDelta(val: number, min: number, range: number, newRange: number): {
  min: number;
  max: number;
} {
  if (stryMutAct_9fa48("641")) {
    {}
  } else {
    stryCov_9fa48("641");
    const minPercent = stryMutAct_9fa48("642") ? Math.min(0, Math.min(1, (val - min) / range || 0)) : (stryCov_9fa48("642"), Math.max(0, stryMutAct_9fa48("643") ? Math.max(1, (val - min) / range || 0) : (stryCov_9fa48("643"), Math.min(1, stryMutAct_9fa48("646") ? (val - min) / range && 0 : stryMutAct_9fa48("645") ? false : stryMutAct_9fa48("644") ? true : (stryCov_9fa48("644", "645", "646"), (stryMutAct_9fa48("647") ? (val - min) * range : (stryCov_9fa48("647"), (stryMutAct_9fa48("648") ? val + min : (stryCov_9fa48("648"), val - min)) / range)) || 0)))));
    const maxPercent = stryMutAct_9fa48("649") ? 1 + minPercent : (stryCov_9fa48("649"), 1 - minPercent);
    return stryMutAct_9fa48("650") ? {} : (stryCov_9fa48("650"), {
      min: stryMutAct_9fa48("651") ? newRange / minPercent : (stryCov_9fa48("651"), newRange * minPercent),
      max: stryMutAct_9fa48("652") ? newRange / maxPercent : (stryCov_9fa48("652"), newRange * maxPercent)
    });
  }
}
function getValueAtPoint(scale: LiveScale, point: ScreenPoint): number | undefined {
  if (stryMutAct_9fa48("653")) {
    {}
  } else {
    stryCov_9fa48("653");
    const pixel = scale.isHorizontal() ? point.x : point.y;
    // Deliberately NOT `?? NaN` here (unlike linearRange/panNumericalScale
    // below, which need a concrete number for isNaN checks): the original
    // plugin's own `logarithmicZoomRange` genuinely branches on this
    // value being `undefined` specifically (an out-of-range pixel), and
    // an earlier version of this port coerced it to NaN here, which
    // silently made that branch permanently unreachable — confirmed as a
    // real, introduced regression via a failing test ("leaves a
    // logarithmic scale unchanged when the zoom center resolves to an
    // undefined value"), not a hypothetical. `linearZoomDelta`'s own
    // caller passes this straight into `zoomDelta`, which already
    // tolerates `undefined`/`NaN` via its own `|| 0` fallback, so no
    // caller needed a NaN specifically — only `logarithmicZoomRange`
    // needed the real `undefined` to reach it at all.
    return scale.getValueForPixel(pixel);
  }
}
function linearZoomDelta(scale: LiveScale, zoomAmount: number, center: ScreenPoint): {
  min: number;
  max: number;
} {
  if (stryMutAct_9fa48("654")) {
    {}
  } else {
    stryCov_9fa48("654");
    const range = stryMutAct_9fa48("655") ? scale.max + scale.min : (stryCov_9fa48("655"), scale.max - scale.min);
    const newRange = stryMutAct_9fa48("656") ? range / (zoomAmount - 1) : (stryCov_9fa48("656"), range * (stryMutAct_9fa48("657") ? zoomAmount + 1 : (stryCov_9fa48("657"), zoomAmount - 1)));
    const centerValue = getValueAtPoint(scale, center);
    return zoomDelta(stryMutAct_9fa48("658") ? centerValue && NaN : (stryCov_9fa48("658"), centerValue ?? NaN), scale.min, range, newRange);
  }
}
function logarithmicZoomRange(scale: LiveScale, zoomAmount: number, center: ScreenPoint): {
  min: number;
  max: number;
} {
  if (stryMutAct_9fa48("659")) {
    {}
  } else {
    stryCov_9fa48("659");
    const centerValue = getValueAtPoint(scale, center);
    if (stryMutAct_9fa48("662") ? centerValue !== undefined : stryMutAct_9fa48("661") ? false : stryMutAct_9fa48("660") ? true : (stryCov_9fa48("660", "661", "662"), centerValue === undefined)) return stryMutAct_9fa48("663") ? {} : (stryCov_9fa48("663"), {
      min: scale.min,
      max: scale.max
    });
    const logMin = Math.log10(scale.min);
    const logMax = Math.log10(scale.max);
    const logCenter = Math.log10(centerValue);
    const logRange = stryMutAct_9fa48("664") ? logMax + logMin : (stryCov_9fa48("664"), logMax - logMin);
    const newLogRange = stryMutAct_9fa48("665") ? logRange / (zoomAmount - 1) : (stryCov_9fa48("665"), logRange * (stryMutAct_9fa48("666") ? zoomAmount + 1 : (stryCov_9fa48("666"), zoomAmount - 1)));
    const delta = zoomDelta(logCenter, logMin, logRange, newLogRange);
    return stryMutAct_9fa48("667") ? {} : (stryCov_9fa48("667"), {
      min: Math.pow(10, stryMutAct_9fa48("668") ? logMin - delta.min : (stryCov_9fa48("668"), logMin + delta.min)),
      max: Math.pow(10, stryMutAct_9fa48("669") ? logMax + delta.max : (stryCov_9fa48("669"), logMax - delta.max))
    });
  }
}
function getScaleLimits(scale: LiveScale, limits: Record<string, ScaleLimits> | undefined): ScaleLimits {
  if (stryMutAct_9fa48("670")) {
    {}
  } else {
    stryCov_9fa48("670");
    return stryMutAct_9fa48("673") ? limits && (limits[scale.id] ?? limits[scale.axis as string]) && {} : stryMutAct_9fa48("672") ? false : stryMutAct_9fa48("671") ? true : (stryCov_9fa48("671", "672", "673"), (stryMutAct_9fa48("675") ? limits || (limits[scale.id] ?? limits[scale.axis as string]) : stryMutAct_9fa48("674") ? false : (stryCov_9fa48("674", "675"), limits && (stryMutAct_9fa48("676") ? limits[scale.id] && limits[scale.axis as string] : (stryCov_9fa48("676"), limits[scale.id] ?? limits[scale.axis as string])))) || {});
  }
}
function getLimit(state: ZoomPluginState, scale: LiveScale, scaleLimits: ScaleLimits, prop: 'min' | 'max', fallback: number): number {
  if (stryMutAct_9fa48("677")) {
    {}
  } else {
    stryCov_9fa48("677");
    const limit = scaleLimits[prop];
    if (stryMutAct_9fa48("680") ? limit !== 'original' : stryMutAct_9fa48("679") ? false : stryMutAct_9fa48("678") ? true : (stryCov_9fa48("678", "679", "680"), limit === (stryMutAct_9fa48("681") ? "" : (stryCov_9fa48("681"), 'original')))) {
      if (stryMutAct_9fa48("682")) {
        {}
      } else {
        stryCov_9fa48("682");
        const original = state.originalScaleLimits[scale.id][prop];
        return stryMutAct_9fa48("683") ? original.options && original.scale : (stryCov_9fa48("683"), original.options ?? original.scale);
      }
    }
    return stryMutAct_9fa48("684") ? limit && fallback : (stryCov_9fa48("684"), limit ?? fallback);
  }
}
function linearRange(scale: LiveScale, pixel0: number, pixel1: number): {
  min: number;
  max: number;
} {
  if (stryMutAct_9fa48("685")) {
    {}
  } else {
    stryCov_9fa48("685");
    const v0 = stryMutAct_9fa48("686") ? scale.getValueForPixel(pixel0) && NaN : (stryCov_9fa48("686"), scale.getValueForPixel(pixel0) ?? NaN);
    const v1 = stryMutAct_9fa48("687") ? scale.getValueForPixel(pixel1) && NaN : (stryCov_9fa48("687"), scale.getValueForPixel(pixel1) ?? NaN);
    return stryMutAct_9fa48("688") ? {} : (stryCov_9fa48("688"), {
      min: stryMutAct_9fa48("689") ? Math.max(v0, v1) : (stryCov_9fa48("689"), Math.min(v0, v1)),
      max: stryMutAct_9fa48("690") ? Math.min(v0, v1) : (stryCov_9fa48("690"), Math.max(v0, v1))
    });
  }
}
function fixRange(range: number, bounds: {
  min: number;
  max: number;
  minLimit: number;
  maxLimit: number;
}, originalLimits: {
  min: ScaleLimitSnapshot;
  max: ScaleLimitSnapshot;
}): {
  min: number;
  max: number;
} {
  if (stryMutAct_9fa48("691")) {
    {}
  } else {
    stryCov_9fa48("691");
    let {
      min,
      max
    } = bounds;
    const {
      minLimit,
      maxLimit
    } = bounds;
    const offset = stryMutAct_9fa48("692") ? (range - max + min) * 2 : (stryCov_9fa48("692"), (stryMutAct_9fa48("693") ? range - max - min : (stryCov_9fa48("693"), (stryMutAct_9fa48("694") ? range + max : (stryCov_9fa48("694"), range - max)) + min)) / 2);
    stryMutAct_9fa48("695") ? min += offset : (stryCov_9fa48("695"), min -= offset);
    stryMutAct_9fa48("696") ? max -= offset : (stryCov_9fa48("696"), max += offset);
    const origMin = stryMutAct_9fa48("697") ? originalLimits.min.options && originalLimits.min.scale : (stryCov_9fa48("697"), originalLimits.min.options ?? originalLimits.min.scale);
    const origMax = stryMutAct_9fa48("698") ? originalLimits.max.options && originalLimits.max.scale : (stryCov_9fa48("698"), originalLimits.max.options ?? originalLimits.max.scale);
    const epsilon = stryMutAct_9fa48("699") ? range * 1e6 : (stryCov_9fa48("699"), range / 1e6);
    if (stryMutAct_9fa48("703") ? Math.abs(min - origMin) >= epsilon : stryMutAct_9fa48("702") ? Math.abs(min - origMin) <= epsilon : stryMutAct_9fa48("701") ? false : stryMutAct_9fa48("700") ? true : (stryCov_9fa48("700", "701", "702", "703"), Math.abs(stryMutAct_9fa48("704") ? min + origMin : (stryCov_9fa48("704"), min - origMin)) < epsilon)) min = origMin;
    if (stryMutAct_9fa48("708") ? Math.abs(max - origMax) >= epsilon : stryMutAct_9fa48("707") ? Math.abs(max - origMax) <= epsilon : stryMutAct_9fa48("706") ? false : stryMutAct_9fa48("705") ? true : (stryCov_9fa48("705", "706", "707", "708"), Math.abs(stryMutAct_9fa48("709") ? max + origMax : (stryCov_9fa48("709"), max - origMax)) < epsilon)) max = origMax;
    if (stryMutAct_9fa48("713") ? min >= minLimit : stryMutAct_9fa48("712") ? min <= minLimit : stryMutAct_9fa48("711") ? false : stryMutAct_9fa48("710") ? true : (stryCov_9fa48("710", "711", "712", "713"), min < minLimit)) {
      if (stryMutAct_9fa48("714")) {
        {}
      } else {
        stryCov_9fa48("714");
        min = minLimit;
        max = stryMutAct_9fa48("715") ? Math.max(minLimit + range, maxLimit) : (stryCov_9fa48("715"), Math.min(stryMutAct_9fa48("716") ? minLimit - range : (stryCov_9fa48("716"), minLimit + range), maxLimit));
      }
    } else if (stryMutAct_9fa48("720") ? max <= maxLimit : stryMutAct_9fa48("719") ? max >= maxLimit : stryMutAct_9fa48("718") ? false : stryMutAct_9fa48("717") ? true : (stryCov_9fa48("717", "718", "719", "720"), max > maxLimit)) {
      if (stryMutAct_9fa48("721")) {
        {}
      } else {
        stryCov_9fa48("721");
        max = maxLimit;
        min = stryMutAct_9fa48("722") ? Math.min(maxLimit - range, minLimit) : (stryCov_9fa48("722"), Math.max(stryMutAct_9fa48("723") ? maxLimit + range : (stryCov_9fa48("723"), maxLimit - range), minLimit));
      }
    }
    return stryMutAct_9fa48("724") ? {} : (stryCov_9fa48("724"), {
      min,
      max
    });
  }
}
/** `zoomKind: true` for a real zoom, `'pan'` for a pan-triggered update (different limit-violation
 * behavior — see the real `zoomKind === 'pan'` check below), `false` for neither. */
function updateRange(scale: LiveScale, range: {
  min: number;
  max: number;
}, limits: Record<string, ScaleLimits> | undefined, zoomKind: boolean | 'pan' = stryMutAct_9fa48("725") ? true : (stryCov_9fa48("725"), false)): boolean {
  if (stryMutAct_9fa48("726")) {
    {}
  } else {
    stryCov_9fa48("726");
    const state = getState(scale.chart);
    const scaleOpts = scale.options as {
      min?: number;
      max?: number;
    };
    const scaleLimits = getScaleLimits(scale, limits);
    const {
      minRange = 0
    } = scaleLimits;
    const minLimit = getLimit(state, scale, scaleLimits, stryMutAct_9fa48("727") ? "" : (stryCov_9fa48("727"), 'min'), stryMutAct_9fa48("728") ? +Infinity : (stryCov_9fa48("728"), -Infinity));
    const maxLimit = getLimit(state, scale, scaleLimits, stryMutAct_9fa48("729") ? "" : (stryCov_9fa48("729"), 'max'), Infinity);
    if (stryMutAct_9fa48("732") ? zoomKind === 'pan' || range.min < minLimit || range.max > maxLimit : stryMutAct_9fa48("731") ? false : stryMutAct_9fa48("730") ? true : (stryCov_9fa48("730", "731", "732"), (stryMutAct_9fa48("734") ? zoomKind !== 'pan' : stryMutAct_9fa48("733") ? true : (stryCov_9fa48("733", "734"), zoomKind === (stryMutAct_9fa48("735") ? "" : (stryCov_9fa48("735"), 'pan')))) && (stryMutAct_9fa48("737") ? range.min < minLimit && range.max > maxLimit : stryMutAct_9fa48("736") ? true : (stryCov_9fa48("736", "737"), (stryMutAct_9fa48("740") ? range.min >= minLimit : stryMutAct_9fa48("739") ? range.min <= minLimit : stryMutAct_9fa48("738") ? false : (stryCov_9fa48("738", "739", "740"), range.min < minLimit)) || (stryMutAct_9fa48("743") ? range.max <= maxLimit : stryMutAct_9fa48("742") ? range.max >= maxLimit : stryMutAct_9fa48("741") ? false : (stryCov_9fa48("741", "742", "743"), range.max > maxLimit)))))) return stryMutAct_9fa48("744") ? false : (stryCov_9fa48("744"), true);
    const scaleRange = stryMutAct_9fa48("745") ? scale.max + scale.min : (stryCov_9fa48("745"), scale.max - scale.min);
    const newSpan = zoomKind ? stryMutAct_9fa48("746") ? Math.min(range.max - range.min, minRange) : (stryCov_9fa48("746"), Math.max(stryMutAct_9fa48("747") ? range.max + range.min : (stryCov_9fa48("747"), range.max - range.min), minRange)) : scaleRange;
    if (stryMutAct_9fa48("750") ? zoomKind && newSpan === minRange || scaleRange <= minRange : stryMutAct_9fa48("749") ? false : stryMutAct_9fa48("748") ? true : (stryCov_9fa48("748", "749", "750"), (stryMutAct_9fa48("752") ? zoomKind || newSpan === minRange : stryMutAct_9fa48("751") ? true : (stryCov_9fa48("751", "752"), zoomKind && (stryMutAct_9fa48("754") ? newSpan !== minRange : stryMutAct_9fa48("753") ? true : (stryCov_9fa48("753", "754"), newSpan === minRange)))) && (stryMutAct_9fa48("757") ? scaleRange > minRange : stryMutAct_9fa48("756") ? scaleRange < minRange : stryMutAct_9fa48("755") ? true : (stryCov_9fa48("755", "756", "757"), scaleRange <= minRange)))) return stryMutAct_9fa48("758") ? false : (stryCov_9fa48("758"), true);
    const fixed = fixRange(newSpan, stryMutAct_9fa48("759") ? {} : (stryCov_9fa48("759"), {
      min: range.min,
      max: range.max,
      minLimit,
      maxLimit
    }), state.originalScaleLimits[scale.id]);
    scaleOpts.min = fixed.min;
    scaleOpts.max = fixed.max;
    state.updatedScaleLimits[scale.id] = fixed;
    return stryMutAct_9fa48("762") ? scale.parse(fixed.min) !== scale.min && scale.parse(fixed.max) !== scale.max : stryMutAct_9fa48("761") ? false : stryMutAct_9fa48("760") ? true : (stryCov_9fa48("760", "761", "762"), (stryMutAct_9fa48("764") ? scale.parse(fixed.min) === scale.min : stryMutAct_9fa48("763") ? false : (stryCov_9fa48("763", "764"), scale.parse(fixed.min) !== scale.min)) || (stryMutAct_9fa48("766") ? scale.parse(fixed.max) === scale.max : stryMutAct_9fa48("765") ? false : (stryCov_9fa48("765", "766"), scale.parse(fixed.max) !== scale.max)));
  }
}
function zoomNumericalScale(scale: LiveScale, zoomAmount: number, center: ScreenPoint, limits: Record<string, ScaleLimits> | undefined): boolean {
  if (stryMutAct_9fa48("767")) {
    {}
  } else {
    stryCov_9fa48("767");
    const delta = linearZoomDelta(scale, zoomAmount, center);
    return updateRange(scale, stryMutAct_9fa48("768") ? {} : (stryCov_9fa48("768"), {
      min: stryMutAct_9fa48("769") ? scale.min - delta.min : (stryCov_9fa48("769"), scale.min + delta.min),
      max: stryMutAct_9fa48("770") ? scale.max + delta.max : (stryCov_9fa48("770"), scale.max - delta.max)
    }), limits, stryMutAct_9fa48("771") ? false : (stryCov_9fa48("771"), true));
  }
}
function zoomLogarithmicScale(scale: LiveScale, zoomAmount: number, center: ScreenPoint, limits: Record<string, ScaleLimits> | undefined): boolean {
  if (stryMutAct_9fa48("772")) {
    {}
  } else {
    stryCov_9fa48("772");
    return updateRange(scale, logarithmicZoomRange(scale, zoomAmount, center), limits, stryMutAct_9fa48("773") ? false : (stryCov_9fa48("773"), true));
  }
}
function zoomRectNumericalScale(scale: LiveScale, from: number, to: number, limits: Record<string, ScaleLimits> | undefined): void {
  if (stryMutAct_9fa48("774")) {
    {}
  } else {
    stryCov_9fa48("774");
    updateRange(scale, linearRange(scale, from, to), limits, stryMutAct_9fa48("775") ? false : (stryCov_9fa48("775"), true));
  }
}
const integerChange = stryMutAct_9fa48("776") ? () => undefined : (stryCov_9fa48("776"), (() => {
  const integerChange = (v: number): number => (stryMutAct_9fa48("779") ? v === 0 && isNaN(v) : stryMutAct_9fa48("778") ? false : stryMutAct_9fa48("777") ? true : (stryCov_9fa48("777", "778", "779"), (stryMutAct_9fa48("781") ? v !== 0 : stryMutAct_9fa48("780") ? false : (stryCov_9fa48("780", "781"), v === 0)) || isNaN(v))) ? 0 : (stryMutAct_9fa48("785") ? v >= 0 : stryMutAct_9fa48("784") ? v <= 0 : stryMutAct_9fa48("783") ? false : stryMutAct_9fa48("782") ? true : (stryCov_9fa48("782", "783", "784", "785"), v < 0)) ? stryMutAct_9fa48("786") ? Math.max(Math.round(v), -1) : (stryCov_9fa48("786"), Math.min(Math.round(v), stryMutAct_9fa48("787") ? +1 : (stryCov_9fa48("787"), -1))) : stryMutAct_9fa48("788") ? Math.min(Math.round(v), 1) : (stryCov_9fa48("788"), Math.max(Math.round(v), 1));
  return integerChange;
})());
function existCategoryFromMaxZoom(scale: LiveScale): void {
  if (stryMutAct_9fa48("789")) {
    {}
  } else {
    stryCov_9fa48("789");
    const maxIndex = stryMutAct_9fa48("790") ? scale.getLabels().length + 1 : (stryCov_9fa48("790"), scale.getLabels().length - 1);
    if (stryMutAct_9fa48("794") ? scale.min <= 0 : stryMutAct_9fa48("793") ? scale.min >= 0 : stryMutAct_9fa48("792") ? false : stryMutAct_9fa48("791") ? true : (stryCov_9fa48("791", "792", "793", "794"), scale.min > 0)) stryMutAct_9fa48("795") ? scale.min += 1 : (stryCov_9fa48("795"), scale.min -= 1);
    if (stryMutAct_9fa48("799") ? scale.max >= maxIndex : stryMutAct_9fa48("798") ? scale.max <= maxIndex : stryMutAct_9fa48("797") ? false : stryMutAct_9fa48("796") ? true : (stryCov_9fa48("796", "797", "798", "799"), scale.max < maxIndex)) stryMutAct_9fa48("800") ? scale.max -= 1 : (stryCov_9fa48("800"), scale.max += 1);
  }
}
function zoomCategoryScale(scale: LiveScale, zoomAmount: number, center: ScreenPoint, limits: Record<string, ScaleLimits> | undefined): boolean {
  if (stryMutAct_9fa48("801")) {
    {}
  } else {
    stryCov_9fa48("801");
    const delta = linearZoomDelta(scale, zoomAmount, center);
    if (stryMutAct_9fa48("804") ? scale.min === scale.max || zoomAmount < 1 : stryMutAct_9fa48("803") ? false : stryMutAct_9fa48("802") ? true : (stryCov_9fa48("802", "803", "804"), (stryMutAct_9fa48("806") ? scale.min !== scale.max : stryMutAct_9fa48("805") ? true : (stryCov_9fa48("805", "806"), scale.min === scale.max)) && (stryMutAct_9fa48("809") ? zoomAmount >= 1 : stryMutAct_9fa48("808") ? zoomAmount <= 1 : stryMutAct_9fa48("807") ? true : (stryCov_9fa48("807", "808", "809"), zoomAmount < 1)))) existCategoryFromMaxZoom(scale);
    return updateRange(scale, stryMutAct_9fa48("810") ? {} : (stryCov_9fa48("810"), {
      min: stryMutAct_9fa48("811") ? scale.min - integerChange(delta.min) : (stryCov_9fa48("811"), scale.min + integerChange(delta.min)),
      max: stryMutAct_9fa48("812") ? scale.max + integerChange(delta.max) : (stryCov_9fa48("812"), scale.max - integerChange(delta.max))
    }), limits, stryMutAct_9fa48("813") ? false : (stryCov_9fa48("813"), true));
  }
}
function scaleLength(scale: LiveScale): number {
  if (stryMutAct_9fa48("814")) {
    {}
  } else {
    stryCov_9fa48("814");
    return scale.isHorizontal() ? scale.width : scale.height;
  }
}
function panCategoryScale(scale: LiveScale, delta: number, limits: Record<string, ScaleLimits> | undefined): boolean {
  if (stryMutAct_9fa48("815")) {
    {}
  } else {
    stryCov_9fa48("815");
    const lastLabelIndex = stryMutAct_9fa48("816") ? scale.getLabels().length + 1 : (stryCov_9fa48("816"), scale.getLabels().length - 1);
    let {
      min,
      max
    } = scale;
    const range = stryMutAct_9fa48("817") ? Math.min(max - min, 1) : (stryCov_9fa48("817"), Math.max(stryMutAct_9fa48("818") ? max + min : (stryCov_9fa48("818"), max - min), 1));
    const stepDelta = Math.round(stryMutAct_9fa48("819") ? scaleLength(scale) * Math.max(range, 10) : (stryCov_9fa48("819"), scaleLength(scale) / (stryMutAct_9fa48("820") ? Math.min(range, 10) : (stryCov_9fa48("820"), Math.max(range, 10)))));
    const stepSize = Math.round(Math.abs(stryMutAct_9fa48("821") ? delta * stepDelta : (stryCov_9fa48("821"), delta / stepDelta)));
    let applied: boolean | undefined;
    if (stryMutAct_9fa48("825") ? delta >= -stepDelta : stryMutAct_9fa48("824") ? delta <= -stepDelta : stryMutAct_9fa48("823") ? false : stryMutAct_9fa48("822") ? true : (stryCov_9fa48("822", "823", "824", "825"), delta < (stryMutAct_9fa48("826") ? +stepDelta : (stryCov_9fa48("826"), -stepDelta)))) {
      if (stryMutAct_9fa48("827")) {
        {}
      } else {
        stryCov_9fa48("827");
        max = stryMutAct_9fa48("828") ? Math.max(max + stepSize, lastLabelIndex) : (stryCov_9fa48("828"), Math.min(stryMutAct_9fa48("829") ? max - stepSize : (stryCov_9fa48("829"), max + stepSize), lastLabelIndex));
        min = (stryMutAct_9fa48("832") ? range !== 1 : stryMutAct_9fa48("831") ? false : stryMutAct_9fa48("830") ? true : (stryCov_9fa48("830", "831", "832"), range === 1)) ? max : stryMutAct_9fa48("833") ? max + range : (stryCov_9fa48("833"), max - range);
        applied = stryMutAct_9fa48("836") ? max !== lastLabelIndex : stryMutAct_9fa48("835") ? false : stryMutAct_9fa48("834") ? true : (stryCov_9fa48("834", "835", "836"), max === lastLabelIndex);
      }
    } else if (stryMutAct_9fa48("840") ? delta <= stepDelta : stryMutAct_9fa48("839") ? delta >= stepDelta : stryMutAct_9fa48("838") ? false : stryMutAct_9fa48("837") ? true : (stryCov_9fa48("837", "838", "839", "840"), delta > stepDelta)) {
      if (stryMutAct_9fa48("841")) {
        {}
      } else {
        stryCov_9fa48("841");
        min = stryMutAct_9fa48("842") ? Math.min(0, min - stepSize) : (stryCov_9fa48("842"), Math.max(0, stryMutAct_9fa48("843") ? min + stepSize : (stryCov_9fa48("843"), min - stepSize)));
        max = (stryMutAct_9fa48("846") ? range !== 1 : stryMutAct_9fa48("845") ? false : stryMutAct_9fa48("844") ? true : (stryCov_9fa48("844", "845", "846"), range === 1)) ? min : stryMutAct_9fa48("847") ? min - range : (stryCov_9fa48("847"), min + range);
        applied = stryMutAct_9fa48("850") ? min !== 0 : stryMutAct_9fa48("849") ? false : stryMutAct_9fa48("848") ? true : (stryCov_9fa48("848", "849", "850"), min === 0);
      }
    }
    return stryMutAct_9fa48("853") ? updateRange(scale, {
      min,
      max
    }, limits) && !!applied : stryMutAct_9fa48("852") ? false : stryMutAct_9fa48("851") ? true : (stryCov_9fa48("851", "852", "853"), updateRange(scale, stryMutAct_9fa48("854") ? {} : (stryCov_9fa48("854"), {
      min,
      max
    }), limits) || (stryMutAct_9fa48("855") ? !applied : (stryCov_9fa48("855"), !(stryMutAct_9fa48("856") ? applied : (stryCov_9fa48("856"), !applied)))));
  }
}
const OFFSETS: Record<string, number> = stryMutAct_9fa48("857") ? {} : (stryCov_9fa48("857"), {
  second: 500,
  minute: stryMutAct_9fa48("858") ? 30 / 1000 : (stryCov_9fa48("858"), 30 * 1000),
  hour: stryMutAct_9fa48("859") ? 30 * 60 / 1000 : (stryCov_9fa48("859"), (stryMutAct_9fa48("860") ? 30 / 60 : (stryCov_9fa48("860"), 30 * 60)) * 1000),
  day: stryMutAct_9fa48("861") ? 12 * 60 * 60 / 1000 : (stryCov_9fa48("861"), (stryMutAct_9fa48("862") ? 12 * 60 / 60 : (stryCov_9fa48("862"), (stryMutAct_9fa48("863") ? 12 / 60 : (stryCov_9fa48("863"), 12 * 60)) * 60)) * 1000),
  week: stryMutAct_9fa48("864") ? 3.5 * 24 * 60 * 60 / 1000 : (stryCov_9fa48("864"), (stryMutAct_9fa48("865") ? 3.5 * 24 * 60 / 60 : (stryCov_9fa48("865"), (stryMutAct_9fa48("866") ? 3.5 * 24 / 60 : (stryCov_9fa48("866"), (stryMutAct_9fa48("867") ? 3.5 / 24 : (stryCov_9fa48("867"), 3.5 * 24)) * 60)) * 60)) * 1000),
  month: stryMutAct_9fa48("868") ? 15 * 24 * 60 * 60 / 1000 : (stryCov_9fa48("868"), (stryMutAct_9fa48("869") ? 15 * 24 * 60 / 60 : (stryCov_9fa48("869"), (stryMutAct_9fa48("870") ? 15 * 24 / 60 : (stryCov_9fa48("870"), (stryMutAct_9fa48("871") ? 15 / 24 : (stryCov_9fa48("871"), 15 * 24)) * 60)) * 60)) * 1000),
  quarter: stryMutAct_9fa48("872") ? 60 * 24 * 60 * 60 / 1000 : (stryCov_9fa48("872"), (stryMutAct_9fa48("873") ? 60 * 24 * 60 / 60 : (stryCov_9fa48("873"), (stryMutAct_9fa48("874") ? 60 * 24 / 60 : (stryCov_9fa48("874"), (stryMutAct_9fa48("875") ? 60 / 24 : (stryCov_9fa48("875"), 60 * 24)) * 60)) * 60)) * 1000),
  year: stryMutAct_9fa48("876") ? 182 * 24 * 60 * 60 / 1000 : (stryCov_9fa48("876"), (stryMutAct_9fa48("877") ? 182 * 24 * 60 / 60 : (stryCov_9fa48("877"), (stryMutAct_9fa48("878") ? 182 * 24 / 60 : (stryCov_9fa48("878"), (stryMutAct_9fa48("879") ? 182 / 24 : (stryCov_9fa48("879"), 182 * 24)) * 60)) * 60)) * 1000)
});
function panNumericalScale(scale: LiveScale, delta: number, limits: Record<string, ScaleLimits> | undefined, pan = stryMutAct_9fa48("880") ? true : (stryCov_9fa48("880"), false)): boolean {
  if (stryMutAct_9fa48("881")) {
    {}
  } else {
    stryCov_9fa48("881");
    const prevStart = scale.min;
    const prevEnd = scale.max;
    const round = stryMutAct_9fa48("882") ? (scale.options as {
      time?: {
        round?: string;
      };
    }).time.round : (stryCov_9fa48("882"), (scale.options as {
      time?: {
        round?: string;
      };
    }).time?.round);
    const offset = stryMutAct_9fa48("885") ? round && OFFSETS[round] && 0 : stryMutAct_9fa48("884") ? false : stryMutAct_9fa48("883") ? true : (stryCov_9fa48("883", "884", "885"), (stryMutAct_9fa48("887") ? round || OFFSETS[round] : stryMutAct_9fa48("886") ? false : (stryCov_9fa48("886", "887"), round && OFFSETS[round])) || 0);
    const newMin = stryMutAct_9fa48("888") ? scale.getValueForPixel(scale.getPixelForValue(prevStart + offset) - delta) && NaN : (stryCov_9fa48("888"), scale.getValueForPixel(stryMutAct_9fa48("889") ? scale.getPixelForValue(prevStart + offset) + delta : (stryCov_9fa48("889"), scale.getPixelForValue(stryMutAct_9fa48("890") ? prevStart - offset : (stryCov_9fa48("890"), prevStart + offset)) - delta)) ?? NaN);
    const newMax = stryMutAct_9fa48("891") ? scale.getValueForPixel(scale.getPixelForValue(prevEnd + offset) - delta) && NaN : (stryCov_9fa48("891"), scale.getValueForPixel(stryMutAct_9fa48("892") ? scale.getPixelForValue(prevEnd + offset) + delta : (stryCov_9fa48("892"), scale.getPixelForValue(stryMutAct_9fa48("893") ? prevEnd - offset : (stryCov_9fa48("893"), prevEnd + offset)) - delta)) ?? NaN);
    if (stryMutAct_9fa48("896") ? isNaN(newMin) && isNaN(newMax) : stryMutAct_9fa48("895") ? false : stryMutAct_9fa48("894") ? true : (stryCov_9fa48("894", "895", "896"), isNaN(newMin) || isNaN(newMax))) return stryMutAct_9fa48("897") ? false : (stryCov_9fa48("897"), true);
    return updateRange(scale, stryMutAct_9fa48("898") ? {} : (stryCov_9fa48("898"), {
      min: newMin,
      max: newMax
    }), limits, pan ? stryMutAct_9fa48("899") ? "" : (stryCov_9fa48("899"), 'pan') : stryMutAct_9fa48("900") ? true : (stryCov_9fa48("900"), false));
  }
}
function panNonLinearScale(scale: LiveScale, delta: number, limits: Record<string, ScaleLimits> | undefined): boolean {
  if (stryMutAct_9fa48("901")) {
    {}
  } else {
    stryCov_9fa48("901");
    return panNumericalScale(scale, delta, limits, stryMutAct_9fa48("902") ? false : (stryCov_9fa48("902"), true));
  }
}
const zoomFunctions: Record<string, (scale: LiveScale, zoomAmount: number, center: ScreenPoint, limits: Record<string, ScaleLimits> | undefined) => boolean> = stryMutAct_9fa48("903") ? {} : (stryCov_9fa48("903"), {
  category: zoomCategoryScale,
  default: zoomNumericalScale,
  logarithmic: zoomLogarithmicScale
});
const zoomRectFunctions: Record<string, (scale: LiveScale, from: number, to: number, limits: Record<string, ScaleLimits> | undefined) => void> = stryMutAct_9fa48("904") ? {} : (stryCov_9fa48("904"), {
  default: zoomRectNumericalScale
});
const panFunctions: Record<string, (scale: LiveScale, delta: number, limits: Record<string, ScaleLimits> | undefined) => boolean> = stryMutAct_9fa48("905") ? {} : (stryCov_9fa48("905"), {
  category: panCategoryScale,
  default: panNumericalScale,
  logarithmic: panNonLinearScale,
  timeseries: panNonLinearScale
});

// ---- scale-limit bookkeeping ----

function shouldUpdateScaleLimits(scale: LiveScale, originalScaleLimits: ZoomPluginState['originalScaleLimits'], updatedScaleLimits: ZoomPluginState['updatedScaleLimits']): boolean {
  if (stryMutAct_9fa48("906")) {
    {}
  } else {
    stryCov_9fa48("906");
    const {
      id
    } = scale;
    const opts = scale.options as {
      min?: number;
      max?: number;
    };
    if (stryMutAct_9fa48("909") ? !originalScaleLimits[id] && !updatedScaleLimits[id] : stryMutAct_9fa48("908") ? false : stryMutAct_9fa48("907") ? true : (stryCov_9fa48("907", "908", "909"), (stryMutAct_9fa48("910") ? originalScaleLimits[id] : (stryCov_9fa48("910"), !originalScaleLimits[id])) || (stryMutAct_9fa48("911") ? updatedScaleLimits[id] : (stryCov_9fa48("911"), !updatedScaleLimits[id])))) return stryMutAct_9fa48("912") ? false : (stryCov_9fa48("912"), true);
    const previous = updatedScaleLimits[id];
    return stryMutAct_9fa48("915") ? previous.min !== opts.min && previous.max !== opts.max : stryMutAct_9fa48("914") ? false : stryMutAct_9fa48("913") ? true : (stryCov_9fa48("913", "914", "915"), (stryMutAct_9fa48("917") ? previous.min === opts.min : stryMutAct_9fa48("916") ? false : (stryCov_9fa48("916", "917"), previous.min !== opts.min)) || (stryMutAct_9fa48("919") ? previous.max === opts.max : stryMutAct_9fa48("918") ? false : (stryCov_9fa48("918", "919"), previous.max !== opts.max)));
  }
}
function removeMissingScales(limits: Record<string, unknown>, scaleIds: Set<string>): void {
  if (stryMutAct_9fa48("920")) {
    {}
  } else {
    stryCov_9fa48("920");
    for (const key of Object.keys(limits)) {
      if (stryMutAct_9fa48("921")) {
        {}
      } else {
        stryCov_9fa48("921");
        if (stryMutAct_9fa48("924") ? false : stryMutAct_9fa48("923") ? true : stryMutAct_9fa48("922") ? scaleIds.has(key) : (stryCov_9fa48("922", "923", "924"), !scaleIds.has(key))) delete limits[key];
      }
    }
  }
}
function storeOriginalScaleLimits(chart: Chart, state: ZoomPluginState): ZoomPluginState['originalScaleLimits'] {
  if (stryMutAct_9fa48("925")) {
    {}
  } else {
    stryCov_9fa48("925");
    const scales = liveScales(chart);
    const {
      originalScaleLimits,
      updatedScaleLimits
    } = state;
    for (const scale of scales) {
      if (stryMutAct_9fa48("926")) {
        {}
      } else {
        stryCov_9fa48("926");
        if (stryMutAct_9fa48("928") ? false : stryMutAct_9fa48("927") ? true : (stryCov_9fa48("927", "928"), shouldUpdateScaleLimits(scale, originalScaleLimits, updatedScaleLimits))) {
          if (stryMutAct_9fa48("929")) {
            {}
          } else {
            stryCov_9fa48("929");
            const opts = scale.options as {
              min?: number;
              max?: number;
            };
            originalScaleLimits[scale.id] = stryMutAct_9fa48("930") ? {} : (stryCov_9fa48("930"), {
              min: stryMutAct_9fa48("931") ? {} : (stryCov_9fa48("931"), {
                scale: scale.min,
                options: opts.min
              }),
              max: stryMutAct_9fa48("932") ? {} : (stryCov_9fa48("932"), {
                scale: scale.max,
                options: opts.max
              })
            });
          }
        }
      }
    }
    const scaleIds = new Set(scales.map(stryMutAct_9fa48("933") ? () => undefined : (stryCov_9fa48("933"), s => s.id)));
    removeMissingScales(originalScaleLimits, scaleIds);
    removeMissingScales(updatedScaleLimits, scaleIds);
    return originalScaleLimits;
  }
}
function doZoom(scale: LiveScale, amount: number, center: ScreenPoint, limits: Record<string, ScaleLimits> | undefined): void {
  if (stryMutAct_9fa48("934")) {
    {}
  } else {
    stryCov_9fa48("934");
    const fn = stryMutAct_9fa48("935") ? zoomFunctions[scale.type] && zoomFunctions.default : (stryCov_9fa48("935"), zoomFunctions[scale.type] ?? zoomFunctions.default);
    fn(scale, amount, center, limits);
  }
}
function doZoomRect(scale: LiveScale, from: number, to: number, limits: Record<string, ScaleLimits> | undefined): void {
  if (stryMutAct_9fa48("936")) {
    {}
  } else {
    stryCov_9fa48("936");
    const fn = stryMutAct_9fa48("937") ? zoomRectFunctions[scale.type] && zoomRectFunctions.default : (stryCov_9fa48("937"), zoomRectFunctions[scale.type] ?? zoomRectFunctions.default);
    fn(scale, from, to, limits);
  }
}
function getCenter(chart: Chart): ScreenPoint {
  if (stryMutAct_9fa48("938")) {
    {}
  } else {
    stryCov_9fa48("938");
    const ca = chart.chartArea;
    return stryMutAct_9fa48("939") ? {} : (stryCov_9fa48("939"), {
      x: stryMutAct_9fa48("940") ? (ca.left + ca.right) * 2 : (stryCov_9fa48("940"), (stryMutAct_9fa48("941") ? ca.left - ca.right : (stryCov_9fa48("941"), ca.left + ca.right)) / 2),
      y: stryMutAct_9fa48("942") ? (ca.top + ca.bottom) * 2 : (stryCov_9fa48("942"), (stryMutAct_9fa48("943") ? ca.top - ca.bottom : (stryCov_9fa48("943"), ca.top + ca.bottom)) / 2)
    });
  }
}
/** Chart.js's own `update(mode)` expects a specific string-literal union
 * of built-in transition-mode names, but its own transitions config is
 * genuinely extensible — a plugin (this one included) can pass a custom
 * mode name it expects a consumer to configure under
 * `options.transitions.<mode>`, and Chart.js falls back to default
 * behavior even if that mode isn't configured. Confirmed this is the
 * original plugin's own real, intentional behavior (passing `'zoom'` as
 * a transition mode, not just the standard built-ins) — cast here
 * rather than narrowing this file's own `transition` parameters to the
 * built-in-only union, which would reject that real usage. */
function updateChart(chart: Chart, transition: string): void {
  if (stryMutAct_9fa48("944")) {
    {}
  } else {
    stryCov_9fa48("944");
    chart.update(transition as UpdateMode);
  }
}

// ---- public zoom/pan API (both driven by DOM events below, and callable directly) ----

export type ZoomAmount = number | {
  x?: number;
  y?: number;
  focalPoint?: ScreenPoint;
};
export function zoom(chart: Chart, amount: ZoomAmount, transition = stryMutAct_9fa48("945") ? "" : (stryCov_9fa48("945"), 'none'), trigger = stryMutAct_9fa48("946") ? "" : (stryCov_9fa48("946"), 'api')): void {
  if (stryMutAct_9fa48("947")) {
    {}
  } else {
    stryCov_9fa48("947");
    const {
      x = 1,
      y = 1,
      focalPoint = getCenter(chart)
    } = (stryMutAct_9fa48("950") ? typeof amount !== 'number' : stryMutAct_9fa48("949") ? false : stryMutAct_9fa48("948") ? true : (stryCov_9fa48("948", "949", "950"), typeof amount === (stryMutAct_9fa48("951") ? "" : (stryCov_9fa48("951"), 'number')))) ? stryMutAct_9fa48("952") ? {} : (stryCov_9fa48("952"), {
      x: amount,
      y: amount
    }) : amount;
    const state = getState(chart);
    const {
      limits,
      zoom: zoomOptions
    } = state.options;
    storeOriginalScaleLimits(chart, state);
    const xEnabled = stryMutAct_9fa48("955") ? x === 1 : stryMutAct_9fa48("954") ? false : stryMutAct_9fa48("953") ? true : (stryCov_9fa48("953", "954", "955"), x !== 1);
    const yEnabled = stryMutAct_9fa48("958") ? y === 1 : stryMutAct_9fa48("957") ? false : stryMutAct_9fa48("956") ? true : (stryCov_9fa48("956", "957", "958"), y !== 1);
    const enabledScales = getEnabledScalesByPoint(zoomOptions, focalPoint, chart);
    // getEnabledScalesByPoint always returns a real array (possibly
    // empty), never null/undefined — the original JS's own
    // `enabledScales || chart.scales` therefore never actually falls
    // back at runtime (an empty array is truthy in JS). Using
    // `enabledScales` directly here, unconditionally, matches that real
    // behavior; an earlier draft of this port used
    // `enabledScales.length ? enabledScales : liveScales(chart)`, which
    // is NOT equivalent — confirmed as a real, introduced regression via
    // a failing test ("does not zoom a direction whose scale axis is
    // disabled by mode"), not a hypothetical: that version zoomed every
    // scale whenever none matched the enabled directions, instead of
    // zooming none.
    for (const scale of enabledScales) {
      if (stryMutAct_9fa48("959")) {
        {}
      } else {
        stryCov_9fa48("959");
        if (stryMutAct_9fa48("962") ? scale.isHorizontal() || xEnabled : stryMutAct_9fa48("961") ? false : stryMutAct_9fa48("960") ? true : (stryCov_9fa48("960", "961", "962"), scale.isHorizontal() && xEnabled)) doZoom(scale, x, focalPoint, limits);else if (stryMutAct_9fa48("965") ? !scale.isHorizontal() || yEnabled : stryMutAct_9fa48("964") ? false : stryMutAct_9fa48("963") ? true : (stryCov_9fa48("963", "964", "965"), (stryMutAct_9fa48("966") ? scale.isHorizontal() : (stryCov_9fa48("966"), !scale.isHorizontal())) && yEnabled)) doZoom(scale, y, focalPoint, limits);
      }
    }
    updateChart(chart, transition);
    invoke(stryMutAct_9fa48("967") ? zoomOptions.onZoom : (stryCov_9fa48("967"), zoomOptions?.onZoom), stryMutAct_9fa48("968") ? [] : (stryCov_9fa48("968"), [stryMutAct_9fa48("969") ? {} : (stryCov_9fa48("969"), {
      chart,
      trigger
    })]));
  }
}
export function zoomRect(chart: Chart, p0: ScreenPoint, p1: ScreenPoint, transition = stryMutAct_9fa48("970") ? "" : (stryCov_9fa48("970"), 'none'), trigger = stryMutAct_9fa48("971") ? "" : (stryCov_9fa48("971"), 'api')): void {
  if (stryMutAct_9fa48("972")) {
    {}
  } else {
    stryCov_9fa48("972");
    const state = getState(chart);
    const {
      limits,
      zoom: zoomOptions
    } = state.options;
    const mode = stryMutAct_9fa48("973") ? zoomOptions?.mode && 'xy' : (stryCov_9fa48("973"), (stryMutAct_9fa48("974") ? zoomOptions.mode : (stryCov_9fa48("974"), zoomOptions?.mode)) ?? (stryMutAct_9fa48("975") ? "" : (stryCov_9fa48("975"), 'xy')));
    storeOriginalScaleLimits(chart, state);
    const xEnabled = directionEnabled(mode, stryMutAct_9fa48("976") ? "" : (stryCov_9fa48("976"), 'x'), chart);
    const yEnabled = directionEnabled(mode, stryMutAct_9fa48("977") ? "" : (stryCov_9fa48("977"), 'y'), chart);
    for (const scale of liveScales(chart)) {
      if (stryMutAct_9fa48("978")) {
        {}
      } else {
        stryCov_9fa48("978");
        if (stryMutAct_9fa48("981") ? scale.isHorizontal() || xEnabled : stryMutAct_9fa48("980") ? false : stryMutAct_9fa48("979") ? true : (stryCov_9fa48("979", "980", "981"), scale.isHorizontal() && xEnabled)) doZoomRect(scale, p0.x, p1.x, limits);else if (stryMutAct_9fa48("984") ? !scale.isHorizontal() || yEnabled : stryMutAct_9fa48("983") ? false : stryMutAct_9fa48("982") ? true : (stryCov_9fa48("982", "983", "984"), (stryMutAct_9fa48("985") ? scale.isHorizontal() : (stryCov_9fa48("985"), !scale.isHorizontal())) && yEnabled)) doZoomRect(scale, p0.y, p1.y, limits);
      }
    }
    updateChart(chart, transition);
    invoke(stryMutAct_9fa48("986") ? zoomOptions.onZoom : (stryCov_9fa48("986"), zoomOptions?.onZoom), stryMutAct_9fa48("987") ? [] : (stryCov_9fa48("987"), [stryMutAct_9fa48("988") ? {} : (stryCov_9fa48("988"), {
      chart,
      trigger
    })]));
  }
}
export function zoomScale(chart: Chart, scaleId: string, range: {
  min: number;
  max: number;
}, transition = stryMutAct_9fa48("989") ? "" : (stryCov_9fa48("989"), 'none'), trigger = stryMutAct_9fa48("990") ? "" : (stryCov_9fa48("990"), 'api')): void {
  if (stryMutAct_9fa48("991")) {
    {}
  } else {
    stryCov_9fa48("991");
    const state = getState(chart);
    storeOriginalScaleLimits(chart, state);
    const scale = (chart.scales as unknown as Record<string, LiveScale>)[scaleId];
    updateRange(scale, range, undefined, stryMutAct_9fa48("992") ? false : (stryCov_9fa48("992"), true));
    updateChart(chart, transition);
    invoke(stryMutAct_9fa48("993") ? state.options.zoom.onZoom : (stryCov_9fa48("993"), state.options.zoom?.onZoom), stryMutAct_9fa48("994") ? [] : (stryCov_9fa48("994"), [stryMutAct_9fa48("995") ? {} : (stryCov_9fa48("995"), {
      chart,
      trigger
    })]));
  }
}
export function resetZoom(chart: Chart, transition = stryMutAct_9fa48("996") ? "" : (stryCov_9fa48("996"), 'default')): void {
  if (stryMutAct_9fa48("997")) {
    {}
  } else {
    stryCov_9fa48("997");
    const state = getState(chart);
    const originalScaleLimits = storeOriginalScaleLimits(chart, state);
    for (const scale of liveScales(chart)) {
      if (stryMutAct_9fa48("998")) {
        {}
      } else {
        stryCov_9fa48("998");
        const scaleOptions = scale.options as {
          min?: number;
          max?: number;
        };
        // The `else` branch below (delete, rather than restore) is
        // structurally very hard to reach: `storeOriginalScaleLimits` just
        // ran, above, and always populates `originalScaleLimits[scale.id]`
        // for every scale this same loop iterates (via `liveScales(chart)`,
        // the identical set) — confirmed by reading `shouldUpdateScaleLimits`
        // directly: it returns true whenever either limits map lacks an
        // entry for a scale, which is always true for a scale's very first
        // encounter. This mirrors the original package's own real logic
        // exactly (same shape, same apparent reachability gap), not a
        // simplification introduced by this port.
        if (stryMutAct_9fa48("1000") ? false : stryMutAct_9fa48("999") ? true : (stryCov_9fa48("999", "1000"), originalScaleLimits[scale.id])) {
          if (stryMutAct_9fa48("1001")) {
            {}
          } else {
            stryCov_9fa48("1001");
            scaleOptions.min = originalScaleLimits[scale.id].min.options;
            scaleOptions.max = originalScaleLimits[scale.id].max.options;
          }
        } else {
          if (stryMutAct_9fa48("1002")) {
            {}
          } else {
            stryCov_9fa48("1002");
            delete scaleOptions.min;
            delete scaleOptions.max;
          }
        }
        delete state.updatedScaleLimits[scale.id];
      }
    }
    updateChart(chart, transition);
    invoke(stryMutAct_9fa48("1003") ? state.options.zoom.onZoomComplete : (stryCov_9fa48("1003"), state.options.zoom?.onZoomComplete), stryMutAct_9fa48("1004") ? [] : (stryCov_9fa48("1004"), [stryMutAct_9fa48("1005") ? {} : (stryCov_9fa48("1005"), {
      chart
    })]));
  }
}
function getOriginalRange(state: ZoomPluginState, scaleId: string): number | undefined {
  if (stryMutAct_9fa48("1006")) {
    {}
  } else {
    stryCov_9fa48("1006");
    const original = state.originalScaleLimits[scaleId];
    if (stryMutAct_9fa48("1009") ? false : stryMutAct_9fa48("1008") ? true : stryMutAct_9fa48("1007") ? original : (stryCov_9fa48("1007", "1008", "1009"), !original)) return undefined;
    return stryMutAct_9fa48("1010") ? (original.max.options ?? original.max.scale) + (original.min.options ?? original.min.scale) : (stryCov_9fa48("1010"), (stryMutAct_9fa48("1011") ? original.max.options && original.max.scale : (stryCov_9fa48("1011"), original.max.options ?? original.max.scale)) - (stryMutAct_9fa48("1012") ? original.min.options && original.min.scale : (stryCov_9fa48("1012"), original.min.options ?? original.min.scale)));
  }
}
export function getZoomLevel(chart: Chart): number {
  if (stryMutAct_9fa48("1013")) {
    {}
  } else {
    stryCov_9fa48("1013");
    const state = getState(chart);
    let min = 1;
    let max = 1;
    for (const scale of liveScales(chart)) {
      if (stryMutAct_9fa48("1014")) {
        {}
      } else {
        stryCov_9fa48("1014");
        const origRange = getOriginalRange(state, scale.id);
        if (stryMutAct_9fa48("1016") ? false : stryMutAct_9fa48("1015") ? true : (stryCov_9fa48("1015", "1016"), origRange)) {
          if (stryMutAct_9fa48("1017")) {
            {}
          } else {
            stryCov_9fa48("1017");
            const level = stryMutAct_9fa48("1018") ? Math.round(origRange / (scale.max - scale.min) * 100) * 100 : (stryCov_9fa48("1018"), Math.round(stryMutAct_9fa48("1019") ? origRange / (scale.max - scale.min) / 100 : (stryCov_9fa48("1019"), (stryMutAct_9fa48("1020") ? origRange * (scale.max - scale.min) : (stryCov_9fa48("1020"), origRange / (stryMutAct_9fa48("1021") ? scale.max + scale.min : (stryCov_9fa48("1021"), scale.max - scale.min)))) * 100)) / 100);
            min = stryMutAct_9fa48("1022") ? Math.max(min, level) : (stryCov_9fa48("1022"), Math.min(min, level));
            max = stryMutAct_9fa48("1023") ? Math.min(max, level) : (stryCov_9fa48("1023"), Math.max(max, level));
          }
        }
      }
    }
    return (stryMutAct_9fa48("1027") ? min >= 1 : stryMutAct_9fa48("1026") ? min <= 1 : stryMutAct_9fa48("1025") ? false : stryMutAct_9fa48("1024") ? true : (stryCov_9fa48("1024", "1025", "1026", "1027"), min < 1)) ? min : max;
  }
}
function panScale(scale: LiveScale, delta: number, limits: Record<string, ScaleLimits> | undefined, state: ZoomPluginState): void {
  if (stryMutAct_9fa48("1028")) {
    {}
  } else {
    stryCov_9fa48("1028");
    const {
      panDelta
    } = state;
    const storedDelta = stryMutAct_9fa48("1031") ? panDelta[scale.id] && 0 : stryMutAct_9fa48("1030") ? false : stryMutAct_9fa48("1029") ? true : (stryCov_9fa48("1029", "1030", "1031"), panDelta[scale.id] || 0);
    const effectiveDelta = (stryMutAct_9fa48("1034") ? Math.sign(storedDelta) !== Math.sign(delta) : stryMutAct_9fa48("1033") ? false : stryMutAct_9fa48("1032") ? true : (stryCov_9fa48("1032", "1033", "1034"), Math.sign(storedDelta) === Math.sign(delta))) ? stryMutAct_9fa48("1035") ? delta - storedDelta : (stryCov_9fa48("1035"), delta + storedDelta) : delta;
    const fn = stryMutAct_9fa48("1036") ? panFunctions[scale.type] && panFunctions.default : (stryCov_9fa48("1036"), panFunctions[scale.type] ?? panFunctions.default);
    // The `else` branch below (accumulating an unapplied delta for the
    // next pan call) needs `fn(...)` to return false — meaning the range
    // was computed but didn't actually change. Confirmed reachable, not
    // just theoretical: an extremely small delta (e.g. 1e-7) on a scale
    // with no configured limits lets `fixRange`'s own epsilon-snap-to-
    // original logic (`range / 1e6`) snap the computed range exactly back
    // to the scale's own original bounds, making `updateRange`'s own
    // final "did this actually change anything" check false — see the
    // real, working test for this exact scenario in
    // tests/unit/zoomPlugin.spec.ts.
    if (stryMutAct_9fa48("1038") ? false : stryMutAct_9fa48("1037") ? true : (stryCov_9fa48("1037", "1038"), fn(scale, effectiveDelta, limits))) {
      if (stryMutAct_9fa48("1039")) {
        {}
      } else {
        stryCov_9fa48("1039");
        panDelta[scale.id] = 0;
      }
    } else {
      if (stryMutAct_9fa48("1040")) {
        {}
      } else {
        stryCov_9fa48("1040");
        panDelta[scale.id] = effectiveDelta;
      }
    }
  }
}
export function pan(chart: Chart, delta: number | {
  x?: number;
  y?: number;
}, enabledScales?: LiveScale[], transition = stryMutAct_9fa48("1041") ? "" : (stryCov_9fa48("1041"), 'none')): void {
  if (stryMutAct_9fa48("1042")) {
    {}
  } else {
    stryCov_9fa48("1042");
    const {
      x = 0,
      y = 0
    } = (stryMutAct_9fa48("1045") ? typeof delta !== 'number' : stryMutAct_9fa48("1044") ? false : stryMutAct_9fa48("1043") ? true : (stryCov_9fa48("1043", "1044", "1045"), typeof delta === (stryMutAct_9fa48("1046") ? "" : (stryCov_9fa48("1046"), 'number')))) ? stryMutAct_9fa48("1047") ? {} : (stryCov_9fa48("1047"), {
      x: delta,
      y: delta
    }) : delta;
    const state = getState(chart);
    const {
      pan: panOptions,
      limits
    } = state.options;
    storeOriginalScaleLimits(chart, state);
    const xEnabled = stryMutAct_9fa48("1050") ? x === 0 : stryMutAct_9fa48("1049") ? false : stryMutAct_9fa48("1048") ? true : (stryCov_9fa48("1048", "1049", "1050"), x !== 0);
    const yEnabled = stryMutAct_9fa48("1053") ? y === 0 : stryMutAct_9fa48("1052") ? false : stryMutAct_9fa48("1051") ? true : (stryCov_9fa48("1051", "1052", "1053"), y !== 0);
    const scalesToPan = (stryMutAct_9fa48("1054") ? enabledScales.length : (stryCov_9fa48("1054"), enabledScales?.length)) ? enabledScales : liveScales(chart);
    // Unlike `zoom()` above, `pan()`'s own `enabledScales` parameter is
    // genuinely optional here (undefined when called directly, e.g. via
    // the public `chart.pan()` API with no explicit scale list) — so this
    // fallback IS real and intentional, matching the original's own
    // `enabledScales || chart.scales` for this specific function (whose
    // own `enabledScales` argument can genuinely be undefined, unlike
    // `zoom()`'s own always-computed-array `enabledScales`).
    for (const scale of scalesToPan) {
      if (stryMutAct_9fa48("1055")) {
        {}
      } else {
        stryCov_9fa48("1055");
        if (stryMutAct_9fa48("1058") ? scale.isHorizontal() || xEnabled : stryMutAct_9fa48("1057") ? false : stryMutAct_9fa48("1056") ? true : (stryCov_9fa48("1056", "1057", "1058"), scale.isHorizontal() && xEnabled)) panScale(scale, x, limits, state);else if (stryMutAct_9fa48("1061") ? !scale.isHorizontal() || yEnabled : stryMutAct_9fa48("1060") ? false : stryMutAct_9fa48("1059") ? true : (stryCov_9fa48("1059", "1060", "1061"), (stryMutAct_9fa48("1062") ? scale.isHorizontal() : (stryCov_9fa48("1062"), !scale.isHorizontal())) && yEnabled)) panScale(scale, y, limits, state);
      }
    }
    updateChart(chart, transition);
    invoke(stryMutAct_9fa48("1063") ? panOptions.onPan : (stryCov_9fa48("1063"), panOptions?.onPan), stryMutAct_9fa48("1064") ? [] : (stryCov_9fa48("1064"), [stryMutAct_9fa48("1065") ? {} : (stryCov_9fa48("1065"), {
      chart
    })]));
  }
}
export function getInitialScaleBounds(chart: Chart): Record<string, {
  min?: number;
  max?: number;
}> {
  if (stryMutAct_9fa48("1066")) {
    {}
  } else {
    stryCov_9fa48("1066");
    const state = getState(chart);
    storeOriginalScaleLimits(chart, state);
    const bounds: Record<string, {
      min?: number;
      max?: number;
    }> = {};
    for (const scaleId of Object.keys(chart.scales)) {
      if (stryMutAct_9fa48("1067")) {
        {}
      } else {
        stryCov_9fa48("1067");
        const entry = state.originalScaleLimits[scaleId];
        bounds[scaleId] = stryMutAct_9fa48("1068") ? {} : (stryCov_9fa48("1068"), {
          min: stryMutAct_9fa48("1069") ? entry.min.scale : (stryCov_9fa48("1069"), entry?.min.scale),
          max: stryMutAct_9fa48("1070") ? entry.max.scale : (stryCov_9fa48("1070"), entry?.max.scale)
        });
      }
    }
    return bounds;
  }
}
export function getZoomedScaleBounds(chart: Chart): Record<string, {
  min: number;
  max: number;
} | undefined> {
  if (stryMutAct_9fa48("1071")) {
    {}
  } else {
    stryCov_9fa48("1071");
    const state = getState(chart);
    const bounds: Record<string, {
      min: number;
      max: number;
    } | undefined> = {};
    for (const scaleId of Object.keys(chart.scales)) {
      if (stryMutAct_9fa48("1072")) {
        {}
      } else {
        stryCov_9fa48("1072");
        bounds[scaleId] = state.updatedScaleLimits[scaleId];
      }
    }
    return bounds;
  }
}
export function isZoomedOrPanned(chart: Chart): boolean {
  if (stryMutAct_9fa48("1073")) {
    {}
  } else {
    stryCov_9fa48("1073");
    const bounds = getInitialScaleBounds(chart);
    const scales = chart.scales as unknown as Record<string, LiveScale>;
    for (const scaleId of Object.keys(chart.scales)) {
      if (stryMutAct_9fa48("1074")) {
        {}
      } else {
        stryCov_9fa48("1074");
        const {
          min: originalMin,
          max: originalMax
        } = bounds[scaleId];
        if (stryMutAct_9fa48("1077") ? originalMin !== undefined || scales[scaleId].min !== originalMin : stryMutAct_9fa48("1076") ? false : stryMutAct_9fa48("1075") ? true : (stryCov_9fa48("1075", "1076", "1077"), (stryMutAct_9fa48("1079") ? originalMin === undefined : stryMutAct_9fa48("1078") ? true : (stryCov_9fa48("1078", "1079"), originalMin !== undefined)) && (stryMutAct_9fa48("1081") ? scales[scaleId].min === originalMin : stryMutAct_9fa48("1080") ? true : (stryCov_9fa48("1080", "1081"), scales[scaleId].min !== originalMin)))) return stryMutAct_9fa48("1082") ? false : (stryCov_9fa48("1082"), true);
        if (stryMutAct_9fa48("1085") ? originalMax !== undefined || scales[scaleId].max !== originalMax : stryMutAct_9fa48("1084") ? false : stryMutAct_9fa48("1083") ? true : (stryCov_9fa48("1083", "1084", "1085"), (stryMutAct_9fa48("1087") ? originalMax === undefined : stryMutAct_9fa48("1086") ? true : (stryCov_9fa48("1086", "1087"), originalMax !== undefined)) && (stryMutAct_9fa48("1089") ? scales[scaleId].max === originalMax : stryMutAct_9fa48("1088") ? true : (stryCov_9fa48("1088", "1089"), scales[scaleId].max !== originalMax)))) return stryMutAct_9fa48("1090") ? false : (stryCov_9fa48("1090"), true);
      }
    }
    return stryMutAct_9fa48("1091") ? true : (stryCov_9fa48("1091"), false);
  }
}
export function isZoomingOrPanning(chart: Chart): boolean {
  if (stryMutAct_9fa48("1092")) {
    {}
  } else {
    stryCov_9fa48("1092");
    const state = getState(chart);
    return stryMutAct_9fa48("1095") ? state.panning && state.dragging : stryMutAct_9fa48("1094") ? false : stryMutAct_9fa48("1093") ? true : (stryCov_9fa48("1093", "1094", "1095"), state.panning || state.dragging);
  }
}

// ---- DOM event handling (wheel zoom, drag-to-zoom-rectangle) ----

const clamp = stryMutAct_9fa48("1096") ? () => undefined : (stryCov_9fa48("1096"), (() => {
  const clamp = (x: number, from: number, to: number): number => stryMutAct_9fa48("1097") ? Math.max(to, Math.max(from, x)) : (stryCov_9fa48("1097"), Math.min(to, stryMutAct_9fa48("1098") ? Math.min(from, x) : (stryCov_9fa48("1098"), Math.max(from, x))));
  return clamp;
})());
function removeHandler(chart: Chart, type: string): void {
  if (stryMutAct_9fa48("1099")) {
    {}
  } else {
    stryCov_9fa48("1099");
    const {
      handlers
    } = getState(chart);
    const handler = handlers[type] as (EventListener & {
      target?: EventTarget;
    }) | undefined;
    if (stryMutAct_9fa48("1102") ? handler.target : stryMutAct_9fa48("1101") ? false : stryMutAct_9fa48("1100") ? true : (stryCov_9fa48("1100", "1101", "1102"), handler?.target)) {
      if (stryMutAct_9fa48("1103")) {
        {}
      } else {
        stryCov_9fa48("1103");
        handler.target.removeEventListener(type, handler);
        delete handlers[type];
      }
    }
  }
}
function addHandler(chart: Chart, target: EventTarget, type: string, handler: (chart: Chart, event: Event, options: ZoomPluginOptions) => void): void {
  if (stryMutAct_9fa48("1104")) {
    {}
  } else {
    stryCov_9fa48("1104");
    const {
      handlers,
      options
    } = getState(chart);
    const oldHandler = handlers[type] as (EventListener & {
      target?: EventTarget;
    }) | undefined;
    if (stryMutAct_9fa48("1107") ? oldHandler?.target !== target : stryMutAct_9fa48("1106") ? false : stryMutAct_9fa48("1105") ? true : (stryCov_9fa48("1105", "1106", "1107"), (stryMutAct_9fa48("1108") ? oldHandler.target : (stryCov_9fa48("1108"), oldHandler?.target)) === target)) return;
    removeHandler(chart, type);
    const wrapped = ((event: Event) => handler(chart, event, options)) as EventListener & {
      target?: EventTarget;
    };
    wrapped.target = target;
    handlers[type] = wrapped;
    const passive = (stryMutAct_9fa48("1111") ? type !== 'wheel' : stryMutAct_9fa48("1110") ? false : stryMutAct_9fa48("1109") ? true : (stryCov_9fa48("1109", "1110", "1111"), type === (stryMutAct_9fa48("1112") ? "" : (stryCov_9fa48("1112"), 'wheel')))) ? stryMutAct_9fa48("1113") ? true : (stryCov_9fa48("1113"), false) : undefined;
    target.addEventListener(type, wrapped, stryMutAct_9fa48("1114") ? {} : (stryCov_9fa48("1114"), {
      passive
    }));
  }
}
function mouseMove(chart: Chart, event: Event): void {
  if (stryMutAct_9fa48("1115")) {
    {}
  } else {
    stryCov_9fa48("1115");
    const state = getState(chart);
    if (stryMutAct_9fa48("1117") ? false : stryMutAct_9fa48("1116") ? true : (stryCov_9fa48("1116", "1117"), state.dragStart)) {
      if (stryMutAct_9fa48("1118")) {
        {}
      } else {
        stryCov_9fa48("1118");
        state.dragging = stryMutAct_9fa48("1119") ? false : (stryCov_9fa48("1119"), true);
        state.dragEnd = event as MouseEvent;
        updateChart(chart, stryMutAct_9fa48("1120") ? "" : (stryCov_9fa48("1120"), 'none'));
      }
    }
  }
}
function keyDown(chart: Chart, event: Event): void {
  if (stryMutAct_9fa48("1121")) {
    {}
  } else {
    stryCov_9fa48("1121");
    const state = getState(chart);
    const keyEvent = event as KeyboardEvent;
    if (stryMutAct_9fa48("1124") ? !state.dragStart && keyEvent.key !== 'Escape' : stryMutAct_9fa48("1123") ? false : stryMutAct_9fa48("1122") ? true : (stryCov_9fa48("1122", "1123", "1124"), (stryMutAct_9fa48("1125") ? state.dragStart : (stryCov_9fa48("1125"), !state.dragStart)) || (stryMutAct_9fa48("1127") ? keyEvent.key === 'Escape' : stryMutAct_9fa48("1126") ? false : (stryCov_9fa48("1126", "1127"), keyEvent.key !== (stryMutAct_9fa48("1128") ? "" : (stryCov_9fa48("1128"), 'Escape')))))) return;
    removeHandler(chart, stryMutAct_9fa48("1129") ? "" : (stryCov_9fa48("1129"), 'keydown'));
    state.dragging = stryMutAct_9fa48("1130") ? true : (stryCov_9fa48("1130"), false);
    state.dragStart = state.dragEnd = null;
    updateChart(chart, stryMutAct_9fa48("1131") ? "" : (stryCov_9fa48("1131"), 'none'));
  }
}
function getPointPosition(event: MouseEvent, chart: Chart): ScreenPoint {
  if (stryMutAct_9fa48("1132")) {
    {}
  } else {
    stryCov_9fa48("1132");
    // Restored from the original rather than a naive
    // getBoundingClientRect()-only computation: Chart.js's own
    // `getRelativePosition` accounts for CSS transforms/scaling and
    // border-box sizing on the canvas that a bare bounding-rect diff
    // would silently get wrong under those conditions. Confirmed real,
    // not a guess: this is the original plugin's own exact logic for the
    // "is this event actually targeting the canvas" branch.
    if (stryMutAct_9fa48("1135") ? event.target === chart.canvas : stryMutAct_9fa48("1134") ? false : stryMutAct_9fa48("1133") ? true : (stryCov_9fa48("1133", "1134", "1135"), event.target !== chart.canvas)) {
      if (stryMutAct_9fa48("1136")) {
        {}
      } else {
        stryCov_9fa48("1136");
        const canvasArea = chart.canvas.getBoundingClientRect();
        return stryMutAct_9fa48("1137") ? {} : (stryCov_9fa48("1137"), {
          x: stryMutAct_9fa48("1138") ? event.clientX + canvasArea.left : (stryCov_9fa48("1138"), event.clientX - canvasArea.left),
          y: stryMutAct_9fa48("1139") ? event.clientY + canvasArea.top : (stryCov_9fa48("1139"), event.clientY - canvasArea.top)
        });
      }
    }
    return getRelativePosition(event, chart);
  }
}
function zoomStart(chart: Chart, event: MouseEvent, zoomOptions: NonNullable<ZoomPluginOptions['zoom']>): boolean {
  if (stryMutAct_9fa48("1140")) {
    {}
  } else {
    stryCov_9fa48("1140");
    const {
      onZoomStart,
      onZoomRejected
    } = zoomOptions;
    if (stryMutAct_9fa48("1142") ? false : stryMutAct_9fa48("1141") ? true : (stryCov_9fa48("1141", "1142"), onZoomStart)) {
      if (stryMutAct_9fa48("1143")) {
        {}
      } else {
        stryCov_9fa48("1143");
        const point = getPointPosition(event, chart);
        if (stryMutAct_9fa48("1146") ? invoke(onZoomStart, [{
          chart,
          event,
          point
        }]) !== false : stryMutAct_9fa48("1145") ? false : stryMutAct_9fa48("1144") ? true : (stryCov_9fa48("1144", "1145", "1146"), invoke(onZoomStart, stryMutAct_9fa48("1147") ? [] : (stryCov_9fa48("1147"), [stryMutAct_9fa48("1148") ? {} : (stryCov_9fa48("1148"), {
          chart,
          event,
          point
        })])) === (stryMutAct_9fa48("1149") ? true : (stryCov_9fa48("1149"), false)))) {
          if (stryMutAct_9fa48("1150")) {
            {}
          } else {
            stryCov_9fa48("1150");
            invoke(onZoomRejected, stryMutAct_9fa48("1151") ? [] : (stryCov_9fa48("1151"), [stryMutAct_9fa48("1152") ? {} : (stryCov_9fa48("1152"), {
              chart,
              event
            })]));
            return stryMutAct_9fa48("1153") ? true : (stryCov_9fa48("1153"), false);
          }
        }
      }
    }
    return stryMutAct_9fa48("1154") ? false : (stryCov_9fa48("1154"), true);
  }
}
function mouseDown(chart: Chart, event: Event): void {
  if (stryMutAct_9fa48("1155")) {
    {}
  } else {
    stryCov_9fa48("1155");
    const mouseEvent = event as MouseEvent;
    if (stryMutAct_9fa48("1157") ? false : stryMutAct_9fa48("1156") ? true : (stryCov_9fa48("1156", "1157"), chart.legend)) {
      if (stryMutAct_9fa48("1158")) {
        {}
      } else {
        stryCov_9fa48("1158");
        const point = getRelativePosition(mouseEvent, chart);
        // _isPointInArea's own Point parameter allows nullable x/y (for
        // missing data points) — getRelativePosition's own real return
        // shape is always non-null, so this widens safely with no cast
        // needed.
        if (stryMutAct_9fa48("1160") ? false : stryMutAct_9fa48("1159") ? true : (stryCov_9fa48("1159", "1160"), _isPointInArea(point, chart.legend as unknown as ChartArea))) return;
      }
    }
    const state = getState(chart);
    const {
      pan: panOptions,
      zoom: zoomOptions = {}
    } = state.options;
    if (stryMutAct_9fa48("1163") ? (mouseEvent.button !== 0 || keyPressed(getModifierKey(panOptions), mouseEvent)) && keyNotPressed(getModifierKey(zoomOptions.drag), mouseEvent) : stryMutAct_9fa48("1162") ? false : stryMutAct_9fa48("1161") ? true : (stryCov_9fa48("1161", "1162", "1163"), (stryMutAct_9fa48("1165") ? mouseEvent.button !== 0 && keyPressed(getModifierKey(panOptions), mouseEvent) : stryMutAct_9fa48("1164") ? false : (stryCov_9fa48("1164", "1165"), (stryMutAct_9fa48("1167") ? mouseEvent.button === 0 : stryMutAct_9fa48("1166") ? false : (stryCov_9fa48("1166", "1167"), mouseEvent.button !== 0)) || keyPressed(getModifierKey(panOptions), mouseEvent))) || keyNotPressed(getModifierKey(zoomOptions.drag), mouseEvent))) {
      if (stryMutAct_9fa48("1168")) {
        {}
      } else {
        stryCov_9fa48("1168");
        invoke(zoomOptions.onZoomRejected, stryMutAct_9fa48("1169") ? [] : (stryCov_9fa48("1169"), [stryMutAct_9fa48("1170") ? {} : (stryCov_9fa48("1170"), {
          chart,
          event
        })]));
        return;
      }
    }
    if (stryMutAct_9fa48("1173") ? false : stryMutAct_9fa48("1172") ? true : stryMutAct_9fa48("1171") ? zoomStart(chart, mouseEvent, zoomOptions) : (stryCov_9fa48("1171", "1172", "1173"), !zoomStart(chart, mouseEvent, zoomOptions))) return;
    state.dragStart = mouseEvent;
    addHandler(chart, chart.canvas.ownerDocument, stryMutAct_9fa48("1174") ? "" : (stryCov_9fa48("1174"), 'mousemove'), mouseMove);
    addHandler(chart, window.document, stryMutAct_9fa48("1175") ? "" : (stryCov_9fa48("1175"), 'keydown'), keyDown);
  }
}
function applyAspectRatio(points: {
  begin: ScreenPoint;
  end: ScreenPoint;
}, aspectRatio: number): void {
  if (stryMutAct_9fa48("1176")) {
    {}
  } else {
    stryCov_9fa48("1176");
    let width = stryMutAct_9fa48("1177") ? points.end.x + points.begin.x : (stryCov_9fa48("1177"), points.end.x - points.begin.x);
    let height = stryMutAct_9fa48("1178") ? points.end.y + points.begin.y : (stryCov_9fa48("1178"), points.end.y - points.begin.y);
    const ratio = Math.abs(stryMutAct_9fa48("1179") ? width * height : (stryCov_9fa48("1179"), width / height));
    if (stryMutAct_9fa48("1183") ? ratio <= aspectRatio : stryMutAct_9fa48("1182") ? ratio >= aspectRatio : stryMutAct_9fa48("1181") ? false : stryMutAct_9fa48("1180") ? true : (stryCov_9fa48("1180", "1181", "1182", "1183"), ratio > aspectRatio)) {
      if (stryMutAct_9fa48("1184")) {
        {}
      } else {
        stryCov_9fa48("1184");
        width = stryMutAct_9fa48("1185") ? Math.sign(width) / Math.abs(height * aspectRatio) : (stryCov_9fa48("1185"), Math.sign(width) * Math.abs(stryMutAct_9fa48("1186") ? height / aspectRatio : (stryCov_9fa48("1186"), height * aspectRatio)));
      }
    } else if (stryMutAct_9fa48("1190") ? ratio >= aspectRatio : stryMutAct_9fa48("1189") ? ratio <= aspectRatio : stryMutAct_9fa48("1188") ? false : stryMutAct_9fa48("1187") ? true : (stryCov_9fa48("1187", "1188", "1189", "1190"), ratio < aspectRatio)) {
      if (stryMutAct_9fa48("1191")) {
        {}
      } else {
        stryCov_9fa48("1191");
        height = stryMutAct_9fa48("1192") ? Math.sign(height) / Math.abs(width / aspectRatio) : (stryCov_9fa48("1192"), Math.sign(height) * Math.abs(stryMutAct_9fa48("1193") ? width * aspectRatio : (stryCov_9fa48("1193"), width / aspectRatio)));
      }
    }
    points.end.x = stryMutAct_9fa48("1194") ? points.begin.x - width : (stryCov_9fa48("1194"), points.begin.x + width);
    points.end.y = stryMutAct_9fa48("1195") ? points.begin.y - height : (stryCov_9fa48("1195"), points.begin.y + height);
  }
}
function applyMinMaxProps(rect: Record<string, number>, chartArea: ChartArea, points: {
  begin: ScreenPoint;
  end: ScreenPoint;
}, spec: {
  min: 'left' | 'top';
  max: 'right' | 'bottom';
  prop: 'x' | 'y';
}): void {
  if (stryMutAct_9fa48("1196")) {
    {}
  } else {
    stryCov_9fa48("1196");
    const areaRecord = chartArea as unknown as Record<string, number>;
    rect[spec.min] = clamp(stryMutAct_9fa48("1197") ? Math.max(points.begin[spec.prop], points.end[spec.prop]) : (stryCov_9fa48("1197"), Math.min(points.begin[spec.prop], points.end[spec.prop])), areaRecord[spec.min], areaRecord[spec.max]);
    rect[spec.max] = clamp(stryMutAct_9fa48("1198") ? Math.min(points.begin[spec.prop], points.end[spec.prop]) : (stryCov_9fa48("1198"), Math.max(points.begin[spec.prop], points.end[spec.prop])), areaRecord[spec.min], areaRecord[spec.max]);
  }
}
function getRelativePoints(chart: Chart, pointEvents: {
  dragStart: MouseEvent;
  dragEnd: MouseEvent;
}, maintainAspectRatio: boolean): {
  begin: ScreenPoint;
  end: ScreenPoint;
} {
  if (stryMutAct_9fa48("1199")) {
    {}
  } else {
    stryCov_9fa48("1199");
    const points = stryMutAct_9fa48("1200") ? {} : (stryCov_9fa48("1200"), {
      begin: getPointPosition(pointEvents.dragStart, chart),
      end: getPointPosition(pointEvents.dragEnd, chart)
    });
    if (stryMutAct_9fa48("1202") ? false : stryMutAct_9fa48("1201") ? true : (stryCov_9fa48("1201", "1202"), maintainAspectRatio)) {
      if (stryMutAct_9fa48("1203")) {
        {}
      } else {
        stryCov_9fa48("1203");
        const aspectRatio = stryMutAct_9fa48("1204") ? chart.chartArea.width * chart.chartArea.height : (stryCov_9fa48("1204"), chart.chartArea.width / chart.chartArea.height);
        applyAspectRatio(points, aspectRatio);
      }
    }
    return points;
  }
}
interface DragRect {
  top: number;
  left: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
  zoomX: number;
  zoomY: number;
}
function computeDragRect(chart: Chart, mode: ZoomMode | undefined, pointEvents: {
  dragStart: MouseEvent;
  dragEnd: MouseEvent;
}, maintainAspectRatio: boolean | undefined): DragRect {
  if (stryMutAct_9fa48("1205")) {
    {}
  } else {
    stryCov_9fa48("1205");
    const xEnabled = directionEnabled(mode, stryMutAct_9fa48("1206") ? "" : (stryCov_9fa48("1206"), 'x'), chart);
    const yEnabled = directionEnabled(mode, stryMutAct_9fa48("1207") ? "" : (stryCov_9fa48("1207"), 'y'), chart);
    const {
      top,
      left,
      right,
      bottom,
      width: chartWidth,
      height: chartHeight
    } = chart.chartArea;
    const rect: Record<string, number> = stryMutAct_9fa48("1208") ? {} : (stryCov_9fa48("1208"), {
      top,
      left,
      right,
      bottom
    });
    const points = getRelativePoints(chart, pointEvents, stryMutAct_9fa48("1209") ? !(maintainAspectRatio && xEnabled && yEnabled) : (stryCov_9fa48("1209"), !(stryMutAct_9fa48("1210") ? maintainAspectRatio && xEnabled && yEnabled : (stryCov_9fa48("1210"), !(stryMutAct_9fa48("1213") ? maintainAspectRatio && xEnabled || yEnabled : stryMutAct_9fa48("1212") ? false : stryMutAct_9fa48("1211") ? true : (stryCov_9fa48("1211", "1212", "1213"), (stryMutAct_9fa48("1215") ? maintainAspectRatio || xEnabled : stryMutAct_9fa48("1214") ? true : (stryCov_9fa48("1214", "1215"), maintainAspectRatio && xEnabled)) && yEnabled))))));
    if (stryMutAct_9fa48("1217") ? false : stryMutAct_9fa48("1216") ? true : (stryCov_9fa48("1216", "1217"), xEnabled)) applyMinMaxProps(rect, chart.chartArea, points, stryMutAct_9fa48("1218") ? {} : (stryCov_9fa48("1218"), {
      min: stryMutAct_9fa48("1219") ? "" : (stryCov_9fa48("1219"), 'left'),
      max: stryMutAct_9fa48("1220") ? "" : (stryCov_9fa48("1220"), 'right'),
      prop: stryMutAct_9fa48("1221") ? "" : (stryCov_9fa48("1221"), 'x')
    }));
    if (stryMutAct_9fa48("1223") ? false : stryMutAct_9fa48("1222") ? true : (stryCov_9fa48("1222", "1223"), yEnabled)) applyMinMaxProps(rect, chart.chartArea, points, stryMutAct_9fa48("1224") ? {} : (stryCov_9fa48("1224"), {
      min: stryMutAct_9fa48("1225") ? "" : (stryCov_9fa48("1225"), 'top'),
      max: stryMutAct_9fa48("1226") ? "" : (stryCov_9fa48("1226"), 'bottom'),
      prop: stryMutAct_9fa48("1227") ? "" : (stryCov_9fa48("1227"), 'y')
    }));
    const width = stryMutAct_9fa48("1228") ? rect.right + rect.left : (stryCov_9fa48("1228"), rect.right - rect.left);
    const height = stryMutAct_9fa48("1229") ? rect.bottom + rect.top : (stryCov_9fa48("1229"), rect.bottom - rect.top);
    return stryMutAct_9fa48("1230") ? {} : (stryCov_9fa48("1230"), {
      top: rect.top,
      left: rect.left,
      right: rect.right,
      bottom: rect.bottom,
      width,
      height,
      zoomX: (stryMutAct_9fa48("1233") ? xEnabled || width : stryMutAct_9fa48("1232") ? false : stryMutAct_9fa48("1231") ? true : (stryCov_9fa48("1231", "1232", "1233"), xEnabled && width)) ? stryMutAct_9fa48("1234") ? 1 - (chartWidth - width) / chartWidth : (stryCov_9fa48("1234"), 1 + (stryMutAct_9fa48("1235") ? (chartWidth - width) * chartWidth : (stryCov_9fa48("1235"), (stryMutAct_9fa48("1236") ? chartWidth + width : (stryCov_9fa48("1236"), chartWidth - width)) / chartWidth))) : 1,
      zoomY: (stryMutAct_9fa48("1239") ? yEnabled || height : stryMutAct_9fa48("1238") ? false : stryMutAct_9fa48("1237") ? true : (stryCov_9fa48("1237", "1238", "1239"), yEnabled && height)) ? stryMutAct_9fa48("1240") ? 1 - (chartHeight - height) / chartHeight : (stryCov_9fa48("1240"), 1 + (stryMutAct_9fa48("1241") ? (chartHeight - height) * chartHeight : (stryCov_9fa48("1241"), (stryMutAct_9fa48("1242") ? chartHeight + height : (stryCov_9fa48("1242"), chartHeight - height)) / chartHeight))) : 1
    });
  }
}
function mouseUp(chart: Chart, event: Event): void {
  if (stryMutAct_9fa48("1243")) {
    {}
  } else {
    stryCov_9fa48("1243");
    const state = getState(chart);
    if (stryMutAct_9fa48("1246") ? false : stryMutAct_9fa48("1245") ? true : stryMutAct_9fa48("1244") ? state.dragStart : (stryCov_9fa48("1244", "1245", "1246"), !state.dragStart)) return;
    removeHandler(chart, stryMutAct_9fa48("1247") ? "" : (stryCov_9fa48("1247"), 'mousemove'));
    const zoomOptions = state.options.zoom!;
    const mode = zoomOptions.mode;
    const {
      threshold = 0,
      maintainAspectRatio
    } = zoomOptions.drag!;
    const rect = computeDragRect(chart, mode, stryMutAct_9fa48("1248") ? {} : (stryCov_9fa48("1248"), {
      dragStart: state.dragStart,
      dragEnd: event as MouseEvent
    }), maintainAspectRatio);
    const distanceX = directionEnabled(mode, stryMutAct_9fa48("1249") ? "" : (stryCov_9fa48("1249"), 'x'), chart) ? rect.width : 0;
    const distanceY = directionEnabled(mode, stryMutAct_9fa48("1250") ? "" : (stryCov_9fa48("1250"), 'y'), chart) ? rect.height : 0;
    const distance = Math.sqrt(stryMutAct_9fa48("1251") ? distanceX * distanceX - distanceY * distanceY : (stryCov_9fa48("1251"), (stryMutAct_9fa48("1252") ? distanceX / distanceX : (stryCov_9fa48("1252"), distanceX * distanceX)) + (stryMutAct_9fa48("1253") ? distanceY / distanceY : (stryCov_9fa48("1253"), distanceY * distanceY))));
    state.dragStart = state.dragEnd = null;
    if (stryMutAct_9fa48("1257") ? distance > threshold : stryMutAct_9fa48("1256") ? distance < threshold : stryMutAct_9fa48("1255") ? false : stryMutAct_9fa48("1254") ? true : (stryCov_9fa48("1254", "1255", "1256", "1257"), distance <= threshold)) {
      if (stryMutAct_9fa48("1258")) {
        {}
      } else {
        stryCov_9fa48("1258");
        state.dragging = stryMutAct_9fa48("1259") ? true : (stryCov_9fa48("1259"), false);
        updateChart(chart, stryMutAct_9fa48("1260") ? "" : (stryCov_9fa48("1260"), 'none'));
        return;
      }
    }
    zoomRect(chart, stryMutAct_9fa48("1261") ? {} : (stryCov_9fa48("1261"), {
      x: rect.left,
      y: rect.top
    }), stryMutAct_9fa48("1262") ? {} : (stryCov_9fa48("1262"), {
      x: rect.right,
      y: rect.bottom
    }), stryMutAct_9fa48("1263") ? "" : (stryCov_9fa48("1263"), 'zoom'), stryMutAct_9fa48("1264") ? "" : (stryCov_9fa48("1264"), 'drag'));
    state.dragging = stryMutAct_9fa48("1265") ? true : (stryCov_9fa48("1265"), false);
    state.filterNextClick = stryMutAct_9fa48("1266") ? false : (stryCov_9fa48("1266"), true);
    invoke(zoomOptions.onZoomComplete, stryMutAct_9fa48("1267") ? [] : (stryCov_9fa48("1267"), [stryMutAct_9fa48("1268") ? {} : (stryCov_9fa48("1268"), {
      chart
    })]));
  }
}
function wheelPreconditions(chart: Chart, event: WheelEvent, zoomOptions: NonNullable<ZoomPluginOptions['zoom']>): boolean {
  if (stryMutAct_9fa48("1269")) {
    {}
  } else {
    stryCov_9fa48("1269");
    if (stryMutAct_9fa48("1271") ? false : stryMutAct_9fa48("1270") ? true : (stryCov_9fa48("1270", "1271"), keyNotPressed(getModifierKey(zoomOptions.wheel), event))) {
      if (stryMutAct_9fa48("1272")) {
        {}
      } else {
        stryCov_9fa48("1272");
        invoke(zoomOptions.onZoomRejected, stryMutAct_9fa48("1273") ? [] : (stryCov_9fa48("1273"), [stryMutAct_9fa48("1274") ? {} : (stryCov_9fa48("1274"), {
          chart,
          event
        })]));
        return stryMutAct_9fa48("1275") ? true : (stryCov_9fa48("1275"), false);
      }
    }
    if (stryMutAct_9fa48("1278") ? false : stryMutAct_9fa48("1277") ? true : stryMutAct_9fa48("1276") ? zoomStart(chart, event, zoomOptions) : (stryCov_9fa48("1276", "1277", "1278"), !zoomStart(chart, event, zoomOptions))) return stryMutAct_9fa48("1279") ? true : (stryCov_9fa48("1279"), false);
    if (stryMutAct_9fa48("1281") ? false : stryMutAct_9fa48("1280") ? true : (stryCov_9fa48("1280", "1281"), event.cancelable)) event.preventDefault();
    return stryMutAct_9fa48("1284") ? event.deltaY === undefined : stryMutAct_9fa48("1283") ? false : stryMutAct_9fa48("1282") ? true : (stryCov_9fa48("1282", "1283", "1284"), event.deltaY !== undefined);
  }
}
function wheel(chart: Chart, event: Event): void {
  if (stryMutAct_9fa48("1285")) {
    {}
  } else {
    stryCov_9fa48("1285");
    const state = getState(chart);
    const zoomOptions = state.options.zoom!;
    const wheelEvent = event as WheelEvent;
    if (stryMutAct_9fa48("1288") ? false : stryMutAct_9fa48("1287") ? true : stryMutAct_9fa48("1286") ? wheelPreconditions(chart, wheelEvent, zoomOptions) : (stryCov_9fa48("1286", "1287", "1288"), !wheelPreconditions(chart, wheelEvent, zoomOptions))) return;
    const rect = (wheelEvent.target as HTMLElement).getBoundingClientRect();
    const speed = zoomOptions.wheel!.speed!;
    const percentage = (stryMutAct_9fa48("1292") ? wheelEvent.deltaY < 0 : stryMutAct_9fa48("1291") ? wheelEvent.deltaY > 0 : stryMutAct_9fa48("1290") ? false : stryMutAct_9fa48("1289") ? true : (stryCov_9fa48("1289", "1290", "1291", "1292"), wheelEvent.deltaY >= 0)) ? stryMutAct_9fa48("1293") ? 2 + 1 / (1 - speed) : (stryCov_9fa48("1293"), 2 - (stryMutAct_9fa48("1294") ? 1 * (1 - speed) : (stryCov_9fa48("1294"), 1 / (stryMutAct_9fa48("1295") ? 1 + speed : (stryCov_9fa48("1295"), 1 - speed))))) : stryMutAct_9fa48("1296") ? 1 - speed : (stryCov_9fa48("1296"), 1 + speed);
    const amount: ZoomAmount = stryMutAct_9fa48("1297") ? {} : (stryCov_9fa48("1297"), {
      x: percentage,
      y: percentage,
      focalPoint: stryMutAct_9fa48("1298") ? {} : (stryCov_9fa48("1298"), {
        x: stryMutAct_9fa48("1299") ? wheelEvent.clientX + rect.left : (stryCov_9fa48("1299"), wheelEvent.clientX - rect.left),
        y: stryMutAct_9fa48("1300") ? wheelEvent.clientY + rect.top : (stryCov_9fa48("1300"), wheelEvent.clientY - rect.top)
      })
    });
    zoom(chart, amount, stryMutAct_9fa48("1301") ? "" : (stryCov_9fa48("1301"), 'zoom'), stryMutAct_9fa48("1302") ? "" : (stryCov_9fa48("1302"), 'wheel'));
    const onZoomComplete = getState(chart).handlers.onZoomComplete as (() => void) | undefined;
    stryMutAct_9fa48("1303") ? onZoomComplete() : (stryCov_9fa48("1303"), onZoomComplete?.());
  }
}
function addDebouncedHandler(chart: Chart, name: string, handler: ((ctx: {
  chart: Chart;
}) => void) | undefined, delay: number): void {
  if (stryMutAct_9fa48("1304")) {
    {}
  } else {
    stryCov_9fa48("1304");
    if (stryMutAct_9fa48("1306") ? false : stryMutAct_9fa48("1305") ? true : (stryCov_9fa48("1305", "1306"), handler)) {
      if (stryMutAct_9fa48("1307")) {
        {}
      } else {
        stryCov_9fa48("1307");
        getState(chart).handlers[name] = debounce(stryMutAct_9fa48("1308") ? () => undefined : (stryCov_9fa48("1308"), () => invoke(handler, stryMutAct_9fa48("1309") ? [] : (stryCov_9fa48("1309"), [stryMutAct_9fa48("1310") ? {} : (stryCov_9fa48("1310"), {
          chart
        })]))), delay);
      }
    }
  }
}

// ---- Pointer Events API: touch/pen pan + pinch-zoom (Hammer.js replacement) ----

function getDistance(a: ScreenPoint, b: ScreenPoint): number {
  if (stryMutAct_9fa48("1311")) {
    {}
  } else {
    stryCov_9fa48("1311");
    return Math.sqrt(stryMutAct_9fa48("1312") ? (a.x - b.x) ** 2 - (a.y - b.y) ** 2 : (stryCov_9fa48("1312"), (stryMutAct_9fa48("1313") ? a.x + b.x : (stryCov_9fa48("1313"), a.x - b.x)) ** 2 + (stryMutAct_9fa48("1314") ? a.y + b.y : (stryCov_9fa48("1314"), a.y - b.y)) ** 2));
  }
}
function getMidpoint(a: ScreenPoint, b: ScreenPoint): ScreenPoint {
  if (stryMutAct_9fa48("1315")) {
    {}
  } else {
    stryCov_9fa48("1315");
    return stryMutAct_9fa48("1316") ? {} : (stryCov_9fa48("1316"), {
      x: stryMutAct_9fa48("1317") ? (a.x + b.x) * 2 : (stryCov_9fa48("1317"), (stryMutAct_9fa48("1318") ? a.x - b.x : (stryCov_9fa48("1318"), a.x + b.x)) / 2),
      y: stryMutAct_9fa48("1319") ? (a.y + b.y) * 2 : (stryCov_9fa48("1319"), (stryMutAct_9fa48("1320") ? a.y - b.y : (stryCov_9fa48("1320"), a.y + b.y)) / 2)
    });
  }
}
/** `getPointPosition` above already works correctly for a `PointerEvent`
 * as-is (it only reads `target`/`clientX`/`clientY`, all real,
 * standard `PointerEvent` properties inherited from `MouseEvent`) —
 * this thin wrapper exists purely so call sites below read naturally
 * without an inline cast at every use. */
function pointerPosition(event: PointerEvent, chart: Chart): ScreenPoint {
  if (stryMutAct_9fa48("1321")) {
    {}
  } else {
    stryCov_9fa48("1321");
    return getPointPosition(event as unknown as MouseEvent, chart);
  }
}
function pointerDown(chart: Chart, event: Event): void {
  if (stryMutAct_9fa48("1322")) {
    {}
  } else {
    stryCov_9fa48("1322");
    const pointerEvent = event as PointerEvent;
    // Mouse input is handled entirely by mouseDown/mouseMove/mouseUp/wheel
    // above — this whole pointer-event path exists specifically for
    // touch/pen input (single-finger pan, two-finger pinch-zoom), which
    // have no mouse-gesture equivalent at all (see this file's own header
    // comment). Explicitly excluding 'mouse' here avoids double-handling
    // the same physical click through two separate event systems.
    if (stryMutAct_9fa48("1325") ? pointerEvent.pointerType !== 'mouse' : stryMutAct_9fa48("1324") ? false : stryMutAct_9fa48("1323") ? true : (stryCov_9fa48("1323", "1324", "1325"), pointerEvent.pointerType === (stryMutAct_9fa48("1326") ? "" : (stryCov_9fa48("1326"), 'mouse')))) return;
    const state = getState(chart);
    const {
      pointers
    } = state;
    if (stryMutAct_9fa48("1330") ? pointers.size < 2 : stryMutAct_9fa48("1329") ? pointers.size > 2 : stryMutAct_9fa48("1328") ? false : stryMutAct_9fa48("1327") ? true : (stryCov_9fa48("1327", "1328", "1329", "1330"), pointers.size >= 2)) return; // only ever track the first two touches
    if (stryMutAct_9fa48("1332") ? false : stryMutAct_9fa48("1331") ? true : (stryCov_9fa48("1331", "1332"), chart.legend)) {
      if (stryMutAct_9fa48("1333")) {
        {}
      } else {
        stryCov_9fa48("1333");
        // Same real guard mouseDown's own legend check applies for mouse —
        // don't start a touch gesture over the legend area either.
        const point = pointerPosition(pointerEvent, chart);
        if (stryMutAct_9fa48("1335") ? false : stryMutAct_9fa48("1334") ? true : (stryCov_9fa48("1334", "1335"), _isPointInArea(point, chart.legend as unknown as ChartArea))) return;
      }
    }
    const point = pointerPosition(pointerEvent, chart);
    pointers.set(pointerEvent.pointerId, point);
    // Keeps this pointer's own move/up events arriving even if the
    // finger drifts outside the canvas mid-gesture — without this, a fast
    // drag that momentarily leaves the canvas's own bounds would silently
    // stop updating until the finger re-entered it. Wrapped in try/catch:
    // confirmed via a real, reproduced browser exception (not a guess)
    // that `setPointerCapture` throws a real `NotFoundError` ("No active
    // pointer with the given id is found") whenever the browser's own
    // internal pointer-tracking doesn't (yet, or no longer) recognize this
    // exact pointerId as active — a real, if uncommon, possibility even
    // for genuine hardware input, not just synthetic events. Capture is
    // inherently best-effort here: the gesture itself still works
    // perfectly well without it (this call only helps events keep arriving
    // if the finger leaves the canvas), so a thrown exception here must
    // never abort the rest of this function. The optional chain's own
    // "real capture happens" branch is separately confirmed genuinely
    // untestable in this project's own jsdom test environment: jsdom has
    // no `setPointerCapture` on `Element.prototype` at all.
    try {
      if (stryMutAct_9fa48("1336")) {
        {}
      } else {
        stryCov_9fa48("1336");
        stryMutAct_9fa48("1337") ? (event.target as Element).setPointerCapture(pointerEvent.pointerId) : (stryCov_9fa48("1337"), (event.target as Element).setPointerCapture?.(pointerEvent.pointerId));
      }
    } catch {
      // Best-effort only — see the comment above.
    }
    const zoomOptions = stryMutAct_9fa48("1338") ? state.options.zoom && {} : (stryCov_9fa48("1338"), state.options.zoom ?? {});
    if (stryMutAct_9fa48("1341") ? pointers.size === 2 || zoomOptions.pinch?.enabled : stryMutAct_9fa48("1340") ? false : stryMutAct_9fa48("1339") ? true : (stryCov_9fa48("1339", "1340", "1341"), (stryMutAct_9fa48("1343") ? pointers.size !== 2 : stryMutAct_9fa48("1342") ? true : (stryCov_9fa48("1342", "1343"), pointers.size === 2)) && (stryMutAct_9fa48("1344") ? zoomOptions.pinch.enabled : (stryCov_9fa48("1344"), zoomOptions.pinch?.enabled)))) {
      if (stryMutAct_9fa48("1345")) {
        {}
      } else {
        stryCov_9fa48("1345");
        // A second finger landing while pinch is enabled always takes over
        // from any single-finger pan already in progress — matches the
        // original's own real Hammer-based behavior (a pinch gesture
        // supersedes an in-progress pan the moment a 2nd touch appears).
        if (stryMutAct_9fa48("1348") ? false : stryMutAct_9fa48("1347") ? true : stryMutAct_9fa48("1346") ? zoomStart(chart, pointerEvent, zoomOptions) : (stryCov_9fa48("1346", "1347", "1348"), !zoomStart(chart, pointerEvent, zoomOptions))) return;
        const [p1, p2] = Array.from(pointers.values());
        state.pinch = stryMutAct_9fa48("1349") ? {} : (stryCov_9fa48("1349"), {
          lastDistance: getDistance(p1, p2)
        });
        state.panning = stryMutAct_9fa48("1350") ? true : (stryCov_9fa48("1350"), false);
        state.panStart = undefined;
      }
    } else if (stryMutAct_9fa48("1353") ? pointers.size === 1 || state.options.pan?.enabled : stryMutAct_9fa48("1352") ? false : stryMutAct_9fa48("1351") ? true : (stryCov_9fa48("1351", "1352", "1353"), (stryMutAct_9fa48("1355") ? pointers.size !== 1 : stryMutAct_9fa48("1354") ? true : (stryCov_9fa48("1354", "1355"), pointers.size === 1)) && (stryMutAct_9fa48("1356") ? state.options.pan.enabled : (stryCov_9fa48("1356"), state.options.pan?.enabled)))) {
      if (stryMutAct_9fa48("1357")) {
        {}
      } else {
        stryCov_9fa48("1357");
        // Not yet a confirmed pan — only a candidate until pointerMove sees
        // it cross `pan.threshold` (see pointerMove's own check below).
        state.panStart = point;
      }
    }
  }
}
function pointerMove(chart: Chart, event: Event): void {
  if (stryMutAct_9fa48("1358")) {
    {}
  } else {
    stryCov_9fa48("1358");
    const pointerEvent = event as PointerEvent;
    if (stryMutAct_9fa48("1361") ? pointerEvent.pointerType !== 'mouse' : stryMutAct_9fa48("1360") ? false : stryMutAct_9fa48("1359") ? true : (stryCov_9fa48("1359", "1360", "1361"), pointerEvent.pointerType === (stryMutAct_9fa48("1362") ? "" : (stryCov_9fa48("1362"), 'mouse')))) return;
    const state = getState(chart);
    const {
      pointers
    } = state;
    if (stryMutAct_9fa48("1365") ? false : stryMutAct_9fa48("1364") ? true : stryMutAct_9fa48("1363") ? pointers.has(pointerEvent.pointerId) : (stryCov_9fa48("1363", "1364", "1365"), !pointers.has(pointerEvent.pointerId))) return;
    const previous = pointers.get(pointerEvent.pointerId)!;
    const current = pointerPosition(pointerEvent, chart);
    pointers.set(pointerEvent.pointerId, current);
    if (stryMutAct_9fa48("1368") ? pointers.size === 2 || state.pinch : stryMutAct_9fa48("1367") ? false : stryMutAct_9fa48("1366") ? true : (stryCov_9fa48("1366", "1367", "1368"), (stryMutAct_9fa48("1370") ? pointers.size !== 2 : stryMutAct_9fa48("1369") ? true : (stryCov_9fa48("1369", "1370"), pointers.size === 2)) && state.pinch)) {
      if (stryMutAct_9fa48("1371")) {
        {}
      } else {
        stryCov_9fa48("1371");
        const [p1, p2] = Array.from(pointers.values());
        const distance = getDistance(p1, p2);
        // Guards against a division-by-near-zero spike (fingers briefly
        // overlapping mid-gesture) producing a wild, single-frame zoom jump.
        if (stryMutAct_9fa48("1375") ? state.pinch.lastDistance <= 0 : stryMutAct_9fa48("1374") ? state.pinch.lastDistance >= 0 : stryMutAct_9fa48("1373") ? false : stryMutAct_9fa48("1372") ? true : (stryCov_9fa48("1372", "1373", "1374", "1375"), state.pinch.lastDistance > 0)) {
          if (stryMutAct_9fa48("1376")) {
            {}
          } else {
            stryCov_9fa48("1376");
            const ratio = stryMutAct_9fa48("1377") ? distance * state.pinch.lastDistance : (stryCov_9fa48("1377"), distance / state.pinch.lastDistance);
            zoom(chart, stryMutAct_9fa48("1378") ? {} : (stryCov_9fa48("1378"), {
              x: ratio,
              y: ratio,
              focalPoint: getMidpoint(p1, p2)
            }), stryMutAct_9fa48("1379") ? "" : (stryCov_9fa48("1379"), 'none'), stryMutAct_9fa48("1380") ? "" : (stryCov_9fa48("1380"), 'pinch'));
          }
        }
        state.pinch.lastDistance = distance;
        return;
      }
    }
    if (stryMutAct_9fa48("1383") ? pointers.size !== 1 && !state.options.pan?.enabled : stryMutAct_9fa48("1382") ? false : stryMutAct_9fa48("1381") ? true : (stryCov_9fa48("1381", "1382", "1383"), (stryMutAct_9fa48("1385") ? pointers.size === 1 : stryMutAct_9fa48("1384") ? false : (stryCov_9fa48("1384", "1385"), pointers.size !== 1)) || (stryMutAct_9fa48("1386") ? state.options.pan?.enabled : (stryCov_9fa48("1386"), !(stryMutAct_9fa48("1387") ? state.options.pan.enabled : (stryCov_9fa48("1387"), state.options.pan?.enabled)))))) return;
    const panOptions = state.options.pan;
    if (stryMutAct_9fa48("1390") ? false : stryMutAct_9fa48("1389") ? true : stryMutAct_9fa48("1388") ? state.panning : (stryCov_9fa48("1388", "1389", "1390"), !state.panning)) {
      if (stryMutAct_9fa48("1391")) {
        {}
      } else {
        stryCov_9fa48("1391");
        if (stryMutAct_9fa48("1394") ? false : stryMutAct_9fa48("1393") ? true : stryMutAct_9fa48("1392") ? state.panStart : (stryCov_9fa48("1392", "1393", "1394"), !state.panStart)) return; // gesture already rejected below, or superseded by a pinch
        const threshold = stryMutAct_9fa48("1395") ? panOptions.threshold && 0 : (stryCov_9fa48("1395"), panOptions.threshold ?? 0);
        if (stryMutAct_9fa48("1399") ? getDistance(state.panStart, current) >= threshold : stryMutAct_9fa48("1398") ? getDistance(state.panStart, current) <= threshold : stryMutAct_9fa48("1397") ? false : stryMutAct_9fa48("1396") ? true : (stryCov_9fa48("1396", "1397", "1398", "1399"), getDistance(state.panStart, current) < threshold)) return; // still within threshold, not a pan yet
        if (stryMutAct_9fa48("1402") ? invoke(panOptions.onPanStart, [{
          chart,
          event: pointerEvent,
          point: current
        }]) !== false : stryMutAct_9fa48("1401") ? false : stryMutAct_9fa48("1400") ? true : (stryCov_9fa48("1400", "1401", "1402"), invoke(panOptions.onPanStart, stryMutAct_9fa48("1403") ? [] : (stryCov_9fa48("1403"), [stryMutAct_9fa48("1404") ? {} : (stryCov_9fa48("1404"), {
          chart,
          event: pointerEvent,
          point: current
        })])) === (stryMutAct_9fa48("1405") ? true : (stryCov_9fa48("1405"), false)))) {
          if (stryMutAct_9fa48("1406")) {
            {}
          } else {
            stryCov_9fa48("1406");
            invoke(panOptions.onPanRejected, stryMutAct_9fa48("1407") ? [] : (stryCov_9fa48("1407"), [stryMutAct_9fa48("1408") ? {} : (stryCov_9fa48("1408"), {
              chart,
              event: pointerEvent
            })]));
            state.panStart = undefined; // don't keep re-checking every frame after an explicit rejection
            return;
          }
        }
        state.panning = stryMutAct_9fa48("1409") ? false : (stryCov_9fa48("1409"), true);
        return;
      }
    }
    const dx = stryMutAct_9fa48("1410") ? current.x + previous.x : (stryCov_9fa48("1410"), current.x - previous.x);
    const dy = stryMutAct_9fa48("1411") ? current.y + previous.y : (stryCov_9fa48("1411"), current.y - previous.y);
    if (stryMutAct_9fa48("1414") ? dx !== 0 && dy !== 0 : stryMutAct_9fa48("1413") ? false : stryMutAct_9fa48("1412") ? true : (stryCov_9fa48("1412", "1413", "1414"), (stryMutAct_9fa48("1416") ? dx === 0 : stryMutAct_9fa48("1415") ? false : (stryCov_9fa48("1415", "1416"), dx !== 0)) || (stryMutAct_9fa48("1418") ? dy === 0 : stryMutAct_9fa48("1417") ? false : (stryCov_9fa48("1417", "1418"), dy !== 0)))) pan(chart, stryMutAct_9fa48("1419") ? {} : (stryCov_9fa48("1419"), {
      x: dx,
      y: dy
    }));
  }
}
function pointerUp(chart: Chart, event: Event): void {
  if (stryMutAct_9fa48("1420")) {
    {}
  } else {
    stryCov_9fa48("1420");
    const pointerEvent = event as PointerEvent;
    if (stryMutAct_9fa48("1423") ? pointerEvent.pointerType !== 'mouse' : stryMutAct_9fa48("1422") ? false : stryMutAct_9fa48("1421") ? true : (stryCov_9fa48("1421", "1422", "1423"), pointerEvent.pointerType === (stryMutAct_9fa48("1424") ? "" : (stryCov_9fa48("1424"), 'mouse')))) return;
    const state = getState(chart);
    const {
      pointers
    } = state;
    if (stryMutAct_9fa48("1427") ? false : stryMutAct_9fa48("1426") ? true : stryMutAct_9fa48("1425") ? pointers.has(pointerEvent.pointerId) : (stryCov_9fa48("1425", "1426", "1427"), !pointers.has(pointerEvent.pointerId))) return;
    pointers.delete(pointerEvent.pointerId);
    if (stryMutAct_9fa48("1430") ? pointers.size < 2 || state.pinch : stryMutAct_9fa48("1429") ? false : stryMutAct_9fa48("1428") ? true : (stryCov_9fa48("1428", "1429", "1430"), (stryMutAct_9fa48("1433") ? pointers.size >= 2 : stryMutAct_9fa48("1432") ? pointers.size <= 2 : stryMutAct_9fa48("1431") ? true : (stryCov_9fa48("1431", "1432", "1433"), pointers.size < 2)) && state.pinch)) {
      if (stryMutAct_9fa48("1434")) {
        {}
      } else {
        stryCov_9fa48("1434");
        state.pinch = undefined;
        invoke(stryMutAct_9fa48("1435") ? state.options.zoom.onZoomComplete : (stryCov_9fa48("1435"), state.options.zoom?.onZoomComplete), stryMutAct_9fa48("1436") ? [] : (stryCov_9fa48("1436"), [stryMutAct_9fa48("1437") ? {} : (stryCov_9fa48("1437"), {
          chart
        })]));
      }
    }
    if (stryMutAct_9fa48("1440") ? pointers.size === 1 && state.options.pan?.enabled || !state.pinch : stryMutAct_9fa48("1439") ? false : stryMutAct_9fa48("1438") ? true : (stryCov_9fa48("1438", "1439", "1440"), (stryMutAct_9fa48("1442") ? pointers.size === 1 || state.options.pan?.enabled : stryMutAct_9fa48("1441") ? true : (stryCov_9fa48("1441", "1442"), (stryMutAct_9fa48("1444") ? pointers.size !== 1 : stryMutAct_9fa48("1443") ? true : (stryCov_9fa48("1443", "1444"), pointers.size === 1)) && (stryMutAct_9fa48("1445") ? state.options.pan.enabled : (stryCov_9fa48("1445"), state.options.pan?.enabled)))) && (stryMutAct_9fa48("1446") ? state.pinch : (stryCov_9fa48("1446"), !state.pinch)))) {
      if (stryMutAct_9fa48("1447")) {
        {}
      } else {
        stryCov_9fa48("1447");
        // One finger lifted out of a two-finger pinch, one finger still
        // down — re-baseline as a fresh pan candidate from here, rather than
        // computing a delta against a stale pre-pinch position (which could
        // otherwise produce a spurious jump).
        state.panStart = pointers.values().next().value;
        state.panning = stryMutAct_9fa48("1448") ? true : (stryCov_9fa48("1448"), false);
      }
    } else if (stryMutAct_9fa48("1451") ? pointers.size !== 0 : stryMutAct_9fa48("1450") ? false : stryMutAct_9fa48("1449") ? true : (stryCov_9fa48("1449", "1450", "1451"), pointers.size === 0)) {
      if (stryMutAct_9fa48("1452")) {
        {}
      } else {
        stryCov_9fa48("1452");
        if (stryMutAct_9fa48("1454") ? false : stryMutAct_9fa48("1453") ? true : (stryCov_9fa48("1453", "1454"), state.panning)) invoke(stryMutAct_9fa48("1455") ? state.options.pan.onPanComplete : (stryCov_9fa48("1455"), state.options.pan?.onPanComplete), stryMutAct_9fa48("1456") ? [] : (stryCov_9fa48("1456"), [stryMutAct_9fa48("1457") ? {} : (stryCov_9fa48("1457"), {
          chart
        })]));
        state.panning = stryMutAct_9fa48("1458") ? true : (stryCov_9fa48("1458"), false);
        state.panStart = undefined;
      }
    }
  }
}
function addListeners(chart: Chart, options: ZoomPluginOptions): void {
  if (stryMutAct_9fa48("1459")) {
    {}
  } else {
    stryCov_9fa48("1459");
    const canvas = chart.canvas;
    const wheelOptions = stryMutAct_9fa48("1460") ? options.zoom.wheel : (stryCov_9fa48("1460"), options.zoom?.wheel);
    const dragOptions = stryMutAct_9fa48("1461") ? options.zoom.drag : (stryCov_9fa48("1461"), options.zoom?.drag);
    const onZoomComplete = stryMutAct_9fa48("1462") ? options.zoom.onZoomComplete : (stryCov_9fa48("1462"), options.zoom?.onZoomComplete);
    const pinchEnabled = stryMutAct_9fa48("1464") ? options.zoom.pinch?.enabled : stryMutAct_9fa48("1463") ? options.zoom?.pinch.enabled : (stryCov_9fa48("1463", "1464"), options.zoom?.pinch?.enabled);
    const panEnabled = stryMutAct_9fa48("1465") ? options.pan.enabled : (stryCov_9fa48("1465"), options.pan?.enabled);
    if (stryMutAct_9fa48("1468") ? wheelOptions.enabled : stryMutAct_9fa48("1467") ? false : stryMutAct_9fa48("1466") ? true : (stryCov_9fa48("1466", "1467", "1468"), wheelOptions?.enabled)) {
      if (stryMutAct_9fa48("1469")) {
        {}
      } else {
        stryCov_9fa48("1469");
        addHandler(chart, canvas, stryMutAct_9fa48("1470") ? "" : (stryCov_9fa48("1470"), 'wheel'), wheel);
        addDebouncedHandler(chart, stryMutAct_9fa48("1471") ? "" : (stryCov_9fa48("1471"), 'onZoomComplete'), onZoomComplete, 250);
      }
    } else {
      if (stryMutAct_9fa48("1472")) {
        {}
      } else {
        stryCov_9fa48("1472");
        removeHandler(chart, stryMutAct_9fa48("1473") ? "" : (stryCov_9fa48("1473"), 'wheel'));
      }
    }
    if (stryMutAct_9fa48("1476") ? dragOptions.enabled : stryMutAct_9fa48("1475") ? false : stryMutAct_9fa48("1474") ? true : (stryCov_9fa48("1474", "1475", "1476"), dragOptions?.enabled)) {
      if (stryMutAct_9fa48("1477")) {
        {}
      } else {
        stryCov_9fa48("1477");
        addHandler(chart, canvas, stryMutAct_9fa48("1478") ? "" : (stryCov_9fa48("1478"), 'mousedown'), mouseDown);
        addHandler(chart, canvas.ownerDocument!, stryMutAct_9fa48("1479") ? "" : (stryCov_9fa48("1479"), 'mouseup'), mouseUp);
      }
    } else {
      if (stryMutAct_9fa48("1480")) {
        {}
      } else {
        stryCov_9fa48("1480");
        removeHandler(chart, stryMutAct_9fa48("1481") ? "" : (stryCov_9fa48("1481"), 'mousedown'));
        removeHandler(chart, stryMutAct_9fa48("1482") ? "" : (stryCov_9fa48("1482"), 'mousemove'));
        removeHandler(chart, stryMutAct_9fa48("1483") ? "" : (stryCov_9fa48("1483"), 'mouseup'));
        removeHandler(chart, stryMutAct_9fa48("1484") ? "" : (stryCov_9fa48("1484"), 'keydown'));
      }
    }
    if (stryMutAct_9fa48("1487") ? panEnabled && pinchEnabled : stryMutAct_9fa48("1486") ? false : stryMutAct_9fa48("1485") ? true : (stryCov_9fa48("1485", "1486", "1487"), panEnabled || pinchEnabled)) {
      if (stryMutAct_9fa48("1488")) {
        {}
      } else {
        stryCov_9fa48("1488");
        addHandler(chart, canvas, stryMutAct_9fa48("1489") ? "" : (stryCov_9fa48("1489"), 'pointerdown'), pointerDown);
        addHandler(chart, canvas.ownerDocument!, stryMutAct_9fa48("1490") ? "" : (stryCov_9fa48("1490"), 'pointermove'), pointerMove);
        addHandler(chart, canvas.ownerDocument!, stryMutAct_9fa48("1491") ? "" : (stryCov_9fa48("1491"), 'pointerup'), pointerUp);
        addHandler(chart, canvas.ownerDocument!, stryMutAct_9fa48("1492") ? "" : (stryCov_9fa48("1492"), 'pointercancel'), pointerUp);
        // Without this, the browser's own native touch panning/pinch-zoom on
        // the canvas fights with this plugin's own gesture handling (both
        // try to interpret the same touch input at once) — 'none' hands
        // full control of touch gestures on this element over to this
        // plugin's own JS-driven pan/zoom instead.
        canvas.style.touchAction = stryMutAct_9fa48("1493") ? "" : (stryCov_9fa48("1493"), 'none');
      }
    } else {
      if (stryMutAct_9fa48("1494")) {
        {}
      } else {
        stryCov_9fa48("1494");
        removeHandler(chart, stryMutAct_9fa48("1495") ? "" : (stryCov_9fa48("1495"), 'pointerdown'));
        removeHandler(chart, stryMutAct_9fa48("1496") ? "" : (stryCov_9fa48("1496"), 'pointermove'));
        removeHandler(chart, stryMutAct_9fa48("1497") ? "" : (stryCov_9fa48("1497"), 'pointerup'));
        removeHandler(chart, stryMutAct_9fa48("1498") ? "" : (stryCov_9fa48("1498"), 'pointercancel'));
        canvas.style.touchAction = stryMutAct_9fa48("1499") ? "Stryker was here!" : (stryCov_9fa48("1499"), '');
      }
    }
  }
}
function removeListeners(chart: Chart): void {
  if (stryMutAct_9fa48("1500")) {
    {}
  } else {
    stryCov_9fa48("1500");
    removeHandler(chart, stryMutAct_9fa48("1501") ? "" : (stryCov_9fa48("1501"), 'mousedown'));
    removeHandler(chart, stryMutAct_9fa48("1502") ? "" : (stryCov_9fa48("1502"), 'mousemove'));
    removeHandler(chart, stryMutAct_9fa48("1503") ? "" : (stryCov_9fa48("1503"), 'mouseup'));
    removeHandler(chart, stryMutAct_9fa48("1504") ? "" : (stryCov_9fa48("1504"), 'wheel'));
    removeHandler(chart, stryMutAct_9fa48("1505") ? "" : (stryCov_9fa48("1505"), 'click'));
    removeHandler(chart, stryMutAct_9fa48("1506") ? "" : (stryCov_9fa48("1506"), 'keydown'));
    removeHandler(chart, stryMutAct_9fa48("1507") ? "" : (stryCov_9fa48("1507"), 'pointerdown'));
    removeHandler(chart, stryMutAct_9fa48("1508") ? "" : (stryCov_9fa48("1508"), 'pointermove'));
    removeHandler(chart, stryMutAct_9fa48("1509") ? "" : (stryCov_9fa48("1509"), 'pointerup'));
    removeHandler(chart, stryMutAct_9fa48("1510") ? "" : (stryCov_9fa48("1510"), 'pointercancel'));
    chart.canvas.style.touchAction = stryMutAct_9fa48("1511") ? "Stryker was here!" : (stryCov_9fa48("1511"), '');
  }
}

// ---- drag-rectangle overlay ----

function drawDragOverlay(chart: Chart, caller: string, options: ZoomPluginOptions): void {
  if (stryMutAct_9fa48("1512")) {
    {}
  } else {
    stryCov_9fa48("1512");
    const dragOptions = options.zoom!.drag!;
    const {
      dragStart,
      dragEnd
    } = getState(chart);
    if (stryMutAct_9fa48("1515") ? dragOptions.drawTime !== caller && !dragEnd : stryMutAct_9fa48("1514") ? false : stryMutAct_9fa48("1513") ? true : (stryCov_9fa48("1513", "1514", "1515"), (stryMutAct_9fa48("1517") ? dragOptions.drawTime === caller : stryMutAct_9fa48("1516") ? false : (stryCov_9fa48("1516", "1517"), dragOptions.drawTime !== caller)) || (stryMutAct_9fa48("1518") ? dragEnd : (stryCov_9fa48("1518"), !dragEnd)))) return;
    const {
      left,
      top,
      width,
      height
    } = computeDragRect(chart, options.zoom!.mode, stryMutAct_9fa48("1519") ? {} : (stryCov_9fa48("1519"), {
      dragStart: dragStart!,
      dragEnd
    }), dragOptions.maintainAspectRatio);
    const ctx = chart.ctx;
    ctx.save();
    ctx.beginPath();
    ctx.fillStyle = stryMutAct_9fa48("1522") ? dragOptions.backgroundColor && 'rgba(225,225,225,0.3)' : stryMutAct_9fa48("1521") ? false : stryMutAct_9fa48("1520") ? true : (stryCov_9fa48("1520", "1521", "1522"), dragOptions.backgroundColor || (stryMutAct_9fa48("1523") ? "" : (stryCov_9fa48("1523"), 'rgba(225,225,225,0.3)')));
    ctx.fillRect(left, top, width, height);
    if (stryMutAct_9fa48("1526") ? dragOptions.borderWidth || dragOptions.borderWidth > 0 : stryMutAct_9fa48("1525") ? false : stryMutAct_9fa48("1524") ? true : (stryCov_9fa48("1524", "1525", "1526"), dragOptions.borderWidth && (stryMutAct_9fa48("1529") ? dragOptions.borderWidth <= 0 : stryMutAct_9fa48("1528") ? dragOptions.borderWidth >= 0 : stryMutAct_9fa48("1527") ? true : (stryCov_9fa48("1527", "1528", "1529"), dragOptions.borderWidth > 0)))) {
      if (stryMutAct_9fa48("1530")) {
        {}
      } else {
        stryCov_9fa48("1530");
        ctx.lineWidth = dragOptions.borderWidth;
        ctx.strokeStyle = stryMutAct_9fa48("1533") ? dragOptions.borderColor && 'rgba(225,225,225)' : stryMutAct_9fa48("1532") ? false : stryMutAct_9fa48("1531") ? true : (stryCov_9fa48("1531", "1532", "1533"), dragOptions.borderColor || (stryMutAct_9fa48("1534") ? "" : (stryCov_9fa48("1534"), 'rgba(225,225,225)')));
        ctx.strokeRect(left, top, width, height);
      }
    }
    ctx.restore();
  }
}
const DEFAULT_OPTIONS: ZoomPluginOptions = stryMutAct_9fa48("1535") ? {} : (stryCov_9fa48("1535"), {
  pan: stryMutAct_9fa48("1536") ? {} : (stryCov_9fa48("1536"), {
    enabled: stryMutAct_9fa48("1537") ? true : (stryCov_9fa48("1537"), false),
    mode: stryMutAct_9fa48("1538") ? "" : (stryCov_9fa48("1538"), 'xy'),
    threshold: 10,
    modifierKey: null
  }),
  zoom: stryMutAct_9fa48("1539") ? {} : (stryCov_9fa48("1539"), {
    wheel: stryMutAct_9fa48("1540") ? {} : (stryCov_9fa48("1540"), {
      enabled: stryMutAct_9fa48("1541") ? true : (stryCov_9fa48("1541"), false),
      speed: 0.1,
      modifierKey: null
    }),
    drag: stryMutAct_9fa48("1542") ? {} : (stryCov_9fa48("1542"), {
      enabled: stryMutAct_9fa48("1543") ? true : (stryCov_9fa48("1543"), false),
      drawTime: stryMutAct_9fa48("1544") ? "" : (stryCov_9fa48("1544"), 'beforeDatasetsDraw'),
      modifierKey: null
    }),
    pinch: stryMutAct_9fa48("1545") ? {} : (stryCov_9fa48("1545"), {
      enabled: stryMutAct_9fa48("1546") ? true : (stryCov_9fa48("1546"), false)
    }),
    mode: stryMutAct_9fa48("1547") ? "" : (stryCov_9fa48("1547"), 'xy')
  })
});

/**
 * Chart.js plugin providing mouse-wheel zoom and mouse-drag-to-zoom-
 * rectangle interaction, plus a full programmatic zoom/pan API attached
 * directly onto the live chart instance. See this file's own header
 * comment for the deliberate Hammer.js/pinch/gesture-pan scope
 * decision.
 *
 * Supplied to Chart.js via its inline `plugins` array rather than a
 * global `Chart.register(...)` call.
 */
export const zoomPlugin: Plugin<ChartType, ZoomPluginOptions> = stryMutAct_9fa48("1548") ? {} : (stryCov_9fa48("1548"), {
  id: stryMutAct_9fa48("1549") ? "" : (stryCov_9fa48("1549"), 'zoom'),
  start(chart: Chart, _args, options: ZoomPluginOptions): void {
    if (stryMutAct_9fa48("1550")) {
      {}
    } else {
      stryCov_9fa48("1550");
      const state = getState(chart);
      state.options = options;
      const chartWithApi = chart as Chart & Record<string, unknown>;
      chartWithApi.pan = stryMutAct_9fa48("1551") ? () => undefined : (stryCov_9fa48("1551"), (delta: number | {
        x?: number;
        y?: number;
      }, enabledScales?: LiveScale[], transition?: string) => pan(chart, delta, enabledScales, transition));
      chartWithApi.zoom = stryMutAct_9fa48("1552") ? () => undefined : (stryCov_9fa48("1552"), (amount: ZoomAmount, transition?: string) => zoom(chart, amount, transition));
      chartWithApi.zoomRect = stryMutAct_9fa48("1553") ? () => undefined : (stryCov_9fa48("1553"), (p0: ScreenPoint, p1: ScreenPoint, transition?: string) => zoomRect(chart, p0, p1, transition));
      chartWithApi.zoomScale = stryMutAct_9fa48("1554") ? () => undefined : (stryCov_9fa48("1554"), (id: string, range: {
        min: number;
        max: number;
      }, transition?: string) => zoomScale(chart, id, range, transition));
      chartWithApi.resetZoom = stryMutAct_9fa48("1555") ? () => undefined : (stryCov_9fa48("1555"), (transition?: string) => resetZoom(chart, transition));
      chartWithApi.getZoomLevel = stryMutAct_9fa48("1556") ? () => undefined : (stryCov_9fa48("1556"), () => getZoomLevel(chart));
      chartWithApi.getInitialScaleBounds = stryMutAct_9fa48("1557") ? () => undefined : (stryCov_9fa48("1557"), () => getInitialScaleBounds(chart));
      chartWithApi.getZoomedScaleBounds = stryMutAct_9fa48("1558") ? () => undefined : (stryCov_9fa48("1558"), () => getZoomedScaleBounds(chart));
      chartWithApi.isZoomedOrPanned = stryMutAct_9fa48("1559") ? () => undefined : (stryCov_9fa48("1559"), () => isZoomedOrPanned(chart));
      chartWithApi.isZoomingOrPanning = stryMutAct_9fa48("1560") ? () => undefined : (stryCov_9fa48("1560"), () => isZoomingOrPanning(chart));
    }
  },
  beforeEvent(chart: Chart, args): boolean | void {
    if (stryMutAct_9fa48("1561")) {
      {}
    } else {
      stryCov_9fa48("1561");
      if (stryMutAct_9fa48("1563") ? false : stryMutAct_9fa48("1562") ? true : (stryCov_9fa48("1562", "1563"), isZoomingOrPanning(chart))) return stryMutAct_9fa48("1564") ? true : (stryCov_9fa48("1564"), false);
      const event = args.event;
      if (stryMutAct_9fa48("1567") ? event.type === 'click' && event.type === 'mouseup' : stryMutAct_9fa48("1566") ? false : stryMutAct_9fa48("1565") ? true : (stryCov_9fa48("1565", "1566", "1567"), (stryMutAct_9fa48("1569") ? event.type !== 'click' : stryMutAct_9fa48("1568") ? false : (stryCov_9fa48("1568", "1569"), event.type === (stryMutAct_9fa48("1570") ? "" : (stryCov_9fa48("1570"), 'click')))) || (stryMutAct_9fa48("1572") ? event.type !== 'mouseup' : stryMutAct_9fa48("1571") ? false : (stryCov_9fa48("1571", "1572"), event.type === (stryMutAct_9fa48("1573") ? "" : (stryCov_9fa48("1573"), 'mouseup')))))) {
        if (stryMutAct_9fa48("1574")) {
          {}
        } else {
          stryCov_9fa48("1574");
          const state = getState(chart);
          if (stryMutAct_9fa48("1576") ? false : stryMutAct_9fa48("1575") ? true : (stryCov_9fa48("1575", "1576"), state.filterNextClick)) {
            if (stryMutAct_9fa48("1577")) {
              {}
            } else {
              stryCov_9fa48("1577");
              state.filterNextClick = stryMutAct_9fa48("1578") ? true : (stryCov_9fa48("1578"), false);
              return stryMutAct_9fa48("1579") ? true : (stryCov_9fa48("1579"), false);
            }
          }
        }
      }
    }
  },
  beforeUpdate(chart: Chart, _args, options: ZoomPluginOptions): void {
    if (stryMutAct_9fa48("1580")) {
      {}
    } else {
      stryCov_9fa48("1580");
      const state = getState(chart);
      state.options = options;
      addListeners(chart, options);
    }
  },
  beforeDatasetsDraw(chart: Chart, _args, options: ZoomPluginOptions): void {
    if (stryMutAct_9fa48("1581")) {
      {}
    } else {
      stryCov_9fa48("1581");
      drawDragOverlay(chart, stryMutAct_9fa48("1582") ? "" : (stryCov_9fa48("1582"), 'beforeDatasetsDraw'), options);
    }
  },
  afterDatasetsDraw(chart: Chart, _args, options: ZoomPluginOptions): void {
    if (stryMutAct_9fa48("1583")) {
      {}
    } else {
      stryCov_9fa48("1583");
      drawDragOverlay(chart, stryMutAct_9fa48("1584") ? "" : (stryCov_9fa48("1584"), 'afterDatasetsDraw'), options);
    }
  },
  beforeDraw(chart: Chart, _args, options: ZoomPluginOptions): void {
    if (stryMutAct_9fa48("1585")) {
      {}
    } else {
      stryCov_9fa48("1585");
      drawDragOverlay(chart, stryMutAct_9fa48("1586") ? "" : (stryCov_9fa48("1586"), 'beforeDraw'), options);
    }
  },
  afterDraw(chart: Chart, _args, options: ZoomPluginOptions): void {
    if (stryMutAct_9fa48("1587")) {
      {}
    } else {
      stryCov_9fa48("1587");
      drawDragOverlay(chart, stryMutAct_9fa48("1588") ? "" : (stryCov_9fa48("1588"), 'afterDraw'), options);
    }
  },
  stop(chart: Chart): void {
    if (stryMutAct_9fa48("1589")) {
      {}
    } else {
      stryCov_9fa48("1589");
      removeListeners(chart);
      removeState(chart);
    }
  },
  defaults: DEFAULT_OPTIONS as unknown as Record<string, unknown>
});