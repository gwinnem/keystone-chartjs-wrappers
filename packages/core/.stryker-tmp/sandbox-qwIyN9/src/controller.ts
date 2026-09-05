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
import { Chart, type ChartConfiguration, type ChartType } from 'chart.js';
import { ensureChartKindRegistered } from './registry.js';
import type { ChartControllerHandle, ChartKind, ChartUpdatePayload } from './types.js';

/**
 * Every distinct chart kind a payload touches — the top-level `type` plus
 * any per-dataset `type` override (mixed/combo charts, e.g. a bar chart
 * with one line-type dataset). See docs/CHARTJS_ANALYSIS.md §2: Chart.js
 * itself supports this by letting each dataset carry its own `type`,
 * overriding the chart-level default for just that dataset — the
 * controller's job is registering every kind actually present, not just
 * the top-level one.
 */
function collectChartKinds(payload: ChartUpdatePayload): ChartKind[] {
  if (stryMutAct_9fa48("0")) {
    {}
  } else {
    stryCov_9fa48("0");
    const kinds = new Set<ChartKind>(stryMutAct_9fa48("1") ? [] : (stryCov_9fa48("1"), [payload.type]));
    const datasets = stryMutAct_9fa48("2") ? (payload.data as {
      datasets?: Array<{
        type?: ChartKind;
      }>;
    }).datasets && [] : (stryCov_9fa48("2"), (payload.data as {
      datasets?: Array<{
        type?: ChartKind;
      }>;
    }).datasets ?? (stryMutAct_9fa48("3") ? ["Stryker was here"] : (stryCov_9fa48("3"), [])));
    for (const dataset of datasets) {
      if (stryMutAct_9fa48("4")) {
        {}
      } else {
        stryCov_9fa48("4");
        if (stryMutAct_9fa48("6") ? false : stryMutAct_9fa48("5") ? true : (stryCov_9fa48("5", "6"), dataset.type)) kinds.add(dataset.type);
      }
    }
    return stryMutAct_9fa48("7") ? [] : (stryCov_9fa48("7"), [...kinds]);
  }
}
async function ensureKindsRegistered(payload: ChartUpdatePayload): Promise<void> {
  if (stryMutAct_9fa48("8")) {
    {}
  } else {
    stryCov_9fa48("8");
    await Promise.all(collectChartKinds(payload).map(stryMutAct_9fa48("9") ? () => undefined : (stryCov_9fa48("9"), kind => ensureChartKindRegistered(kind))));
  }
}
function toConfig(payload: ChartUpdatePayload): ChartConfiguration {
  if (stryMutAct_9fa48("10")) {
    {}
  } else {
    stryCov_9fa48("10");
    return {
      type: payload.type,
      data: payload.data,
      options: payload.options,
      // Passed through untouched — Chart.js's own `ChartConfiguration.plugins`
      // field is a real, distinct array of per-chart-instance plugin objects,
      // separate from `options.plugins.<id>` config (which this library's own
      // 3 official opt-in props handle). `undefined` here is fine: Chart.js
      // simply omits the field from its own internal config when absent.
      plugins: payload.plugins
    } as ChartConfiguration;
  }
}

/**
 * Shallow (one-level-deep) merge for `applyTheme` — deliberately not a
 * full recursive deep-merge. Theme re-application only ever needs to
 * layer top-level option groups (`color`, `plugins`, `scales`, ...) on
 * top of whatever's already there; a real recursive merge would risk
 * silently dropping nested keys the patch didn't mention (e.g. patching
 * `scales.x.grid.color` while leaving `scales.x.ticks` untouched needs
 * `scales.x` itself merged, not replaced) — that's real complexity this
 * controller doesn't need yet. Revisit if/when a real theme patch needs
 * more than one level.
 */
function mergeOptionsOneLevel(base: NonNullable<ChartConfiguration['options']>, patch: NonNullable<ChartConfiguration['options']>): NonNullable<ChartConfiguration['options']> {
  if (stryMutAct_9fa48("11")) {
    {}
  } else {
    stryCov_9fa48("11");
    return stryMutAct_9fa48("12") ? {} : (stryCov_9fa48("12"), {
      ...base,
      ...patch
    });
  }
}

/**
 * Constructs a managed Chart.js instance and wires up its full lifecycle:
 * lazy kind registration (including mixed-dataset kinds), a ResizeObserver
 * on the canvas's parent, and an imperative handle for update/resize/
 * theme/destroy. This is the one thing every framework package's own
 * `<Chart>` component should call into on mount rather than constructing
 * `new Chart(...)` directly — see CLAUDE.md's "never re-implement chart
 * lifecycle/registration logic themselves" rule.
 */
export async function createChartController(canvas: HTMLCanvasElement, initial: ChartUpdatePayload): Promise<ChartControllerHandle> {
  if (stryMutAct_9fa48("13")) {
    {}
  } else {
    stryCov_9fa48("13");
    await ensureKindsRegistered(initial);

    // Explicit `<ChartType>` generic argument, not left to inference —
    // a real `tsc --noEmit` run surfaced "TS2590: Expression produces a
    // union type that is too complex to represent" here without it.
    // Chart.js's own `Chart` class is generic (`TType`/`TData`/`TLabel`);
    // `toConfig()`'s own return type is the bare, unparameterized
    // `ChartConfiguration`, and letting the constructor call *infer* its
    // own type parameters from that bare argument forces TypeScript to
    // work backward through `ChartType`'s full 8-member union (and
    // `DefaultDataPoint<ChartType>`'s own distributive expansion across
    // all 8) to figure out what `TType`/`TData` should be — expensive
    // enough to hit this limitation. Explicitly providing `TType` up
    // front (`TData`/`TLabel` still default normally) turns this into a
    // forward assignability check instead of a backward inference — no
    // behavior change, since `new Chart(...)`'s own real runtime value is
    // unaffected either way. An earlier attempt at fixing this via an
    // explicit `: Chart` annotation on the *variable* instead did NOT
    // work — confirmed by a real run still failing identically, since
    // the complexity explosion happens during the constructor call's own
    // overload resolution, before any assignment is even considered.
    let chart: Chart = new Chart<ChartType>(canvas, toConfig(initial));
    let currentType: ChartKind = initial.type;
    // Tracked separately from `currentType` — inline plugins, unlike
    // `type`, can't be patched on a live Chart.js instance at all (the
    // `plugins` field is only read at construction time). A reference
    // identity change in `next.plugins` therefore forces its own
    // destroy-and-recreate even when `type` itself hasn't changed.
    let currentPlugins: ChartConfiguration['plugins'] = initial.plugins;
    const resizeTarget = stryMutAct_9fa48("14") ? canvas.parentElement && canvas : (stryCov_9fa48("14"), canvas.parentElement ?? canvas);
    let resizeObserver: ResizeObserver | undefined;
    if (stryMutAct_9fa48("17") ? typeof ResizeObserver === 'undefined' : stryMutAct_9fa48("16") ? false : stryMutAct_9fa48("15") ? true : (stryCov_9fa48("15", "16", "17"), typeof ResizeObserver !== (stryMutAct_9fa48("18") ? "" : (stryCov_9fa48("18"), 'undefined')))) {
      if (stryMutAct_9fa48("19")) {
        {}
      } else {
        stryCov_9fa48("19");
        resizeObserver = new ResizeObserver(stryMutAct_9fa48("20") ? () => undefined : (stryCov_9fa48("20"), () => chart.resize()));
        resizeObserver.observe(resizeTarget);
      }
    }
    const handle: ChartControllerHandle = stryMutAct_9fa48("21") ? {} : (stryCov_9fa48("21"), {
      get chart() {
        if (stryMutAct_9fa48("22")) {
          {}
        } else {
          stryCov_9fa48("22");
          return chart;
        }
      },
      async update(next: ChartUpdatePayload): Promise<void> {
        if (stryMutAct_9fa48("23")) {
          {}
        } else {
          stryCov_9fa48("23");
          // Registration first, regardless of which branch runs below — even
          // an in-place update needs any newly-introduced per-dataset kind
          // registered before Chart.js can construct that dataset's own
          // controller.
          await ensureKindsRegistered(next);
          if (stryMutAct_9fa48("26") ? next.type !== currentType : stryMutAct_9fa48("25") ? false : stryMutAct_9fa48("24") ? true : (stryCov_9fa48("24", "25", "26"), next.type === currentType)) {
            if (stryMutAct_9fa48("27")) {
              {}
            } else {
              stryCov_9fa48("27");
              // In place: same top-level type — per the acceptance criterion in
              // docs/IMPLEMENTATION_PLAN.md Phase 1 ("only rebuild when type
              // itself changes"), a changed *mix* of per-dataset type overrides
              // does NOT force a recreate on its own. Chart.js's own
              // `chart.update()` handles datasets appearing/disappearing/
              // changing their own `type` in place, as long as that type's
              // controller is already registered (just ensured above) — a
              // destroy+reconstruct here would reset animation/interaction
              // state for no reason.
              chart.data = next.data as ChartConfiguration['data'];
              if (stryMutAct_9fa48("29") ? false : stryMutAct_9fa48("28") ? true : (stryCov_9fa48("28", "29"), next.options)) chart.options = next.options as never;

              // Inline plugins can't be patched on a live instance — if they
              // changed (by reference), rebuild even though `type` didn't.
              if (stryMutAct_9fa48("32") ? next.plugins === currentPlugins : stryMutAct_9fa48("31") ? false : stryMutAct_9fa48("30") ? true : (stryCov_9fa48("30", "31", "32"), next.plugins !== currentPlugins)) {
                if (stryMutAct_9fa48("33")) {
                  {}
                } else {
                  stryCov_9fa48("33");
                  stryMutAct_9fa48("34") ? resizeObserver.disconnect() : (stryCov_9fa48("34"), resizeObserver?.disconnect());
                  chart.destroy();
                  chart = new Chart<ChartType>(canvas, toConfig(next));
                  currentPlugins = next.plugins;
                  if (stryMutAct_9fa48("37") ? typeof ResizeObserver === 'undefined' : stryMutAct_9fa48("36") ? false : stryMutAct_9fa48("35") ? true : (stryCov_9fa48("35", "36", "37"), typeof ResizeObserver !== (stryMutAct_9fa48("38") ? "" : (stryCov_9fa48("38"), 'undefined')))) {
                    if (stryMutAct_9fa48("39")) {
                      {}
                    } else {
                      stryCov_9fa48("39");
                      resizeObserver = new ResizeObserver(stryMutAct_9fa48("40") ? () => undefined : (stryCov_9fa48("40"), () => chart.resize()));
                      resizeObserver.observe(resizeTarget);
                    }
                  }
                  return;
                }
              }
              chart.update();
              return;
            }
          }

          // The chart's own top-level type changed — Chart.js has no
          // supported way to swap a live instance's default controller type
          // in place, so destroy and rebuild.
          stryMutAct_9fa48("41") ? resizeObserver.disconnect() : (stryCov_9fa48("41"), resizeObserver?.disconnect());
          chart.destroy();
          chart = new Chart<ChartType>(canvas, toConfig(next));
          currentType = next.type;
          currentPlugins = next.plugins;
          if (stryMutAct_9fa48("44") ? typeof ResizeObserver === 'undefined' : stryMutAct_9fa48("43") ? false : stryMutAct_9fa48("42") ? true : (stryCov_9fa48("42", "43", "44"), typeof ResizeObserver !== (stryMutAct_9fa48("45") ? "" : (stryCov_9fa48("45"), 'undefined')))) {
            if (stryMutAct_9fa48("46")) {
              {}
            } else {
              stryCov_9fa48("46");
              resizeObserver = new ResizeObserver(stryMutAct_9fa48("47") ? () => undefined : (stryCov_9fa48("47"), () => chart.resize()));
              resizeObserver.observe(resizeTarget);
            }
          }
        }
      },
      resize(): void {
        if (stryMutAct_9fa48("48")) {
          {}
        } else {
          stryCov_9fa48("48");
          chart.resize();
        }
      },
      applyTheme(patch: NonNullable<ChartConfiguration['options']>): void {
        if (stryMutAct_9fa48("49")) {
          {}
        } else {
          stryCov_9fa48("49");
          chart.options = mergeOptionsOneLevel((chart.options ?? {}) as NonNullable<ChartConfiguration['options']>, patch) as never;
          chart.update();
        }
      },
      destroy(): void {
        if (stryMutAct_9fa48("50")) {
          {}
        } else {
          stryCov_9fa48("50");
          stryMutAct_9fa48("51") ? resizeObserver.disconnect() : (stryCov_9fa48("51"), resizeObserver?.disconnect());
          chart.destroy();
        }
      }
    });
    return handle;
  }
}