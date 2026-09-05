/**
 * Local port of `chartjs-plugin-trendline` (v3.2.12, MIT, Marcus
 * Alsterfjord), supplied via `Chart.register(trendlinePlugin)` instead
 * of a dependency, so it avoids the docs-site dynamic-import hydration
 * gap the still-dependency-based plugins in this project hit (item #4
 * in docs/IMPLEMENTATION_PLAN.md) \u2014 at your explicit request, the same
 * reasoning already applied to `zoom`/`gradient`/`hierarchical`/
 * `imageLabel`/`autocolors`/`deferred`.
 *
 * **No concrete bug or unmaintained-dependency reason motivated this
 * port** \u2014 unlike every one of those six, this package is actively
 * maintained with zero runtime dependencies of its own and no known
 * bugs found during dissection. Ported anyway, at your explicit
 * request, specifically so `keystone-chartjs-core` depends on nothing
 * but `chart.js` itself \u2014 `annotation`/`dataLabels` remain the only two
 * real npm dependencies left in this project after this port.
 *
 * Real source dissected directly from the installed package's own
 * real, readable `src/` (not a minified bundle \u2014 the package ships
 * real source under `src/core/plugin.js`, `src/components/
 * {trendline,label}.js`, `src/utils/{baseFitter,lineFitter,
 * exponentialFitter,drawing,accessibility}.js`), mirrored here across
 * `fitters.ts`/`drawing.ts`/`label.ts`/`accessibility.ts`/
 * `trendlineCore.ts`, with this file itself corresponding to the
 * original's own `core/plugin.js`.
 *
 * **Real features found only by reading the source, not documented in
 * the README at all**: (1) `dataset.order` \u2014 datasets are drawn in
 * ascending order, except order-`0` (Chart.js's own real default when
 * unset) datasets, which are pushed to draw *last*, on top of every
 * other trendline; (2) `dataset.alwaysShowTrendline` \u2014 draws the
 * trendline even when the dataset itself is currently hidden via the
 * legend; (3) `fillColor` on the trendline config \u2014 fills the area
 * between the trendline and the chart's own bottom edge; (4) a full
 * automatic-ARIA-label system (see `accessibility.ts`); (5) real
 * legend integration \u2014 `beforeInit` monkey-patches the chart's own
 * `legend.options.labels.generateLabels` to append one legend entry per
 * dataset with a real `legend` sub-config, entirely additive to
 * Chart.js's own default-generated legend items.
 *
 * `afterDatasetsDraw` resets `ctx.setLineDash([])` once, after every
 * dataset's own trendline has been drawn \u2014 the original's own real
 * cleanup, carried over unchanged, so a later plugin/dataset drawing
 * after this one doesn't inherit a dashed line style left over from a
 * `lineStyle: 'dotted'`/`'dashed'`/`'dashdot'` trendline.
 */
import type { Chart, Plugin } from 'chart.js';
import type { ChartConfigDataset } from '../../types.js';
import { getScales } from './drawing.js';
import { addFitter } from './trendlineCore.js';
import { applyCanvasAccessibility } from './accessibility.js';

interface RawTrendlineConfig {
  legend?: {
    display?: boolean;
    text?: string;
    strokeStyle?: string;
    color?: string;
    fillStyle?: string;
    lineCap?: CanvasLineCap;
    lineDash?: number[];
    lineWidth?: number;
    width?: number;
  };
}

interface TrendlineLegendItem {
  text: string;
  strokeStyle: string;
  fillStyle: string;
  lineCap: CanvasLineCap;
  lineDash: number[];
  lineWidth: number;
}

/** Builds one legend entry from a dataset's own trendline config \u2014
 * `null` when there's no trendline config at all, or its own `legend`
 * sub-config is absent/explicitly `display: false`. Every real default
 * below (gray `strokeStyle`, transparent `fillStyle`, `'butt'`
 * `lineCap`, `lineWidth` `1`) matches the original's own real values,
 * not guessed at. */
function createLegendItemFromTrendline(dataset: ChartConfigDataset, trendlineConfig: RawTrendlineConfig | undefined): TrendlineLegendItem | null {
  if (!trendlineConfig) return null;
  const legendConfig = trendlineConfig.legend;
  if (!legendConfig || legendConfig.display === false) return null;

  return {
    text: legendConfig.text ?? (dataset.label as string | undefined) ?? 'Trendline',
    strokeStyle: legendConfig.strokeStyle ?? legendConfig.color ?? (dataset.borderColor as string | undefined) ?? 'rgba(169,169,169, .6)',
    fillStyle: legendConfig.fillStyle ?? 'transparent',
    lineCap: legendConfig.lineCap ?? 'butt',
    lineDash: legendConfig.lineDash ?? [],
    lineWidth: legendConfig.lineWidth ?? legendConfig.width ?? 1,
  };
}

/**
 * Chart.js plugin that fits and draws a real linear or exponential
 * trendline per dataset (`dataset.trendlineLinear`/`dataset.
 * trendlineExponential`), with an optional rotated text label, an
 * optional fill below the line, automatic legend entries, and
 * automatic ARIA-label generation.
 *
 * Registered via `Chart.register(trendlinePlugin)`.
 */
export const trendlinePlugin: Plugin = {
  id: 'chartjs-plugin-trendline',

  afterDatasetsDraw(chart: Chart): void {
    const ctx = chart.ctx;
    const { xScale, yScale } = getScales(chart);
    if (!xScale || !yScale) return;

    const datasets = chart.data.datasets as unknown as ChartConfigDataset[];
    const sorted = datasets
      .map((dataset, index) => ({ dataset, index }))
      .filter((entry) => entry.dataset.trendlineLinear ?? entry.dataset.trendlineExponential)
      .sort((a, b) => {
        const orderA = (a.dataset.order as number | undefined) ?? 0;
        const orderB = (b.dataset.order as number | undefined) ?? 0;
        if (orderA === 0 && orderB !== 0) return 1;
        if (orderB === 0 && orderA !== 0) return -1;
        return orderA - orderB;
      });

    for (const { dataset, index } of sorted) {
      const showTrendline = (dataset.alwaysShowTrendline as boolean | undefined) ?? chart.isDatasetVisible(index);
      const data = dataset.data as unknown[];
      if (showTrendline && data.length > 1) {
        const datasetMeta = chart.getDatasetMeta(index);
        addFitter(datasetMeta as unknown as { controller: { chart: Chart } }, ctx, dataset, xScale, yScale);
      }
    }

    ctx.setLineDash([]);
  },

  afterInit(chart: Chart): void {
    applyCanvasAccessibility(chart);
  },

  afterUpdate(chart: Chart): void {
    applyCanvasAccessibility(chart);
  },

  beforeInit(chart: Chart): void {
    const datasets = chart.data.datasets as unknown as ChartConfigDataset[];
    const hasLegendConfig = datasets.some((dataset) => {
      const trendlineConfig = (dataset.trendlineLinear ?? dataset.trendlineExponential) as RawTrendlineConfig | undefined;
      return createLegendItemFromTrendline(dataset, trendlineConfig) !== null;
    });
    if (!hasLegendConfig) return;

    // Cast: Chart.js's own real `LegendElement`/`LegendOptions` types
    // are fully generic over chart type, which strict inference doesn't
    // resolve cleanly against this project's own widened `ChartKind`
    // union here \u2014 safe at runtime, since `chart.legend` and its own
    // `options.labels.generateLabels` are real, standard Chart.js
    // properties regardless of chart kind.
    const legend = chart.legend as unknown as { options: { labels: { generateLabels: (chart: Chart) => TrendlineLegendItem[] } } } | undefined;
    if (!legend) return;

    const originalGenerateLabels = legend.options.labels.generateLabels;
    legend.options.labels.generateLabels = (c: Chart): TrendlineLegendItem[] => {
      const defaultLabels = originalGenerateLabels(c);
      for (const dataset of c.data.datasets as unknown as ChartConfigDataset[]) {
        const trendlineConfig = (dataset.trendlineLinear ?? dataset.trendlineExponential) as RawTrendlineConfig | undefined;
        const item = createLegendItemFromTrendline(dataset, trendlineConfig);
        if (item) defaultLabels.push(item);
      }
      return defaultLabels;
    };
  },
};
