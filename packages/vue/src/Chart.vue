<script setup lang="ts">
// Single generic <Chart :type="..."> component (decided architecture:
// one component, not per-type components — see docs/IMPLEMENTATION_PLAN.md
// Phase 2). Deliberately thin — all real chart lifecycle/plugin logic
// lives in useChartController.ts, a plain .ts module, not here. Matches
// keystone-theme-builder's own real convention (thin .vue components,
// logic extracted to plain .ts files) — see that composable's own
// header comment for why this separation matters for mutation testing
// specifically, not just style.
import { ref } from 'vue';
import type {
  AnnotationPluginOptions,
  ChartConfigData,
  ChartConfiguration,
  ChartKind,
  DataLabelsPluginOptions,
  ImageLabelPluginOptions,
  ZoomPluginOptions,
} from 'keystone-chartjs-core';
import { useChartController } from './useChartController.js';

const props = defineProps<{
  type: ChartKind;
  data: ChartConfigData;
  options?: ChartConfiguration['options'];
  /** Opt-in to a local port of `chartjs-plugin-zoom` — `true` applies it
   * with no extra config, an object applies it with that pan/zoom
   * config. As of the port, never registered globally via
   * `Chart.register(...)` — supplied per-chart-instance via Chart.js's
   * own real inline `plugins` array instead, the same mechanism
   * `gradient`/`imageLabel` below use. **Real scope limitation, not a
   * bug**: this port drops every Hammer.js-dependent code path
   * (pinch-zoom, and *all* interactive drag-to-pan — the original has
   * no separate mouse-only pan mechanism at all). Mouse-wheel zoom,
   * mouse-drag-to-zoom-rectangle, and the full programmatic API
   * (`chart.zoom()`, `chart.resetZoom()`, `chart.pan()`, etc.) are all
   * kept. */
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
   * above: its real config lives on each *dataset* instead
   * (`dataset.gradient = { backgroundColor: {...}, borderColor: {...} }`),
   * which already reaches Chart.js untouched via the `data` prop — this
   * prop only supplies the plugin so that per-dataset config takes
   * effect. As of a local port (not a dependency), never registered
   * globally via `Chart.register(...)` — supplied per-chart-instance
   * via Chart.js's own real inline `plugins` array instead, the same
   * mechanism `imageLabel` below uses.
   */
  gradient?: boolean;
  /**
   * Opt-in to `chartjs-scale-timestack` — boolean only, like `gradient`:
   * no `Chart.register(...)`-able export and no plugin-level config of
   * its own. Use it via the standard
   * `options.scales.<id>.type = 'timestack'`, which already reaches
   * Chart.js untouched via the `options` prop — this prop only
   * registers the scale so that value is recognized at all.
   */
  timestack?: boolean;
  /**
   * Opt-in to `chartjs-plugin-hierarchical` — boolean only, registering a
   * real, distinct `hierarchical` **scale** via its own confirmed named
   * export. Use it via `options.scales.<id>.type = 'hierarchical'`, which
   * already reaches Chart.js untouched via the `options` prop. Requires
   * `data.labels`/`dataset.data` in this scale's own tree-node shape
   * (`ILabelNode`/`IValueNode`) rather than flat arrays.
   */
  hierarchical?: boolean;
  /**
   * Opt-in to `chartjs-plugin-image-label` — no plain-boolean form:
   * `imagesList` is required, since there's no sensible empty default
   * (same reasoning as `annotation`). Genuinely different mechanism
   * from every other plugin prop above: never registered globally via
   * `Chart.register(...)` — supplied per-chart-instance via Chart.js's
   * own real inline `plugins` array instead, the same mechanism the
   * `plugins` prop below exposes for custom/community plugins. When
   * set, its own resolved plugin object is appended to whatever
   * `plugins` array is already in effect, additively. Doughnut charts
   * only, per the real package's own docs.
   */
  imageLabel?: ImageLabelPluginOptions;
  /**
   * Inline, per-chart-instance Chart.js plugin objects — passed straight
   * through to Chart.js's own `ChartConfiguration.plugins` field. Distinct
   * from the `zoom`/`annotation`/`dataLabels` props above, which register
   * a known, named package automatically; this prop is for any custom or
   * community plugin the consumer provides themselves.
   */
  plugins?: ChartConfiguration['plugins'];
}>();

const canvasRef = ref<HTMLCanvasElement | null>(null);
// `props` (the reactive proxy defineProps returns) is passed through as
// a whole, not destructured — useChartController reads individual
// properties lazily inside its own functions/watch callback, which is
// what keeps that access reactive.
const { chart } = useChartController(canvasRef, props);

defineExpose({ chart });
</script>

<template>
  <!--
    No `defineOptions({ inheritAttrs: false })` anywhere in this file —
    Vue 3's own default behavior for a single-root component (confirmed
    directly, not assumed: this template has exactly one root element)
    is to forward every attribute the caller passes that isn't a
    declared prop straight onto that root element. That already covers
    accessibility's own ARIA-attribute mechanism
    (`<Chart aria-label="..." role="img">`) and any other native
    `<canvas>` attribute (`id`, `class`, `style`, ...) with zero extra
    code — confirmed by a real component test
    (`tests/component/Chart.spec.ts`'s own "forwards non-prop
    attributes..." case), not just Vue's documented default.

    The `<slot>` below is this file's own real addition: Chart.js's own
    accessibility docs are explicit that real fallback content placed
    between a canvas element's own opening/closing tags is what
    browsers/assistive tech that can't render canvas at all actually
    show — an ARIA attribute alone doesn't cover that case. A consumer
    passing default-slot content (e.g. a data-table summary) renders it
    here, inside the canvas tags, exactly where Chart.js's own docs say
    it needs to be. See docs/site's own
    guide/concepts/accessibility.md for the full guide and a real
    usage example.
  -->
  <canvas ref="canvasRef">
    <slot />
  </canvas>
</template>
