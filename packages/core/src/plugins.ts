import { Chart, type ChartConfiguration } from 'chart.js';
import { gradientPlugin } from './gradientPlugin.js';
import { imageLabelPlugin } from './imageLabelPlugin.js';
import { zoomPlugin, type ZoomPluginOptions } from './zoomPlugin.js';
import type { AnnotationPluginOptions, DataLabelsPluginOptions, ImageLabelPluginOptions } from './types.js';

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
 * Registers `chartjs-plugin-annotation` (once) and returns `options` with
 * the given annotation config merged into `options.plugins.annotation`
 * (the plugin's own real option path — see docs/CHARTJS_ANALYSIS.md §4),
 * without touching any other existing `plugins.*` entries.
 */
export async function withAnnotation(options: Options, annotationOptions: AnnotationPluginOptions): Promise<Options> {
  if (!annotationRegistered) {
    // Stryker disable next-line StringLiteral: see withZoom's own comment
    // above for the full reasoning — same issue, same fix.
    const mod = await import(/* @vite-ignore */ 'chartjs-plugin-annotation');
    Chart.register(mod.default ?? mod);
    annotationRegistered = true;
  }
  return {
    ...options,
    plugins: {
      ...options.plugins,
      // Cast, not a structural match: AnnotationPluginOptions is
      // deliberately loose (see its own doc comment in types.ts) — the
      // real chartjs-plugin-annotation package's own type augmentation
      // to Chart.js's ChartConfiguration expects a much more specific
      // shape (a discriminated union per annotation type), which full
      // Phase 5 plugin-option typing is meant to model properly. This
      // assertion is safe at runtime: Chart.js itself does no
      // compile-time shape checking, only reads whatever object is
      // actually passed. Confirmed as a real, pre-existing gap (not
      // introduced by anything else) via a real `tsc --noEmit` run —
      // this had apparently never actually been run for this package
      // before, since Phase 1's own closing checks covered test:unit/
      // test:coverage/test:mutation but never a dedicated typecheck.
      annotation: annotationOptions as NonNullable<Options['plugins']>['annotation'],
    },
  };
}

/**
 * Registers `chartjs-plugin-datalabels` (once) and returns `options` with
 * the given config merged into `options.plugins.datalabels`, without
 * touching any other existing `plugins.*` entries.
 */
export async function withDataLabels(options: Options, dataLabelsOptions: DataLabelsPluginOptions = {}): Promise<Options> {
  if (!dataLabelsRegistered) {
    // Stryker disable next-line StringLiteral: see withZoom's own comment
    // above for the full reasoning — same issue, same fix.
    const mod = await import(/* @vite-ignore */ 'chartjs-plugin-datalabels');
    Chart.register(mod.default ?? mod);
    dataLabelsRegistered = true;
  }
  return {
    ...options,
    plugins: {
      ...options.plugins,
      datalabels: dataLabelsOptions,
    },
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
 * Registers `chartjs-plugin-hierarchical` (once) via its own real,
 * confirmed named export (`HierarchicalScale`) — a *third*, distinct
 * registration shape in this file, not matching either `withZoom`'s own
 * `mod.default ?? mod` fallback pattern or `withTimestack`'s own
 * side-effect-only import. Confirmed directly from the real package's
 * own README (github.com/sgratzl/chartjs-plugin-hierarchical): its ESM
 * build is genuinely tree-shakeable with no side effects, so an
 * explicit `Chart.register(HierarchicalScale)` call is required —
 * unlike `chartjs-scale-timestack`, which registers itself just by
 * being imported. No `mod.default ?? mod` fallback needed either: the
 * named export is the whole, real, confirmed API surface, not a
 * defensive guess.
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
 * (`ILabelNode`/`IValueNode`, confirmed directly from the real
 * package's own type declarations) rather than the flat arrays every
 * other kind/plugin in this project accepts — already reaches Chart.js
 * untouched via the existing `data` prop, no type change needed here
 * either, but a real, meaningfully different shape a consumer needs to
 * know about (see the docs site's own example).
 */
export async function withHierarchical(options: Options): Promise<Options> {
  if (!hierarchicalRegistered) {
    // Stryker disable next-line StringLiteral: see withZoom's own comment
    // above for the full reasoning — same issue, same fix.
    const mod = await import(/* @vite-ignore */ 'chartjs-plugin-hierarchical');
    Chart.register(mod.HierarchicalScale);
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
 * Test-only: resets the remaining four registration flags so tests can
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
}
