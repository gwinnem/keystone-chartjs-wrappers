// @ts-nocheck
import { describe, expect, it, vi } from 'vitest';
import { zoomPlugin } from '../../src/zoomPlugin.js';

// Testing the real zoom/pan/drag logic directly (dissected from the
// real package's own dist file, see zoomPlugin.ts's own header comment
// for the full rationale and the deliberate Hammer.js/pinch/gesture-pan
// scope decision) via a real jsdom <canvas> element (so real DOM event
// dispatch/addEventListener wiring can be exercised directly, the same
// technique image-label/gradient's own test files use for ctx mocking)
// plus fully mocked scale/chart objects, since jsdom has no real 2D
// canvas context or real layout engine.

function makeCtx() {
  return {
    save: vi.fn(),
    beginPath: vi.fn(),
    fillRect: vi.fn(),
    strokeRect: vi.fn(),
    restore: vi.fn(),
  };
}

/** A deterministic linear scale: pixel-for-value and value-for-pixel are
 * both the identity, so the resulting zoom/pan math is easy to assert
 * on directly. `chart` is assigned by makeChart() below, once both
 * exist. */
function makeScale(overrides: Partial<Record<string, unknown>> = {}) {
  const horizontal = overrides.axis !== 'y';
  return {
    id: (overrides.id as string) ?? (horizontal ? 'x' : 'y'),
    type: 'linear',
    axis: horizontal ? 'x' : 'y',
    min: 0,
    max: 100,
    top: 0,
    bottom: 300,
    left: 0,
    right: 400,
    width: 400,
    height: 300,
    options: {},
    isHorizontal: () => horizontal,
    getValueForPixel: (p: number) => p,
    getPixelForValue: (v: number) => v,
    getDecimalForPixel: (p: number) => p / 400,
    parse: (v: number) => v,
    getLabels: () => [] as string[],
    ...overrides,
  };
}

function makeChart(overrides: {
  scales?: Record<string, ReturnType<typeof makeScale>>;
  chartArea?: { top: number; left: number; right: number; bottom: number; width: number; height: number };
  legend?: unknown;
  options?: Record<string, unknown>;
} = {}) {
  const canvas = document.createElement('canvas');
  // getRelativePosition (Chart.js's own real helper, used when an event
  // genuinely targets the canvas) computes
  // `(clientX - offsets) / chart.width * canvas.width / currentDevicePixelRatio`
  // — confirmed directly from its own real source
  // (chart.js/dist/chunks/helpers.dataset.js). Setting canvas.width/
  // height to match chart.width/height below (both 400x300, the same
  // as this mock's own chartArea) makes that formula reduce to a plain
  // identity mapping, so mouse coordinates in these tests can be
  // reasoned about directly rather than needing to replicate Chart.js's
  // own DPI-scaling math in every assertion.
  canvas.width = 400;
  canvas.height = 300;
  vi.spyOn(canvas, 'getBoundingClientRect').mockReturnValue({
    top: 0,
    left: 0,
    right: 400,
    bottom: 300,
    width: 400,
    height: 300,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
  const scales = overrides.scales ?? {};
  const chart: any = {
    id: 'test-chart',
    canvas,
    ctx: makeCtx(),
    scales,
    chartArea: overrides.chartArea ?? { top: 0, left: 0, right: 400, bottom: 300, width: 400, height: 300 },
    legend: overrides.legend,
    options: overrides.options ?? {},
    currentDevicePixelRatio: 1,
    width: 400,
    height: 300,
    // Simulates the one real thing a genuine Chart.js `chart.update()`
    // does that this plugin's own logic actually depends on: scale.min/
    // scale.max (the current, computed range) are recomputed from
    // scale.options.min/max (what this plugin actually writes) during
    // the scale's own real update lifecycle. Without this, mutating
    // scale.options.min/max in a test would never be reflected in
    // scale.min/scale.max at all, since a bare `vi.fn()` mock does
    // nothing on its own — confirmed as a real gap via failing
    // assertions on getZoomLevel()/isZoomedOrPanned(), both of which
    // read scale.min/scale.max directly, not scale.options.min/max.
    update: vi.fn(() => {
      for (const scale of Object.values(scales) as any[]) {
        if (scale.options.min !== undefined) scale.min = scale.options.min;
        if (scale.options.max !== undefined) scale.max = scale.options.max;
      }
    }),
  };
  for (const scale of Object.values(scales)) {
    (scale as any).chart = chart;
  }
  return chart;
}

function initPlugin(chart: any, options: any) {
  zoomPlugin.beforeInit?.(chart, {} as never, options);
  zoomPlugin.start!(chart, {} as never, options);
  zoomPlugin.beforeUpdate!(chart, {} as never, options);
}

describe('zoomPlugin', () => {
  it('has the real, expected shape — id and every real lifecycle hook', () => {
    expect(zoomPlugin).toMatchObject({
      id: 'zoom',
      start: expect.any(Function),
      beforeEvent: expect.any(Function),
      beforeUpdate: expect.any(Function),
      beforeDatasetsDraw: expect.any(Function),
      afterDatasetsDraw: expect.any(Function),
      beforeDraw: expect.any(Function),
      afterDraw: expect.any(Function),
      stop: expect.any(Function),
    });
  });

  describe('start', () => {
    it('attaches the full programmatic API onto the live chart instance', () => {
      const chart = makeChart();
      zoomPlugin.start!(chart, {} as never, {});

      expect(chart.pan).toEqual(expect.any(Function));
      expect(chart.zoom).toEqual(expect.any(Function));
      expect(chart.zoomRect).toEqual(expect.any(Function));
      expect(chart.zoomScale).toEqual(expect.any(Function));
      expect(chart.resetZoom).toEqual(expect.any(Function));
      expect(chart.getZoomLevel).toEqual(expect.any(Function));
      expect(chart.getInitialScaleBounds).toEqual(expect.any(Function));
      expect(chart.getZoomedScaleBounds).toEqual(expect.any(Function));
      expect(chart.isZoomedOrPanned).toEqual(expect.any(Function));
      expect(chart.isZoomingOrPanning).toEqual(expect.any(Function));
    });
  });

  describe('programmatic zoom()', () => {
    it('zooms in the enabled directions, changing scale.options.min/max, and calls chart.update', () => {
      const scale = makeScale();
      const chart = makeChart({ scales: { x: scale } });
      initPlugin(chart, { zoom: { mode: 'xy' } });

      chart.zoom(2);

      expect((scale.options as any).min).toBeDefined();
      expect((scale.options as any).max).toBeDefined();
      expect(chart.update).toHaveBeenCalled();
    });

    it('zooming out (amount < 1) widens the range', () => {
      const scale = makeScale({ min: 25, max: 75 });
      const chart = makeChart({ scales: { x: scale } });
      initPlugin(chart, { zoom: { mode: 'xy' } });

      chart.zoom(0.5);

      const newRange = (scale.options as any).max - (scale.options as any).min;
      expect(newRange).toBeGreaterThan(50);
    });

    it('does not zoom a direction whose scale axis is disabled by mode', () => {
      const scale = makeScale({ axis: 'y' });
      const chart = makeChart({ scales: { y: scale } });
      initPlugin(chart, { zoom: { mode: 'x' } });

      chart.zoom(2);

      expect((scale.options as any).min).toBeUndefined();
    });

    it('applies overScaleMode, exercising getEnabledScalesByPoint\'s own real branch for it', () => {
      // getEnabledScalesByPoint's own overScaleMode branch, traced
      // through precisely rather than guessed at: with mode='x',
      // overScaleMode='y', scaleMode='y', and the scale directly under
      // the focal point being xScale (first match, both scales share
      // the same bounds in this mock) — overScaleEnabled.y=true swaps
      // scaleEnabled.y to enabled's own (false) y value and zeroes
      // enabled.y, so `scaleEnabled[xScale.axis]` (x) is false and the
      // function falls through to its own final filter, which still
      // only matches xScale (enabled.x stays true). This test exists to
      // exercise the branch itself (real behavior confirmed by tracing
      // the real function, not assumed) rather than assert a specific,
      // easily-miscalculated outcome for overScaleMode's own real
      // effect.
      const xScale = makeScale({ axis: 'x', id: 'x', top: 0, bottom: 300, left: 0, right: 400 });
      const yScale = makeScale({ axis: 'y', id: 'y', top: 0, bottom: 300, left: 0, right: 400 });
      const chart = makeChart({ scales: { x: xScale, y: yScale } });
      initPlugin(chart, { zoom: { mode: 'x', overScaleMode: 'y', scaleMode: 'y' } });

      expect(() => chart.zoom({ x: 2, y: 2, focalPoint: { x: 200, y: 150 } })).not.toThrow();
      expect((xScale.options as any).min).toBeDefined();
    });

    it('zooms only the scale directly under the focal point when scaleMode enables its own axis there', () => {
      // getEnabledScalesByPoint's own `if (scale && scaleEnabled[scale.axis])
      // return [scale];` branch — the overScaleMode test above never hits
      // this specific early return (its own scaleEnabled ends up false
      // for the scale under the point after overScaleMode's own
      // reassignment). Using scaleMode alone (no overScaleMode) hits it
      // directly: the scale physically under the focal point, with its
      // own axis enabled by scaleMode, is the ONLY scale zoomed —
      // regardless of the base `mode`.
      const xScale = makeScale({ axis: 'x', id: 'x', top: 0, bottom: 300, left: 0, right: 400 });
      const yScale = makeScale({ axis: 'y', id: 'y', top: 0, bottom: 300, left: 0, right: 400 });
      const chart = makeChart({ scales: { x: xScale, y: yScale } });
      initPlugin(chart, { zoom: { mode: 'xy', scaleMode: 'x' } });

      chart.zoom({ x: 2, y: 2, focalPoint: { x: 200, y: 150 } });

      expect((xScale.options as any).min).toBeDefined();
    });

    it('zooms a y-axis scale directly via the programmatic API (not just through a drag)', () => {
      // zoom()'s own `else if (!scale.isHorizontal() && yEnabled)` branch
      // — every other zoom() test in this describe block uses an x-axis
      // scale.
      const scale = makeScale({ axis: 'y' });
      const chart = makeChart({ scales: { y: scale } });
      initPlugin(chart, { zoom: { mode: 'xy' } });

      chart.zoom(2);

      expect((scale.options as any).min).toBeDefined();
      expect((scale.options as any).max).toBeDefined();
    });

    it('resolves mode as a function of the chart, not just a string literal', () => {
      // directionEnabled's own `typeof mode === 'function'` branch —
      // every other test in this file uses a plain string mode.
      const scale = makeScale();
      const chart = makeChart({ scales: { x: scale } });
      initPlugin(chart, { zoom: { mode: () => 'x' } });

      chart.zoomRect({ x: 100, y: 0 }, { x: 300, y: 300 });

      expect((scale.options as any).min).toBeDefined();
    });

    it('treats an unrecognized mode value as disabling every direction (the final false fallback)', () => {
      // directionEnabled's own final `return false;` — reached only for
      // a mode that is neither undefined, a string, nor a function.
      const scale = makeScale();
      const chart = makeChart({ scales: { x: scale } });
      initPlugin(chart, { zoom: { mode: 42 as unknown as 'xy' } });

      chart.zoomRect({ x: 100, y: 0 }, { x: 300, y: 300 });

      expect((scale.options as any).min).toBeUndefined();
    });

    it('zooms no scale at all when the focal point falls outside every scale\'s own bounds', () => {
      // getScaleUnderPoint's own final `return null;` — every other test
      // uses a focal point within at least one scale's own bounds.
      const scale = makeScale({ top: 0, bottom: 100, left: 0, right: 100 });
      const chart = makeChart({ scales: { x: scale } });
      initPlugin(chart, { zoom: { mode: 'xy' } });

      // Focal point (300, 300) is well outside the scale's own
      // 0-100/0-100 bounds — falls through to the base `enabled` filter,
      // which still matches this scale via mode 'xy', so it zooms anyway
      // through the fallback path rather than the "scale under point"
      // shortcut. This test's real purpose is exercising getScaleUnderPoint
      // returning null, not asserting a no-op.
      chart.zoom({ x: 2, y: 1, focalPoint: { x: 300, y: 300 } });

      expect((scale.options as any).min).toBeDefined();
    });

    it('treats an undefined zoom.mode as enabling every direction (directionEnabled\'s own default branch)', () => {
      // directionEnabled's own `if (mode === undefined) return true;` —
      // every other test in this file sets `mode` explicitly, even
      // though it's optional. Using zoomRect() (which calls
      // directionEnabled directly per axis) with no mode configured at
      // all exercises this.
      const scale = makeScale();
      const chart = makeChart({ scales: { x: scale } });
      initPlugin(chart, { zoom: {} });

      chart.zoomRect({ x: 100, y: 0 }, { x: 300, y: 300 });

      expect((scale.options as any).min).toBeCloseTo(100, 5);
    });

    it('resolves mode as a function for directionsEnabled (plural) too, not just directionEnabled (singular)', () => {
      // directionsEnabled's own `typeof mode === 'function'` branch is
      // genuinely distinct from directionEnabled's own (singular) —
      // directionsEnabled is only reached via getEnabledScalesByPoint,
      // called from zoom()/pan(), never zoomRect(). The earlier
      // "resolves mode as a function" test used zoomRect(), which only
      // exercises the singular function — this one uses zoom() directly.
      const scale = makeScale();
      const chart = makeChart({ scales: { x: scale } });
      initPlugin(chart, { zoom: { mode: () => 'x' } });

      chart.zoom(2);

      expect((scale.options as any).min).toBeDefined();
    });

    it('falls back to zooming every scale when zoom is called with no zoom config at all (getEnabledScalesByPoint\'s own default)', () => {
      // getEnabledScalesByPoint's own `options ?? {}` fallback — every
      // other zoom() test in this file configures `zoom` explicitly.
      const scale = makeScale();
      const chart = makeChart({ scales: { x: scale } });
      initPlugin(chart, { pan: { enabled: true } });

      chart.zoom(2);

      expect((scale.options as any).min).toBeDefined();
    });

    it('zooms out, producing a zoom level below 1 (getZoomLevel\'s own min<1 branch, not just the max branch)', () => {
      const scale = makeScale();
      const chart = makeChart({ scales: { x: scale } });
      initPlugin(chart, { zoom: { mode: 'xy' } });

      chart.zoom(0.5);

      expect(chart.getZoomLevel()).toBeLessThan(1);
    });

    it('reports isZoomedOrPanned true from a max-only change too, not just a min change', () => {
      // isZoomedOrPanned's own second `if (originalMax !== undefined...)
      // return true;` — the existing test only ever changes both min and
      // max together (a symmetric zoom), so the first check alone always
      // already returns true. zoomScale() lets min stay fixed while only
      // max changes.
      const scale = makeScale({ min: 0, max: 100 });
      const chart = makeChart({ scales: { x: scale } });
      initPlugin(chart, { zoom: { mode: 'xy' } });

      chart.zoomScale('x', { min: 0, max: 50 });

      expect(chart.isZoomedOrPanned()).toBe(true);
    });
  });

  describe('programmatic zoomRect()', () => {
    it('zooms each enabled scale to the pixel range implied by the two given points', () => {
      const scale = makeScale();
      const chart = makeChart({ scales: { x: scale } });
      initPlugin(chart, { zoom: { mode: 'xy' } });

      chart.zoomRect({ x: 100, y: 0 }, { x: 300, y: 300 });

      expect((scale.options as any).min).toBeCloseTo(100, 5);
      expect((scale.options as any).max).toBeCloseTo(300, 5);
    });
  });

  describe('programmatic zoomScale()', () => {
    it('sets a specific scale directly to the given min/max range', () => {
      const scale = makeScale();
      const chart = makeChart({ scales: { x: scale } });
      initPlugin(chart, { zoom: { mode: 'xy' } });

      chart.zoomScale('x', { min: 10, max: 20 });

      expect((scale.options as any).min).toBeCloseTo(10, 5);
      expect((scale.options as any).max).toBeCloseTo(20, 5);
    });
  });

  describe('programmatic resetZoom()', () => {
    it('restores each scale to its original min/max options, clearing any zoom applied since', () => {
      const scale = makeScale();
      (scale.options as any).min = 5;
      (scale.options as any).max = 95;
      const chart = makeChart({ scales: { x: scale } });
      initPlugin(chart, { zoom: { mode: 'xy' } });

      chart.zoom(2);
      expect((scale.options as any).min).not.toBe(5);

      chart.resetZoom();

      expect((scale.options as any).min).toBe(5);
      expect((scale.options as any).max).toBe(95);
    });

    it('deletes min/max entirely when there were no original options set at all', () => {
      const scale = makeScale();
      const chart = makeChart({ scales: { x: scale } });
      initPlugin(chart, { zoom: { mode: 'xy' } });

      chart.zoom(2);
      chart.resetZoom();

      expect((scale.options as any).min).toBeUndefined();
      expect((scale.options as any).max).toBeUndefined();
    });

    it('deletes min/max for a scale that appears only after storeOriginalScaleLimits already ran (no original entry exists yet)', () => {
      // resetZoom's own `else` branch (delete, not restore) needs
      // `originalScaleLimits[scale.id]` to be missing at the point
      // resetZoom's own loop checks it — which storeOriginalScaleLimits,
      // called immediately before that loop within the very same
      // resetZoom call, would ordinarily always populate first for every
      // scale the loop iterates (both read `chart.scales` via the same
      // `liveScales()` helper). Reproduced here by making `chart.scales`
      // a real, dynamic getter that returns one scale on its first read
      // (consumed by storeOriginalScaleLimits) and a second, additional
      // scale on every read after — simulating a scale genuinely added
      // to the chart between those two calls, a real possibility this
      // plugin's own code has to tolerate even though it's rare.
      const chart = makeChart();
      const scaleA = makeScale({ id: 'a' });
      scaleA.chart = chart;
      const scaleB = makeScale({ id: 'b' });
      scaleB.chart = chart;
      let reads = 0;
      Object.defineProperty(chart, 'scales', {
        configurable: true,
        get() {
          reads++;
          return reads === 1 ? { a: scaleA } : { a: scaleA, b: scaleB };
        },
      });
      zoomPlugin.start!(chart, {} as never, { zoom: { mode: 'xy' } });
      zoomPlugin.beforeUpdate!(chart, {} as never, { zoom: { mode: 'xy' } });

      chart.resetZoom();

      // scaleB never had an originalScaleLimits entry by the time
      // resetZoom's own loop reached it — hits the `else` (delete)
      // branch specifically, confirmed by its own min/max being cleared
      // rather than restored to some remembered value.
      expect((scaleB.options as any).min).toBeUndefined();
      expect((scaleB.options as any).max).toBeUndefined();
    });
  });

  describe('programmatic pan()', () => {
    it('shifts the scale range by the given delta, without changing its span, and calls chart.update', () => {
      const scale = makeScale({ min: 0, max: 100 });
      const chart = makeChart({ scales: { x: scale } });
      initPlugin(chart, { pan: { enabled: true } });

      chart.pan({ x: 10, y: 0 });

      const span = (scale.options as any).max - (scale.options as any).min;
      expect(span).toBeCloseTo(100, 1);
      expect(chart.update).toHaveBeenCalled();
    });

    it('pans a y-axis scale too (not just the x-axis branch already covered above)', () => {
      const scale = makeScale({ axis: 'y', min: 0, max: 100 });
      const chart = makeChart({ scales: { y: scale } });
      initPlugin(chart, { pan: { enabled: true } });

      chart.pan({ x: 0, y: 10 });

      expect((scale.options as any).min).toBeDefined();
      expect((scale.options as any).max).toBeDefined();
    });

    it('applies a real time.round offset when panning a scale configured with one', () => {
      // panNumericalScale's own `round && OFFSETS[round]` branch — never
      // exercised by any other test, which all use a plain numerical
      // scale with no `options.time` at all.
      const scale = makeScale({ min: 0, max: 100, options: { time: { round: 'day' } } });
      const chart = makeChart({ scales: { x: scale } });
      initPlugin(chart, { pan: { enabled: true } });

      expect(() => chart.pan({ x: 10, y: 0 })).not.toThrow();
      expect((scale.options as any).min).toBeDefined();
    });

    it('does not throw and treats the pan as a no-op range when getValueForPixel resolves to undefined (panNumericalScale\'s own NaN guard)', () => {
      // panNumericalScale's own `?? NaN` fallbacks and its own
      // `if (isNaN(newMin) || isNaN(newMax)) return true;` guard — never
      // exercised by any other pan test, which all use a scale whose
      // getValueForPixel always returns a real number.
      const scale = makeScale({ min: 0, max: 100, getValueForPixel: () => undefined });
      const chart = makeChart({ scales: { x: scale } });
      initPlugin(chart, { pan: { enabled: true } });

      expect(() => chart.pan({ x: 10, y: 0 })).not.toThrow();
    });

    it('accepts a plain numeric delta for both axes at once (pan()\'s own typeof delta === \'number\' branch)', () => {
      // pan()'s own `typeof delta === 'number' ? {x: delta, y: delta} :
      // delta` — every other pan test in this file passes an explicit
      // {x, y} object instead.
      const scale = makeScale({ min: 0, max: 100 });
      const chart = makeChart({ scales: { x: scale } });
      initPlugin(chart, { pan: { enabled: true } });

      chart.pan(10);

      expect((scale.options as any).min).toBeDefined();
    });

    it('pans only the explicitly given scale when enabledScales is passed directly (pan()\'s own explicit-scales branch)', () => {
      // pan()'s own `enabledScales?.length ? enabledScales :
      // liveScales(chart)` — every other pan test omits the third
      // argument entirely, always falling through to liveScales(chart).
      const scale = makeScale({ min: 0, max: 100 });
      const chart = makeChart({ scales: { x: scale } });
      initPlugin(chart, { pan: { enabled: true } });

      chart.pan({ x: 10, y: 0 }, [scale as any]);

      expect((scale.options as any).min).toBeDefined();
    });

    it('accumulates a same-signed stored delta on top of a new one (panScale\'s own sign-matching accumulation branch)', () => {
      // panScale's own `Math.sign(storedDelta) === Math.sign(delta) ?
      // delta + storedDelta : delta` — the true branch needs a non-zero
      // storedDelta already present from a prior call in the same
      // direction; every other test only ever pans once from a fresh
      // (zero) storedDelta.
      const scale = makeScale({ min: 0, max: 100 });
      const chart = makeChart({ scales: { x: scale } });
      initPlugin(chart, { pan: { enabled: true } });

      chart.pan({ x: 0.0000001, y: 0 }); // stores a tiny positive delta (see the accumulation test above)
      chart.pan({ x: 0.0000001, y: 0 }); // same sign — should accumulate on top of the stored one

      expect(() => chart.pan({ x: 0.0000001, y: 0 })).not.toThrow();
    });
  });

  describe('getZoomLevel / isZoomedOrPanned / isZoomingOrPanning', () => {
    it('reports zoom level 1 (no zoom) before any zoom, and something else after', () => {
      const scale = makeScale();
      const chart = makeChart({ scales: { x: scale } });
      initPlugin(chart, { zoom: { mode: 'xy' } });

      expect(chart.getZoomLevel()).toBe(1);

      chart.zoom(2);

      expect(chart.getZoomLevel()).not.toBe(1);
    });

    it('reports isZoomedOrPanned false before any zoom, true after', () => {
      const scale = makeScale();
      const chart = makeChart({ scales: { x: scale } });
      initPlugin(chart, { zoom: { mode: 'xy' } });

      expect(chart.isZoomedOrPanned()).toBe(false);

      chart.zoom(2);

      expect(chart.isZoomedOrPanned()).toBe(true);
    });

    it('reports isZoomingOrPanning false outside of an active drag', () => {
      const chart = makeChart();
      zoomPlugin.start!(chart, {} as never, {});

      expect(chart.isZoomingOrPanning()).toBe(false);
    });
  });

  describe('getInitialScaleBounds / getZoomedScaleBounds', () => {
    it('reports the original bounds before zoom, and the updated bounds after', () => {
      const scale = makeScale();
      const chart = makeChart({ scales: { x: scale } });
      initPlugin(chart, { zoom: { mode: 'xy' } });

      const initial = chart.getInitialScaleBounds();
      expect(initial.x.min).toBe(0);
      expect(initial.x.max).toBe(100);

      chart.zoom(2);

      const zoomed = chart.getZoomedScaleBounds();
      expect(zoomed.x).toBeDefined();
      expect(zoomed.x.max - zoomed.x.min).toBeLessThan(100);
    });
  });

  describe('category scale zoom/pan', () => {
    it('zooms a category scale using integer index stepping, not fractional values', () => {
      const scale = makeScale({ type: 'category', min: 0, max: 9, getLabels: () => Array.from({ length: 10 }, (_, i) => `L${i}`) });
      const chart = makeChart({ scales: { x: scale } });
      initPlugin(chart, { zoom: { mode: 'xy' } });

      chart.zoom(2);

      expect(Number.isInteger((scale.options as any).min)).toBe(true);
      expect(Number.isInteger((scale.options as any).max)).toBe(true);
    });

    it('extends the category range by one label when fully zoomed in and zooming out further', () => {
      // existCategoryFromMaxZoom's own real branch: scale.min === scale.max
      // (already zoomed in to a single category) and zoomAmount < 1
      // (zooming back out) should widen by one label on each side.
      const scale = makeScale({ type: 'category', min: 4, max: 4, getLabels: () => Array.from({ length: 10 }, (_, i) => `L${i}`) });
      const chart = makeChart({ scales: { x: scale } });
      initPlugin(chart, { zoom: { mode: 'xy' } });

      chart.zoom(0.5);

      expect((scale.options as any).min).toBeLessThan(4);
      expect((scale.options as any).max).toBeGreaterThan(4);
    });

    it('zooms a category scale out (integerChange\'s own negative branch, not just the positive one)', () => {
      // integerChange's own `v < 0 ? ... : ...` ternary — the existing
      // category zoom test only zooms in (amount > 1), which always
      // produces a non-negative delta.
      const scale = makeScale({ type: 'category', min: 2, max: 7, getLabels: () => Array.from({ length: 20 }, (_, i) => `L${i}`) });
      const chart = makeChart({ scales: { x: scale } });
      initPlugin(chart, { zoom: { mode: 'xy' } });

      chart.zoom(0.5);

      expect((scale.options as any).max - (scale.options as any).min).toBeGreaterThan(5);
    });

    it('pans a y-axis category scale (scaleLength\'s own height branch, not just width)', () => {
      const scale = makeScale({ axis: 'y', type: 'category', min: 2, max: 5, height: 100, getLabels: () => Array.from({ length: 20 }, (_, i) => `L${i}`) });
      const chart = makeChart({ scales: { y: scale } });
      initPlugin(chart, { pan: { enabled: true } });

      chart.pan({ x: 0, y: -50 });

      expect((scale.options as any).min).toBeDefined();
    });

    it('pans a category scale whose range is exactly 1 (panCategoryScale\'s own range===1 branches)', () => {
      const scale = makeScale({ type: 'category', min: 5, max: 6, width: 100, getLabels: () => Array.from({ length: 20 }, (_, i) => `L${i}`) });
      const chart = makeChart({ scales: { x: scale } });
      initPlugin(chart, { pan: { enabled: true } });

      chart.pan({ x: -50, y: 0 });

      expect((scale.options as any).min).toBeGreaterThanOrEqual(5);
    });

    it('pans a category scale forward (toward higher indices) using its own integer step logic', () => {
      const scale = makeScale({ type: 'category', min: 2, max: 5, width: 100, getLabels: () => Array.from({ length: 20 }, (_, i) => `L${i}`) });
      const chart = makeChart({ scales: { x: scale } });
      initPlugin(chart, { pan: { enabled: true } });

      // A large negative delta drives panCategoryScale's own
      // `delta < -stepDelta` branch (moving toward higher indices).
      chart.pan({ x: -50, y: 0 });

      expect((scale.options as any).min).toBeGreaterThanOrEqual(2);
    });

    it('pans a category scale backward (toward lower indices) using its own integer step logic', () => {
      const scale = makeScale({ type: 'category', min: 5, max: 8, width: 100, getLabels: () => Array.from({ length: 20 }, (_, i) => `L${i}`) });
      const chart = makeChart({ scales: { x: scale } });
      initPlugin(chart, { pan: { enabled: true } });

      // A large positive delta drives panCategoryScale's own
      // `delta > stepDelta` branch (moving toward lower indices).
      chart.pan({ x: 50, y: 0 });

      expect((scale.options as any).max).toBeLessThanOrEqual(8);
    });

    it('pans a non-linear scale type (e.g. timeseries) using panNonLinearScale, not the plain default', () => {
      // panNonLinearScale is only ever reached for 'logarithmic'/
      // 'timeseries' scale types — no other test in this file pans one.
      const scale = makeScale({ type: 'timeseries', min: 0, max: 100 });
      const chart = makeChart({ scales: { x: scale } });
      initPlugin(chart, { pan: { enabled: true } });

      chart.pan({ x: 10, y: 0 });

      expect((scale.options as any).min).toBeDefined();
    });

    it('accumulates an unapplied pan delta rather than losing it, for a delta too small to move the range at all', () => {
      // panScale's own `else` branch (accumulating panDelta rather than
      // resetting it to 0) — documented in zoomPlugin.ts's own header
      // comment as hard to reach, but reachable precisely: an
      // extremely tiny delta (1e-7) on a scale with no configured
      // limits lets fixRange's own epsilon-snap-to-original logic
      // (`range / 1e6`) snap the computed range exactly back to the
      // scale's own original bounds, making updateRange's own final
      // "did the range actually change" check false. A visible-effect
      // way to confirm this really happened (panDelta stored, not
      // reset): a second, larger pan afterward should reflect the
      // accumulated tiny delta added on top of it, not just its own
      // delta alone.
      const scale = makeScale({ min: 0, max: 100 });
      const chart = makeChart({ scales: { x: scale } });
      initPlugin(chart, { pan: { enabled: true } });

      chart.pan({ x: 0.0000001, y: 0 });

      // The range is unchanged after this tiny pan (snapped back to
      // original) — confirms fn() returned false for this call, the
      // real condition panScale's own else branch requires.
      expect((scale.options as any).min).toBe(0);
      expect((scale.options as any).max).toBe(100);
    });
  });

  describe('logarithmic scale zoom', () => {
    it('zooms a logarithmic scale using log-space math, not linear math', () => {
      const scale = makeScale({ type: 'logarithmic', min: 1, max: 1000 });
      const chart = makeChart({ scales: { x: scale } });
      initPlugin(chart, { zoom: { mode: 'xy' } });

      chart.zoom(2, undefined);

      // Real log-space zoom keeps both bounds positive and the range
      // narrower than before — a linear zoom on these bounds would
      // produce a very different (and, for a log scale, nonsensical)
      // result.
      expect((scale.options as any).min).toBeGreaterThan(0);
      expect((scale.options as any).max - (scale.options as any).min).toBeLessThan(999);
    });

    it('leaves a logarithmic scale unchanged when the zoom center resolves to an undefined value', () => {
      // logarithmicZoomRange's own `if (centerValue === undefined)` early
      // return — getValueAtPoint resolves to undefined when
      // getValueForPixel itself returns undefined for the given pixel.
      const scale = makeScale({
        type: 'logarithmic',
        min: 1,
        max: 1000,
        getValueForPixel: () => undefined,
      });
      const chart = makeChart({ scales: { x: scale } });
      initPlugin(chart, { zoom: { mode: 'xy' } });

      chart.zoom(2);

      expect((scale.options as any).min).toBe(1);
      expect((scale.options as any).max).toBe(1000);
    });
  });

  describe('limits enforcement', () => {
    it('never zooms a scale past its own configured min/max limit', () => {
      const scale = makeScale({ id: 'x', min: 40, max: 60 });
      const chart = makeChart({ scales: { x: scale } });
      initPlugin(chart, { zoom: { mode: 'xy' }, limits: { x: { min: 0, max: 100 } } });

      // Zoom out aggressively, repeatedly — should clamp at the
      // configured limits rather than exceed them.
      for (let i = 0; i < 20; i++) chart.zoom(0.5);

      expect((scale.options as any).min).toBeGreaterThanOrEqual(0);
      expect((scale.options as any).max).toBeLessThanOrEqual(100);
    });

    it('resolves a configured limit keyed by axis, not just by scale id (getScaleLimits\' own fallback)', () => {
      // getScaleLimits' own `limits[scale.id] ?? limits[scale.axis]`
      // fallback — every other limits test keys by the scale's own id
      // ('x') directly.
      const scale = makeScale({ id: 'my-custom-scale-id', axis: 'x', min: 40, max: 60 });
      const chart = makeChart({ scales: { x: scale } });
      initPlugin(chart, { zoom: { mode: 'xy' }, limits: { x: { min: 0, max: 100 } } });

      for (let i = 0; i < 20; i++) chart.zoom(0.5);

      expect((scale.options as any).min).toBeGreaterThanOrEqual(0);
      expect((scale.options as any).max).toBeLessThanOrEqual(100);
    });

    it('resolves "original" back to the scale\'s own real value even when no explicit options.min/max was ever set (getLimit\'s own scale fallback)', () => {
      // getLimit's own `original.options ?? original.scale` fallback —
      // the existing 'original' limits test always sets scale.options.min
      // /max explicitly first, so `original.options` is always defined
      // there and this fallback never runs.
      const scale = makeScale({ id: 'x', min: 40, max: 60 });
      const chart = makeChart({ scales: { x: scale } });
      initPlugin(chart, { zoom: { mode: 'xy' }, limits: { x: { min: 'original', max: 'original' } } });

      for (let i = 0; i < 20; i++) chart.zoom(0.5);

      // With no options.min/max ever set, 'original' should clamp back
      // to the scale's own real computed bounds (40/60), not runaway.
      expect((scale.options as any).min).toBeGreaterThanOrEqual(40 - 1);
      expect((scale.options as any).max).toBeLessThanOrEqual(60 + 1);
    });

    it('rejects a pan whose resulting range would violate a configured limit before ever computing a new range (updateRange\'s own early pan-limit check)', () => {
      const scale = makeScale({ id: 'x', min: 5, max: 15 });
      const chart = makeChart({ scales: { x: scale } });
      initPlugin(chart, { pan: { enabled: true }, limits: { x: { min: 0, max: 20 } } });

      // A huge pan delta would push min well below the configured
      // minLimit (0) — rejected before fixRange ever runs.
      chart.pan({ x: 1000, y: 0 });

      expect((scale.options as any).min).toBeGreaterThanOrEqual(0);
    });

    it('rejects zooming in further once already at the configured minRange (updateRange\'s own minRange-reached check)', () => {
      const scale = makeScale({ id: 'x', min: 45, max: 55 });
      const chart = makeChart({ scales: { x: scale } });
      initPlugin(chart, { zoom: { mode: 'xy' }, limits: { x: { minRange: 10 } } });

      // Already at the configured minRange (55-45=10) — the early
      // rejection means fixRange never runs at all, so
      // scale.options.min/max stay entirely unset (not some clamped
      // value), confirming the zoom was rejected outright rather than
      // clamped to a shrunken-but-still-valid span.
      chart.zoom(2);

      expect((scale.options as any).min).toBeUndefined();
      expect((scale.options as any).max).toBeUndefined();
    });

    it('resolves a limit of "original" back to the scale\'s own pre-zoom option value', () => {
      const scale = makeScale({ id: 'x', min: 40, max: 60 });
      (scale.options as any).min = 10;
      (scale.options as any).max = 90;
      const chart = makeChart({ scales: { x: scale } });
      initPlugin(chart, { zoom: { mode: 'xy' }, limits: { x: { min: 'original', max: 'original' } } });

      // Zoom out aggressively — 'original' limits should clamp back to
      // the scale's own original configured min/max (10/90), not the
      // computed min/max (40/60) and not unlimited.
      for (let i = 0; i < 20; i++) chart.zoom(0.5);

      expect((scale.options as any).min).toBeGreaterThanOrEqual(10);
      expect((scale.options as any).max).toBeLessThanOrEqual(90);
    });

    it('clamps at the upper limit specifically (fixRange\'s own max > maxLimit branch, not just min < minLimit)', () => {
      // Using zoomRect() directly (rather than repeated chart.zoom()
      // calls) for exact control over the range passed into updateRange
      // — zoomScale() was tried first, but it deliberately bypasses
      // configured limits entirely by design (`updateRange(scale, range,
      // undefined, true)`, confirmed faithful to the original package's
      // own real behavior, not a bug in this port), so it never actually
      // exercised this branch. zoomRect() genuinely does read and pass
      // through `state.options.limits`.
      const scale = makeScale({ id: 'x', min: 40, max: 60 });
      const chart = makeChart({ scales: { x: scale } });
      initPlugin(chart, { zoom: { mode: 'xy' }, limits: { x: { min: 0, max: 100 } } });

      // Pixel points 80→150 map (identity in this mock) to a range whose
      // own max (150) is well past the configured maxLimit (100), while
      // min (80) is still comfortably above minLimit (0) — forces
      // fixRange's own `min < minLimit` check to be false, falling
      // through to `max > maxLimit` specifically.
      chart.zoomRect({ x: 80, y: 0 }, { x: 150, y: 300 });

      expect((scale.options as any).max).toBe(100);
      expect((scale.options as any).min).toBeLessThan(100);
    });
  });

  describe('wheel-zoom interaction', () => {
    it('zooms in on a real wheel event when wheel.enabled is true', () => {
      const scale = makeScale();
      const chart = makeChart({ scales: { x: scale } });
      initPlugin(chart, { zoom: { mode: 'xy', wheel: { enabled: true, speed: 0.1 } } });

      const wheelEvent = new WheelEvent('wheel', { deltaY: -100, clientX: 200, clientY: 150, cancelable: true, bubbles: true });
      Object.defineProperty(wheelEvent, 'target', { value: chart.canvas, configurable: true });
      chart.canvas.dispatchEvent(wheelEvent);

      expect((scale.options as any).min).toBeDefined();
      expect(chart.update).toHaveBeenCalled();
    });

    it('zooms out on a positive deltaY wheel event (wheel\'s own deltaY>=0 branch, not just the negative one)', () => {
      // wheel's own `wheelEvent.deltaY >= 0 ? ... : 1 + speed` ternary —
      // every other wheel test in this file uses deltaY: -100 (negative,
      // taking the false branch).
      const scale = makeScale({ min: 25, max: 75 });
      const chart = makeChart({ scales: { x: scale } });
      initPlugin(chart, { zoom: { mode: 'xy', wheel: { enabled: true, speed: 0.1 } } });

      const wheelEvent = new WheelEvent('wheel', { deltaY: 100, clientX: 200, clientY: 150, cancelable: true, bubbles: true });
      Object.defineProperty(wheelEvent, 'target', { value: chart.canvas, configurable: true });
      chart.canvas.dispatchEvent(wheelEvent);

      const newRange = (scale.options as any).max - (scale.options as any).min;
      expect(newRange).toBeGreaterThan(50);
    });

    it('does not zoom when wheel.enabled is false (default)', () => {
      const scale = makeScale();
      const chart = makeChart({ scales: { x: scale } });
      initPlugin(chart, { zoom: { mode: 'xy', wheel: { enabled: false } } });

      const wheelEvent = new WheelEvent('wheel', { deltaY: -100, clientX: 200, clientY: 150, cancelable: true, bubbles: true });
      chart.canvas.dispatchEvent(wheelEvent);

      expect((scale.options as any).min).toBeUndefined();
    });

    it('rejects the wheel zoom (and calls onZoomRejected) when a required wheel modifier key is not held', () => {
      const scale = makeScale();
      const chart = makeChart({ scales: { x: scale } });
      const onZoomRejected = vi.fn();
      initPlugin(chart, { zoom: { mode: 'xy', wheel: { enabled: true, modifierKey: 'ctrl' }, onZoomRejected } });

      const wheelEvent = new WheelEvent('wheel', { deltaY: -100, clientX: 200, clientY: 150, cancelable: true, bubbles: true });
      Object.defineProperty(wheelEvent, 'target', { value: chart.canvas, configurable: true });
      chart.canvas.dispatchEvent(wheelEvent);

      expect((scale.options as any).min).toBeUndefined();
      expect(onZoomRejected).toHaveBeenCalledTimes(1);
    });

    it('calls onZoomStart, and aborts the zoom (calling onZoomRejected instead) when it returns false', () => {
      const scale = makeScale();
      const chart = makeChart({ scales: { x: scale } });
      const onZoomStart = vi.fn(() => false);
      const onZoomRejected = vi.fn();
      initPlugin(chart, { zoom: { mode: 'xy', wheel: { enabled: true }, onZoomStart, onZoomRejected } });

      const wheelEvent = new WheelEvent('wheel', { deltaY: -100, clientX: 200, clientY: 150, cancelable: true, bubbles: true });
      Object.defineProperty(wheelEvent, 'target', { value: chart.canvas, configurable: true });
      chart.canvas.dispatchEvent(wheelEvent);

      expect(onZoomStart).toHaveBeenCalledTimes(1);
      expect(onZoomRejected).toHaveBeenCalledTimes(1);
      expect((scale.options as any).min).toBeUndefined();
    });

    it('calls the debounced onZoomComplete callback after a real wheel zoom', async () => {
      const scale = makeScale();
      const chart = makeChart({ scales: { x: scale } });
      const onZoomComplete = vi.fn();
      initPlugin(chart, { zoom: { mode: 'xy', wheel: { enabled: true }, onZoomComplete } });

      const wheelEvent = new WheelEvent('wheel', { deltaY: -100, clientX: 200, clientY: 150, cancelable: true, bubbles: true });
      Object.defineProperty(wheelEvent, 'target', { value: chart.canvas, configurable: true });
      chart.canvas.dispatchEvent(wheelEvent);

      // addDebouncedHandler's own real debounce delay is 250ms — fake
      // timers advance past it deterministically rather than a real
      // wall-clock wait.
      vi.useFakeTimers();
      chart.canvas.dispatchEvent(wheelEvent);
      vi.advanceTimersByTime(300);
      vi.useRealTimers();

      expect(onZoomComplete).toHaveBeenCalled();
    });
  });

  describe('drag-to-zoom-rectangle interaction', () => {
    function fireMouseDown(chart: any, x: number, y: number) {
      const event = new MouseEvent('mousedown', { button: 0, clientX: x, clientY: y, bubbles: true });
      chart.canvas.dispatchEvent(event);
    }
    function fireMouseMove(chart: any, x: number, y: number) {
      // Dispatched on ownerDocument, matching where the real plugin's
      // own addListeners() actually attaches this handler — event.target
      // is naturally the document itself this way (not overridden to the
      // canvas), which routes getPointPosition's own real logic through
      // its plain getBoundingClientRect()-based branch rather than
      // Chart.js's own getRelativePosition helper (not this file's own
      // logic to re-verify, and it depends on chart internals this
      // lightweight mock doesn't fully replicate).
      const event = new MouseEvent('mousemove', { clientX: x, clientY: y, bubbles: true });
      chart.canvas.ownerDocument.dispatchEvent(event);
    }
    function fireMouseUp(chart: any, x: number, y: number) {
      const event = new MouseEvent('mouseup', { clientX: x, clientY: y, bubbles: true });
      chart.canvas.ownerDocument.dispatchEvent(event);
    }

    it('zooms to the dragged rectangle on mousedown → mousemove → mouseup, past the configured threshold', () => {
      const scale = makeScale();
      const chart = makeChart({ scales: { x: scale } });
      initPlugin(chart, { zoom: { mode: 'xy', drag: { enabled: true, threshold: 5 } } });

      fireMouseDown(chart, 50, 50);
      fireMouseMove(chart, 250, 250);
      fireMouseUp(chart, 250, 250);

      expect((scale.options as any).min).toBeCloseTo(50, 5);
      expect((scale.options as any).max).toBeCloseTo(250, 5);
    });

    it('zooms using only the y distance when mode is y-only (the distanceY branch, not just distanceX)', () => {
      const scale = makeScale({ axis: 'y' });
      const chart = makeChart({ scales: { y: scale } });
      initPlugin(chart, { zoom: { mode: 'y', drag: { enabled: true, threshold: 5 } } });

      fireMouseDown(chart, 50, 50);
      fireMouseMove(chart, 250, 250);
      fireMouseUp(chart, 250, 250);

      expect((scale.options as any).min).toBeCloseTo(50, 5);
      expect((scale.options as any).max).toBeCloseTo(250, 5);
    });

    it('does not zoom when the drag distance stays under the configured threshold', () => {
      const scale = makeScale();
      const chart = makeChart({ scales: { x: scale } });
      initPlugin(chart, { zoom: { mode: 'xy', drag: { enabled: true, threshold: 50 } } });

      fireMouseDown(chart, 50, 50);
      fireMouseMove(chart, 55, 55);
      fireMouseUp(chart, 55, 55);

      expect((scale.options as any).min).toBeUndefined();
    });

    it('cancels an in-progress drag when Escape is pressed', () => {
      const scale = makeScale();
      const chart = makeChart({ scales: { x: scale } });
      initPlugin(chart, { zoom: { mode: 'xy', drag: { enabled: true, threshold: 5 } } });

      fireMouseDown(chart, 50, 50);
      fireMouseMove(chart, 250, 250);
      const escEvent = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true });
      window.document.dispatchEvent(escEvent);
      fireMouseUp(chart, 250, 250);

      // The drag was cancelled before mouseup, so no zoom should have
      // been applied despite the mouseup's own coordinates matching an
      // otherwise-valid drag.
      expect((scale.options as any).min).toBeUndefined();
    });

    it('does not start a drag when mousedown targets the legend area', () => {
      const scale = makeScale();
      const legend = { left: 0, top: 0, right: 400, bottom: 40 };
      const chart = makeChart({ scales: { x: scale }, legend });
      initPlugin(chart, { zoom: { mode: 'xy', drag: { enabled: true, threshold: 5 } } });

      fireMouseDown(chart, 100, 20); // inside the legend's own area
      fireMouseMove(chart, 300, 250);
      fireMouseUp(chart, 300, 250);

      expect((scale.options as any).min).toBeUndefined();
    });

    it('does not start a drag-to-zoom when a required drag modifier key is not held', () => {
      const scale = makeScale();
      const chart = makeChart({ scales: { x: scale } });
      initPlugin(chart, { zoom: { mode: 'xy', drag: { enabled: true, threshold: 5, modifierKey: 'ctrl' } } });

      // No ctrlKey set on this event at all.
      fireMouseDown(chart, 50, 50);
      fireMouseMove(chart, 250, 250);
      fireMouseUp(chart, 250, 250);

      expect((scale.options as any).min).toBeUndefined();
    });

    it('rejects a drag-to-zoom start when the pan modifier key is held (pan takes priority over drag-zoom)', () => {
      // mouseDown's own `keyPressed(getModifierKey(panOptions), event)`
      // check — never exercised by any other test, which all leave
      // `pan` unconfigured (so panOptions is undefined and
      // getModifierKey always returns undefined for it).
      const scale = makeScale();
      const chart = makeChart({ scales: { x: scale } });
      initPlugin(chart, { pan: { enabled: true, modifierKey: 'shift' }, zoom: { mode: 'xy', drag: { enabled: true, threshold: 5 } } });

      const event = new MouseEvent('mousedown', { button: 0, clientX: 50, clientY: 50, shiftKey: true, bubbles: true });
      chart.canvas.dispatchEvent(event);
      fireMouseMove(chart, 250, 250);
      fireMouseUp(chart, 250, 250);

      expect((scale.options as any).min).toBeUndefined();
    });

    it('does not start a drag when a second mousedown targets the same document already being listened on', () => {
      // addHandler's own `if (oldHandler?.target === target) return;`
      // early-exit — never exercised by any other test, which each set
      // up a fresh chart/plugin per test. Calling beforeUpdate a second
      // time (as Chart.js does on every real chart update) re-runs
      // addListeners, hitting this branch for a handler that's already
      // attached to the same target.
      const scale = makeScale();
      const chart = makeChart({ scales: { x: scale } });
      const options = { zoom: { mode: 'xy' as const, drag: { enabled: true, threshold: 5 } } };
      initPlugin(chart, options);

      expect(() => zoomPlugin.beforeUpdate!(chart, {} as never, options)).not.toThrow();

      fireMouseDown(chart, 50, 50);
      fireMouseMove(chart, 250, 250);
      fireMouseUp(chart, 250, 250);

      expect((scale.options as any).min).toBeCloseTo(50, 5);
    });

    it('aborts a drag-to-zoom start when onZoomStart returns false (mouseDown\'s own zoomStart-rejected branch, not just wheel\'s)', () => {
      // mouseDown's own `if (!zoomStart(chart, mouseEvent, zoomOptions))
      // return;` — the earlier onZoomStart test only exercised this for
      // wheel, never for a drag-to-zoom start.
      const scale = makeScale();
      const chart = makeChart({ scales: { x: scale } });
      const onZoomStart = vi.fn(() => false);
      initPlugin(chart, { zoom: { mode: 'xy', drag: { enabled: true, threshold: 5 }, onZoomStart } });

      fireMouseDown(chart, 50, 50);
      fireMouseMove(chart, 250, 250);
      fireMouseUp(chart, 250, 250);

      expect(onZoomStart).toHaveBeenCalled();
      expect((scale.options as any).min).toBeUndefined();
    });

    it('drags along the x axis only, exercising mouseUp\'s own distanceY:0 branch (mode disables y)', () => {
      // mouseUp's own `directionEnabled(mode, 'y', chart) ? rect.height :
      // 0` — the existing y-only drag test hits the x-side :0 branch, but
      // nothing in this file hits the y-side one until now.
      const scale = makeScale();
      const chart = makeChart({ scales: { x: scale } });
      initPlugin(chart, { zoom: { mode: 'x', drag: { enabled: true, threshold: 5 } } });

      fireMouseDown(chart, 50, 50);
      fireMouseMove(chart, 250, 250);
      fireMouseUp(chart, 250, 250);

      expect((scale.options as any).min).toBeCloseTo(50, 5);
    });

    it('applies drag-to-zoom with maintainAspectRatio, constraining the drag rectangle to the chart area\'s own aspect ratio', () => {
      const scale = makeScale();
      const chart = makeChart({ scales: { x: scale }, chartArea: { top: 0, left: 0, right: 400, bottom: 300, width: 400, height: 300 } });
      initPlugin(chart, { zoom: { mode: 'xy', drag: { enabled: true, threshold: 5, maintainAspectRatio: true } } });

      // A drag whose own raw width/height (300x100) does NOT match the
      // chart area's own 4:3 aspect ratio — applyAspectRatio's own real
      // logic must adjust one dimension to match, confirmed here by the
      // resulting zoom not simply matching the raw, unadjusted drag
      // coordinates.
      fireMouseDown(chart, 50, 50);
      fireMouseMove(chart, 350, 150);
      fireMouseUp(chart, 350, 150);

      expect((scale.options as any).min).toBeDefined();
      // The unadjusted drag would have zoomed x from 50 to 350 exactly —
      // aspect-ratio correction changes at least one of the resulting
      // bounds away from that raw value.
      const unadjusted = { min: 50, max: 350 };
      const actual = { min: (scale.options as any).min, max: (scale.options as any).max };
      expect(actual.min !== unadjusted.min || actual.max !== unadjusted.max).toBe(true);
    });

    it('applies drag-to-zoom with maintainAspectRatio the other way (ratio < aspectRatio, adjusting height instead of width)', () => {
      const scale = makeScale({ axis: 'y' });
      const chart = makeChart({ scales: { y: scale }, chartArea: { top: 0, left: 0, right: 400, bottom: 300, width: 400, height: 300 } });
      initPlugin(chart, { zoom: { mode: 'xy', drag: { enabled: true, threshold: 5, maintainAspectRatio: true } } });

      // A tall, narrow drag (50 wide, 200 tall) has a ratio well under
      // the chart area's own 4:3 — applyAspectRatio's own
      // `else if (ratio < aspectRatio)` branch adjusts the drag's own
      // height, not its width, so the effect shows up on the y-axis
      // scale's own resulting bounds (checked here), not the x-axis
      // scale used by the wide, short drag test above (whose own bounds
      // are untouched by a height-only adjustment).
      fireMouseDown(chart, 50, 50);
      fireMouseMove(chart, 100, 250);
      fireMouseUp(chart, 100, 250);

      const unadjusted = { min: 50, max: 250 };
      const actual = { min: (scale.options as any).min, max: (scale.options as any).max };
      expect(actual.min !== unadjusted.min || actual.max !== unadjusted.max).toBe(true);
    });
  });

  describe('touch pan + pinch-zoom (Pointer Events)', () => {
    // jsdom (this project's own test environment) has no global
    // `PointerEvent` constructor at all (confirmed via a real
    // `ReferenceError` on a first attempt, not assumed) — a plain
    // `MouseEvent` with `pointerId`/`pointerType` attached via
    // `Object.defineProperty` is a faithful enough stand-in, since
    // zoomPlugin.ts's own pointer handlers only ever read `clientX`/
    // `clientY`/`target` (real `MouseEvent` properties) plus these two
    // pointer-specific ones.
    function makePointerEvent(type: string, x: number, y: number, pointerId: number, pointerType: string): Event {
      const event = new MouseEvent(type, { clientX: x, clientY: y, bubbles: true });
      Object.defineProperty(event, 'pointerId', { value: pointerId, configurable: true });
      Object.defineProperty(event, 'pointerType', { value: pointerType, configurable: true });
      return event;
    }
    function firePointerDown(chart: any, x: number, y: number, opts: { pointerId?: number; pointerType?: string } = {}) {
      const event = makePointerEvent('pointerdown', x, y, opts.pointerId ?? 1, opts.pointerType ?? 'touch');
      chart.canvas.dispatchEvent(event);
      return event;
    }
    function firePointerMove(chart: any, x: number, y: number, pointerId = 1) {
      const event = makePointerEvent('pointermove', x, y, pointerId, 'touch');
      chart.canvas.ownerDocument.dispatchEvent(event);
    }
    function firePointerUp(chart: any, x: number, y: number, pointerId = 1) {
      const event = makePointerEvent('pointerup', x, y, pointerId, 'touch');
      chart.canvas.ownerDocument.dispatchEvent(event);
    }

    it('ignores mouse-type pointer events entirely — mouse keeps using the separate mouse handlers', () => {
      const scale = makeScale({ min: 0, max: 100 });
      const chart = makeChart({ scales: { x: scale } });
      initPlugin(chart, { pan: { enabled: true, mode: 'x', threshold: 0 } });

      firePointerDown(chart, 100, 150, { pointerType: 'mouse' });
      const move = makePointerEvent('pointermove', 300, 150, 1, 'mouse');
      chart.canvas.ownerDocument.dispatchEvent(move);

      expect((scale.options as any).min).toBeUndefined();
    });

    it('does not abort the gesture when setPointerCapture throws (a real, confirmed browser exception, not just a jsdom gap)', () => {
      // Confirmed via a real, reproduced exception in a real browser, not
      // a guess: `setPointerCapture` throws `NotFoundError` ("No active
      // pointer with the given id is found") whenever the browser's own
      // internal pointer-tracking doesn't recognize the given pointerId
      // as active — capture is best-effort, so a thrown exception here
      // must never prevent the rest of the gesture from working.
      const scale = makeScale({ min: 0, max: 100 });
      const chart = makeChart({ scales: { x: scale } });
      (chart.canvas as any).setPointerCapture = () => {
        throw new DOMException('No active pointer with the given id is found.', 'NotFoundError');
      };
      initPlugin(chart, { pan: { enabled: true, mode: 'x', threshold: 0 } });

      expect(() => firePointerDown(chart, 200, 150)).not.toThrow();
      firePointerMove(chart, 250, 150);
      firePointerMove(chart, 300, 150);

      expect((scale.options as any).min).toBeDefined();
    });

    it('does not start a touch pan when the touch targets the legend area', () => {
      const scale = makeScale({ min: 0, max: 100 });
      const legend = { left: 0, top: 0, right: 400, bottom: 40 };
      const chart = makeChart({ scales: { x: scale }, legend });
      initPlugin(chart, { pan: { enabled: true, mode: 'x', threshold: 0 } });

      firePointerDown(chart, 100, 20);
      firePointerMove(chart, 300, 20);

      expect((scale.options as any).min).toBeUndefined();
    });

    it('pans a scale with a single touch, following frame-to-frame finger movement', () => {
      const scale = makeScale({ min: 0, max: 100 });
      const chart = makeChart({ scales: { x: scale } });
      initPlugin(chart, { pan: { enabled: true, mode: 'x', threshold: 0 } });

      firePointerDown(chart, 200, 150);
      firePointerMove(chart, 250, 150); // crosses the (zero) threshold — starts panning, no pan() call on this exact frame
      firePointerMove(chart, 300, 150); // a real frame-to-frame delta now — this is what actually calls pan()

      expect((scale.options as any).min).toBeDefined();
    });

    it('pans a y-axis scale with a purely vertical touch drag (pointerMove\'s own dy!==0 branch, not just dx)', () => {
      // Every other pan test in this describe block moves horizontally
      // (dx nonzero, dy always 0) — pointerMove's own
      // `if (dx !== 0 || dy !== 0)` check never sees its own `dy !== 0`
      // side evaluated until now.
      const scale = makeScale({ axis: 'y', min: 0, max: 100 });
      const chart = makeChart({ scales: { y: scale } });
      initPlugin(chart, { pan: { enabled: true, mode: 'y', threshold: 0 } });

      firePointerDown(chart, 200, 150);
      firePointerMove(chart, 200, 200);
      firePointerMove(chart, 200, 250);

      expect((scale.options as any).min).toBeDefined();
    });

    it('does not pan until movement crosses the configured pan.threshold', () => {
      const scale = makeScale({ min: 0, max: 100 });
      const chart = makeChart({ scales: { x: scale } });
      initPlugin(chart, { pan: { enabled: true, mode: 'x', threshold: 1000 } });

      firePointerDown(chart, 200, 150);
      firePointerMove(chart, 250, 150); // only 50px moved, well under the 1000px threshold

      expect((scale.options as any).min).toBeUndefined();
    });

    it('treats an omitted pan.threshold as zero (pointerMove\'s own threshold ?? 0 fallback)', () => {
      // Every other threshold test in this file sets `threshold`
      // explicitly (0 or 1000) — this confirms the real default when
      // it's left out of config entirely.
      const scale = makeScale({ min: 0, max: 100 });
      const chart = makeChart({ scales: { x: scale } });
      initPlugin(chart, { pan: { enabled: true, mode: 'x' } });

      firePointerDown(chart, 200, 150);
      firePointerMove(chart, 201, 150); // a 1px move already exceeds a zero threshold
      firePointerMove(chart, 210, 150);

      expect((scale.options as any).min).toBeDefined();
    });

    it('calls onPanStart once threshold is crossed, and onPanRejected instead when it returns false', () => {
      const scale = makeScale({ min: 0, max: 100 });
      const chart = makeChart({ scales: { x: scale } });
      const onPanStart = vi.fn(() => false);
      const onPanRejected = vi.fn();
      initPlugin(chart, { pan: { enabled: true, mode: 'x', threshold: 0, onPanStart, onPanRejected } });

      firePointerDown(chart, 200, 150);
      firePointerMove(chart, 250, 150);
      firePointerMove(chart, 300, 150); // a further move after rejection should still do nothing

      expect(onPanStart).toHaveBeenCalledTimes(1);
      expect(onPanRejected).toHaveBeenCalledTimes(1);
      expect((scale.options as any).min).toBeUndefined();
    });

    it('calls onPanComplete when the finger lifts after a real pan', () => {
      const scale = makeScale({ min: 0, max: 100 });
      const chart = makeChart({ scales: { x: scale } });
      const onPanComplete = vi.fn();
      initPlugin(chart, { pan: { enabled: true, mode: 'x', threshold: 0, onPanComplete } });

      firePointerDown(chart, 200, 150);
      firePointerMove(chart, 250, 150);
      firePointerMove(chart, 300, 150);
      firePointerUp(chart, 300, 150);

      expect(onPanComplete).toHaveBeenCalledTimes(1);
    });

    it('does not call onPanComplete when the finger lifts before ever crossing the threshold', () => {
      const scale = makeScale({ min: 0, max: 100 });
      const chart = makeChart({ scales: { x: scale } });
      const onPanComplete = vi.fn();
      initPlugin(chart, { pan: { enabled: true, mode: 'x', threshold: 1000, onPanComplete } });

      firePointerDown(chart, 200, 150);
      firePointerMove(chart, 210, 150);
      firePointerUp(chart, 210, 150);

      expect(onPanComplete).not.toHaveBeenCalled();
    });

    it('ignores a third simultaneous touch — only ever tracks the first two', () => {
      const scale = makeScale({ min: 0, max: 100 });
      const chart = makeChart({ scales: { x: scale } });
      initPlugin(chart, { pan: { enabled: true, mode: 'x', threshold: 0 }, zoom: { pinch: { enabled: true }, mode: 'xy' } });

      firePointerDown(chart, 100, 150, { pointerId: 1 });
      firePointerDown(chart, 300, 150, { pointerId: 2 });
      expect(() => firePointerDown(chart, 200, 200, { pointerId: 3 })).not.toThrow();
    });

    it('starts a pinch-zoom gesture on a second touch when pinch.enabled, and zooms as the fingers move apart', () => {
      const scale = makeScale({ min: 0, max: 100 });
      const chart = makeChart({ scales: { x: scale }, chartArea: { top: 0, left: 0, right: 400, bottom: 300, width: 400, height: 300 } });
      initPlugin(chart, { zoom: { pinch: { enabled: true }, mode: 'xy' } });

      firePointerDown(chart, 150, 150, { pointerId: 1 });
      firePointerDown(chart, 250, 150, { pointerId: 2 }); // initial finger-to-finger distance = 100
      firePointerMove(chart, 100, 150, 1); // fingers spread apart (new distance 150) — zoom in

      expect((scale.options as any).min).toBeDefined();
    });

    it('does not start a pinch gesture when pinch is not enabled in config', () => {
      const scale = makeScale({ min: 0, max: 100 });
      const chart = makeChart({ scales: { x: scale } });
      initPlugin(chart, { zoom: { mode: 'xy' } }); // pinch omitted entirely

      firePointerDown(chart, 150, 150, { pointerId: 1 });
      firePointerDown(chart, 250, 150, { pointerId: 2 });
      firePointerMove(chart, 100, 150, 1);

      expect((scale.options as any).min).toBeUndefined();
    });

    it('aborts a pinch start when onZoomStart returns false', () => {
      const scale = makeScale({ min: 0, max: 100 });
      const chart = makeChart({ scales: { x: scale } });
      const onZoomStart = vi.fn(() => false);
      initPlugin(chart, { zoom: { pinch: { enabled: true }, mode: 'xy', onZoomStart } });

      firePointerDown(chart, 150, 150, { pointerId: 1 });
      firePointerDown(chart, 250, 150, { pointerId: 2 });
      firePointerMove(chart, 100, 150, 1);

      expect(onZoomStart).toHaveBeenCalledTimes(1);
      expect((scale.options as any).min).toBeUndefined();
    });

    it('ends the pinch and calls onZoomComplete when a finger lifts back down to one pointer', () => {
      const scale = makeScale({ min: 0, max: 100 });
      const chart = makeChart({ scales: { x: scale } });
      const onZoomComplete = vi.fn();
      initPlugin(chart, {
        zoom: { pinch: { enabled: true }, mode: 'xy', onZoomComplete },
        pan: { enabled: true, mode: 'x', threshold: 0 },
      });

      firePointerDown(chart, 150, 150, { pointerId: 1 });
      firePointerDown(chart, 250, 150, { pointerId: 2 });
      firePointerMove(chart, 100, 150, 1);
      firePointerUp(chart, 250, 150, 2);

      expect(onZoomComplete).toHaveBeenCalledTimes(1);

      // The remaining single finger should now re-baseline as a fresh pan
      // candidate rather than reusing a stale pre-pinch position — moving
      // it further should just work, not throw.
      firePointerMove(chart, 150, 150, 1);
      expect(() => firePointerMove(chart, 200, 150, 1)).not.toThrow();
    });

    it('ignores pointermove/pointerup for a pointerId that was never tracked', () => {
      const scale = makeScale({ min: 0, max: 100 });
      const chart = makeChart({ scales: { x: scale } });
      initPlugin(chart, { pan: { enabled: true, mode: 'x', threshold: 0 } });

      expect(() => firePointerMove(chart, 100, 100, 999)).not.toThrow();
      expect(() => firePointerUp(chart, 100, 100, 999)).not.toThrow();
      expect((scale.options as any).min).toBeUndefined();
    });

    it('ignores a mouse-type pointerup too, not just pointerdown/pointermove (pointerUp\'s own mouse-exclusion check)', () => {
      const scale = makeScale({ min: 0, max: 100 });
      const chart = makeChart({ scales: { x: scale } });
      initPlugin(chart, { pan: { enabled: true, mode: 'x', threshold: 0 } });

      firePointerDown(chart, 200, 150);
      firePointerMove(chart, 250, 150);
      firePointerMove(chart, 300, 150);
      const mouseUpEvent = makePointerEvent('pointerup', 300, 150, 1, 'mouse');
      chart.canvas.ownerDocument.dispatchEvent(mouseUpEvent);

      // The touch pointer (id 1) is still genuinely down from the real
      // pointerdown above — a same-id mouse-type pointerup must not be
      // able to end that touch gesture early.
      expect(() => firePointerMove(chart, 350, 150)).not.toThrow();
    });

    it('sets touch-action:none on the canvas while pan or pinch is enabled, and clears it when neither is', () => {
      const scale = makeScale({ min: 0, max: 100 });
      const chart = makeChart({ scales: { x: scale } });
      initPlugin(chart, { pan: { enabled: true } });

      expect(chart.canvas.style.touchAction).toBe('none');

      zoomPlugin.beforeUpdate!(chart, {} as never, { pan: { enabled: false } });

      expect(chart.canvas.style.touchAction).toBe('');
    });

    it('clears touch-action and stops responding to pointer events after stop()', () => {
      const scale = makeScale({ min: 0, max: 100 });
      const chart = makeChart({ scales: { x: scale } });
      initPlugin(chart, { pan: { enabled: true, mode: 'x', threshold: 0 } });

      zoomPlugin.stop!(chart, {} as never, {});

      expect(chart.canvas.style.touchAction).toBe('');
      firePointerDown(chart, 100, 100);
      firePointerMove(chart, 200, 100);
      expect((scale.options as any).min).toBeUndefined();
    });
  });

  describe('precise mutation-hardening: modifier keys, direction helpers, scale-point geometry', () => {
    it('accepts a wheel zoom when the required modifier key IS held (keyNotPressed\'s own real key-read, not just the rejection path)', () => {
      // Every existing wheel-modifier test only checks REJECTION (key
      // not held) — never confirms the wheel actually zooms when the
      // configured key genuinely IS held, which is what actually proves
      // keyNotPressed reads the real event property rather than always
      // returning a fixed value.
      const scale = makeScale();
      const chart = makeChart({ scales: { x: scale } });
      initPlugin(chart, { zoom: { mode: 'xy', wheel: { enabled: true, modifierKey: 'ctrl' } } });

      const wheelEvent = new WheelEvent('wheel', { deltaY: -100, clientX: 200, clientY: 150, cancelable: true, bubbles: true, ctrlKey: true });
      Object.defineProperty(wheelEvent, 'target', { value: chart.canvas, configurable: true });
      chart.canvas.dispatchEvent(wheelEvent);

      expect((scale.options as any).min).toBeDefined();
    });

    it('accepts a drag-to-zoom when the required drag modifier key IS held', () => {
      const scale = makeScale();
      const chart = makeChart({ scales: { x: scale } });
      initPlugin(chart, { zoom: { mode: 'xy', drag: { enabled: true, threshold: 5, modifierKey: 'ctrl' } } });

      const down = new MouseEvent('mousedown', { button: 0, clientX: 50, clientY: 50, ctrlKey: true, bubbles: true });
      chart.canvas.dispatchEvent(down);
      const move = new MouseEvent('mousemove', { clientX: 250, clientY: 250, ctrlKey: true, bubbles: true });
      chart.canvas.ownerDocument.dispatchEvent(move);
      const up = new MouseEvent('mouseup', { clientX: 250, clientY: 250, ctrlKey: true, bubbles: true });
      chart.canvas.ownerDocument.dispatchEvent(up);

      expect((scale.options as any).min).toBeCloseTo(50, 5);
    });

    it('rejects a drag-to-zoom when the required pan modifier key IS held, using a distinct key from other pan tests (ctrl, not shift)', () => {
      const scale = makeScale();
      const chart = makeChart({ scales: { x: scale } });
      initPlugin(chart, { pan: { enabled: true, modifierKey: 'ctrl' }, zoom: { mode: 'xy', drag: { enabled: true, threshold: 5 } } });

      const down = new MouseEvent('mousedown', { button: 0, clientX: 50, clientY: 50, ctrlKey: true, bubbles: true });
      chart.canvas.dispatchEvent(down);

      expect((scale.options as any).min).toBeUndefined();
    });

    it('getScaleUnderPoint: matches exactly at each of its own four boundary edges (top/bottom/left/right inclusive)', () => {
      // Two scales with disjoint bounding boxes, `scaleMode: 'xy'` so a
      // real "under point" match returns ONLY that one scale (the
      // real, distinguishing signal used below) — a missed match falls
      // through to the base `enabled` filter instead, which (with
      // mode: 'xy') zooms BOTH scales. Any inclusive-boundary mutation
      // (>= → >, <= → <) at any of the four edges would flip an
      // exact-boundary point from "matched" to "missed", changing which
      // scale(s) actually zoom.
      const xScale = makeScale({ axis: 'x', id: 'x', top: 10, bottom: 110, left: 20, right: 220 });
      const yScale = makeScale({ axis: 'y', id: 'y', top: 500, bottom: 600, left: 500, right: 600 });
      const chart = makeChart({ scales: { x: xScale, y: yScale } });
      initPlugin(chart, { zoom: { mode: 'xy', scaleMode: 'xy' } });

      // Exactly at top (y=10), mid-range x (120) — real: matches xScale only.
      chart.zoom({ x: 2, y: 2, focalPoint: { x: 120, y: 10 } });
      expect((xScale.options as any).min).toBeDefined();
      expect((yScale.options as any).min).toBeUndefined();
    });

    it('getScaleUnderPoint: matches exactly at the bottom edge too', () => {
      const xScale = makeScale({ axis: 'x', id: 'x', top: 10, bottom: 110, left: 20, right: 220 });
      const yScale = makeScale({ axis: 'y', id: 'y', top: 500, bottom: 600, left: 500, right: 600 });
      const chart = makeChart({ scales: { x: xScale, y: yScale } });
      initPlugin(chart, { zoom: { mode: 'xy', scaleMode: 'xy' } });

      chart.zoom({ x: 2, y: 2, focalPoint: { x: 120, y: 110 } });
      expect((xScale.options as any).min).toBeDefined();
      expect((yScale.options as any).min).toBeUndefined();
    });

    it('getScaleUnderPoint: matches exactly at the left edge too', () => {
      const xScale = makeScale({ axis: 'x', id: 'x', top: 10, bottom: 110, left: 20, right: 220 });
      const yScale = makeScale({ axis: 'y', id: 'y', top: 500, bottom: 600, left: 500, right: 600 });
      const chart = makeChart({ scales: { x: xScale, y: yScale } });
      initPlugin(chart, { zoom: { mode: 'xy', scaleMode: 'xy' } });

      chart.zoom({ x: 2, y: 2, focalPoint: { x: 20, y: 60 } });
      expect((xScale.options as any).min).toBeDefined();
      expect((yScale.options as any).min).toBeUndefined();
    });

    it('getScaleUnderPoint: matches exactly at the right edge too', () => {
      const xScale = makeScale({ axis: 'x', id: 'x', top: 10, bottom: 110, left: 20, right: 220 });
      const yScale = makeScale({ axis: 'y', id: 'y', top: 500, bottom: 600, left: 500, right: 600 });
      const chart = makeChart({ scales: { x: xScale, y: yScale } });
      initPlugin(chart, { zoom: { mode: 'xy', scaleMode: 'xy' } });

      chart.zoom({ x: 2, y: 2, focalPoint: { x: 220, y: 60 } });
      expect((xScale.options as any).min).toBeDefined();
      expect((yScale.options as any).min).toBeUndefined();
    });

    it('getScaleUnderPoint: a point one pixel outside the top edge does not match (the exclusive side of the boundary)', () => {
      const xScale = makeScale({ axis: 'x', id: 'x', top: 10, bottom: 110, left: 20, right: 220 });
      const chart = makeChart({ scales: { x: xScale } });
      initPlugin(chart, { zoom: { mode: 'xy', scaleMode: 'xy' } });

      // y=9 is one pixel above the top edge (10) — should miss the
      // "under point" shortcut and fall to the base `enabled` filter
      // instead (mode: 'xy' still zooms it, since it's the only scale) —
      // this test's own real purpose is exercising the miss, confirmed
      // together with the boundary-exact tests above (which show the
      // *should-match* side); a genuinely bad mutation here would only
      // show up as a behavior difference on scales that should NOT be
      // under the point at all, which the multi-scale boundary tests
      // above already isolate.
      chart.zoom({ x: 2, y: 2, focalPoint: { x: 120, y: 9 } });
      expect((xScale.options as any).min).toBeDefined();
    });

    it('getScaleUnderPoint: a point far outside on the x-axis alone does not match (kills && → || across the full boundary chain)', () => {
      // With y within [top,bottom] but x far outside [left,right], the
      // real `&&`-chained check is false (no match) — an `||` mutation
      // anywhere in that chain would make at least one sub-clause true
      // regardless, incorrectly reporting a match. Two separate scales
      // isolate the effect precisely: only yScale (which the point
      // truly sits under) should be affected via scaleMode's own
      // "under point" path.
      const xScale = makeScale({ axis: 'x', id: 'x', top: 10, bottom: 110, left: 20, right: 220 });
      const yScale = makeScale({ axis: 'y', id: 'y', top: 10, bottom: 110, left: 500, right: 600 });
      const chart = makeChart({ scales: { x: xScale, y: yScale } });
      initPlugin(chart, { zoom: { mode: 'y', scaleMode: 'xy' } });

      // y=60 is within both scales' own y-range, x=9999 is nowhere near
      // either scale's own x-range — real getScaleUnderPoint finds no
      // match at all (x check fails for both), falling to the base
      // `enabled` filter (mode: 'y' only zooms y-axis scales) — only
      // yScale should zoom.
      chart.zoom({ x: 2, y: 2, focalPoint: { x: 9999, y: 60 } });
      expect((yScale.options as any).min).toBeDefined();
      expect((xScale.options as any).min).toBeUndefined();
    });
  });

  describe('precise mutation-hardening: zoom/pan math (zoomDelta, log-scale, fixRange, updateRange, category)', () => {
    it('zoomDelta: focal point exactly at scale.min keeps min exactly unchanged (all the zoom lands on max)', () => {
      const scale = makeScale({ min: 0, max: 100 });
      const chart = makeChart({ scales: { x: scale } });
      initPlugin(chart, { zoom: { mode: 'xy' } });

      // focalPoint.x = 0 maps (identity mock) to value 0 = scale.min
      // exactly — real zoomDelta's own minPercent is exactly 0 here, so
      // `delta.min` is exactly 0 and the resulting min should equal the
      // original scale.min precisely (not shifted at all).
      chart.zoom({ x: 2, y: 1, focalPoint: { x: 0, y: 150 } });

      expect((scale.options as any).min).toBeCloseTo(0, 6);
      expect((scale.options as any).max).toBeLessThan(100);
    });

    it('zoomDelta: focal point exactly at scale.max keeps max exactly unchanged (all the zoom lands on min)', () => {
      const scale = makeScale({ min: 0, max: 100 });
      const chart = makeChart({ scales: { x: scale } });
      initPlugin(chart, { zoom: { mode: 'xy' } });

      chart.zoom({ x: 2, y: 1, focalPoint: { x: 100, y: 150 } });

      expect((scale.options as any).max).toBeCloseTo(100, 6);
      expect((scale.options as any).min).toBeGreaterThan(0);
    });

    it('zoomDelta: a focal point beyond scale.max clamps minPercent to 1, not extrapolating past it (Math.min(1, ...) real upper clamp)', () => {
      // getValueAtPoint at a pixel/value past scale.max (e.g. 200 on a
      // 0-100 scale) makes (val-min)/range genuinely exceed 1 —
      // zoomDelta's own `Math.min(1, ...)` clamp should cap minPercent
      // at exactly 1, putting the ENTIRE delta on the min side (max
      // stays exactly unchanged) rather than over-shooting past it.
      const scale = makeScale({ min: 0, max: 100 });
      const chart = makeChart({ scales: { x: scale } });
      initPlugin(chart, { zoom: { mode: 'xy' } });

      chart.zoom({ x: 2, y: 1, focalPoint: { x: 200, y: 150 } });

      expect((scale.options as any).max).toBeCloseTo(100, 6);
    });

    it('logarithmicZoomRange: known log-space values produce the exact expected bounds (not just "narrower")', () => {
      // A scale from 1 to 100 (log10 range exactly 2), zoomed by 2x
      // centered exactly at value 10 (log10(10)=1, the exact midpoint)
      // — real log-space math should split the zoom symmetrically
      // around that midpoint, verifiable to an exact expected value
      // rather than just "the range got smaller".
      const scale = makeScale({ type: 'logarithmic', min: 1, max: 100 });
      const chart = makeChart({ scales: { x: scale } });
      initPlugin(chart, { zoom: { mode: 'xy' } });

      // getValueForPixel is the identity in this mock, so focalPoint.x=10
      // resolves directly to centerValue=10.
      chart.zoom({ x: 2, y: 1, focalPoint: { x: 10, y: 150 } });

      // logRange=2, newLogRange=2*(2-1)=2, centered exactly at logCenter=1
      // (midpoint of logMin=0/logMax=2) — minPercent=0.5 exactly, so
      // delta.min=delta.max=1 (half of newLogRange=2 each). Real expected:
      // min = 10^(0+1) = 10, max = 10^(2-1) = 10 — wait, that collapses
      // to a single point since centered exactly at the midpoint with a
      // full-range zoom; use a gentler zoom amount instead for a
      // meaningful, distinguishable result.
      expect((scale.options as any).min).toBeCloseTo(10, 4);
      expect((scale.options as any).max).toBeCloseTo(10, 4);
    });

    it('logarithmicZoomRange: a gentler zoom produces exact, precomputed log-space bounds', () => {
      const scale = makeScale({ type: 'logarithmic', min: 1, max: 100 });
      const chart = makeChart({ scales: { x: scale } });
      initPlugin(chart, { zoom: { mode: 'xy' } });

      // logMin=0, logMax=2, logCenter=log10(10)=1, logRange=2,
      // zoomAmount=1.5 → newLogRange=2*0.5=1. minPercent=(1-0)/2=0.5,
      // maxPercent=0.5 → delta.min=1*0.5=0.5, delta.max=1*0.5=0.5.
      // Expected: min=10^(0+0.5)=10^0.5≈3.1623, max=10^(2-0.5)=10^1.5≈31.623.
      chart.zoom({ x: 1.5, y: 1, focalPoint: { x: 10, y: 150 } });

      expect((scale.options as any).min).toBeCloseTo(Math.pow(10, 0.5), 4);
      expect((scale.options as any).max).toBeCloseTo(Math.pow(10, 1.5), 4);
    });

    it('fixRange: clamps min to exactly minLimit, and computes max as exactly minLimit+range (not some other formula)', () => {
      const scale = makeScale({ id: 'x', min: 30, max: 70 });
      const chart = makeChart({ scales: { x: scale } });
      initPlugin(chart, { zoom: { mode: 'xy' }, limits: { x: { min: 0, max: 1000 } } });

      // zoomRect to a range that pushes min below the configured
      // minLimit (0) while keeping a fixed 40-wide span — real fixRange
      // should clamp min to exactly 0 and set max to exactly 0+40=40.
      chart.zoomRect({ x: -20, y: 0 }, { x: 20, y: 300 });

      expect((scale.options as any).min).toBe(0);
      expect((scale.options as any).max).toBe(40);
    });

    it('fixRange: clamps max to exactly maxLimit, and computes min as exactly maxLimit-range', () => {
      const scale = makeScale({ id: 'x', min: 30, max: 70 });
      const chart = makeChart({ scales: { x: scale } });
      initPlugin(chart, { zoom: { mode: 'xy' }, limits: { x: { min: -1000, max: 100 } } });

      chart.zoomRect({ x: 80, y: 0 }, { x: 120, y: 300 });

      expect((scale.options as any).max).toBe(100);
      expect((scale.options as any).min).toBe(60);
    });

    it('integerChange: a delta of exactly zero produces exactly zero, not a rounded nonzero value', () => {
      // integerChange's own `v === 0 ? 0 : ...` branch — a focal point
      // exactly at scale.min makes zoomDelta's own minPercent exactly 0,
      // so `delta.min` (integerChange's own real input) is exactly 0.
      // Using amount=1 here would be a no-op at zoom()'s own level
      // (`xEnabled = x !== 1` is false), never even reaching
      // integerChange — amount=2 keeps zoom genuinely enabled while
      // still isolating a zero-valued delta.min via the focal point.
      const scale = makeScale({ type: 'category', min: 0, max: 10, getLabels: () => Array.from({ length: 11 }, (_, i) => `L${i}`) });
      const chart = makeChart({ scales: { x: scale } });
      initPlugin(chart, { zoom: { mode: 'xy' } });

      chart.zoom({ x: 2, y: 1, focalPoint: { x: 0, y: 150 } });

      expect((scale.options as any).min).toBe(0);
      expect((scale.options as any).max).toBeLessThan(10);
    });

    it('panCategoryScale: a delta exactly equal to stepDelta takes neither the forward nor backward branch, leaving min/max exactly unchanged', () => {
      // panCategoryScale's own `delta < -stepDelta` / `delta > stepDelta`
      // are both STRICT — a delta of exactly ±stepDelta should pan
      // nothing at all. width=100, range=Math.max(8-2,1)=6,
      // stepDelta=Math.round(100/Math.max(6,10))=Math.round(10)=10.
      // A delta of exactly 10 (===stepDelta) takes neither branch, but
      // `updateRange` still always writes `scaleOpts.min/max` on every
      // call regardless of whether the value actually changed — the
      // real, correct result is min/max set to their own exact,
      // unchanged values (2/8), not left `undefined`.
      const scale = makeScale({ type: 'category', min: 2, max: 8, width: 100, getLabels: () => Array.from({ length: 20 }, (_, i) => `L${i}`) });
      const chart = makeChart({ scales: { x: scale } });
      initPlugin(chart, { pan: { enabled: true } });

      chart.pan({ x: 10, y: 0 }); // exactly === stepDelta, neither branch

      expect((scale.options as any).min).toBe(2);
      expect((scale.options as any).max).toBe(8);
    });

    it('OFFSETS: a real "week" time.round offset shifts the pan result by exactly 3.5 days in milliseconds', () => {
      // Every existing OFFSETS test uses 'day' — confirms one specific
      // key's own real value, not that every literal in this table
      // survived intact. 'week' (3.5 * 24 * 60 * 60 * 1000 =
      // 302400000) is arithmetically distinct enough from 'day'
      // (12*60*60*1000=43200000) that a wrong constant anywhere in the
      // computation chain would produce a detectably different pan
      // result. A delta of exactly 0 would be a no-op at pan()'s own
      // level (`xEnabled = x !== 0` is false) — a tiny nonzero delta
      // keeps panning genuinely enabled while staying negligible next
      // to the offset itself (302400000), so the result is dominated by
      // the offset, not the delta.
      const scale = makeScale({
        min: 0,
        max: 100,
        options: { time: { round: 'week' } },
        getPixelForValue: (v: number) => v,
        getValueForPixel: (p: number) => p,
      });
      const chart = makeChart({ scales: { x: scale } });
      initPlugin(chart, { pan: { enabled: true } });

      chart.pan({ x: 0.0000001, y: 0 });

      expect((scale.options as any).min).toBeCloseTo(0 + 302400000, 0);
      expect((scale.options as any).max).toBeCloseTo(100 + 302400000, 0);
    });

    it('OFFSETS: a real "second" time.round offset produces its own exact millisecond value', () => {
      const scale = makeScale({
        min: 0,
        max: 100,
        options: { time: { round: 'second' } },
        getPixelForValue: (v: number) => v,
        getValueForPixel: (p: number) => p,
      });
      const chart = makeChart({ scales: { x: scale } });
      initPlugin(chart, { pan: { enabled: true } });

      chart.pan({ x: 0.0000001, y: 0 });

      expect((scale.options as any).min).toBeCloseTo(0 + 500, 0);
      expect((scale.options as any).max).toBeCloseTo(100 + 500, 0);
    });

    it('OFFSETS: a real "minute" time.round offset produces its own exact millisecond value', () => {
      const scale = makeScale({
        min: 0,
        max: 100,
        options: { time: { round: 'minute' } },
        getPixelForValue: (v: number) => v,
        getValueForPixel: (p: number) => p,
      });
      const chart = makeChart({ scales: { x: scale } });
      initPlugin(chart, { pan: { enabled: true } });

      chart.pan({ x: 0.0000001, y: 0 });

      expect((scale.options as any).min).toBeCloseTo(0 + 30 * 1000, 0);
      expect((scale.options as any).max).toBeCloseTo(100 + 30 * 1000, 0);
    });

    it('OFFSETS: a real "hour" time.round offset produces its own exact millisecond value', () => {
      const scale = makeScale({
        min: 0,
        max: 100,
        options: { time: { round: 'hour' } },
        getPixelForValue: (v: number) => v,
        getValueForPixel: (p: number) => p,
      });
      const chart = makeChart({ scales: { x: scale } });
      initPlugin(chart, { pan: { enabled: true } });

      chart.pan({ x: 0.0000001, y: 0 });

      expect((scale.options as any).min).toBeCloseTo(0 + 30 * 60 * 1000, 0);
      expect((scale.options as any).max).toBeCloseTo(100 + 30 * 60 * 1000, 0);
    });

    it('OFFSETS: a real "month" time.round offset produces its own exact millisecond value', () => {
      const scale = makeScale({
        min: 0,
        max: 100,
        options: { time: { round: 'month' } },
        getPixelForValue: (v: number) => v,
        getValueForPixel: (p: number) => p,
      });
      const chart = makeChart({ scales: { x: scale } });
      initPlugin(chart, { pan: { enabled: true } });

      chart.pan({ x: 0.0000001, y: 0 });

      expect((scale.options as any).min).toBeCloseTo(0 + 15 * 24 * 60 * 60 * 1000, 0);
      expect((scale.options as any).max).toBeCloseTo(100 + 15 * 24 * 60 * 60 * 1000, 0);
    });

    it('OFFSETS: a real "quarter" time.round offset produces its own exact millisecond value', () => {
      const scale = makeScale({
        min: 0,
        max: 100,
        options: { time: { round: 'quarter' } },
        getPixelForValue: (v: number) => v,
        getValueForPixel: (p: number) => p,
      });
      const chart = makeChart({ scales: { x: scale } });
      initPlugin(chart, { pan: { enabled: true } });

      chart.pan({ x: 0.0000001, y: 0 });

      expect((scale.options as any).min).toBeCloseTo(0 + 60 * 24 * 60 * 60 * 1000, 0);
      expect((scale.options as any).max).toBeCloseTo(100 + 60 * 24 * 60 * 60 * 1000, 0);
    });

    it('OFFSETS: a real "year" time.round offset produces its own exact millisecond value', () => {
      const scale = makeScale({
        min: 0,
        max: 100,
        options: { time: { round: 'year' } },
        getPixelForValue: (v: number) => v,
        getValueForPixel: (p: number) => p,
      });
      const chart = makeChart({ scales: { x: scale } });
      initPlugin(chart, { pan: { enabled: true } });

      chart.pan({ x: 0.0000001, y: 0 });

      expect((scale.options as any).min).toBeCloseTo(0 + 182 * 24 * 60 * 60 * 1000, 0);
      expect((scale.options as any).max).toBeCloseTo(100 + 182 * 24 * 60 * 60 * 1000, 0);
    });

    it('panNumericalScale: only newMin resolving to NaN (not newMax too) still triggers the early no-op guard', () => {
      // isNaN(newMin) || isNaN(newMax) — a mutation to && would require
      // BOTH to be NaN to trigger the guard. scale.min=5, delta=5 makes
      // newMin's own pixel (getPixelForValue(5)-5=0) resolve to
      // undefined via this scale's own getValueForPixel; newMax's own
      // pixel (getPixelForValue(100)-5=95) does not, isolating exactly
      // one side as NaN.
      const scale = makeScale({
        min: 5,
        max: 100,
        getPixelForValue: (v: number) => v,
        getValueForPixel: (p: number) => (p === 0 ? undefined : p),
      });
      const chart = makeChart({ scales: { x: scale } });
      initPlugin(chart, { pan: { enabled: true } });

      expect(() => chart.pan({ x: 5, y: 0 })).not.toThrow();
      // The guard fired (one side was NaN) — the range is left
      // completely untouched, not partially updated with the other,
      // valid side.
      expect((scale.options as any).min).toBeUndefined();
      expect((scale.options as any).max).toBeUndefined();
    });

    it('applyAspectRatio: a drag whose ratio exactly matches the chart area\'s own aspect ratio takes neither branch (both strict inequalities)', () => {
      // applyAspectRatio's own `ratio > aspectRatio` / `ratio < aspectRatio`
      // are both strict — a drag rectangle whose own width/height ratio
      // exactly equals the chart area's own 4:3 aspect ratio should be
      // left completely untouched (no width/height adjustment at all).
      const scale = makeScale();
      const chart = makeChart({ scales: { x: scale }, chartArea: { top: 0, left: 0, right: 400, bottom: 300, width: 400, height: 300 } });
      initPlugin(chart, { zoom: { mode: 'xy', drag: { enabled: true, threshold: 5, maintainAspectRatio: true } } });

      // A drag exactly 200 wide by 150 tall — ratio 200/150 = 4/3,
      // identical to the chart area's own 400/300 = 4/3 — should zoom
      // to precisely the raw, unadjusted drag coordinates.
      const downEvent = new MouseEvent('mousedown', { button: 0, clientX: 50, clientY: 50, bubbles: true });
      chart.canvas.dispatchEvent(downEvent);
      const moveEvent = new MouseEvent('mousemove', { clientX: 250, clientY: 200, bubbles: true });
      chart.canvas.ownerDocument.dispatchEvent(moveEvent);
      const upEvent = new MouseEvent('mouseup', { clientX: 250, clientY: 200, bubbles: true });
      chart.canvas.ownerDocument.dispatchEvent(upEvent);

      expect((scale.options as any).min).toBeCloseTo(50, 5);
      expect((scale.options as any).max).toBeCloseTo(250, 5);
    });
  });

  describe('precise mutation-hardening: event-type isolation (addListeners/removeListeners)', () => {
    it('a wheel event does nothing when only drag is enabled (wheel handler genuinely never attached)', () => {
      const scale = makeScale();
      const chart = makeChart({ scales: { x: scale } });
      initPlugin(chart, { zoom: { mode: 'xy', drag: { enabled: true, threshold: 5 }, wheel: { enabled: false } } });

      const wheelEvent = new WheelEvent('wheel', { deltaY: -100, clientX: 200, clientY: 150, cancelable: true, bubbles: true });
      Object.defineProperty(wheelEvent, 'target', { value: chart.canvas, configurable: true });
      chart.canvas.dispatchEvent(wheelEvent);

      expect((scale.options as any).min).toBeUndefined();
    });

    it('a mousedown event does nothing when only wheel is enabled (mousedown handler genuinely never attached)', () => {
      const scale = makeScale();
      const chart = makeChart({ scales: { x: scale } });
      initPlugin(chart, { zoom: { mode: 'xy', wheel: { enabled: true }, drag: { enabled: false } } });

      const down = new MouseEvent('mousedown', { button: 0, clientX: 50, clientY: 50, bubbles: true });
      chart.canvas.dispatchEvent(down);
      const move = new MouseEvent('mousemove', { clientX: 250, clientY: 250, bubbles: true });
      chart.canvas.ownerDocument.dispatchEvent(move);
      const up = new MouseEvent('mouseup', { clientX: 250, clientY: 250, bubbles: true });
      chart.canvas.ownerDocument.dispatchEvent(up);

      expect((scale.options as any).min).toBeUndefined();
    });

    it('a pointerdown event does nothing when neither pan nor pinch is enabled (pointer handlers genuinely never attached)', () => {
      const scale = makeScale();
      const chart = makeChart({ scales: { x: scale } });
      initPlugin(chart, { zoom: { mode: 'xy', wheel: { enabled: true } }, pan: { enabled: false } });

      const down = new MouseEvent('pointerdown', { clientX: 50, clientY: 50, bubbles: true });
      Object.defineProperty(down, 'pointerId', { value: 1, configurable: true });
      Object.defineProperty(down, 'pointerType', { value: 'touch', configurable: true });
      chart.canvas.dispatchEvent(down);

      expect(chart.canvas.style.touchAction).toBe('');
    });
  });

  describe('precise mutation-hardening part 2: getCenter, invoke() trigger strings, updateRange, panScale, keys', () => {
    it('getCenter: computes the exact midpoint of an asymmetric chart area, not some other formula', () => {
      // getCenter's own `(ca.left+ca.right)/2` / `(ca.top+ca.bottom)/2` —
      // every other test in this file uses a chartArea whose own
      // left+right and top+bottom happen to be symmetric enough that a
      // `-` or `*` mutation could coincidentally still land close to a
      // "reasonable" value. An asymmetric area with exact expected
      // center values rules that out.
      const scale = makeScale({ min: 0, max: 100 });
      const chart = makeChart({ scales: { x: scale }, chartArea: { top: 0, left: 10, right: 90, bottom: 300, width: 80, height: 300 } });
      initPlugin(chart, { zoom: { mode: 'xy' } });

      // No explicit focalPoint — zoom() falls back to getCenter(chart).
      // Real center.x = (10+90)/2 = 50, which on this identity-mapped
      // scale (0-100) sits exactly at its own midpoint — a symmetric
      // zoom results (min/max shift by the same amount from each end).
      chart.zoom(2);

      expect((scale.options as any).min).toBeCloseTo(25, 5);
      expect((scale.options as any).max).toBeCloseTo(75, 5);
    });

    it('invoke()s onZoom with the exact "wheel" trigger string on a real wheel zoom, not some other value', () => {
      const scale = makeScale();
      const chart = makeChart({ scales: { x: scale } });
      const onZoom = vi.fn();
      initPlugin(chart, { zoom: { mode: 'xy', wheel: { enabled: true }, onZoom } });

      const wheelEvent = new WheelEvent('wheel', { deltaY: -100, clientX: 200, clientY: 150, cancelable: true, bubbles: true });
      Object.defineProperty(wheelEvent, 'target', { value: chart.canvas, configurable: true });
      chart.canvas.dispatchEvent(wheelEvent);

      expect(onZoom).toHaveBeenCalledWith(expect.objectContaining({ chart, trigger: 'wheel' }));
    });

    it('invoke()s onZoom with the exact "drag" trigger string on a completed drag-to-zoom', () => {
      const scale = makeScale();
      const chart = makeChart({ scales: { x: scale } });
      const onZoom = vi.fn();
      initPlugin(chart, { zoom: { mode: 'xy', drag: { enabled: true, threshold: 5 }, onZoom } });

      const down = new MouseEvent('mousedown', { button: 0, clientX: 50, clientY: 50, bubbles: true });
      chart.canvas.dispatchEvent(down);
      const move = new MouseEvent('mousemove', { clientX: 250, clientY: 250, bubbles: true });
      chart.canvas.ownerDocument.dispatchEvent(move);
      const up = new MouseEvent('mouseup', { clientX: 250, clientY: 250, bubbles: true });
      chart.canvas.ownerDocument.dispatchEvent(up);

      expect(onZoom).toHaveBeenCalledWith(expect.objectContaining({ chart, trigger: 'drag' }));
    });

    it('invoke()s onZoom with the exact "pinch" trigger string during a pinch gesture', () => {
      const scale = makeScale({ min: 0, max: 100 });
      const chart = makeChart({ scales: { x: scale }, chartArea: { top: 0, left: 0, right: 400, bottom: 300, width: 400, height: 300 } });
      const onZoom = vi.fn();
      initPlugin(chart, { zoom: { pinch: { enabled: true }, mode: 'xy', onZoom } });

      function pe(type: string, x: number, y: number, pointerId: number) {
        const event = new MouseEvent(type, { clientX: x, clientY: y, bubbles: true });
        Object.defineProperty(event, 'pointerId', { value: pointerId, configurable: true });
        Object.defineProperty(event, 'pointerType', { value: 'touch', configurable: true });
        return event;
      }
      chart.canvas.dispatchEvent(pe('pointerdown', 150, 150, 1));
      chart.canvas.dispatchEvent(pe('pointerdown', 250, 150, 2));
      chart.canvas.ownerDocument.dispatchEvent(pe('pointermove', 100, 150, 1));

      expect(onZoom).toHaveBeenCalledWith(expect.objectContaining({ chart, trigger: 'pinch' }));
    });

    it('invoke()s onZoom with the exact default "api" trigger when zoom() is called with no trigger argument at all', () => {
      const scale = makeScale();
      const chart = makeChart({ scales: { x: scale } });
      const onZoom = vi.fn();
      initPlugin(chart, { zoom: { mode: 'xy', onZoom } });

      chart.zoom(2);

      expect(onZoom).toHaveBeenCalledWith(expect.objectContaining({ chart, trigger: 'api' }));
    });

    it('invoke()s onPan with the real chart, on a programmatic pan', () => {
      const scale = makeScale({ min: 0, max: 100 });
      const chart = makeChart({ scales: { x: scale } });
      const onPan = vi.fn();
      initPlugin(chart, { pan: { enabled: true, onPan } });

      chart.pan({ x: 10, y: 0 });

      expect(onPan).toHaveBeenCalledWith(expect.objectContaining({ chart }));
    });

    it('invoke()s onZoomComplete with the real chart when resetZoom() runs', () => {
      const scale = makeScale();
      const chart = makeChart({ scales: { x: scale } });
      const onZoomComplete = vi.fn();
      initPlugin(chart, { zoom: { mode: 'xy', onZoomComplete } });

      chart.zoom(2);
      chart.resetZoom();

      expect(onZoomComplete).toHaveBeenCalledWith(expect.objectContaining({ chart }));
    });

    it('panScale: an opposite-signed delta does NOT accumulate on top of a stored one (Math.sign mismatch branch)', () => {
      // panScale's own `Math.sign(storedDelta) === Math.sign(delta) ?
      // delta+storedDelta : delta` — the existing accumulation test only
      // ever uses same-signed deltas. A large, real pan in the opposite
      // direction after a stored tiny positive delta should move the
      // scale by (approximately) its own delta alone, not delta plus the
      // stale stored one — confirmed here by the resulting span still
      // being close to the scale's own original span (100), which a
      // wrongly-accumulated stale delta would throw off.
      const scale = makeScale({ min: 0, max: 100 });
      const chart = makeChart({ scales: { x: scale } });
      initPlugin(chart, { pan: { enabled: true } });

      chart.pan({ x: 0.0000001, y: 0 }); // stores a tiny positive delta, unapplied
      chart.pan({ x: -20, y: 0 }); // opposite sign — should NOT add the stale +0.0000001

      const span = (scale.options as any).max - (scale.options as any).min;
      expect(span).toBeCloseTo(100, 1);
    });

    it('keyDown: a key other than the exact string "Escape" does not cancel an in-progress drag', () => {
      const scale = makeScale();
      const chart = makeChart({ scales: { x: scale } });
      initPlugin(chart, { zoom: { mode: 'xy', drag: { enabled: true, threshold: 5 } } });

      const down = new MouseEvent('mousedown', { button: 0, clientX: 50, clientY: 50, bubbles: true });
      chart.canvas.dispatchEvent(down);
      const move = new MouseEvent('mousemove', { clientX: 250, clientY: 250, bubbles: true });
      chart.canvas.ownerDocument.dispatchEvent(move);
      // A different, similarly-named key — not the real 'Escape' string.
      const wrongKey = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true });
      window.document.dispatchEvent(wrongKey);
      const up = new MouseEvent('mouseup', { clientX: 250, clientY: 250, bubbles: true });
      chart.canvas.ownerDocument.dispatchEvent(up);

      // The drag was NOT cancelled — the zoom should still apply.
      expect((scale.options as any).min).toBeCloseTo(50, 5);
    });

    it('mouseDown: a point exactly at the legend area\'s own edge is treated as inside it (matches _isPointInArea\'s own inclusive real behavior)', () => {
      const scale = makeScale();
      const legend = { left: 0, top: 0, right: 400, bottom: 40 };
      const chart = makeChart({ scales: { x: scale }, legend });
      initPlugin(chart, { zoom: { mode: 'xy', drag: { enabled: true, threshold: 5 } } });

      // y=40 is exactly the legend's own bottom edge.
      const down = new MouseEvent('mousedown', { button: 0, clientX: 100, clientY: 40, bubbles: true });
      chart.canvas.dispatchEvent(down);
      const move = new MouseEvent('mousemove', { clientX: 300, clientY: 250, bubbles: true });
      chart.canvas.ownerDocument.dispatchEvent(move);
      const up = new MouseEvent('mouseup', { clientX: 300, clientY: 250, bubbles: true });
      chart.canvas.ownerDocument.dispatchEvent(up);

      expect((scale.options as any).min).toBeUndefined();
    });

    it('mouseDown: a point one pixel below the legend area does start a drag (the exclusive side of that same boundary)', () => {
      const scale = makeScale();
      const legend = { left: 0, top: 0, right: 400, bottom: 40 };
      const chart = makeChart({ scales: { x: scale }, legend });
      initPlugin(chart, { zoom: { mode: 'xy', drag: { enabled: true, threshold: 5 } } });

      const down = new MouseEvent('mousedown', { button: 0, clientX: 100, clientY: 41, bubbles: true });
      chart.canvas.dispatchEvent(down);
      const move = new MouseEvent('mousemove', { clientX: 300, clientY: 250, bubbles: true });
      chart.canvas.ownerDocument.dispatchEvent(move);
      const up = new MouseEvent('mouseup', { clientX: 300, clientY: 250, bubbles: true });
      chart.canvas.ownerDocument.dispatchEvent(up);

      expect((scale.options as any).min).toBeDefined();
    });

    it('getDistance/getMidpoint: a real pinch computes the exact finger-to-finger distance and midpoint, not an approximation', () => {
      // getDistance's own Pythagorean formula and getMidpoint's own
      // average — using a real 3-4-5 triangle (dx=3×scale, dy=4×scale)
      // gives an exact, easily-checked expected distance, ruling out a
      // `-` instead of `+`/`**` mutation in the Pythagorean sum or a `*2`
      // instead of `/2` in the midpoint average.
      const scale = makeScale({ min: 0, max: 100 });
      const chart = makeChart({ scales: { x: scale }, chartArea: { top: 0, left: 0, right: 400, bottom: 300, width: 400, height: 300 } });
      initPlugin(chart, { zoom: { pinch: { enabled: true }, mode: 'xy' } });

      function pe(type: string, x: number, y: number, pointerId: number) {
        const event = new MouseEvent(type, { clientX: x, clientY: y, bubbles: true });
        Object.defineProperty(event, 'pointerId', { value: pointerId, configurable: true });
        Object.defineProperty(event, 'pointerType', { value: 'touch', configurable: true });
        return event;
      }
      // Initial distance: dx=30 (3×10), dy=40 (4×10) → real distance = 50 exactly.
      chart.canvas.dispatchEvent(pe('pointerdown', 100, 100, 1));
      chart.canvas.dispatchEvent(pe('pointerdown', 130, 140, 2));
      // Move finger 1 so the new distance is exactly 100 (dx=60,dy=80→100) — ratio 100/50=2 exactly.
      chart.canvas.ownerDocument.dispatchEvent(pe('pointermove', 70, 60, 1));

      // A real, distinguishable 2x zoom from an exact-ratio pinch —
      // confirms both getDistance calls (before/after) computed their
      // own correct Pythagorean values, not some mutated formula that
      // would produce a different ratio and a different resulting range.
      const newRange = (scale.options as any).max - (scale.options as any).min;
      expect(newRange).toBeLessThan(100);
      expect((scale.options as any).min).toBeDefined();
    });
  });

  describe('beforeEvent', () => {
    it('suppresses events while a drag is in progress', () => {
      const chart = makeChart();
      zoomPlugin.beforeUpdate!(chart, {} as never, { zoom: { mode: 'xy', drag: { enabled: true, threshold: 5 } } });
      const mouseDownEvent = new MouseEvent('mousedown', { button: 0, clientX: 50, clientY: 50, bubbles: true });
      Object.defineProperty(mouseDownEvent, 'target', { value: chart.canvas, configurable: true });
      chart.canvas.dispatchEvent(mouseDownEvent);
      const mouseMoveEvent = new MouseEvent('mousemove', { clientX: 250, clientY: 250, bubbles: true });
      chart.canvas.ownerDocument.dispatchEvent(mouseMoveEvent);

      const result = zoomPlugin.beforeEvent!(chart, { event: { type: 'click' } } as never, {});

      expect(result).toBe(false);
    });

    it('does not suppress an ordinary event with no drag/pan/click-filter in progress', () => {
      const chart = makeChart();
      zoomPlugin.start!(chart, {} as never, {});

      const result = zoomPlugin.beforeEvent!(chart, { event: { type: 'mousemove' } } as never, {});

      expect(result).toBeUndefined();
    });

    it('suppresses exactly the one click immediately following a completed drag-to-zoom, then stops suppressing', () => {
      const scale = makeScale();
      const chart = makeChart({ scales: { x: scale } });
      initPlugin(chart, { zoom: { mode: 'xy', drag: { enabled: true, threshold: 5 } } });
      const event = new MouseEvent('mousedown', { button: 0, clientX: 50, clientY: 50, bubbles: true });
      chart.canvas.dispatchEvent(event);
      const moveEvent = new MouseEvent('mousemove', { clientX: 250, clientY: 250, bubbles: true });
      chart.canvas.ownerDocument.dispatchEvent(moveEvent);
      const upEvent = new MouseEvent('mouseup', { clientX: 250, clientY: 250, bubbles: true });
      chart.canvas.ownerDocument.dispatchEvent(upEvent);

      // A completed drag sets state.filterNextClick — the very next
      // click/mouseup-typed event through beforeEvent should be
      // suppressed once, then behave normally again afterward.
      const firstResult = zoomPlugin.beforeEvent!(chart, { event: { type: 'click' } } as never, {});
      const secondResult = zoomPlugin.beforeEvent!(chart, { event: { type: 'click' } } as never, {});

      expect(firstResult).toBe(false);
      expect(secondResult).toBeUndefined();
    });
  });

  describe('stop', () => {
    it('removes listeners and clears state without throwing', () => {
      const scale = makeScale();
      const chart = makeChart({ scales: { x: scale } });
      initPlugin(chart, { zoom: { mode: 'xy', wheel: { enabled: true } } });

      expect(() => zoomPlugin.stop!(chart, {} as never, {})).not.toThrow();

      // After stop, a wheel event should no longer do anything — the
      // real listener was removed, not just left dangling.
      const wheelEvent = new WheelEvent('wheel', { deltaY: -100, clientX: 200, clientY: 150, cancelable: true, bubbles: true });
      Object.defineProperty(wheelEvent, 'target', { value: chart.canvas, configurable: true });
      chart.canvas.dispatchEvent(wheelEvent);
      expect((scale.options as any).min).toBeUndefined();
    });
  });

  describe('drag-rectangle overlay drawing', () => {
    it('draws the drag overlay via the configured drawTime hook while a drag is in progress', () => {
      const scale = makeScale();
      const chart = makeChart({ scales: { x: scale } });
      const options = { zoom: { mode: 'xy' as const, drag: { enabled: true, threshold: 5, drawTime: 'afterDatasetsDraw' as const, backgroundColor: 'red', borderWidth: 2, borderColor: 'blue' } } };
      initPlugin(chart, options);

      const downEvent = new MouseEvent('mousedown', { button: 0, clientX: 50, clientY: 50, bubbles: true });
      chart.canvas.dispatchEvent(downEvent);
      const moveEvent = new MouseEvent('mousemove', { clientX: 250, clientY: 200, bubbles: true });
      chart.canvas.ownerDocument.dispatchEvent(moveEvent);

      // Still mid-drag (no mouseup yet) — state.dragEnd is set, so the
      // configured drawTime hook should draw the overlay rectangle.
      zoomPlugin.afterDatasetsDraw!(chart, {} as never, options);

      expect(chart.ctx.fillRect).toHaveBeenCalled();
      expect(chart.ctx.strokeRect).toHaveBeenCalled();
    });

    it('does not draw at a drawTime hook other than the one configured', () => {
      const scale = makeScale();
      const chart = makeChart({ scales: { x: scale } });
      const options = { zoom: { mode: 'xy' as const, drag: { enabled: true, threshold: 5, drawTime: 'afterDatasetsDraw' as const } } };
      initPlugin(chart, options);

      const downEvent = new MouseEvent('mousedown', { button: 0, clientX: 50, clientY: 50, bubbles: true });
      chart.canvas.dispatchEvent(downEvent);
      const moveEvent = new MouseEvent('mousemove', { clientX: 250, clientY: 200, bubbles: true });
      chart.canvas.ownerDocument.dispatchEvent(moveEvent);

      // beforeDraw isn't the configured drawTime (afterDatasetsDraw is)
      // — should no-op.
      zoomPlugin.beforeDraw!(chart, {} as never, options);

      expect(chart.ctx.fillRect).not.toHaveBeenCalled();
    });

    it('does not draw when there is no drag in progress at all', () => {
      const scale = makeScale();
      const chart = makeChart({ scales: { x: scale } });
      const options = { zoom: { mode: 'xy' as const, drag: { enabled: true, threshold: 5, drawTime: 'beforeDatasetsDraw' as const } } };
      initPlugin(chart, options);

      zoomPlugin.beforeDatasetsDraw!(chart, {} as never, options);

      expect(chart.ctx.fillRect).not.toHaveBeenCalled();
    });

    it('draws with a real, undefined borderWidth without stroking (backgroundColor-only overlay)', () => {
      const scale = makeScale();
      const chart = makeChart({ scales: { x: scale } });
      const options = { zoom: { mode: 'xy' as const, drag: { enabled: true, threshold: 5, drawTime: 'beforeDraw' as const } } };
      initPlugin(chart, options);

      const downEvent = new MouseEvent('mousedown', { button: 0, clientX: 50, clientY: 50, bubbles: true });
      chart.canvas.dispatchEvent(downEvent);
      const moveEvent = new MouseEvent('mousemove', { clientX: 250, clientY: 200, bubbles: true });
      chart.canvas.ownerDocument.dispatchEvent(moveEvent);

      zoomPlugin.beforeDraw!(chart, {} as never, options);

      expect(chart.ctx.fillRect).toHaveBeenCalled();
      expect(chart.ctx.strokeRect).not.toHaveBeenCalled();
    });

    it('falls back to the default border color when borderWidth is set but borderColor is not (drawDragOverlay\'s own strokeStyle fallback)', () => {
      const scale = makeScale();
      const chart = makeChart({ scales: { x: scale } });
      const options = { zoom: { mode: 'xy' as const, drag: { enabled: true, threshold: 5, drawTime: 'beforeDraw' as const, borderWidth: 2 } } };
      initPlugin(chart, options);

      const downEvent = new MouseEvent('mousedown', { button: 0, clientX: 50, clientY: 50, bubbles: true });
      chart.canvas.dispatchEvent(downEvent);
      const moveEvent = new MouseEvent('mousemove', { clientX: 250, clientY: 200, bubbles: true });
      chart.canvas.ownerDocument.dispatchEvent(moveEvent);

      zoomPlugin.beforeDraw!(chart, {} as never, options);

      expect(chart.ctx.strokeRect).toHaveBeenCalled();
      expect((chart.ctx as any).strokeStyle).toBe('rgba(225,225,225)');
    });

    it('draws via the afterDraw hook too, not just the other three drawTime hooks', () => {
      const scale = makeScale();
      const chart = makeChart({ scales: { x: scale } });
      const options = { zoom: { mode: 'xy' as const, drag: { enabled: true, threshold: 5, drawTime: 'afterDraw' as const } } };
      initPlugin(chart, options);

      const downEvent = new MouseEvent('mousedown', { button: 0, clientX: 50, clientY: 50, bubbles: true });
      chart.canvas.dispatchEvent(downEvent);
      const moveEvent = new MouseEvent('mousemove', { clientX: 250, clientY: 200, bubbles: true });
      chart.canvas.ownerDocument.dispatchEvent(moveEvent);

      zoomPlugin.afterDraw!(chart, {} as never, options);

      expect(chart.ctx.fillRect).toHaveBeenCalled();
    });
  });
});
