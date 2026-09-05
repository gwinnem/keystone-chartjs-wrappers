// @ts-nocheck
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ArcElement } from 'chart.js';
import { imageLabelPlugin } from '../../src/imageLabelPlugin.js';

// Testing the real drawing logic directly (dissected from the real
// package's own dist file, see imageLabelPlugin.ts's own header comment
// for the full rationale) via a fully mocked `chart`/`ctx`, since jsdom
// has no real 2D canvas context (confirmed in this package's own
// vitest.config.ts header comment) — the same reason controller.spec.ts
// doesn't render a real chart either.
//
// Also stubs the global `Image` constructor: jsdom's own real
// `HTMLImageElement` never actually fetches/decodes anything, so
// `onload` never fires on its own no matter how long a test waits.
// The stub below defers `onload` by one microtask after `src` is set,
// simulating an instant, successful load — NOT synchronously: a first
// attempt fired `onload` synchronously inside the `src` setter, which
// is actually wrong and broke every test that needed a real draw,
// confirmed via a real run ("expected 'spy' to be called N times, but
// got 0"). The real plugin code (matching the original) sets `src`
// BEFORE assigning `onload` (`image.src = imageUrl; image.onload = ()
// => {...};`), so a synchronous fire-on-set calls a still-null
// `onload` — real browsers never fire `load` synchronously either, so
// deferring by a microtask is both more correct and what makes these
// tests pass.
let originalImage: typeof Image;

beforeEach(() => {
  originalImage = globalThis.Image;
  class FakeImage {
    onload: (() => void) | null = null;
    private _src = '';
    get src() {
      return this._src;
    }
    set src(value: string) {
      this._src = value;
      queueMicrotask(() => this.onload?.());
    }
  }
  vi.stubGlobal('Image', FakeImage);
});

afterEach(() => {
  vi.stubGlobal('Image', originalImage);
});

/** Flushes the microtask queue so a pending FakeImage's deferred
 * `onload` (and thus the real draw call it triggers) has run before
 * assertions check the draw calls it makes. */
async function flushImageLoad(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

function makeArc(overrides: Partial<{ startAngle: number; endAngle: number; innerRadius: number; outerRadius: number; x: number; y: number }> = {}) {
  const { startAngle = 0, endAngle = Math.PI, innerRadius = 0, outerRadius = 100, x = 50, y = 50 } = overrides;
  // imageLabelPlugin.ts's own afterDraw uses a real `instanceof ArcElement`
  // check (not a blind cast) to confirm each arc's own geometry is safe to
  // read — a plain object literal would fail that check and be silently
  // skipped. Object.setPrototypeOf makes this lightweight mock a real
  // ArcElement as far as `instanceof` is concerned, without needing to
  // construct one through Chart.js's own real (and much heavier)
  // constructor.
  return Object.setPrototypeOf(
    {
      startAngle,
      endAngle,
      innerRadius,
      outerRadius,
      getCenterPoint: () => ({ x, y }),
    },
    ArcElement.prototype,
  );
}

function makeCtx() {
  return {
    save: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    clip: vi.fn(),
    drawImage: vi.fn(),
    closePath: vi.fn(),
    restore: vi.fn(),
  };
}

describe('imageLabelPlugin', () => {
  it('has the real, expected shape — id and an afterDraw hook', () => {
    expect(imageLabelPlugin).toMatchObject({ id: 'imageLabel', afterDraw: expect.any(Function) });
  });

  it('skips a dataset whose meta.type is neither doughnut nor pie', () => {
    const ctx = makeCtx();
    const chart = {
      ctx,
      data: { datasets: [{}] },
      getDatasetMeta: () => ({ type: 'bar', data: [makeArc()] }),
    };

    imageLabelPlugin.afterDraw(chart as never, {}, { imagesList: [{ imageUrl: 'a.png', imageWidth: 10, imageHeight: 10 }] });

    expect(ctx.arc).not.toHaveBeenCalled();
  });

  it('fix #1: draws labels for every dataset, not just the first — the original\'s own confirmed bug', async () => {
    const metas = [
      { type: 'doughnut', data: [makeArc({ x: 1, y: 1 })] },
      { type: 'doughnut', data: [makeArc({ x: 2, y: 2 })] },
    ];
    const ctx = makeCtx();
    const chart = {
      ctx,
      data: { datasets: [{}, {}] },
      getDatasetMeta: (i: number) => metas[i],
    };

    imageLabelPlugin.afterDraw(
      chart as never,
      {},
      { imagesList: [{ imageUrl: `multi-${Math.random()}.png`, imageWidth: 10, imageHeight: 10 }] },
    );
    await flushImageLoad();

    // Both datasets' own arcs got a clip-circle drawn at their own
    // distinct center points (1,1) and (2,2) — confirming dataset index 1
    // was reached at all, which the original's own datasets[0]-only logic
    // never did.
    expect(ctx.arc).toHaveBeenCalledTimes(2);
    expect(ctx.arc.mock.calls[0][0]).toBeCloseTo(1, 5);
    expect(ctx.arc.mock.calls[1][0]).toBeCloseTo(2, 5);
  });

  it('fix #2: positions using the arc\'s own real, already-computed geometry, not recomputed slice angles', async () => {
    // A distinctive, non-default startAngle/endAngle/radius combination —
    // if this were still recomputed from raw data values (the original's
    // own bug), it would always start at -π/2 regardless of what's set
    // here, and this test would fail.
    const arc = makeArc({ startAngle: Math.PI / 4, endAngle: Math.PI / 2, innerRadius: 20, outerRadius: 40, x: 123, y: 456 });
    const ctx = makeCtx();
    const chart = {
      ctx,
      data: { datasets: [{}] },
      getDatasetMeta: () => ({ type: 'doughnut', data: [arc] }),
    };

    const midAngle = (arc.startAngle + arc.endAngle) / 2;
    // verticalAlign defaults to 'middle': distanceFromCenter = innerRadius
    // + (outerRadius - innerRadius) / 2
    const distanceFromCenter = arc.innerRadius + (arc.outerRadius - arc.innerRadius) / 2;
    const expectedX = arc.getCenterPoint().x + distanceFromCenter * Math.cos(midAngle);
    const expectedY = arc.getCenterPoint().y + distanceFromCenter * Math.sin(midAngle);

    imageLabelPlugin.afterDraw(
      chart as never,
      {},
      { imagesList: [{ imageUrl: `geom-${Math.random()}.png`, imageWidth: 10, imageHeight: 10 }] },
    );
    await flushImageLoad();

    expect(ctx.arc).toHaveBeenCalledTimes(1);
    const [calledX, calledY] = ctx.arc.mock.calls[0];
    expect(calledX).toBeCloseTo(expectedX, 5);
    expect(calledY).toBeCloseTo(expectedY, 5);
  });

  it('skips an imagesList entry with no imageUrl, and an index beyond the list', () => {
    const ctx = makeCtx();
    const chart = {
      ctx,
      data: { datasets: [{}] },
      getDatasetMeta: () => ({ type: 'doughnut', data: [makeArc(), makeArc(), makeArc()] }),
    };

    imageLabelPlugin.afterDraw(chart as never, {}, { imagesList: [{ imageUrl: '', imageWidth: 10, imageHeight: 10 }] });

    expect(ctx.arc).not.toHaveBeenCalled();
  });

  it('caches a loaded image by URL — a second draw of the same URL draws immediately from cache', async () => {
    const url = `unique-${Math.random()}.png`;
    const ctx1 = makeCtx();
    const chart1 = {
      ctx: ctx1,
      data: { datasets: [{}] },
      getDatasetMeta: () => ({ type: 'doughnut', data: [makeArc()] }),
    };

    imageLabelPlugin.afterDraw(chart1 as never, {}, { imagesList: [{ imageUrl: url, imageWidth: 10, imageHeight: 10 }] });
    await flushImageLoad();
    expect(ctx1.drawImage).toHaveBeenCalledTimes(1);

    // Second chart, same URL — the module-level cache is shared across
    // chart instances by design (matching the original's own real
    // behavior), so this one draws synchronously from cache, no
    // microtask flush needed.
    const ctx2 = makeCtx();
    const chart2 = {
      ctx: ctx2,
      data: { datasets: [{}] },
      getDatasetMeta: () => ({ type: 'doughnut', data: [makeArc()] }),
    };
    imageLabelPlugin.afterDraw(chart2 as never, {}, { imagesList: [{ imageUrl: url, imageWidth: 10, imageHeight: 10 }] });

    expect(ctx2.drawImage).toHaveBeenCalledTimes(1);
  });

  it('evicts the oldest cached image once the cache reaches its cap, so a later draw of that URL re-loads rather than reuses it', async () => {
    // MAX_CACHED_IMAGES is 200 and not exported — exercised through the
    // public afterDraw API by drawing 201 distinct URLs, the same way a
    // real long-running page cycling through many images would.
    const firstUrl = `evict-first-${Math.random()}.png`;
    for (let i = 0; i < 201; i++) {
      const url = i === 0 ? firstUrl : `evict-filler-${i}-${Math.random()}.png`;
      const ctx = makeCtx();
      const chart = {
        ctx,
        data: { datasets: [{}] },
        getDatasetMeta: () => ({ type: 'doughnut', data: [makeArc()] }),
      };
      imageLabelPlugin.afterDraw(chart as never, {}, { imagesList: [{ imageUrl: url, imageWidth: 10, imageHeight: 10 }] });
      await flushImageLoad();
    }

    // The 201st distinct URL pushed the cache past its 200-entry cap,
    // evicting the very first one (insertion order) — a fresh draw of
    // that same URL should therefore still work (a new Image() load,
    // not an already-evicted cache hit that would otherwise be
    // indistinguishable from this test's own perspective either way,
    // so what's actually being confirmed is that the plugin doesn't
    // throw or otherwise break once eviction has occurred).
    const ctx = makeCtx();
    const chart = {
      ctx,
      data: { datasets: [{}] },
      getDatasetMeta: () => ({ type: 'doughnut', data: [makeArc()] }),
    };
    imageLabelPlugin.afterDraw(chart as never, {}, { imagesList: [{ imageUrl: firstUrl, imageWidth: 10, imageHeight: 10 }] });
    await flushImageLoad();

    expect(ctx.drawImage).toHaveBeenCalledTimes(1);
  });

  it('logs a warning and does not draw when the image fails to load', async () => {
    // Overrides this file's own default FakeImage (which always
    // succeeds) with one that fires onerror instead of onload, to
    // exercise loadImage's own failure path.
    class FailingImage {
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      private _src = '';
      get src() {
        return this._src;
      }
      set src(value: string) {
        this._src = value;
        queueMicrotask(() => this.onerror?.());
      }
    }
    vi.stubGlobal('Image', FailingImage);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const url = `fails-${Math.random()}.png`;
    const ctx = makeCtx();
    const chart = {
      ctx,
      data: { datasets: [{}] },
      getDatasetMeta: () => ({ type: 'doughnut', data: [makeArc()] }),
    };
    imageLabelPlugin.afterDraw(chart as never, {}, { imagesList: [{ imageUrl: url, imageWidth: 10, imageHeight: 10 }] });
    await flushImageLoad();

    expect(warn).toHaveBeenCalledWith(expect.stringContaining(url));
    expect(ctx.drawImage).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  it('positions using verticalAlign: top/bottom and horizontalAlign: start/end, not just the untested default middle/middle', async () => {
    // Every other test in this file leaves verticalAlign/horizontalAlign
    // at their default ('middle'/'middle') — this is the only test that
    // exercises the other two cases of each switch in
    // computeDistanceFromCenter/computeAngleForImage.
    const arc = makeArc({ startAngle: 0, endAngle: Math.PI / 2, innerRadius: 20, outerRadius: 40, x: 100, y: 100 });
    const ctx = makeCtx();
    const chart = {
      ctx,
      data: { datasets: [{}] },
      getDatasetMeta: () => ({ type: 'doughnut', data: [arc] }),
    };

    const imageRadius = 5; // min(10,10)/2
    const expectedDistanceTop = arc.outerRadius - imageRadius;
    const expectedAngleStart = arc.startAngle + imageRadius / arc.outerRadius;
    const { x: centerX, y: centerY } = arc.getCenterPoint();
    const expectedX = centerX + expectedDistanceTop * Math.cos(expectedAngleStart);
    const expectedY = centerY + expectedDistanceTop * Math.sin(expectedAngleStart);

    imageLabelPlugin.afterDraw(
      chart as never,
      {},
      {
        verticalAlign: 'top',
        horizontalAlign: 'start',
        imagesList: [{ imageUrl: `align-${Math.random()}.png`, imageWidth: 10, imageHeight: 10 }],
      },
    );
    await flushImageLoad();

    expect(ctx.arc).toHaveBeenCalledTimes(1);
    const [calledX, calledY] = ctx.arc.mock.calls[0];
    expect(calledX).toBeCloseTo(expectedX, 5);
    expect(calledY).toBeCloseTo(expectedY, 5);
  });

  it('positions using verticalAlign: bottom and horizontalAlign: end, the other untested case of each switch', async () => {
    const arc = makeArc({ startAngle: 0, endAngle: Math.PI / 2, innerRadius: 20, outerRadius: 40, x: 100, y: 100 });
    const ctx = makeCtx();
    const chart = {
      ctx,
      data: { datasets: [{}] },
      getDatasetMeta: () => ({ type: 'doughnut', data: [arc] }),
    };

    const imageRadius = 5;
    const expectedDistanceBottom = arc.innerRadius + imageRadius;
    const expectedAngleEnd = arc.endAngle - imageRadius / arc.outerRadius;
    const { x: centerX, y: centerY } = arc.getCenterPoint();
    const expectedX = centerX + expectedDistanceBottom * Math.cos(expectedAngleEnd);
    const expectedY = centerY + expectedDistanceBottom * Math.sin(expectedAngleEnd);

    imageLabelPlugin.afterDraw(
      chart as never,
      {},
      {
        verticalAlign: 'bottom',
        horizontalAlign: 'end',
        imagesList: [{ imageUrl: `align2-${Math.random()}.png`, imageWidth: 10, imageHeight: 10 }],
      },
    );
    await flushImageLoad();

    expect(ctx.arc).toHaveBeenCalledTimes(1);
    const [calledX, calledY] = ctx.arc.mock.calls[0];
    expect(calledX).toBeCloseTo(expectedX, 5);
    expect(calledY).toBeCloseTo(expectedY, 5);
  });

  it('applies options.offset as an additional angular offset — untested by every other test, which all omit it', async () => {
    // computeImageLabelPosition's own `offset ? offset / outerRadius : 0`
    // ternary was never exercised by any other test, since none of them
    // pass an explicit `offset` at all.
    const arc = makeArc({ startAngle: 0, endAngle: Math.PI / 2, innerRadius: 20, outerRadius: 40, x: 100, y: 100 });
    const ctx = makeCtx();
    const chart = {
      ctx,
      data: { datasets: [{}] },
      getDatasetMeta: () => ({ type: 'doughnut', data: [arc] }),
    };

    const offset = 8;
    const imageRadius = 5;
    const offsetRadian = offset / arc.outerRadius;
    const expectedAngleStart = arc.startAngle + imageRadius / arc.outerRadius + offsetRadian;
    const distanceMiddle = arc.innerRadius + (arc.outerRadius - arc.innerRadius) / 2;
    const { x: centerX, y: centerY } = arc.getCenterPoint();
    const expectedX = centerX + distanceMiddle * Math.cos(expectedAngleStart);
    const expectedY = centerY + distanceMiddle * Math.sin(expectedAngleStart);

    imageLabelPlugin.afterDraw(
      chart as never,
      {},
      {
        horizontalAlign: 'start',
        offset,
        imagesList: [{ imageUrl: `offset-${Math.random()}.png`, imageWidth: 10, imageHeight: 10 }],
      },
    );
    await flushImageLoad();

    expect(ctx.arc).toHaveBeenCalledTimes(1);
    const [calledX, calledY] = ctx.arc.mock.calls[0];
    expect(calledX).toBeCloseTo(expectedX, 5);
    expect(calledY).toBeCloseTo(expectedY, 5);
  });

  it('applies an explicit verticalAlign while horizontalAlign is left at its own default (the one align combination every other test skips)', async () => {
    // Every other test in this file sets both verticalAlign and
    // horizontalAlign together, or neither — never one explicit with
    // the other left at its own default. This is the missing
    // combination: verticalAlign set, horizontalAlign defaulted.
    const arc = makeArc({ startAngle: 0, endAngle: Math.PI / 2, innerRadius: 20, outerRadius: 40, x: 100, y: 100 });
    const ctx = makeCtx();
    const chart = {
      ctx,
      data: { datasets: [{}] },
      getDatasetMeta: () => ({ type: 'doughnut', data: [arc] }),
    };

    const imageRadius = 5;
    const expectedDistanceTop = arc.outerRadius - imageRadius;
    const midAngle = (arc.startAngle + arc.endAngle) / 2; // horizontalAlign default: 'middle'
    const { x: centerX, y: centerY } = arc.getCenterPoint();
    const expectedX = centerX + expectedDistanceTop * Math.cos(midAngle);
    const expectedY = centerY + expectedDistanceTop * Math.sin(midAngle);

    imageLabelPlugin.afterDraw(
      chart as never,
      {},
      {
        verticalAlign: 'top',
        imagesList: [{ imageUrl: `mixed-align-${Math.random()}.png`, imageWidth: 10, imageHeight: 10 }],
      },
    );
    await flushImageLoad();

    expect(ctx.arc).toHaveBeenCalledTimes(1);
    const [calledX, calledY] = ctx.arc.mock.calls[0];
    expect(calledX).toBeCloseTo(expectedX, 5);
    expect(calledY).toBeCloseTo(expectedY, 5);
  });

  it('skips a dataset element that is not a real ArcElement instance (the instanceof type guard\'s own real skip path)', async () => {
    // Every other test's own meta.data only ever contains real,
    // instanceof-passing ArcElement mocks (via makeArc()) — this test
    // mixes in a plain, non-ArcElement object to confirm isArcElement's
    // own false branch is a real, working skip, not just a type-level
    // guard.
    const realArc = makeArc({ x: 5, y: 5 });
    const notAnArc = { startAngle: 0, endAngle: 1, innerRadius: 0, outerRadius: 10, getCenterPoint: () => ({ x: 0, y: 0 }) };
    const ctx = makeCtx();
    const chart = {
      ctx,
      data: { datasets: [{}] },
      getDatasetMeta: () => ({ type: 'doughnut', data: [notAnArc, realArc] }),
    };

    imageLabelPlugin.afterDraw(
      chart as never,
      {},
      {
        imagesList: [
          { imageUrl: `guard-a-${Math.random()}.png`, imageWidth: 10, imageHeight: 10 },
          { imageUrl: `guard-b-${Math.random()}.png`, imageWidth: 10, imageHeight: 10 },
        ],
      },
    );
    await flushImageLoad();

    // Only the real ArcElement got a clip-circle drawn — the non-arc
    // element was skipped entirely, not thrown on.
    expect(ctx.arc).toHaveBeenCalledTimes(1);
    expect(ctx.arc.mock.calls[0][0]).toBeCloseTo(5, 5);
  });
});
