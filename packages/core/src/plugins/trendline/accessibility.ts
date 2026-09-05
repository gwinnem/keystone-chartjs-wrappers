/**
 * Automatic ARIA-label generation for trendline-bearing charts,
 * faithfully ported from `chartjs-plugin-trendline` (v3.2.12, MIT,
 * Marcus Alsterfjord) \u2014 real source dissected directly from the
 * installed package's own real, readable `src/utils/accessibility.js`.
 * A genuinely undocumented feature: neither the real package's own
 * README nor `MIGRATION.md` mentions this at all \u2014 confirmed only by
 * reading the real source directly.
 *
 * **A real, confirmed dead-code finding in the original itself, not
 * introduced by this port**: the original also exports a
 * `generateTrendlineDescription(fitter, dataset, isExponential)`
 * function (computing a slope/intercept-based description directly
 * from a fitter instance) \u2014 but nothing in the original's own real
 * source ever calls it. `generateChartTrendlineDescription` (the
 * function actually used, below) builds its own description straight
 * from each dataset's own `accessibility.description`/`.label` config
 * instead, never touching a fitter at all. Omitted here rather than
 * ported as unreachable code with no real caller \u2014 the same
 * "genuinely orphaned in the original" reasoning this project has
 * applied before when a real port surfaced dead code in the source
 * being dissected.
 */
import type { Chart } from 'chart.js';
import type { ChartConfigDataset } from '../../types.js';

interface TrendlineAccessibilityConfig {
  accessibility?: { description?: string; label?: string };
}

/** Builds a combined, human-readable description covering every
 * dataset on the chart that has a real trendline config \u2014 used as the
 * canvas's own `aria-label`. Prefers a consumer-supplied
 * `accessibility.description` verbatim; falls back to a short,
 * generated sentence using `accessibility.label` if given, or a bare
 * "Linear/Exponential trendline for <dataset label>." otherwise. */
export function generateChartTrendlineDescription(chart: Chart): string {
  const descriptions: string[] = [];

  for (const dataset of chart.data.datasets as unknown as ChartConfigDataset[]) {
    const isExponential = !!dataset.trendlineExponential;
    const config = (dataset.trendlineExponential ?? dataset.trendlineLinear) as TrendlineAccessibilityConfig | undefined;
    if (!config) continue;

    if (config.accessibility?.description) {
      descriptions.push(config.accessibility.description);
      continue;
    }

    const dataLabel = dataset.label ?? 'Dataset';
    const trendType = isExponential ? 'Exponential trendline' : 'Linear trendline';
    if (config.accessibility?.label) {
      descriptions.push(`${trendType} for ${dataLabel}: ${config.accessibility.label}`);
    } else {
      descriptions.push(`${trendType} for ${dataLabel}.`);
    }
  }

  return descriptions.join(' ');
}

/** Sets `role="img"` and a real, generated `aria-label` on the chart's
 * own canvas \u2014 called from both `afterInit` and `afterUpdate`, so a
 * real, working guard against duplicate-appending is needed: the
 * canvas's own original, consumer-supplied `aria-label` (if any) is
 * captured once into a `data-trendline-original-label` attribute on
 * first call, then every subsequent call re-derives the final label
 * from that stable original plus the current description \u2014 rather
 * than appending onto whatever `aria-label` happened to be there
 * already, which would otherwise grow a new copy of the description
 * on every single chart update. Confirmed a real, deliberate fix in
 * the original for a real, reported bug
 * (github.com/Makanz/chartjs-plugin-trendline/issues/152), not
 * something this port introduced. */
export function applyCanvasAccessibility(chart: Chart): void {
  const canvas = chart.canvas;
  if (!canvas) return;

  canvas.setAttribute('role', 'img');

  const description = generateChartTrendlineDescription(chart);
  if (!description) return;

  if (!canvas.hasAttribute('data-trendline-original-label')) {
    canvas.setAttribute('data-trendline-original-label', canvas.getAttribute('aria-label') ?? '');
  }
  const originalLabel = canvas.getAttribute('data-trendline-original-label') ?? '';
  canvas.setAttribute('aria-label', originalLabel ? `${originalLabel}. ${description}` : description);
}
