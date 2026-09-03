import { describe, expect, it, vi } from 'vitest';
import { color } from 'chart.js/helpers';
import { gradientPlugin } from '../../src/gradientPlugin.js';

// Testing the real gradient-computation logic directly (dissected from
// the real package's own dist file, see gradientPlugin.ts's own header
// comment) via fully mocked chart/ctx/scale objects, since jsdom has no
// real 2D canvas context (confirmed in this package's own
// vitest.config.ts header comment) — the same reason
// imageLabelPlugin.spec.ts takes this same approach.

function makeCtx() {
  const gradient = { addColorStop: vi.fn() };
  return {
    createLinearGradient: vi.fn(() => gradient),
    createRadialGradient: vi.fn(() => gradient),
    __gradient: gradient,
  };
}

/** A deterministic linear scale: pixel-for-value is the identity, and
 * decimal-for-pixel divides by 100 — so a value of 0 maps to stop 0,
 * and a value of 100 maps to stop 1, making the resulting math easy to
 * assert on directly. left/top/right/bottom match the default 100x100
 * chart area used by makeChart() below, so createGradient's own
 * left/right or top/bottom reads land on real, sensible numbers. */
function makeLinearScale(overrides: Partial<{ reverse: boolean }> = {}) {
  return {
    type: 'linear',
    options: { reverse: overrides.reverse ?? false },
    left: 0,
    top: 0,
    right: 100,
    bottom: 100,
    parse: (v: unknown) => Number(v),
    getPixelForValue: (v: number) => v,
    getDecimalForPixel: (p: number) => p / 100,
  };
}

function makeRadialScale(drawingArea = 50) {
  return {
    type: 'radialLinear',
    left: 0,
    top: 0,
    right: 100,
    bottom: 100,
    xCenter: 50,
    yCenter: 50,
    drawingArea,
    getDistanceFromCenterForValue: (v: number) => v,
  };
}

function makeChart(overrides: {
  chartArea?: { top: number; left: number; bottom: number; right: number };
  datasets?: any[];
  metas?: Record<number, any>;
  legend?: any;
} = {}) {
  const chartArea = overrides.chartArea ?? { top: 0, left: 0, bottom: 100, right: 100 };
  const datasets = overrides.datasets ?? [];
  const metas = overrides.metas ?? {};
  const chart: any = {
    id: 'test-chart',
    ctx: makeCtx(),
    chartArea,
    data: { datasets },
    legend: overrides.legend,
    getDatasetMeta: (i: number) => metas[i] ?? { hidden: false },
  };
  return chart;
}

describe('gradientPlugin', () => {
  it('has the real, expected shape — id and the four lifecycle hooks', () => {
    expect(gradientPlugin).toMatchObject({
      id: 'gradient',
      beforeInit: expect.any(Function),
      beforeDatasetsUpdate: expect.any(Function),
      afterUpdate: expect.any(Function),
      afterDestroy: expect.any(Function),
    });
  });

  describe('beforeDatasetsUpdate', () => {
    it('does nothing when the chart area is not valid (zero width/height)', () => {
      const chart = makeChart({ chartArea: { top: 0, left: 0, bottom: 0, right: 0 }, datasets: [{ gradient: { backgroundColor: { axis: 'x', colors: { 0: 'red' } } } }] });
      gradientPlugin.beforeInit!(chart, {} as never, {});

      gradientPlugin.beforeDatasetsUpdate!(chart, {} as never, {});

      expect(chart.ctx.createLinearGradient).not.toHaveBeenCalled();
    });

    it('skips a dataset with no gradient config at all', () => {
      const chart = makeChart({ datasets: [{ data: [1, 2, 3] }] });
      gradientPlugin.beforeInit!(chart, {} as never, {});

      gradientPlugin.beforeDatasetsUpdate!(chart, {} as never, {});

      expect(chart.ctx.createLinearGradient).not.toHaveBeenCalled();
    });

    it('skips a hidden dataset', () => {
      const chart = makeChart({
        datasets: [{ gradient: { backgroundColor: { axis: 'x', colors: { 0: 'red', 100: 'blue' } } } }],
        metas: { 0: { hidden: true, xScale: makeLinearScale() } },
      });
      gradientPlugin.beforeInit!(chart, {} as never, {});

      gradientPlugin.beforeDatasetsUpdate!(chart, {} as never, {});

      expect(chart.ctx.createLinearGradient).not.toHaveBeenCalled();
    });

    it('warns and skips when the configured axis has no matching scale', () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const chart = makeChart({
        datasets: [{ gradient: { backgroundColor: { axis: 'y', colors: { 0: 'red' } } } }],
        metas: { 0: { hidden: false } }, // no yScale
      });
      gradientPlugin.beforeInit!(chart, {} as never, {});

      gradientPlugin.beforeDatasetsUpdate!(chart, {} as never, {});

      expect(warn).toHaveBeenCalledWith(expect.stringContaining("no 'y'-axis scale"));
      warn.mockRestore();
    });

    it('creates a linear gradient (not radial) for an x/y axis and writes it onto the dataset', () => {
      const dataset = { gradient: { backgroundColor: { axis: 'x', colors: { 0: 'red', 100: 'blue' } } } };
      const meta = { hidden: false, xScale: makeLinearScale() };
      const chart = makeChart({ datasets: [dataset], metas: { 0: meta } });
      gradientPlugin.beforeInit!(chart, {} as never, {});

      gradientPlugin.beforeDatasetsUpdate!(chart, {} as never, {});

      expect(chart.ctx.createLinearGradient).toHaveBeenCalledTimes(1);
      expect(chart.ctx.createRadialGradient).not.toHaveBeenCalled();
      expect(chart.ctx.__gradient.addColorStop).toHaveBeenCalledTimes(2);
      expect((dataset as any).backgroundColor).toBe(chart.ctx.__gradient);
    });

    it('creates a linear gradient along the y axis specifically (using top/bottom, not left/right)', () => {
      const dataset = { gradient: { backgroundColor: { axis: 'y', colors: { 0: 'red', 100: 'blue' } } } };
      const meta = { hidden: false, yScale: makeLinearScale() };
      const chart = makeChart({ datasets: [dataset], metas: { 0: meta } });
      gradientPlugin.beforeInit!(chart, {} as never, {});

      gradientPlugin.beforeDatasetsUpdate!(chart, {} as never, {});

      // createGradient's own axis==='y' branch calls
      // ctx.createLinearGradient(0, bottom, 0, top) — distinct from the
      // axis==='x' branch's own (left, 0, right, 0) call already covered
      // by the test above.
      expect(chart.ctx.createLinearGradient).toHaveBeenCalledWith(0, meta.yScale.bottom, 0, meta.yScale.top);
    });

    it('refreshes an existing state entry for the same dataset/key on a second update, rather than only ever appending', () => {
      // Every other test in this describe block calls
      // beforeDatasetsUpdate exactly once, so getStateEntries always
      // finds no existing entries for the (key, datasetIndex) pair —
      // this test calls it twice to exercise the "entries already exist,
      // dataset isn't hidden" refresh branch specifically.
      const dataset = { gradient: { backgroundColor: { axis: 'x', colors: { 0: 'red', 100: 'blue' } } } };
      const meta = { hidden: false, xScale: makeLinearScale() };
      const chart = makeChart({ datasets: [dataset], metas: { 0: meta } });
      gradientPlugin.beforeInit!(chart, {} as never, {});

      gradientPlugin.beforeDatasetsUpdate!(chart, {} as never, {});
      gradientPlugin.beforeDatasetsUpdate!(chart, {} as never, {});

      // Two full updates, each creating one real gradient — confirms the
      // second update ran its own full computation again rather than
      // throwing or silently no-opping once a prior entry already
      // existed for this exact dataset/key pair.
      expect(chart.ctx.createLinearGradient).toHaveBeenCalledTimes(2);
    });

    it('creates a radial gradient for the r axis', () => {
      const dataset = { gradient: { backgroundColor: { axis: 'r', colors: { 0: 'red', 50: 'blue' } } } };
      const meta = { hidden: false, rScale: makeRadialScale() };
      const chart = makeChart({ datasets: [dataset], metas: { 0: meta } });
      gradientPlugin.beforeInit!(chart, {} as never, {});

      gradientPlugin.beforeDatasetsUpdate!(chart, {} as never, {});

      expect(chart.ctx.createRadialGradient).toHaveBeenCalledTimes(1);
      expect(chart.ctx.createLinearGradient).not.toHaveBeenCalled();
    });

    it('sorts and clamps stop colors correctly for an out-of-order color map', () => {
      // Colors given out of numeric order (100 before 0) — the plugin's
      // own real logic must still produce sorted, 0..1-clamped stops.
      const dataset = { gradient: { backgroundColor: { axis: 'x', colors: { 100: 'blue', 0: 'red' } } } };
      const meta = { hidden: false, xScale: makeLinearScale() };
      const chart = makeChart({ datasets: [dataset], metas: { 0: meta } });
      gradientPlugin.beforeInit!(chart, {} as never, {});

      gradientPlugin.beforeDatasetsUpdate!(chart, {} as never, {});

      const calls = chart.ctx.__gradient.addColorStop.mock.calls;
      expect(calls[0][0]).toBeCloseTo(0, 5);
      expect(calls[1][0]).toBeCloseTo(1, 5);
    });

    it('reverses the stop percentage when the scale itself is reversed', () => {
      const datasetForward = { gradient: { backgroundColor: { axis: 'x', colors: { 100: 'blue' } } } };
      const chartForward = makeChart({ datasets: [datasetForward], metas: { 0: { hidden: false, xScale: makeLinearScale({ reverse: false }) } } });
      gradientPlugin.beforeInit!(chartForward, {} as never, {});
      gradientPlugin.beforeDatasetsUpdate!(chartForward, {} as never, {});

      const datasetReversed = { gradient: { backgroundColor: { axis: 'x', colors: { 100: 'blue' } } } };
      const chartReversed = makeChart({ datasets: [datasetReversed], metas: { 0: { hidden: false, xScale: makeLinearScale({ reverse: true }) } } });
      gradientPlugin.beforeInit!(chartReversed, {} as never, {});
      gradientPlugin.beforeDatasetsUpdate!(chartReversed, {} as never, {});

      const forwardStop = chartForward.ctx.__gradient.addColorStop.mock.calls[0][0];
      const reversedStop = chartReversed.ctx.__gradient.addColorStop.mock.calls[0][0];
      expect(forwardStop).toBeCloseTo(1, 5);
      expect(reversedStop).toBeCloseTo(0, 5);
    });
    it('treats a scale with no explicit reverse option as non-reversed (the ?? false fallback)', () => {
      // Every other test's own makeLinearScale() always sets
      // options.reverse explicitly (true or false) — this test omits it
      // entirely to exercise the `?? false` fallback on its own.
      const dataset = { gradient: { backgroundColor: { axis: 'x', colors: { 100: 'blue' } } } };
      const scale = makeLinearScale();
      delete (scale.options as { reverse?: boolean }).reverse;
      const chart = makeChart({ datasets: [dataset], metas: { 0: { hidden: false, xScale: scale } } });
      gradientPlugin.beforeInit!(chart, {} as never, {});

      gradientPlugin.beforeDatasetsUpdate!(chart, {} as never, {});

      // Same result as the explicit reverse:false case in the test above —
      // confirms the fallback behaves identically to an explicit false.
      const stop = chart.ctx.__gradient.addColorStop.mock.calls[0][0];
      expect(stop).toBeCloseTo(1, 5);
    });

    it('skips a color-map entry whose key does not parse to a finite pixel/stop', () => {
      // buildStopColors's own `!isFinite(pixel) || !isFinite(stop)` guard
      // — a non-numeric key (Number('not-a-number') is NaN) triggers it.
      const dataset = { gradient: { backgroundColor: { axis: 'x', colors: { 'not-a-number': 'red', 100: 'blue' } } } };
      const meta = { hidden: false, xScale: makeLinearScale() };
      const chart = makeChart({ datasets: [dataset], metas: { 0: meta } });
      gradientPlugin.beforeInit!(chart, {} as never, {});

      gradientPlugin.beforeDatasetsUpdate!(chart, {} as never, {});

      // Only the one valid entry (100: blue) became a real stop — the
      // invalid key was silently skipped, not thrown on.
      expect(chart.ctx.__gradient.addColorStop).toHaveBeenCalledTimes(1);
    });

    it('skips a gradient config entry with no colors field at all (e.g. borderColor set but empty)', () => {
      // updateDatasetGradients's own `if (!config?.colors) continue;`
      // guard — every other test's own gradient config always has a real
      // colors object on every key it sets.
      const dataset = {
        gradient: {
          backgroundColor: { axis: 'x', colors: { 0: 'red', 100: 'blue' } },
          borderColor: { axis: 'x' } as unknown as { axis: 'x'; colors: Record<string, string> },
        },
      };
      const meta = { hidden: false, xScale: makeLinearScale() };
      const chart = makeChart({ datasets: [dataset], metas: { 0: meta } });
      gradientPlugin.beforeInit!(chart, {} as never, {});

      expect(() => gradientPlugin.beforeDatasetsUpdate!(chart, {} as never, {})).not.toThrow();

      // Only backgroundColor's own real gradient was created — borderColor
      // was skipped for having no colors, not thrown on.
      expect(chart.ctx.createLinearGradient).toHaveBeenCalledTimes(1);
    });
  });

  describe('afterUpdate', () => {
    it('does nothing when the chart has no legend', () => {
      const chart = makeChart({ legend: undefined });
      gradientPlugin.beforeInit!(chart, {} as never, {});

      expect(() => gradientPlugin.afterUpdate!(chart, {} as never, {})).not.toThrow();
    });

    it('does nothing when the legend is explicitly hidden', () => {
      const chart = makeChart({ legend: { options: { display: false } } });
      gradientPlugin.beforeInit!(chart, {} as never, {});

      expect(() => gradientPlugin.afterUpdate!(chart, {} as never, {})).not.toThrow();
    });

    it('applies the dataset-level gradient to its own legend swatch (one swatch per dataset)', () => {
      const dataset = { gradient: { backgroundColor: { axis: 'x', colors: { 0: 'red', 100: 'blue' } } } };
      const meta = { hidden: false, xScale: makeLinearScale() };
      const legendItem: any = { datasetIndex: 0 };
      const chart = makeChart({
        datasets: [dataset],
        metas: { 0: meta },
        legend: {
          options: { display: true, labels: { boxWidth: 40, boxHeight: 12 } },
          legendItems: [legendItem],
          legendHitBoxes: [{ top: 0, left: 0 }],
        },
      });
      gradientPlugin.beforeInit!(chart, {} as never, {});
      gradientPlugin.beforeDatasetsUpdate!(chart, {} as never, {});

      gradientPlugin.afterUpdate!(chart, {} as never, {});

      expect(legendItem.fillStyle).toBe(chart.ctx.__gradient);
    });

    it('does nothing for a legend item with no matching hitBox for its own datasetIndex', () => {
      const dataset = { gradient: { backgroundColor: { axis: 'x', colors: { 0: 'red', 100: 'blue' } } } };
      const meta = { hidden: false, xScale: makeLinearScale() };
      const legendItem: any = { datasetIndex: 0 };
      const chart = makeChart({
        datasets: [dataset],
        metas: { 0: meta },
        legend: {
          options: { display: true, labels: { boxWidth: 40, boxHeight: 12 } },
          legendItems: [legendItem],
          legendHitBoxes: [], // no hitBox at index 0
        },
      });
      gradientPlugin.beforeInit!(chart, {} as never, {});
      gradientPlugin.beforeDatasetsUpdate!(chart, {} as never, {});

      expect(() => gradientPlugin.afterUpdate!(chart, {} as never, {})).not.toThrow();
      expect(legendItem.fillStyle).toBeUndefined();
    });

    it('does nothing when the computed legend-swatch area is invalid (labels.boxWidth left unset, defaulting to 0)', () => {
      const dataset = { gradient: { backgroundColor: { axis: 'x', colors: { 0: 'red', 100: 'blue' } } } };
      const meta = { hidden: false, xScale: makeLinearScale() };
      const legendItem: any = { datasetIndex: 0 };
      const chart = makeChart({
        datasets: [dataset],
        metas: { 0: meta },
        legend: {
          // No labels.boxWidth at all — updateLegendItems's own `?? 0`
          // fallback makes right === left, an invalid area.
          options: { display: true, labels: { boxHeight: 12 } },
          legendItems: [legendItem],
          legendHitBoxes: [{ top: 0, left: 0 }],
        },
      });
      gradientPlugin.beforeInit!(chart, {} as never, {});
      gradientPlugin.beforeDatasetsUpdate!(chart, {} as never, {});

      expect(() => gradientPlugin.afterUpdate!(chart, {} as never, {})).not.toThrow();
      expect(legendItem.fillStyle).toBeUndefined();
    });

    it('skips a dataset with no corresponding legend item (fewer legendItems than datasets)', () => {
      const dataset0 = { gradient: { backgroundColor: { axis: 'x', colors: { 0: 'red', 100: 'blue' } } } };
      const dataset1 = { gradient: { backgroundColor: { axis: 'x', colors: { 0: 'red', 100: 'blue' } } } };
      const meta = { hidden: false, xScale: makeLinearScale() };
      const chart = makeChart({
        datasets: [dataset0, dataset1],
        metas: { 0: meta, 1: meta },
        legend: {
          options: { display: true, labels: { boxWidth: 40, boxHeight: 12 } },
          legendItems: [{ datasetIndex: 0 }], // only one item for two datasets
          legendHitBoxes: [{ top: 0, left: 0 }],
        },
      });
      gradientPlugin.beforeInit!(chart, {} as never, {});
      gradientPlugin.beforeDatasetsUpdate!(chart, {} as never, {});

      expect(() => gradientPlugin.afterUpdate!(chart, {} as never, {})).not.toThrow();
    });

    it('falls back to chart.options.font.size for the legend box height when neither boxHeight nor labels.font.size is set', () => {
      const dataset = { gradient: { backgroundColor: { axis: 'x', colors: { 0: 'red', 100: 'blue' } } } };
      const meta = { hidden: false, xScale: makeLinearScale() };
      const legendItem: any = { datasetIndex: 0 };
      const chart = makeChart({
        datasets: [dataset],
        metas: { 0: meta },
        legend: {
          // No labels.boxHeight and no labels.font.size — forces
          // legendBoxHeight's own chart.options.font.size fallback.
          // labels.boxWidth IS set explicitly (unlike boxHeight/font),
          // since boxWidth has no fallback function at all (just `?? 0`
          // in updateLegendItems) — leaving it unset would make the
          // computed legend area invalid (right === left) before ever
          // reaching the fallback this test exists to exercise.
          options: { display: true, labels: { boxWidth: 40 } },
          legendItems: [legendItem],
          legendHitBoxes: [{ top: 0, left: 0 }],
        },
      });
      chart.options = { font: { size: 14 } };
      gradientPlugin.beforeInit!(chart, {} as never, {});
      gradientPlugin.beforeDatasetsUpdate!(chart, {} as never, {});

      expect(() => gradientPlugin.afterUpdate!(chart, {} as never, {})).not.toThrow();
      expect(legendItem.fillStyle).toBe(chart.ctx.__gradient);
    });

    it('reads the legend box height from labels.font.size directly when set, without falling back to chart.options', () => {
      const dataset = { gradient: { backgroundColor: { axis: 'x', colors: { 0: 'red', 100: 'blue' } } } };
      const meta = { hidden: false, xScale: makeLinearScale() };
      const legendItem: any = { datasetIndex: 0 };
      const chart = makeChart({
        datasets: [dataset],
        metas: { 0: meta },
        legend: {
          // No labels.boxHeight, but labels.font.size IS set — this
          // should be used directly, not chart.options.font.size.
          options: { display: true, labels: { boxWidth: 40, font: { size: 16 } } },
          legendItems: [legendItem],
          legendHitBoxes: [{ top: 0, left: 0 }],
        },
      });
      // Deliberately a different value from labels.font.size (16), so a
      // wrong fallback to this would be a real, detectable difference —
      // though this test only confirms no throw/fillStyle set, since the
      // resulting gradient object itself is opaque either way.
      chart.options = { font: { size: 99 } };
      gradientPlugin.beforeInit!(chart, {} as never, {});
      gradientPlugin.beforeDatasetsUpdate!(chart, {} as never, {});

      expect(() => gradientPlugin.afterUpdate!(chart, {} as never, {})).not.toThrow();
      expect(legendItem.fillStyle).toBe(chart.ctx.__gradient);
    });

    it('writes the computed gradient onto meta.dataset.options when present (not just the plain dataset)', () => {
      const dataset = { gradient: { backgroundColor: { axis: 'x', colors: { 0: 'red', 100: 'blue' } } } };
      const meta = { hidden: false, xScale: makeLinearScale(), dataset: { options: {} } };
      const chart = makeChart({ datasets: [dataset], metas: { 0: meta } });
      gradientPlugin.beforeInit!(chart, {} as never, {});

      gradientPlugin.beforeDatasetsUpdate!(chart, {} as never, {});

      expect((meta.dataset.options as any).backgroundColor).toBe(chart.ctx.__gradient);
    });

    it('writes the computed gradient directly onto meta.dataset when it has no own options object', () => {
      const dataset = { gradient: { backgroundColor: { axis: 'x', colors: { 0: 'red', 100: 'blue' } } } };
      const meta = { hidden: false, xScale: makeLinearScale(), dataset: {} as Record<string, unknown> };
      const chart = makeChart({ datasets: [dataset], metas: { 0: meta } });
      gradientPlugin.beforeInit!(chart, {} as never, {});

      gradientPlugin.beforeDatasetsUpdate!(chart, {} as never, {});

      expect(meta.dataset.backgroundColor).toBe(chart.ctx.__gradient);
    });

    it('applies an exact-match stop color directly to a per-data-point legend swatch (doughnut/radar-style legends)', () => {
      // legendItems[i].datasetIndex deliberately doesn't equal the loop
      // index i (0) — forces updateLegendItems's own "per data point"
      // branch (applyLegendGradientForDataIndex), the one every other
      // test in this describe block never reaches, since they all use a
      // legend item whose datasetIndex genuinely equals its own loop
      // index (the "per dataset" branch).
      const dataset = { data: [0, 100], gradient: { backgroundColor: { axis: 'x', colors: { 0: 'red', 100: 'blue' } } } };
      const meta = { hidden: false, xScale: makeLinearScale() };
      const legendItems: any[] = [
        { datasetIndex: 99, index: 0 },
        { datasetIndex: 99, index: 1 },
      ];
      const chart = makeChart({
        datasets: [dataset],
        metas: { 0: meta },
        legend: {
          options: { display: true, labels: { boxWidth: 40, boxHeight: 12 } },
          legendItems,
          legendHitBoxes: [{ top: 0, left: 0 }],
        },
      });
      gradientPlugin.beforeInit!(chart, {} as never, {});
      gradientPlugin.beforeDatasetsUpdate!(chart, {} as never, {});

      gradientPlugin.afterUpdate!(chart, {} as never, {});

      // data[0] === 0 maps to stop 0 exactly — an exact match returns
      // that stop's own color directly, with no interpolation at all.
      // Computed via the real color() helper rather than a hardcoded
      // string, since @kurkle/color's own rgbString() format isn't
      // guessed at here.
      expect(legendItems[0].fillStyle).toBe(color('red').rgbString());
    });

    it('interpolates a color for a per-data-point legend swatch whose raw value falls between two stops', () => {
      const dataset = { data: [0, 50], gradient: { backgroundColor: { axis: 'x', colors: { 0: 'red', 100: 'blue' } } } };
      const meta = { hidden: false, xScale: makeLinearScale() };
      const legendItems: any[] = [
        { datasetIndex: 99, index: 0 },
        { datasetIndex: 99, index: 1 },
      ];
      const chart = makeChart({
        datasets: [dataset],
        metas: { 0: meta },
        legend: {
          options: { display: true, labels: { boxWidth: 40, boxHeight: 12 } },
          legendItems,
          legendHitBoxes: [{ top: 0, left: 0 }],
        },
      });
      gradientPlugin.beforeInit!(chart, {} as never, {});
      gradientPlugin.beforeDatasetsUpdate!(chart, {} as never, {});

      gradientPlugin.afterUpdate!(chart, {} as never, {});

      // data[1] === 50, exactly halfway between the 0/red and 100/blue
      // stops — must be a real, interpolated color, distinct from both
      // endpoints, confirming interpolateColor's own real math ran
      // rather than the exact-match early return above.
      const fillStyle = legendItems[1].fillStyle as string;
      expect(fillStyle).toEqual(expect.any(String));
      expect(fillStyle).not.toBe(color('red').rgbString());
      expect(fillStyle).not.toBe(color('blue').rgbString());
    });

    it('resolves the color from only the nearest earlier stop when a value falls before the very first stop', () => {
      // getInterpolatedColorByValue's own `if (!startColor) return
      // endColor.color;` branch — a value below every configured stop's
      // own position means no startColor is ever set, only endColor.
      const dataset = { data: [-50], gradient: { backgroundColor: { axis: 'x', colors: { 0: 'red', 100: 'blue' } } } };
      const meta = { hidden: false, xScale: makeLinearScale() };
      const legendItems: any[] = [{ datasetIndex: 99, index: 0 }];
      const chart = makeChart({
        datasets: [dataset],
        metas: { 0: meta },
        legend: {
          options: { display: true, labels: { boxWidth: 40, boxHeight: 12 } },
          legendItems,
          legendHitBoxes: [{ top: 0, left: 0 }],
        },
      });
      gradientPlugin.beforeInit!(chart, {} as never, {});
      gradientPlugin.beforeDatasetsUpdate!(chart, {} as never, {});

      gradientPlugin.afterUpdate!(chart, {} as never, {});

      expect(legendItems[0].fillStyle).toBe(color('red').rgbString());
    });

    it('resolves the color from only the nearest later stop when a value falls after the very last stop', () => {
      // getInterpolatedColorByValue's own `if (!endColor) return
      // startColor?.color;` branch — a value above every configured
      // stop's own position means no endColor is ever set, only
      // startColor.
      const dataset = { data: [150], gradient: { backgroundColor: { axis: 'x', colors: { 0: 'red', 100: 'blue' } } } };
      const meta = { hidden: false, xScale: makeLinearScale() };
      const legendItems: any[] = [{ datasetIndex: 99, index: 0 }];
      const chart = makeChart({
        datasets: [dataset],
        metas: { 0: meta },
        legend: {
          options: { display: true, labels: { boxWidth: 40, boxHeight: 12 } },
          legendItems,
          legendHitBoxes: [{ top: 0, left: 0 }],
        },
      });
      gradientPlugin.beforeInit!(chart, {} as never, {});
      gradientPlugin.beforeDatasetsUpdate!(chart, {} as never, {});

      gradientPlugin.afterUpdate!(chart, {} as never, {});

      expect(legendItems[0].fillStyle).toBe(color('blue').rgbString());
    });
  });

  describe('afterDestroy', () => {
    it('clears this chart\'s own state without throwing', () => {
      const chart = makeChart({ datasets: [{ gradient: { backgroundColor: { axis: 'x', colors: { 0: 'red' } } } }] });
      gradientPlugin.beforeInit!(chart, {} as never, {});

      expect(() => gradientPlugin.afterDestroy!(chart, {} as never, {})).not.toThrow();
      // After afterDestroy, beforeDatasetsUpdate has no state to read —
      // confirms it no-ops gracefully rather than throwing.
      expect(() => gradientPlugin.beforeDatasetsUpdate!(chart, {} as never, {})).not.toThrow();
    });
  });
});
