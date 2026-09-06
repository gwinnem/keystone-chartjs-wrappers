import { onMounted, onBeforeUnmount, shallowRef, watch, type Ref } from 'vue';
import {
  createChartController,
  withAnnotation,
  withAutocolors,
  withDataLabels,
  withDeferred,
  withGradient,
  withHierarchical,
  withImageLabel,
  withTimestack,
  withTrendline,
  withZoom,
} from 'keystone-chartjs-core';
import type {
  AnnotationPluginOptions,
  AutocolorsPluginOptions,
  ChartConfigData,
  ChartConfiguration,
  ChartControllerHandle,
  ChartJs,
  ChartKind,
  DataLabelsPluginOptions,
  DeferredPluginOptions,
  ImageLabelPluginOptions,
  ZoomPluginOptions,
} from 'keystone-chartjs-core';

// The real chart lifecycle/plugin-threading logic behind <Chart> — kept
// in its own plain .ts module rather than inline in Chart.vue's own
// <script setup> block, matching keystone-theme-builder's own real
// convention (thin .vue components, logic extracted to plain .ts files/
// composables) — see that project's own stryker.config.mjs comment for
// why: Stryker mutates JS/TS ASTs, and a .vue SFC's <script> block isn't
// an officially supported mutation target the same way a plain .ts file
// is. A prior version of this logic lived directly in Chart.vue, which
// would have meant Phase 2's own mutation-testing tier had nothing real
// to target at all (Chart.vue itself was the only file with real logic,
// and `.vue` files were never in `stryker.config.mjs`'s own `mutate`
// list, matching keystone-theme-builder's identical exclusion).
export interface UseChartControllerProps {
  type: ChartKind;
  data: ChartConfigData;
  options?: ChartConfiguration['options'];
  /** Opt-in to a local port of `chartjs-plugin-zoom` — `true` applies it
   * with no extra config, an object applies it with that pan/zoom
   * config. As of the port, this plugin is never registered globally
   * via `Chart.register(...)` — supplied per-chart-instance via
   * Chart.js's own real inline `plugins` array instead, the same
   * mechanism `gradient`/`imageLabel` below use. **Hammer.js is gone,
   * but pinch and interactive pan are not** — both are reimplemented
   * directly on the standards-based Pointer Events API instead of the
   * original's own Hammer.js dependency (itself confirmed
   * unmaintained — see `zoomPlugin.ts`'s own header comment). Set
   * `zoom.pinch.enabled` for pinch-zoom and `pan.enabled` for
   * single-finger touch/pen pan — mouse drag stays wheel-zoom/drag-to-
   * zoom-rectangle only, matching the original's own real mouse
   * behavior (it never had a separate mouse-drag-to-pan gesture
   * either). The full programmatic API (`chart.zoom()`,
   * `chart.resetZoom()`, `chart.pan()`, etc.) is available regardless
   * of what's enabled here. */
  zoom?: ZoomPluginOptions | boolean;
  /** Opt-in to `chartjs-plugin-annotation` — no plain-boolean form (unlike
   * `zoom`/`dataLabels`): `AnnotationPluginOptions.annotations` is
   * required, since there's no sensible empty default to apply the
   * plugin with. */
  annotation?: AnnotationPluginOptions;
  /** Opt-in to `chartjs-plugin-datalabels` — `true` applies it with no
   * extra config, an object applies it with that config. */
  dataLabels?: DataLabelsPluginOptions | boolean;
  /**
   * Opt-in to `chartjs-plugin-gradient` — boolean only, unlike the three
   * above: this plugin has no plugin-level config of its own to merge
   * into `options.plugins.gradient`. Its real config lives on each
   * *dataset* instead (`dataset.gradient = { backgroundColor: {...},
   * borderColor: {...} }`), which already reaches Chart.js untouched via
   * the existing `data` prop — this prop only supplies the plugin so
   * that per-dataset config takes effect. As of a local port (not a
   * dependency), this plugin is never registered globally via
   * `Chart.register(...)` — supplied per-chart-instance via Chart.js's
   * own real inline `plugins` array instead, the same mechanism
   * `imageLabel` below uses. When set, this prop's own resolved plugin
   * object is appended to whatever `plugins` array is already in effect
   * (additively, not replacing it) — see `resolveOptionsAndPlugins()`.
   */
  gradient?: boolean;
  /**
   * Opt-in to `chartjs-scale-timestack` — boolean only, like `gradient`:
   * this package has no `Chart.register(...)`-able export at all (it
   * registers its own `timestack` scale as a side effect of being
   * imported) and no plugin-level config of its own either. Use it via
   * the standard `options.scales.<id>.type = 'timestack'` (and
   * optionally `options.scales.<id>.timestack = {...}` for its own real
   * config), both of which already reach Chart.js untouched via the
   * existing `options` prop — this prop only registers the scale so
   * that `type: 'timestack'` is recognized at all.
   */
  timestack?: boolean;
  /**
   * Opt-in to a local port of `chartjs-plugin-hierarchical` — boolean
   * only, like `gradient`/`timestack`: this registers a real, distinct
   * `hierarchical` **scale** (not a Chart.js "plugin" object) via this
   * project's own `HierarchicalScale` (see `hierarchicalScale.ts`'s
   * own header comment for the full port rationale — unlike
   * `chartjs-scale-timestack`, this one has zero runtime dependencies
   * of its own, confirmed directly from the real package's own
   * `package.json`), with no plugin-level config of its own to merge
   * here either. Use it via the standard
   * `options.scales.<id>.type = 'hierarchical'`, which already reaches
   * Chart.js untouched via the existing `options` prop. Requires
   * `data.labels`/`dataset.data` in this scale's own tree-node shape
   * (`HierarchicalRawLabelNode`/`HierarchicalValueNode`, exported from
   * `keystone-chartjs-core`) rather than flat arrays — see the docs
   * site's own example.
   */
  hierarchical?: boolean;
  /**
   * Opt-in to `chartjs-plugin-image-label` — no plain-boolean form:
   * `ImageLabelPluginOptions.imagesList` is required, since there's no
   * sensible empty default (same reasoning as `annotation`). Genuinely
   * different mechanism from every other plugin prop above: this
   * package is never registered globally via `Chart.register(...)` at
   * all — it's supplied per-chart-instance, via Chart.js's own real
   * inline `plugins` array, the same mechanism the `plugins` prop below
   * already exposes for custom/community plugins. When set, this prop's
   * own resolved plugin object is appended to whatever `plugins` array
   * is already in effect (additively, not replacing it) — see
   * `resolveOptionsAndPlugins()`. Doughnut charts only, per the real
   * package's own docs (not enforced here).
   */
  imageLabel?: ImageLabelPluginOptions;
  /**
   * Opt-in to `chartjs-plugin-autocolors` — `true` applies it with no
   * extra config, an object applies it with that config (`mode`,
   * `offset`, `repeat`, `customize`). Automatically assigns a distinct
   * color per dataset (or per data point, in `'data'`/`'label'` mode)
   * when none is already set — useful for charts with a variable
   * number of series where hand-picking colors isn't practical. Same
   * registration shape as `dataLabels`/`annotation`: registered once
   * via `Chart.register(...)`, its own config merged into
   * `options.plugins.autocolors`.
   */
  autocolors?: AutocolorsPluginOptions | boolean;
  /**
   * Opt-in to `chartjs-plugin-deferred` — `true` applies it with no
   * extra config, an object applies it with that config (`xOffset`,
   * `yOffset`, `delay`). Defers the chart's own real initial update
   * (and thus its initial-render animations) until the canvas actually
   * scrolls into the viewport — useful for charts far down a long page
   * that would otherwise animate in unseen. Same registration shape as
   * `dataLabels`/`annotation`: a real npm dependency, registered once
   * via `Chart.register(...)`, its own config merged into
   * `options.plugins.deferred`.
   */
  deferred?: DeferredPluginOptions | boolean;
  /**
   * Opt-in to `chartjs-plugin-trendline` — boolean only, like
   * `gradient`/`timestack`/`hierarchical`: this plugin has no
   * plugin-level config of its own to merge into
   * `options.plugins.trendline` at all. Its real config
   * (`TrendlineConfig`, exported from `keystone-chartjs-core`) lives on
   * each *dataset* instead (`dataset.trendlineLinear`/`dataset.
   * trendlineExponential`), which already reaches Chart.js untouched
   * via the existing `data` prop — this prop only registers the
   * plugin so that per-dataset config takes effect. A real npm
   * dependency, registered once via `Chart.register(...)` — the same
   * mechanism `dataLabels`/`annotation` use, unlike `gradient`'s own
   * local port. */
  trendline?: boolean;
  /**
   * Inline, per-chart-instance Chart.js plugin objects — passed straight
   * through to Chart.js's own `ChartConfiguration.plugins` field. Distinct
   * from the `zoom`/`annotation`/`dataLabels` props above, which register
   * a known, named package automatically; this prop is for any custom or
   * community plugin the consumer provides themselves. A change in this
   * array's own reference triggers a full chart destroy-and-recreate (the
   * `plugins` field is only read by Chart.js at construction time).
   */
  plugins?: ChartConfiguration['plugins'];
}

export function useChartController(
  canvasRef: Ref<HTMLCanvasElement | null>,
  props: UseChartControllerProps,
) {
  // The live Chart.js instance, returned below for the caller to expose
  // for advanced/escape-hatch consumer access — shallowRef since
  // Chart.js instances manage their own internal mutation and should
  // never be deep-reactive-proxied.
  const chart = shallowRef<ChartJs | null>(null);

  let handle: ChartControllerHandle | null = null;
  // Caches the merged `plugins` array produced when `zoom`/`gradient`/
  // `imageLabel` are set, so its own reference stays stable across calls
  // where none of `props.plugins`/`props.zoom`/`props.gradient`/
  // `props.imageLabel` actually changed — without this, a fresh array on
  // every single resolveOptionsAndPlugins() call (even one triggered by
  // an unrelated prop like `data`) would make controller.ts's own
  // `next.plugins !== currentPlugins` reference check always true,
  // forcing a full destroy-and-recreate on every update whenever any
  // inline plugin is in use. Keyed on the last-seen references/values of
  // all four inputs (shallow, matching how `plugins` is already diffed
  // elsewhere) — a real, reasoned concern, not a hypothetical, since
  // this exact class of bug already needed a fix once before for
  // `useChartController.ts`'s own promise-chain handling (see
  // `enqueue()`'s own comment on the unhandled-rejection gap).
  let lastRawPlugins: ChartConfiguration['plugins'];
  let lastZoom: ZoomPluginOptions | boolean | undefined;
  let lastGradient: boolean | undefined;
  let lastImageLabelOptions: ImageLabelPluginOptions | undefined;
  let mergedPluginsCache: ChartConfiguration['plugins'];
  // Serializes every mount/update call through one promise chain — both
  // createChartController and handle.update are async, so a prop change
  // arriving before the previous render has settled could otherwise race
  // it (two overlapping calls stepping on each other, or an update
  // running against a handle that doesn't exist yet). Chaining through
  // `pending` guarantees strict, one-at-a-time ordering regardless of
  // timing.
  let pending: Promise<void> = Promise.resolve();

  function enqueue(task: () => Promise<void>): void {
    pending = pending.then(task, task);
    // Marks `pending` as handled immediately, regardless of whether it
    // rejects — without this, a real run confirmed a genuine gap: if
    // `task` itself rejects (e.g. `createChartController` throwing), the
    // resulting `pending` sits unhandled for however long passes before
    // the *next* `enqueue()` call attaches `.then(task, task)`'s own
    // real continuation logic, which is exactly what `.then(task, task)`
    // recovers from — but Node/V8 flags an unhandled rejection based on
    // whether a handler was EVER attached at all during that gap,
    // regardless of it eventually being handled later. This empty
    // `.catch` changes no real behavior (the callback is a true no-op)
    // and doesn't affect the `pending` reference used for actual
    // chaining above — it exists purely to suppress that false-positive
    // warning/failure.
    pending.catch(() => {});
  }

  async function resolveOptionsAndPlugins(): Promise<{
    options: ChartConfiguration['options'];
    plugins: ChartConfiguration['plugins'];
  }> {
    let opts = props.options ?? {};
    if (props.annotation) {
      opts = await withAnnotation(opts, props.annotation);
    }
    if (props.dataLabels) {
      opts = await withDataLabels(
        opts,
        typeof props.dataLabels === 'object' ? props.dataLabels : undefined,
      );
    }
    if (props.timestack) {
      opts = await withTimestack(opts);
    }
    if (props.hierarchical) {
      opts = await withHierarchical(opts);
    }
    if (props.autocolors) {
      opts = await withAutocolors(
        opts,
        typeof props.autocolors === 'object' ? props.autocolors : undefined,
      );
    }
    if (props.deferred) {
      opts = await withDeferred(
        opts,
        typeof props.deferred === 'object' ? props.deferred : undefined,
      );
    }
    if (props.trendline) {
      opts = await withTrendline(opts);
    }
    // Effective plugins array starts as whatever the consumer supplied
    // via the `plugins` prop directly — `withZoom`'s, `withGradient`'s,
    // and `withImageLabel`'s own resolved plugin objects are appended to
    // it, not substituted for it, since these inline plugins and a
    // consumer's own custom `plugins` are all meant to coexist (they
    // ultimately feed the same real Chart.js `ChartConfiguration.plugins`
    // array).
    let effectivePlugins = props.plugins;
    const inputsChanged =
      props.plugins !== lastRawPlugins ||
      props.zoom !== lastZoom ||
      props.gradient !== lastGradient ||
      props.imageLabel !== lastImageLabelOptions;
    if (props.zoom || props.gradient || props.imageLabel) {
      // withZoom/withGradient/withImageLabel are called every time
      // regardless of the cache below — withZoom's/withImageLabel's own
      // calls are what merge their own config into opts.plugins.*, which
      // still needs to happen even when the merged plugins *array*
      // reference can be reused. The plugin objects themselves are
      // stable, local, module-level values (see zoomPlugin.ts/
      // gradientPlugin.ts/imageLabelPlugin.ts), so calling these helpers
      // again here is cheap either way.
      const inlinePlugins: unknown[] = [];
      if (props.zoom) {
        const result = await withZoom(
          opts,
          typeof props.zoom === 'object' ? props.zoom : undefined,
        );
        opts = result.options;
        inlinePlugins.push(result.plugin);
      }
      if (props.gradient) {
        const result = await withGradient(opts);
        opts = result.options;
        inlinePlugins.push(result.plugin);
      }
      if (props.imageLabel) {
        const result = await withImageLabel(opts, props.imageLabel);
        opts = result.options;
        inlinePlugins.push(result.plugin);
      }
      if (!inputsChanged) {
        // None of props.plugins/props.zoom/props.gradient/props.imageLabel
        // changed since the last call — reuse the exact same merged array
        // reference rather than rebuild an identical-looking one, so an
        // unrelated update (e.g. `data`) doesn't spuriously force a
        // destroy-and-recreate.
        effectivePlugins = mergedPluginsCache;
      } else {
        // Cast needed: withZoom/withGradient/withImageLabel all
        // deliberately type their own returned plugin as `unknown` (see
        // plugins.ts), since none is modeled against Chart.js's own
        // `Plugin<...>` type at the cross-package boundary — safe here
        // since all three are real, valid Chart.js plugin objects at
        // runtime (confirmed by each's own dedicated test suite in
        // packages/core).
        effectivePlugins = [
          ...(props.plugins ?? []),
          ...inlinePlugins,
        ] as ChartConfiguration['plugins'];
        mergedPluginsCache = effectivePlugins;
      }
    }
    lastRawPlugins = props.plugins;
    lastZoom = props.zoom;
    lastGradient = props.gradient;
    lastImageLabelOptions = props.imageLabel;
    return { options: opts, plugins: effectivePlugins };
  }

  // No "canvasRef is still null" guard here — genuinely unreachable, not
  // just unlikely: the caller's own template renders <canvas> with no
  // `v-if`, so Vue always assigns the template ref during its own
  // render/patch phase *before* calling onMounted — by the time this
  // function's enqueued task actually runs, canvasRef.value is always a
  // real element. A real `test:coverage` run against the pre-refactor
  // inline version of this logic confirmed a guard here was dead code.
  async function mount(): Promise<void> {
    const { options, plugins } = await resolveOptionsAndPlugins();
    handle = await createChartController(canvasRef.value!, {
      type: props.type,
      data: props.data,
      options,
      plugins,
    });
    chart.value = handle.chart;
  }

  // No "handle is still null" fallback here either, for the identical
  // reason: `enqueue()` always runs `mount()` before any `update()` task
  // (`onMounted` enqueues `mount` first; `watch()`'s callback can only
  // fire on a later reactive tick), and `mount()` always successfully
  // sets `handle` per the note above.
  async function update(): Promise<void> {
    const { options, plugins } = await resolveOptionsAndPlugins();
    await handle!.update({ type: props.type, data: props.data, options, plugins });
    // handle.chart is a live getter — re-read it after update(), since an
    // in-place update keeps the same instance but a type-change recreate
    // swaps it for a new one under the same handle.
    chart.value = handle!.chart;
  }

  onMounted(() => {
    enqueue(mount);
  });

  watch(
    () => [
      props.type,
      props.data,
      props.options,
      props.zoom,
      props.annotation,
      props.dataLabels,
      props.gradient,
      props.timestack,
      props.hierarchical,
      props.imageLabel,
      props.autocolors,
      props.deferred,
      props.trendline,
      props.plugins,
    ],
    () => {
      enqueue(update);
    },
    { deep: true },
  );

  onBeforeUnmount(() => {
    enqueue(async () => {
      handle?.destroy();
      handle = null;
      chart.value = null;
    });
  });

  return { chart };
}
