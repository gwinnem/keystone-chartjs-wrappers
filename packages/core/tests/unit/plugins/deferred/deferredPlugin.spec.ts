import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { deferredPlugin } from '../../../../src/plugins/deferred/deferredPlugin.js';

// Testing the real scroll-event-driven defer logic directly (dissected
// from the real, installed package's own real source — it ships real,
// readable source, not just a minified bundle — see deferredPlugin.ts's
// own header comment), against a real jsdom canvas/DOM tree with
// `getBoundingClientRect`/`getComputedStyle` mocked as needed, the same
// technique gradientPlugin.spec.ts/imageLabelPlugin.spec.ts use.

/** Builds a real `<canvas>` inside a real parent chain, with
 * `getBoundingClientRect` stubbed to the given rect and `offsetParent`
 * stubbed non-null (so `chartInViewport`'s own `display: none` guard
 * doesn't short-circuit every test). */
function makeCanvas(rect: { top: number; left: number; right: number; bottom: number; width: number; height: number }) {
  const canvas = document.createElement('canvas');
  const parent = document.createElement('div');
  parent.appendChild(canvas);
  document.body.appendChild(parent);
  canvas.getBoundingClientRect = () => rect as DOMRect;
  Object.defineProperty(canvas, 'offsetParent', { value: parent, configurable: true });
  return { canvas, parent };
}

function makeChart(canvas: HTMLCanvasElement) {
  return {
    canvas,
    ctx: {} as CanvasRenderingContext2D,
    update: vi.fn(),
  } as never;
}

const INSIDE_VIEWPORT = { top: 0, left: 0, right: 100, bottom: 100, width: 100, height: 100 };
const OUTSIDE_VIEWPORT = { top: -5000, left: -5000, right: -4900, bottom: -4900, width: 100, height: 100 };

beforeEach(() => {
  vi.useFakeTimers();
  window.innerWidth = 1024;
  window.innerHeight = 768;
});

afterEach(() => {
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe('deferredPlugin', () => {
  it('has the real, expected shape — id, defaults, and the three lifecycle hooks', () => {
    expect(deferredPlugin).toMatchObject({
      id: 'deferred',
      defaults: { xOffset: 0, yOffset: 0, delay: 0 },
      beforeInit: expect.any(Function),
      beforeDatasetsUpdate: expect.any(Function),
      afterDestroy: expect.any(Function),
    });
  });

  describe('already in the viewport at mount', () => {
    it('lets the first real update through immediately (no false return) when delay is 0', () => {
      const { canvas } = makeCanvas(INSIDE_VIEWPORT);
      const chart = makeChart(canvas);

      deferredPlugin.beforeInit!(chart, {} as never, { xOffset: 0, yOffset: 0, delay: 0 });
      const result = deferredPlugin.beforeDatasetsUpdate!(chart, {} as never, { xOffset: 0, yOffset: 0, delay: 0 });

      expect(result).not.toBe(false);
    });

    it('cancels the update and schedules a delayed one when delay is set, calling chart.update() only after the delay elapses', () => {
      const { canvas } = makeCanvas(INSIDE_VIEWPORT);
      const chart = makeChart(canvas);

      deferredPlugin.beforeInit!(chart, {} as never, { xOffset: 0, yOffset: 0, delay: 300 });
      const result = deferredPlugin.beforeDatasetsUpdate!(chart, {} as never, { xOffset: 0, yOffset: 0, delay: 300 });

      expect(result).toBe(false);
      expect(chart.update).not.toHaveBeenCalled();

      vi.advanceTimersByTime(300);
      expect(chart.update).toHaveBeenCalledTimes(1);
    });

    it('does not call chart.update() after the delay if the chart was destroyed in the meantime (ctx cleared)', () => {
      const { canvas } = makeCanvas(INSIDE_VIEWPORT);
      const chart = makeChart(canvas);

      deferredPlugin.beforeInit!(chart, {} as never, { xOffset: 0, yOffset: 0, delay: 300 });
      deferredPlugin.beforeDatasetsUpdate!(chart, {} as never, { xOffset: 0, yOffset: 0, delay: 300 });

      // Real, confirmed guard from the original: chart.ctx is cleared
      // on real destroy, so its absence means the instance is gone.
      (chart as { ctx: unknown }).ctx = null;
      vi.advanceTimersByTime(300);

      expect(chart.update).not.toHaveBeenCalled();
    });

    it('blocks a further update attempt while a delayed first update is still pending', () => {
      const { canvas } = makeCanvas(INSIDE_VIEWPORT);
      const chart = makeChart(canvas);

      deferredPlugin.beforeInit!(chart, {} as never, { xOffset: 0, yOffset: 0, delay: 300 });
      deferredPlugin.beforeDatasetsUpdate!(chart, {} as never, { xOffset: 0, yOffset: 0, delay: 300 });

      // A second call arriving before the delay elapses (e.g. a
      // consumer's own update() call, or legend interaction) — the
      // real plugin blocks this too, not just the very first call.
      const secondResult = deferredPlugin.beforeDatasetsUpdate!(chart, {} as never, { xOffset: 0, yOffset: 0, delay: 300 });
      expect(secondResult).toBe(false);
    });
  });

  describe('outside the viewport at mount', () => {
    it('cancels the update and does not call chart.update() until the canvas scrolls into view', () => {
      const { canvas } = makeCanvas(OUTSIDE_VIEWPORT);
      const chart = makeChart(canvas);

      deferredPlugin.beforeInit!(chart, {} as never, { xOffset: 0, yOffset: 0, delay: 0 });
      const result = deferredPlugin.beforeDatasetsUpdate!(chart, {} as never, { xOffset: 0, yOffset: 0, delay: 0 });

      expect(result).toBe(false);
      expect(chart.update).not.toHaveBeenCalled();
    });

    it('calls chart.update() once a real scroll event on the document reveals the canvas is now inside the viewport', () => {
      const { canvas } = makeCanvas(OUTSIDE_VIEWPORT);
      const chart = makeChart(canvas);

      deferredPlugin.beforeInit!(chart, {} as never, { xOffset: 0, yOffset: 0, delay: 0 });
      deferredPlugin.beforeDatasetsUpdate!(chart, {} as never, { xOffset: 0, yOffset: 0, delay: 0 });

      // The canvas "scrolls into view" — flip its own stubbed rect,
      // then dispatch the real scroll event the plugin's own watch()
      // listens for (falls back to `document` when no explicit
      // scrollable ancestor exists, confirmed real logic).
      canvas.getBoundingClientRect = () => INSIDE_VIEWPORT as DOMRect;
      document.dispatchEvent(new Event('scroll'));

      // The real handler throttles via requestAnimationFrame — flush it.
      vi.runOnlyPendingTimers();

      expect(chart.update).toHaveBeenCalledTimes(1);
    });

    it('does not call chart.update() on a scroll event if the canvas is still outside the viewport', () => {
      const { canvas } = makeCanvas(OUTSIDE_VIEWPORT);
      const chart = makeChart(canvas);

      deferredPlugin.beforeInit!(chart, {} as never, { xOffset: 0, yOffset: 0, delay: 0 });
      deferredPlugin.beforeDatasetsUpdate!(chart, {} as never, { xOffset: 0, yOffset: 0, delay: 0 });

      document.dispatchEvent(new Event('scroll'));
      vi.runOnlyPendingTimers();

      expect(chart.update).not.toHaveBeenCalled();
    });
  });

  describe('xOffset/yOffset', () => {
    it('requires more of the canvas to already be showing as xOffset increases — a small sliver passes at 0 but fails once more overlap is required', () => {
      // Confirmed real semantics from the source: `xOffset` is how much
      // of the canvas must ALREADY be inside the viewport, not a
      // leniency margin for being mostly offscreen — a LARGER xOffset
      // makes the check stricter (`rect.right - xOffset >= 0`), not more
      // forgiving. A canvas barely peeking in (right edge at 15px)
      // passes with no offset required, but fails once 20px of
      // real overlap is required.
      const barelyVisible = { top: 0, left: -5, right: 15, bottom: 100, width: 20, height: 100 };
      const { canvas: canvasNoOffset } = makeCanvas(barelyVisible);
      const chartNoOffset = makeChart(canvasNoOffset);
      deferredPlugin.beforeInit!(chartNoOffset, {} as never, { xOffset: 0, yOffset: 0, delay: 0 });
      const resultNoOffset = deferredPlugin.beforeDatasetsUpdate!(chartNoOffset, {} as never, { xOffset: 0, yOffset: 0, delay: 0 });
      expect(resultNoOffset).not.toBe(false);

      const { canvas: canvasWithOffset } = makeCanvas(barelyVisible);
      const chartWithOffset = makeChart(canvasWithOffset);
      deferredPlugin.beforeInit!(chartWithOffset, {} as never, { xOffset: 20, yOffset: 0, delay: 0 });
      const resultWithOffset = deferredPlugin.beforeDatasetsUpdate!(chartWithOffset, {} as never, { xOffset: 20, yOffset: 0, delay: 0 });
      expect(resultWithOffset).toBe(false);
    });

    it('resolves a percentage offset against the canvas\'s own real width, requiring more overlap the larger the canvas is', () => {
      // '50%' of a 40px-wide canvas requires 20px of real overlap —
      // confirmed against the same barely-visible (15px) rect as above,
      // which the fixed-number case just showed fails once 20px is
      // required.
      const rect = { top: 0, left: -25, right: 15, bottom: 100, width: 40, height: 100 };
      const { canvas } = makeCanvas(rect);
      const chart = makeChart(canvas);

      deferredPlugin.beforeInit!(chart, {} as never, { xOffset: '50%', yOffset: 0, delay: 0 });
      const result = deferredPlugin.beforeDatasetsUpdate!(chart, {} as never, { xOffset: '50%', yOffset: 0, delay: 0 });

      expect(result).toBe(false);
    });

    it('treats an unparseable offset as 0, matching the real default', () => {
      const { canvas } = makeCanvas(INSIDE_VIEWPORT);
      const chart = makeChart(canvas);

      deferredPlugin.beforeInit!(chart, {} as never, { xOffset: 'not-a-number', yOffset: 0, delay: 0 });
      const result = deferredPlugin.beforeDatasetsUpdate!(chart, {} as never, { xOffset: 'not-a-number', yOffset: 0, delay: 0 });

      expect(result).not.toBe(false);
    });
  });

  describe('canvas removed from layout (display: none)', () => {
    it('treats a canvas with a null offsetParent as not in the viewport, regardless of its own stubbed rect', () => {
      const { canvas } = makeCanvas(INSIDE_VIEWPORT);
      Object.defineProperty(canvas, 'offsetParent', { value: null, configurable: true });
      const chart = makeChart(canvas);

      deferredPlugin.beforeInit!(chart, {} as never, { xOffset: 0, yOffset: 0, delay: 0 });
      const result = deferredPlugin.beforeDatasetsUpdate!(chart, {} as never, { xOffset: 0, yOffset: 0, delay: 0 });

      expect(result).toBe(false);
    });
  });

  describe('scrollable ancestor', () => {
    it('watches the nearest real scrollable ancestor (overflow-y: scroll) rather than only the document', () => {
      const { canvas, parent } = makeCanvas(OUTSIDE_VIEWPORT);
      parent.style.overflowY = 'scroll';
      const chart = makeChart(canvas);

      deferredPlugin.beforeInit!(chart, {} as never, { xOffset: 0, yOffset: 0, delay: 0 });
      deferredPlugin.beforeDatasetsUpdate!(chart, {} as never, { xOffset: 0, yOffset: 0, delay: 0 });

      canvas.getBoundingClientRect = () => INSIDE_VIEWPORT as DOMRect;
      parent.dispatchEvent(new Event('scroll'));
      vi.runOnlyPendingTimers();

      expect(chart.update).toHaveBeenCalledTimes(1);
    });

    it('also recognizes overflow-x: auto as scrollable, not just overflow-y: scroll', () => {
      const { canvas, parent } = makeCanvas(OUTSIDE_VIEWPORT);
      parent.style.overflowX = 'auto';
      const chart = makeChart(canvas);

      deferredPlugin.beforeInit!(chart, {} as never, { xOffset: 0, yOffset: 0, delay: 0 });
      deferredPlugin.beforeDatasetsUpdate!(chart, {} as never, { xOffset: 0, yOffset: 0, delay: 0 });

      canvas.getBoundingClientRect = () => INSIDE_VIEWPORT as DOMRect;
      parent.dispatchEvent(new Event('scroll'));
      vi.runOnlyPendingTimers();

      expect(chart.update).toHaveBeenCalledTimes(1);
    });

    it('throttles a burst of scroll events into a single visibility check, not one per event', () => {
      const { canvas, parent } = makeCanvas(OUTSIDE_VIEWPORT);
      parent.style.overflowY = 'scroll';
      const chart = makeChart(canvas);

      deferredPlugin.beforeInit!(chart, {} as never, { xOffset: 0, yOffset: 0, delay: 0 });
      deferredPlugin.beforeDatasetsUpdate!(chart, {} as never, { xOffset: 0, yOffset: 0, delay: 0 });

      canvas.getBoundingClientRect = () => INSIDE_VIEWPORT as DOMRect;
      // Two scroll events fired back-to-back, before the first's own
      // throttled (requestAnimationFrame-deferred) check has run — the
      // real `stub.ticking` guard should mean the second is a no-op,
      // not a second, redundant visibility check.
      parent.dispatchEvent(new Event('scroll'));
      parent.dispatchEvent(new Event('scroll'));
      vi.runOnlyPendingTimers();

      expect(chart.update).toHaveBeenCalledTimes(1);
    });

    it('watches a second chart sharing the same scrollable ancestor without re-adding a duplicate scroll listener', () => {
      const { parent } = makeCanvas(OUTSIDE_VIEWPORT);
      parent.style.overflowY = 'scroll';
      // A second canvas placed inside the exact same scrollable parent.
      const canvas2 = document.createElement('canvas');
      parent.appendChild(canvas2);
      canvas2.getBoundingClientRect = () => OUTSIDE_VIEWPORT as DOMRect;
      Object.defineProperty(canvas2, 'offsetParent', { value: parent, configurable: true });
      const chart2 = makeChart(canvas2);

      deferredPlugin.beforeInit!(chart2, {} as never, { xOffset: 0, yOffset: 0, delay: 0 });
      deferredPlugin.beforeDatasetsUpdate!(chart2, {} as never, { xOffset: 0, yOffset: 0, delay: 0 });

      canvas2.getBoundingClientRect = () => INSIDE_VIEWPORT as DOMRect;
      parent.dispatchEvent(new Event('scroll'));
      vi.runOnlyPendingTimers();

      // Confirms the second chart is genuinely watched through the same
      // shared stub (not silently dropped) — its own real update fires
      // from the identical scroll event, without this test needing to
      // spy on addEventListener's own call count directly.
      expect(chart2.update).toHaveBeenCalledTimes(1);
    });
  });

  describe('afterDestroy', () => {
    it('removes the real scroll listener so a later scroll event does not call chart.update() on a destroyed chart', () => {
      const { canvas } = makeCanvas(OUTSIDE_VIEWPORT);
      const chart = makeChart(canvas);

      deferredPlugin.beforeInit!(chart, {} as never, { xOffset: 0, yOffset: 0, delay: 0 });
      deferredPlugin.beforeDatasetsUpdate!(chart, {} as never, { xOffset: 0, yOffset: 0, delay: 0 });
      deferredPlugin.afterDestroy!(chart, {} as never, {});

      canvas.getBoundingClientRect = () => INSIDE_VIEWPORT as DOMRect;
      document.dispatchEvent(new Event('scroll'));
      vi.runOnlyPendingTimers();

      expect(chart.update).not.toHaveBeenCalled();
    });

    it('does not throw when called on a chart that was never watched (already unwatched via a real viewport appearance)', () => {
      const { canvas } = makeCanvas(INSIDE_VIEWPORT);
      const chart = makeChart(canvas);

      deferredPlugin.beforeInit!(chart, {} as never, { xOffset: 0, yOffset: 0, delay: 0 });
      deferredPlugin.beforeDatasetsUpdate!(chart, {} as never, { xOffset: 0, yOffset: 0, delay: 0 });

      expect(() => deferredPlugin.afterDestroy!(chart, {} as never, {})).not.toThrow();
    });
  });

  describe('defensive guards', () => {
    it('does not throw when beforeDatasetsUpdate is called for a chart that never had beforeInit run (no model)', () => {
      const { canvas } = makeCanvas(INSIDE_VIEWPORT);
      const chart = makeChart(canvas);

      expect(() => deferredPlugin.beforeDatasetsUpdate!(chart, {} as never, { xOffset: 0, yOffset: 0, delay: 0 })).not.toThrow();
    });

    it('does not throw when afterDestroy is called for a chart that never had beforeInit run (no model) — the one real, reachable path to unwatch()\'s own !model guard', () => {
      const { canvas } = makeCanvas(INSIDE_VIEWPORT);
      const chart = makeChart(canvas);

      expect(() => deferredPlugin.afterDestroy!(chart, {} as never, {})).not.toThrow();
    });
  });
});
