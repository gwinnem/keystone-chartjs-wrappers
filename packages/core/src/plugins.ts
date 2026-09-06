import { Chart, type ChartConfiguration } from 'chart.js';
import { annotationPlugin } from './plugins/annotation/annotationPlugin.js';
import { autocolorPlugin } from './plugins/autocolors/autocolorsPlugin.js';
import { dataLabelsPlugin } from './plugins/dataLabels/dataLabelsPlugin.js';
import { deferredPlugin } from './plugins/deferred/deferredPlugin.js';
import { gradientPlugin } from './plugins/gradient/gradientPlugin.js';
import { HierarchicalScale } from './plugins/hierarchical/hierarchicalScale.js';
import { imageLabelPlugin } from './plugins/imageLabel/imageLabelPlugin.js';
import { trendlinePlugin } from './plugins/trendline/trendlinePlugin.js';
import { zoomPlugin, type ZoomPluginOptions } from './plugins/zoom/zoomPlugin.js';
import type {
  AnnotationPluginOptions,
  AutocolorsPluginOptions,
  DataLabelsPluginOptions,
  DeferredPluginOptions,
  ImageLabelPluginOptions,
} from './types.js';

/**
 * One registration flag per plugin (not a shared cache like registry.ts's
 * per-kind Set) — there are only three of these, all module-level
 * singletons, so a dedicated boolean each is simpler than a generic
 * cache for a fixed, small set.
 */
let annotationRegistered = false;
let dataLabelsRegistered = false;
let timestackRegistered = false;
let hierarchicalRegistered = false;
let autocolorsRegistered = false;
let deferredRegistered = false;
let trendlineRegistered = false;

type Options = NonNullable<ChartConfiguration['options']>;

/**
 * Merges `zoomOptions` (`pan`/`zoom` config) into `options.plugins.zoom`
 * (this plugin's own real, documented option path) and returns the
 * local plugin object (defined in zoomPlugin.ts) for the caller to
 * include in Chart.js's own inline `plugins` array — the same
 * `{ options, plugin }` shape `withGradient`/`withImageLabel` return,
 * since this plugin (as of the local port) is also never passed to a
 * global `Chart.register(...)` call.
 *
 * As of the port, `ZoomPluginOptions` is imported from `zoomPlugin.ts`
 * itself, not `types.ts` — modeled precisely now that the real option
 * shape is fully known from the dissected source, rather than the
 * deliberately loose shape used while this was still a dependency (see
 * zoomPlugin.ts's own header comment for the real scope this port
 * covers — notably, no Hammer.js-dependent pinch/gesture-pan support).
 */
export async function withZoom(options: Options, zoomOptions: ZoomPluginOptions = {}): Promise<{ options: Options; plugin: unknown }> {
  return {
    options: {
      ...options,
      plugins: {
        ...options.plugins,
        // Cast needed: Chart.js's own `PluginOptionsByType` has no
        // knowledge of this local plugin's own option shape — safe at
        // runtime since Chart.js itself does no compile-time shape
        // checking, only reads whatever object is actually passed.
        zoom: zoomOptions,
      } as Options['plugins'],
    },
    plugin: zoomPlugin,
  };
}

/**
 * Registers a local port of `chartjs-plugin-annotation` (once), via
 * this project's own {@link annotationPlugin} — see
 * `plugins/annotation/annotationPlugin.ts`'s own header comment for
 * the full port rationale (seven real Chart.js `Element` subclasses —
 * box/doughnutLabel/ellipse/label/line/point/polygon — each registered
 * via `Chart.register(annotationTypes)` in the plugin's own
 * `afterRegister()` hook, plus a real, deliberate structural
 * improvement replacing the original's own chart-keyed `Map` with a
 * `WeakMap`). `Chart.register(...)` is called directly and
 * synchronously (no dynamic `import()` at all, unlike this function's
 * own prior, still-a-dependency version) — kept `async` regardless,
 * purely so `useChartController.ts`'s own `await withAnnotation(opts,
 * ...)` call site needed no changes.
 *
 * Same registration/config-merging shape as `withDataLabels`: a real,
 * synchronous `Chart.register(...)` call (matching
 * `withAutocolors`'s/`withDeferred`'s own mechanism) AND real
 * plugin-level config merged into `options.plugins.annotation`.
 */
export async function withAnnotation(options: Options, annotationOptions: AnnotationPluginOptions): Promise<Options> {
  if (!annotationRegistered) {
    Chart.register(annotationPlugin);
    annotationRegistered = true;
  }
  return {
    ...options,
    plugins: {
      ...options.plugins,
      // Cast needed: Chart.js's own `PluginOptionsByType` no longer
      // knows `annotation` is a valid key at all now that the real
      // package's own type augmentation isn't present anywhere in this
      // project's module graph (it was only ever picked up because
      // `chartjs-plugin-annotation` was a real dependency — now that
      // it's a local port instead, that global augmentation is gone).
      // Safe at runtime: Chart.js itself does no compile-time shape
      // checking, only reads whatever object is actually passed —
      // `annotationPlugin.ts`'s own `beforeUpdate` reads this key
      // directly.
      annotation: annotationOptions,
    } as Options['plugins'],
  };
}

/**
 * Registers a local port of `chartjs-plugin-datalabels` (once), via
 * this project's own {@link dataLabelsPlugin} — see
 * `dataLabelsPlugin.ts`'s own header comment for the full port
 * rationale (real overlap auto-hiding, real click/hover interaction,
 * real multi-label-per-point support, and a real, deliberate
 * structural improvement replacing the original's own
 * `chart.$datalabels`/`element.$datalabels` monkey-patched bookkeeping
 * with module-level `WeakMap`s). `Chart.register(...)` is called
 * directly and synchronously (no dynamic `import()` at all, unlike
 * this function's own prior, still-a-dependency version) — kept
 * `async` regardless, purely so `useChartController.ts`'s own `await
 * withDataLabels(opts, ...)` call site needed no changes.
 *
 * Same registration/config-merging shape as `withAutocolors`/
 * `withDeferred`: a real, synchronous `Chart.register(...)` call
 * (matching `withHierarchical`'s own mechanism) AND real plugin-level
 * config of its own merged into `options.plugins.datalabels`.
 */
export async function withDataLabels(options: Options, dataLabelsOptions: DataLabelsPluginOptions = {}): Promise<Options> {
  if (!dataLabelsRegistered) {
    Chart.register(dataLabelsPlugin);
    dataLabelsRegistered = true;
  }
  return {
    ...options,
    plugins: {
      ...options.plugins,
      // Cast needed: Chart.js's own `PluginOptionsByType` has no
      // knowledge of this local plugin's own precisely-modeled option
      // shape (`DataLabelsConfig`) — safe at runtime since Chart.js
      // itself does no compile-time shape checking, only reads
      // whatever object is actually passed —
      // `dataLabelsPlugin.ts`'s own `afterDatasetUpdate` reads this key
      // directly via its second argument.
      datalabels: dataLabelsOptions,
    } as Options['plugins'],
  };
}

/**
 * Merges the given config into `options.plugins.gradient` (this
 * plugin's own real, documented option path) and returns the local
 * plugin object (defined in gradientPlugin.ts) for the caller to
 * include in Chart.js's own inline `plugins` array — the same
 * `{ options, plugin }` shape `withImageLabel` returns, since this
 * plugin (as of the local port) is also never passed to a global
 * `Chart.register(...)` call.
 *
 * Unlike `withZoom`/`withAnnotation`/`withDataLabels`, there is no
 * plugin-level config to merge into `options.plugins.gradient` at all —
 * confirmed directly from the real package's own docs
 * (github.com/kurkle/chartjs-plugin-gradient): its own config lives on
 * each *dataset* instead (`dataset.gradient = { backgroundColor: {...},
 * borderColor: {...} }`), which already reaches Chart.js untouched via
 * this project's own `data` passthrough (`ChartConfigDataset`'s own
 * index signature already allows an arbitrary `gradient` key — no type
 * change needed for that half at all). `options` is therefore returned
 * completely unchanged; the `gradient` opt-in prop is boolean-only
 * (registration only), unlike `zoom`/`dataLabels` (boolean-or-config-
 * object) or `annotation` (config-object required).
 */
export async function withGradient(options: Options): Promise<{ options: Options; plugin: unknown }> {
  return { options, plugin: gradientPlugin };
}

/**
 * Registers `chartjs-scale-timestack` (once). Genuinely different from
 * every other helper in this file, not just `withGradient` — confirmed
 * directly from the real package's own README
 * (github.com/jkmnt/chartjs-scale-timestack): there is no exported
 * plugin object to pass to `Chart.register(...)` at all. The package
 * registers its own `timestack` scale as a *module-load side effect* of
 * being imported (`import 'chartjs-scale-timestack';` in the package's
 * own documented usage, with no further call needed) — so this helper's
 * only job is running that import once; there's nothing to call
 * `Chart.register` with, and no `mod.default ?? mod` fallback needed
 * either, unlike `withZoom`/`withAnnotation`/`withDataLabels`/
 * `withGradient` above. Like `withGradient`, `options` is returned
 * completely unchanged — the scale is used by setting
 * `options.scales.<id>.type = 'timestack'` (and optionally
 * `options.scales.<id>.timestack = {...}` for its own real config),
 * both of which already reach Chart.js untouched via the existing
 * `options` prop, no merging needed.
 *
 * Real, hard runtime dependency worth knowing: this package requires
 * `luxon` (confirmed from its own README: "npm install luxon chartjs-
 * scale-timestack") for locale-aware time formatting — a real, sizeable
 * added dependency, not merely optional. Luxon itself is actively
 * maintained (confirmed: 2 maintainers, healthy release cadence, no
 * open unpatched CVEs at the time of this check), unlike the Hammer.js
 * concern already flagged for `chartjs-plugin-zoom` in
 * `docs/CHARTJS_ANALYSIS.md` §6 — a real dependency-weight cost, but not
 * the same maintenance-risk concern.
 *
 * **Accepted mutation survivors, confirmed via a real run, not
 * hypothetical**: the `if (!timestackRegistered)` guard itself (and its
 * own flag's true/false mutations, in both this function and
 * `__resetPluginsForTests`) has no test that can distinguish "guard
 * worked, import ran once" from "guard broken, import ran again" —
 * because this function has no `Chart.register` call and never reads
 * any property off the imported module, there is genuinely nothing
 * observable about a second `import()` call beyond the first: ES module
 * evaluation is cached regardless of the guard's own correctness, so
 * even a completely broken guard produces byte-identical, unobservable
 * behavior. This is the same class of gap as `controller.ts`'s own
 * accepted `handle?.destroy()` survivor — real defensive value (avoiding
 * a wasted repeat `import()` call on every future invocation), just not
 * distinguishable via any external assertion given this function's own
 * design. Contrast with `withHierarchical` below, whose identical-shaped
 * guard *is* fully covered, because that function's own real
 * `Chart.register(HierarchicalScale)` call gives every one of its own
 * guard mutations a real, observable side effect to fail against.
 */
export async function withTimestack(options: Options): Promise<Options> {
  if (!timestackRegistered) {
    // Stryker disable next-line StringLiteral: see withZoom's own comment
    // above for the full reasoning — same issue, same fix.
    await import(/* @vite-ignore */ 'chartjs-scale-timestack');
    timestackRegistered = true;
  }
  return options;
}

/**
 * Registers a local port of `chartjs-plugin-hierarchical` (once), via
 * this project's own {@link HierarchicalScale} — see `hierarchicalScale.ts`'s
 * own header comment for the full port rationale. As of the port,
 * `Chart.register(...)` is called directly and synchronously (no
 * dynamic `import()` at all, unlike this function's own prior,
 * still-a-dependency version) — kept `async` regardless, purely so
 * `useChartController.ts`'s own `await withHierarchical(opts)` call
 * site needed no changes.
 *
 * Like `withGradient`/`withTimestack`, there is no plugin-level config
 * of its own to merge into `options` here — it's a real, distinct
 * **scale** (`hierarchical`), not a Chart.js "plugin" object with
 * lifecycle hooks, used via the standard
 * `options.scales.<id>.type = 'hierarchical'` mechanism (and optionally
 * `options.scales.<id>.hierarchical = {...}` for its own real styling
 * config), both of which already reach Chart.js untouched via the
 * existing `options` prop. `options` is returned unchanged.
 *
 * Real, non-trivial data-shape requirement worth knowing: this scale
 * needs `data.labels`/`dataset.data` in its own tree-node shape
 * (`HierarchicalRawLabelNode`/`HierarchicalValueNode`, exported from
 * `hierarchicalScale.ts`) rather than the flat arrays every other
 * kind/plugin in this project accepts — already reaches Chart.js
 * untouched via the existing `data` prop, no type change needed here
 * either, but a real, meaningfully different shape a consumer needs to
 * know about (see the docs site's own example).
 */
export async function withHierarchical(options: Options): Promise<Options> {
  if (!hierarchicalRegistered) {
    Chart.register(HierarchicalScale);
    hierarchicalRegistered = true;
  }
  return options;
}

/**
 * Merges the given config into `options.plugins.imageLabel` (this
 * plugin's own real, documented option path) and returns the local
 * plugin object (defined in imageLabelPlugin.ts) for the caller to
 * include in Chart.js's own inline `plugins` array — kept async and
 * returning the same `{ options, plugin }` shape as before this was
 * split into its own file, so `useChartController.ts`'s own
 * `resolveOptionsAndPlugins()` needed no changes at all.
 *
 * `imagesList` is required — there's no sensible empty default, matching
 * `AnnotationPluginOptions.annotations`'s own reasoning — so `imageLabel`
 * has no plain-boolean opt-in form the way `zoom`/`dataLabels` do.
 * Doughnut/pie charts only (enforced in imageLabelPlugin.ts's own
 * `afterDraw`, not here).
 */
export async function withImageLabel(
  options: Options,
  imageLabelOptions: ImageLabelPluginOptions,
): Promise<{ options: Options; plugin: unknown }> {
  return {
    options: {
      ...options,
      plugins: {
        ...options.plugins,
        // Cast needed: Chart.js's own `PluginOptionsByType` has no
        // knowledge of `imageLabel` as a valid key at all — this is a
        // local plugin, not one with any type augmentation to Chart.js's
        // own types. Safe at runtime: Chart.js itself does no
        // compile-time shape checking, only reads whatever object is
        // actually passed — imageLabelPlugin.ts's own `afterDraw` reads
        // this key directly.
        imageLabel: imageLabelOptions,
      } as Options['plugins'],
    },
    plugin: imageLabelPlugin,
  };
}

/**
 * Registers a local port of `chartjs-plugin-autocolors` (once), via
 * this project's own {@link autocolorPlugin} — see
 * `autocolorsPlugin.ts`'s own header comment for the full port
 * rationale (a real, faithful port of the original's own color-
 * selection logic; only its own two small, standard color-conversion
 * utility functions are reimplemented locally, to avoid a new
 * dependency on `@kurkle/color`). As of the port, `Chart.register(...)`
 * is called directly and synchronously (no dynamic `import()` at all,
 * unlike this function's own prior, still-a-dependency version) —
 * kept `async` regardless, purely so `useChartController.ts`'s own
 * `await withAutocolors(opts, ...)` call site needed no changes.
 *
 * Genuinely different shape from every other helper in this file: the
 * only one that both (a) registers a local port directly via a real,
 * synchronous `Chart.register(...)` call (matching `withHierarchical`'s
 * own registration mechanism) AND (b) has real plugin-level config of
 * its own to merge into `options.plugins.autocolors` (matching
 * `withAnnotation`/`withDataLabels`'s own config-merging shape) —
 * `withHierarchical` has no config to merge (a scale, not a plugin
 * with options), and `withAnnotation`/`withDataLabels` are still real
 * npm dependencies needing an async dynamic import to register.
 */
export async function withAutocolors(options: Options, autocolorsOptions: AutocolorsPluginOptions = {}): Promise<Options> {
  if (!autocolorsRegistered) {
    Chart.register(autocolorPlugin);
    autocolorsRegistered = true;
  }
  return {
    ...options,
    plugins: {
      ...options.plugins,
      // Cast needed: Chart.js's own `PluginOptionsByType` has no
      // knowledge of `autocolors` as a valid key at all — this is a
      // local plugin, not one with any type augmentation to Chart.js's
      // own types. Safe at runtime: Chart.js itself does no
      // compile-time shape checking, only reads whatever object is
      // actually passed — autocolorsPlugin.ts's own `beforeUpdate` reads
      // this key directly.
      autocolors: autocolorsOptions,
    } as Options['plugins'],
  };
}

/**
 * Registers a local port of `chartjs-plugin-deferred` (once), via this
 * project's own {@link deferredPlugin} — see `deferredPlugin.ts`'s own
 * header comment for the full port rationale (a real, faithful port of
 * the original's own scroll-event-driven defer logic; a real,
 * confirmed `destroy`-vs-`afterDestroy` hook-name bug fixed along the
 * way, the identical class already found in `gradientPlugin.ts`'s own
 * port). As of the port, `Chart.register(...)` is called directly and
 * synchronously (no dynamic `import()` at all, unlike this function's
 * own prior, still-a-dependency version) — kept `async` regardless,
 * purely so `useChartController.ts`'s own `await withDeferred(opts,
 * ...)` call site needed no changes.
 *
 * Same registration/config-merging shape as `withAutocolors`: a real,
 * synchronous `Chart.register(...)` call (matching `withHierarchical`'s
 * own mechanism) AND real plugin-level config of its own merged into
 * `options.plugins.deferred` (matching `withAnnotation`/
 * `withDataLabels`'s own config-merging shape).
 */
export async function withDeferred(options: Options, deferredOptions: DeferredPluginOptions = {}): Promise<Options> {
  if (!deferredRegistered) {
    Chart.register(deferredPlugin);
    deferredRegistered = true;
  }
  return {
    ...options,
    plugins: {
      ...options.plugins,
      // Cast needed: Chart.js's own `PluginOptionsByType` has no
      // knowledge of `deferred` as a valid key at all — this is a
      // local plugin, not one with any type augmentation to Chart.js's
      // own types. Safe at runtime: Chart.js itself does no
      // compile-time shape checking, only reads whatever object is
      // actually passed — deferredPlugin.ts's own `beforeDatasetsUpdate`
      // reads this key directly.
      deferred: deferredOptions,
    } as Options['plugins'],
  };
}

/**
 * Registers a local port of `chartjs-plugin-trendline` (once), via this
 * project's own {@link trendlinePlugin} — see `trendlinePlugin.ts`'s own
 * header comment for the full port rationale. Unlike every other
 * plugin this project has actually ported, there was no concrete bug
 * or unmaintained-dependency reason motivating this one — ported
 * anyway, at your explicit request, specifically so
 * `keystone-chartjs-core` depends on nothing but `chart.js` itself.
 * `Chart.register(...)` is called directly and synchronously (no
 * dynamic `import()` at all, unlike this function's own prior,
 * still-a-dependency version) — kept `async` regardless, purely so
 * `useChartController.ts`'s own `await withTrendline(opts)` call site
 * needed no changes.
 *
 * Like `withGradient`/`withTimestack`/`withHierarchical`, there is no
 * plugin-level config of its own to merge into `options` here — its
 * real config (`TrendlineConfig`, see types.ts) lives on each
 * *dataset* instead (`dataset.trendlineLinear`/`dataset.
 * trendlineExponential`), which already reaches Chart.js untouched via
 * the existing `data` prop. `options` is returned unchanged.
 */
export async function withTrendline(options: Options): Promise<Options> {
  if (!trendlineRegistered) {
    Chart.register(trendlinePlugin);
    trendlineRegistered = true;
  }
  return options;
}

/**
 * Test-only: resets the remaining seven registration flags so tests can
 * verify register-once behavior from a known-unregistered state. Not
 * part of the package's public entry point — import directly from
 * './plugins.js' in tests. (`withZoom`/`withGradient`/`withImageLabel`
 * need no reset — all three are now local, static plugin objects with
 * no module-level registration cache left, since porting each one in
 * removed its own dynamic import entirely.)
 */
export function __resetPluginsForTests(): void {
  annotationRegistered = false;
  dataLabelsRegistered = false;
  timestackRegistered = false;
  hierarchicalRegistered = false;
  autocolorsRegistered = false;
  deferredRegistered = false;
  trendlineRegistered = false;
}
