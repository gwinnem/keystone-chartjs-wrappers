import type { Chart, ChartConfiguration, ChartType, DefaultDataPoint } from 'chart.js';

// Re-exported so framework packages (packages/vue|react|angular) can
// import Chart.js's own types through this package rather than
// depending on 'chart.js' directly for type-only imports —
// `ChartConfiguration` and the `Chart` class type itself (aliased here
// as `ChartJs` to avoid colliding with each framework's own `<Chart>`
// component export, matching the alias `packages/vue/src/
// useChartController.ts` already used locally before this centralized
// it). `chart.js` itself stays a real, separate `peerDependency` of
// each framework package regardless — this re-export only removes the
// need for a *duplicate, direct* import of its types in three places.
export type { ChartConfiguration, Chart as ChartJs };

/**
 * Every chart "kind" this library resolves to a Chart.js controller for —
 * the 8 built-in types plus the ecosystem chart-type extensions decided
 * in docs/IMPLEMENTATION_PLAN.md (financial, boxplot, matrix, sankey,
 * treemap). Kept as a distinct union from Chart.js's own `ChartType` so
 * the registry can validate/lazily-register extension controllers before
 * a chart is constructed.
 */
export type ChartKind =
  | ChartType
  | 'candlestick'
  | 'ohlc'
  | 'boxplot'
  | 'violin'
  | 'matrix'
  | 'sankey'
  | 'treemap';

/**
 * Chart.js's own `DefaultDataPoint<ChartType>` (what `ChartConfiguration
 * ['data']` resolves to when left unparameterized) only covers the 8
 * built-in kinds' own data-point shapes (`number | [number, number] |
 * Point | BubbleDataPoint | null`) — none of the 7 ecosystem extension
 * kinds' own data-point shapes are part of it at all, since Chart.js's
 * core types have no knowledge of packages this project registers
 * purely at runtime (no extension package's own `.d.ts` is ever
 * imported anywhere in this project, by design — registration is fully
 * dynamic, not type-driven). A real `vue-tsc --noEmit` run confirmed
 * this genuinely breaks type-checking for real data passed to 6 of the
 * 7 extension kinds (candlestick/ohlc/boxplot/violin/matrix/sankey —
 * treemap's own flat `number[]` shape happens to already fit an
 * existing built-in shape, so it alone wasn't affected). Widened below,
 * matching the same "loose on purpose, full per-kind modeling deferred
 * to Phase 5" approach already used for `AnnotationPluginOptions`
 * further down this file — a complete, precise discriminated union
 * keyed off `type` would be a real, much larger undertaking, not
 * attempted here.
 *
 * IMPORTANT: Chart.js's own `TData` generic parameter (what
 * `DefaultDataPoint<TType>` itself resolves to) represents the **whole
 * per-dataset `data` array type** (e.g. `(number | null)[]`), not a
 * single data-point's own shape — confirmed directly from Chart.js's own
 * `ChartDatasetProperties<TType, TData> { data: TData }`. A first,
 * wrong attempt at this fix defined bare per-entry shapes here (e.g.
 * `number[]` for boxplot, meant as "one box's own raw values") without
 * the outer array Chart.js actually expects (an *array* of those, one
 * per box) — confirmed broken by a real `vue-tsc --noEmit` run still
 * failing identically afterward. Every member below is therefore
 * itself already an array type, matching each real package's own
 * dataset-level `data` shape exactly.
 */
type ExtensionData =
  | number[][] // boxplot/violin: array of raw-number arrays, one per box
  | { x: number; y: number; v: number }[] // matrix
  | { x: number; o: number; h: number; l: number; c: number }[] // candlestick/ohlc
  | { from: string; to: string; flow: number }[]; // sankey

/**
 * One dataset within `ChartConfigData`. Hand-rolled rather than derived
 * from Chart.js's own generic `ChartDataset<TType, TData>`, for a
 * second, real gap found via an actual `vue-tsc --noEmit` run (after
 * fixing the `data`-shape gap above): Chart.js's own per-dataset
 * *options* type is ALSO keyed by its narrow, built-ins-only `ChartType`
 * — e.g. `matrix`'s own real, documented scriptable `width`/`height`
 * dataset functions aren't part of it at all, the identical class of
 * gap as `ExtensionData` above but at the dataset-options level rather
 * than the data-array level. Modeled here as a loose index signature
 * (`[key: string]: unknown`) alongside the fields every dataset
 * definitely has, rather than Chart.js's own much stricter
 * per-built-in-kind dataset-options union — full, precise
 * per-extension-kind dataset-option typing is real Phase 5 scope,
 * matching every other "loose on purpose" type in this file.
 */
export interface ChartConfigDataset {
  type?: ChartKind;
  label?: string;
  data: DefaultDataPoint<ChartType> | ExtensionData;
  [key: string]: unknown;
}

/**
 * The real `data` type this library's own `<Chart>` components accept,
 * across all 15 kinds — exported so framework packages
 * (packages/vue|react|angular) can type their own `data` prop/input
 * against this directly, rather than each re-deriving the same widened
 * shape independently. Hand-rolled (matching Chart.js's own real
 * `ChartData` shape: optional `labels`, required `datasets`) rather than
 * derived from `ChartConfiguration<...>['data']` directly, for the
 * `ChartConfigDataset` reason above.
 */
export interface ChartConfigData {
  labels?: unknown[];
  datasets: ChartConfigDataset[];
}

/**
 * What a framework component passes in on mount, and again on every
 * subsequent prop/input change — a flat shape rather than nesting `data`/
 * `options` inside a `config` object, since that's what ends up threaded
 * straight into `ChartConfiguration` anyway (see controller.ts).
 *
 * NOTE: this replaces the placeholder `ChartInstanceOptions` shape
 * (`{ kind, config }`) the scaffolded Chart.vue/Chart.tsx/
 * KeystoneChartComponent currently construct. Those three placeholders
 * are NOT updated as part of Phase 1 — updating them to this shape (and
 * to `createChartController`'s new async signature) is explicitly
 * Phase 2/3/4 work per docs/IMPLEMENTATION_PLAN.md. Until then they will
 * not compile/run correctly against this package — a known, tracked gap,
 * not an oversight.
 */
export interface ChartUpdatePayload<TKind extends ChartKind = ChartKind> {
  type: TKind;
  data: ChartConfigData;
  options?: ChartConfiguration['options'];
  /**
   * Inline, per-chart-instance Chart.js plugin objects — the real
   * `ChartConfiguration['plugins']` field, distinct from this library's
   * own 3 official opt-in props (`zoom`/`annotation`/`dataLabels`), which
   * register a *known, named* package and merge its config into
   * `options.plugins.<id>`. This field is for any Chart.js plugin a
   * consumer supplies themselves — a custom plugin object, or any
   * community plugin this library doesn't officially ship support for.
   * Reaches the real `Chart` constructor untouched via `toConfig()` in
   * controller.ts, the same way `options` already does.
   */
  plugins?: ChartConfiguration['plugins'];
}

/**
 * The handle `createChartController` resolves to — the imperative surface
 * framework layers call into for the rest of the chart's lifecycle after
 * mount.
 */
export interface ChartControllerHandle {
  /** The live Chart.js instance. Framework layers may read from it, but
   * should go through the methods below to change it — the controller
   * needs to know about type changes to decide update-vs-recreate. */
  readonly chart: Chart;
  /** Diffs `next` against the current chart: same `type` (including every
   * dataset's own `type` override) updates in place via `chart.update()`;
   * a changed `type` destroys and reconstructs. Either path re-registers
   * any not-yet-registered chart kinds first. */
  update(next: ChartUpdatePayload): Promise<void>;
  /** Manual resize trigger — also called automatically by the
   * ResizeObserver wired up in `createChartController`. */
  resize(): void;
  /** Merges `patch` into the live chart's own `options` (one level deep —
   * see controller.ts's own `mergeOptions`) and calls `chart.update()`,
   * without touching `data` or recreating the instance. Intended for
   * light/dark theme token re-application, not general options changes —
   * use `update()` for those. */
  applyTheme(patch: NonNullable<ChartConfiguration['options']>): void;
  /** Disconnects the ResizeObserver and destroys the Chart.js instance. */
  destroy(): void;
}

/**
 * `chartjs-plugin-annotation`'s real config lives under
 * `options.plugins.annotation.annotations` — see
 * docs/CHARTJS_ANALYSIS.md §4. Same "loose on purpose" note as
 * `ZoomPluginOptions` used to have before that plugin's own local port
 * (see zoomPlugin.ts, which now models its own options precisely).
 */
export interface AnnotationPluginOptions {
  annotations: Record<string, unknown>;
}

/**
 * `chartjs-plugin-datalabels`'s real config lives under
 * `options.plugins.datalabels` directly. Same "loose on purpose" note as
 * `ZoomPluginOptions` above.
 */
export type DataLabelsPluginOptions = Record<string, unknown>;

/**
 * `chartjs-plugin-image-label`'s real config, confirmed directly from
 * the real package's own README (npmjs.com/package/chartjs-plugin-
 * image-label) — unlike every other plugin option type in this file,
 * modeled precisely rather than loosely, since the package's own real
 * surface is small and fully documented. Lives under
 * `options.plugins.imageLabel`, doughnut charts only.
 */
export interface ImageLabelPluginOptions {
  verticalAlign?: 'top' | 'middle' | 'bottom';
  horizontalAlign?: 'start' | 'middle' | 'end';
  offset?: number;
  imagesList: Array<{
    imageUrl: string;
    imageWidth: number;
    imageHeight: number;
  }>;
}

/**
 * `chartjs-plugin-autocolors`'s real config, confirmed directly from
 * the real package's own README (github.com/kurkle/chartjs-plugin-
 * autocolors) — modeled precisely rather than loosely, since the
 * package's own real surface is small and fully documented (same
 * approach as `ImageLabelPluginOptions` above). Lives under
 * `options.plugins.autocolors`.
 */
export interface AutocolorsPluginOptions {
  /** Set to `false` to disable autocoloring for a chart that would
   * otherwise pick it up from a global `Chart.register(autocolors)`
   * call.
   * @default true */
  enabled?: boolean;
  /** `'dataset'` picks one new color per dataset; `'data'` picks one
   * per data point within each dataset; `'label'` keys the color to
   * each data point's own label instead of its index (so the same
   * label always gets the same color across datasets). `'dataset'`
   * mode doesn't work properly for doughnut/pie charts — the real
   * package's own docs recommend `'data'` mode for those instead.
   * @default 'dataset' */
  mode?: 'dataset' | 'data' | 'label';
  /** Offsets the color generation by this many colors — useful when
   * several charts on the same page should not start from the same
   * first color. */
  offset?: number;
  /** Colors this many adjacent datasets/points the same before moving
   * to the next color — useful for grouping related series. */
  repeat?: number;
  /** Called once per generated color with the real, computed
   * `{ background, border }` pair — return a replacement pair (e.g.
   * lightened/darkened) to customize the generated palette without
   * replacing it outright. */
  customize?: (context: { colors: { background: string; border: string } }) => { background: string; border: string };
}

/**
 * `chartjs-plugin-deferred`'s real config, confirmed directly from the
 * real package's own README (github.com/chartjs/chartjs-plugin-deferred)
 * — modeled precisely rather than loosely, since the package's own real
 * surface is small and fully documented (same approach as
 * `ImageLabelPluginOptions`/`AutocolorsPluginOptions` above). Lives
 * under `options.plugins.deferred`.
 */
export interface DeferredPluginOptions {
  /** How many pixels (or, as a percentage string, what fraction) of the
   * canvas's own width must already be inside the viewport before the
   * chart's real initial update runs.
   * @default 150 */
  xOffset?: number | string;
  /** Same as `xOffset`, for the canvas's own height.
   * @default 150 */
  yOffset?: number | string;
  /** Extra delay, in milliseconds, after the canvas is considered
   * inside the viewport before the real initial update actually runs.
   * @default 500 */
  delay?: number;
}
