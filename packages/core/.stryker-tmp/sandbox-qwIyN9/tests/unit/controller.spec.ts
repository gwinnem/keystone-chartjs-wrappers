// @ts-nocheck
import { beforeEach, describe, expect, it, vi } from 'vitest';

// A minimal but faithful Chart.js stand-in — records everything the
// controller's own logic branches on (config passed to the constructor,
// update()/resize()/destroy() call counts, destroyed state) without
// touching a real canvas 2D context, which jsdom doesn't provide.
//
// Defined inside vi.hoisted() rather than as a plain top-level class:
// vi.mock(...) factories are hoisted above the rest of this file, so a
// factory that references a plain top-level `class MockChart {...}`
// declared further down hits a genuine temporal-dead-zone error at
// runtime ("Cannot access 'MockChart' before initialization") — confirmed
// via a real run, not a hypothetical. vi.hoisted() itself gets hoisted
// together with vi.mock(), in the same relative order, which is exactly
// what's needed here.
const { MockChart } = vi.hoisted(() => {
  class MockChart {
    static register = vi.fn();
    config!: { type: string; data: unknown; options?: unknown; plugins?: unknown };
    data: unknown;
    options: unknown;
    updateCalls = 0;
    resizeCalls = 0;
    destroyed = false;

    constructor(_canvas: unknown, config: { type: string; data: unknown; options?: unknown; plugins?: unknown }) {
      this.config = config;
      this.data = config.data;
      this.options = config.options;
    }

    update() {
      this.updateCalls += 1;
    }

    resize() {
      this.resizeCalls += 1;
    }

    destroy() {
      this.destroyed = true;
    }
  }
  return { MockChart };
});
type MockChartInstance = InstanceType<typeof MockChart>;

vi.mock('chart.js', () => ({ Chart: MockChart, registerables: [] }));
vi.mock('chartjs-chart-sankey', () => ({
  SankeyController: { id: 'sankey' },
  Flow: {},
}));

import { createChartController } from '../../src/controller.js';
import * as registryModule from '../../src/registry.js';
import { __resetRegistryForTests } from '../../src/registry.js';
import { createTestCanvasWithParent } from '../../src/test-utils.js';

// Vitest's global test environment sets up ResizeObserver via jsdom in
// some versions but not others — every test that isn't specifically
// about the "no ResizeObserver in this environment" fallback stubs a
// controllable fake, rather than depending on jsdom's own (possibly
// absent) implementation.
function stubResizeObserver() {
  const observe = vi.fn();
  const disconnect = vi.fn();
  let capturedCallback: (() => void) | undefined;
  const ctor = vi.fn().mockImplementation((callback: () => void) => {
    capturedCallback = callback;
    return { observe, disconnect, unobserve: vi.fn() };
  });
  vi.stubGlobal('ResizeObserver', ctor);
  return {
    observe,
    disconnect,
    trigger: () => capturedCallback?.(),
  };
}

beforeEach(() => {
  __resetRegistryForTests();
  vi.mocked(MockChart.register).mockClear();
  vi.unstubAllGlobals();
});

describe('createChartController — mount', () => {
  it('constructs a Chart.js instance with the given type/data/options', async () => {
    const { observe } = stubResizeObserver();
    const { canvas } = createTestCanvasWithParent();

    const handle = await createChartController(canvas, {
      type: 'bar',
      data: { datasets: [{ data: [1, 2, 3] }] },
      options: { responsive: true },
    });

    expect(handle.chart.config.type).toBe('bar');
    expect(handle.chart.data).toEqual({ datasets: [{ data: [1, 2, 3] }] });
    expect(handle.chart.options).toEqual({ responsive: true });
    expect(observe).toHaveBeenCalledTimes(1);
  });

  it('tolerates a data object with no datasets key at all (falls back to an empty list when collecting mixed-chart kinds)', async () => {
    stubResizeObserver();
    const { canvas } = createTestCanvasWithParent();

    // No `datasets` property on `data` whatsoever — collectChartKinds's
    // own `?? []` fallback is what's actually under test here; every
    // other test in this file always provides a (possibly empty) array.
    const handle = await createChartController(canvas, {
      type: 'bar',
      data: {} as never,
    });

    expect(handle.chart.config.type).toBe('bar');
    expect(MockChart.register).not.toHaveBeenCalled();
  });

  it('registers every kind present across mixed-chart datasets, not just the top-level type', async () => {
    stubResizeObserver();
    const { canvas } = createTestCanvasWithParent();

    await createChartController(canvas, {
      type: 'bar',
      data: { datasets: [{ type: 'bar', data: [] }, { type: 'sankey', data: [] }] },
    });

    // 'bar' is built-in (no registration call); 'sankey' is an extension
    // kind and must have been registered even though the chart-level
    // type is 'bar'.
    expect(MockChart.register).toHaveBeenCalledTimes(1);
    expect(MockChart.register).toHaveBeenCalledWith({ id: 'sankey' }, {});
  });

  it('registers the top-level type itself when it is an extension kind, even with no dataset overrides at all', async () => {
    stubResizeObserver();
    const { canvas } = createTestCanvasWithParent();

    // Every other mount test in this file uses a built-in top-level
    // `type` ('bar') and only ever reaches an extension kind via a
    // dataset override — this is the one test where the TOP-LEVEL type
    // itself is the extension kind, with no dataset overrides at all,
    // proving collectChartKinds actually includes `payload.type` in the
    // set it builds (not just dataset-level overrides).
    await createChartController(canvas, {
      type: 'sankey',
      data: { datasets: [] },
    });

    expect(MockChart.register).toHaveBeenCalledTimes(1);
    expect(MockChart.register).toHaveBeenCalledWith({ id: 'sankey' }, {});
  });

  it('does not attempt to register a kind for a dataset with no type property at all', async () => {
    stubResizeObserver();
    const spy = vi.spyOn(registryModule, 'ensureChartKindRegistered');
    const { canvas } = createTestCanvasWithParent();

    // A dataset with no `type` key whatsoever, alongside one that does
    // have one — checked via a spy on ensureChartKindRegistered itself,
    // not just Chart.register: an untyped dataset resolving to `kind:
    // undefined` would still be a silent no-op in registry.ts (built-ins
    // and unrecognized kinds alike never call Chart.register), so
    // checking Chart.register's own call count can't tell the two cases
    // apart — only the exact set of kinds actually requested can.
    await createChartController(canvas, {
      type: 'bar',
      data: { datasets: [{ data: [] }, { type: 'sankey', data: [] }] },
    });

    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy).toHaveBeenCalledWith('bar');
    expect(spy).toHaveBeenCalledWith('sankey');
    spy.mockRestore();
  });
});

describe('createChartController — update', () => {
  it('updates in place (same Chart.js instance, chart.update() called) when the top-level type is unchanged', async () => {
    stubResizeObserver();
    const { canvas } = createTestCanvasWithParent();
    const handle = await createChartController(canvas, {
      type: 'bar',
      data: { datasets: [{ data: [1] }] },
    });
    const instanceBefore = handle.chart;

    await handle.update({ type: 'bar', data: { datasets: [{ data: [2] }] } });

    expect(handle.chart).toBe(instanceBefore);
    expect((handle.chart as unknown as MockChartInstance).updateCalls).toBe(1);
    expect((handle.chart as unknown as MockChartInstance).destroyed).toBe(false);
    expect(handle.chart.data).toEqual({ datasets: [{ data: [2] }] });
  });

  it('does not force a recreate just because the mix of per-dataset types changed, as long as the top-level type did not', async () => {
    stubResizeObserver();
    const { canvas } = createTestCanvasWithParent();
    const handle = await createChartController(canvas, {
      type: 'bar',
      data: { datasets: [{ type: 'sankey', data: [] }] },
    });
    const instanceBefore = handle.chart;
    vi.mocked(MockChart.register).mockClear();

    // Same top-level type ('bar'), but the sankey dataset is gone now —
    // per Phase 1's own acceptance criterion, this alone must not force
    // a recreate.
    await handle.update({ type: 'bar', data: { datasets: [{ data: [] }] } });

    expect(handle.chart).toBe(instanceBefore);
    expect((handle.chart as unknown as MockChartInstance).updateCalls).toBe(1);
  });

  it('destroys and reconstructs when the top-level type changes', async () => {
    stubResizeObserver();
    const { canvas } = createTestCanvasWithParent();
    const handle = await createChartController(canvas, {
      type: 'bar',
      data: { datasets: [] },
    });
    const firstInstance = handle.chart as unknown as MockChartInstance;

    await handle.update({ type: 'line', data: { datasets: [] } });

    expect(firstInstance.destroyed).toBe(true);
    expect(handle.chart).not.toBe(firstInstance);
    expect(handle.chart.config.type).toBe('line');
  });

  it('leaves options untouched when the update payload does not include any', async () => {
    stubResizeObserver();
    const { canvas } = createTestCanvasWithParent();
    const handle = await createChartController(canvas, {
      type: 'bar',
      data: { datasets: [] },
      options: { responsive: true },
    });

    await handle.update({ type: 'bar', data: { datasets: [] } });

    expect(handle.chart.options).toEqual({ responsive: true });
  });

  it('applies new options when the in-place update payload does include them', async () => {
    stubResizeObserver();
    const { canvas } = createTestCanvasWithParent();
    const handle = await createChartController(canvas, {
      type: 'bar',
      data: { datasets: [] },
      options: { responsive: true },
    });

    // Same top-level type ('bar') — the in-place branch — but THIS call
    // (unlike every other in-place-update test in this file) actually
    // includes `options`, exercising the `if (next.options)` truthy path
    // specifically inside that branch.
    await handle.update({ type: 'bar', data: { datasets: [] }, options: { responsive: false } });

    expect(handle.chart.options).toEqual({ responsive: false });
  });

  it('passes plugins through to the Chart.js constructor on mount', async () => {
    stubResizeObserver();
    const { canvas } = createTestCanvasWithParent();
    const plugin = { id: 'custom', beforeDraw: vi.fn() };

    const handle = await createChartController(canvas, {
      type: 'bar',
      data: { datasets: [] },
      plugins: [plugin],
    });

    expect((handle.chart as unknown as MockChartInstance).config.plugins).toEqual([plugin]);
  });

  it('updates in place when plugins reference is unchanged alongside same type', async () => {
    stubResizeObserver();
    const { canvas } = createTestCanvasWithParent();
    const plugins = [{ id: 'custom', beforeDraw: vi.fn() }];
    const handle = await createChartController(canvas, {
      type: 'bar',
      data: { datasets: [] },
      plugins,
    });
    const instanceBefore = handle.chart;

    // Same `plugins` reference — should not force a recreate.
    await handle.update({ type: 'bar', data: { datasets: [{ data: [1] }] }, plugins });

    expect(handle.chart).toBe(instanceBefore);
    expect((handle.chart as unknown as MockChartInstance).updateCalls).toBe(1);
  });

  it('destroys and reconstructs when plugins reference changes even though type is unchanged', async () => {
    stubResizeObserver();
    const { canvas } = createTestCanvasWithParent();
    const handle = await createChartController(canvas, {
      type: 'bar',
      data: { datasets: [] },
      plugins: [{ id: 'plugin-v1', beforeDraw: vi.fn() }],
    });
    const firstInstance = handle.chart as unknown as MockChartInstance;

    // A new array reference — must force a recreate since Chart.js only
    // reads `plugins` at construction time.
    const newPlugins = [{ id: 'plugin-v2', beforeDraw: vi.fn() }];
    await handle.update({ type: 'bar', data: { datasets: [] }, plugins: newPlugins });

    expect(firstInstance.destroyed).toBe(true);
    expect(handle.chart).not.toBe(firstInstance);
    expect((handle.chart as unknown as MockChartInstance).config.plugins).toEqual(newPlugins);
  });

  it('re-wires the ResizeObserver on the new instance after a plugins-change recreate', async () => {
    // Mirrors the equivalent type-change recreate test — the plugins-change
    // recreate branch contains identical ResizeObserver rewiring logic that
    // needs its own dedicated coverage, since a mutant forcing that
    // conditional false (or no-opping the callback) would otherwise survive
    // unnoticed. Confirmed needed via a real Stryker run surfacing 7
    // survivors (ids 34–40) all in this branch, matching the same class
    // that was already fixed for the type-change branch.
    const { observe, trigger } = stubResizeObserver();
    const { canvas, parent } = createTestCanvasWithParent();

    const plugins = [{ id: 'plugin-v1', beforeDraw: vi.fn() }];
    const handle = await createChartController(canvas, {
      type: 'bar',
      data: { datasets: [] },
      plugins,
    });

    const newPlugins = [{ id: 'plugin-v2', beforeDraw: vi.fn() }];
    await handle.update({ type: 'bar', data: { datasets: [] }, plugins: newPlugins });

    // The plugins-change recreate must re-wire the observer onto the new
    // instance — a second observe() call proves the rewiring block ran.
    expect(observe).toHaveBeenCalledTimes(2);
    expect(observe).toHaveBeenNthCalledWith(2, parent);

    // trigger() now invokes the second (post-recreate) callback, bound
    // to the new chart instance.
    trigger();
    expect((handle.chart as unknown as MockChartInstance).resizeCalls).toBe(1);
  });

  it('does not throw when a plugins-change recreate happens in an environment with no ResizeObserver at all', async () => {
    // A real Stryker run still showed 3 survivors after the test above
    // (ids 34/35/38) — that test always stubs a real ResizeObserver, so
    // `typeof ResizeObserver !== 'undefined'` is always true within it,
    // making a mutant that forces it true (or removes the `?.`, or
    // mutates the 'undefined' string literal) unobservable. Mirrors test
    // 17's own "no ResizeObserver in this environment" scenario, but for
    // a plugins-change recreate specifically rather than a type-change
    // one — the exact gap test 17 doesn't cover.
    vi.stubGlobal('ResizeObserver', undefined);
    const { canvas } = createTestCanvasWithParent();

    const handle = await createChartController(canvas, {
      type: 'bar',
      data: { datasets: [] },
      plugins: [{ id: 'plugin-v1', beforeDraw: vi.fn() }],
    });

    await handle.update({
      type: 'bar',
      data: { datasets: [] },
      plugins: [{ id: 'plugin-v2', beforeDraw: vi.fn() }],
    });

    expect((handle.chart as unknown as MockChartInstance).config.plugins).toEqual([{ id: 'plugin-v2', beforeDraw: expect.any(Function) }]);
  });
});

describe('createChartController — resize', () => {
  it('wires a ResizeObserver on the canvas parent that calls chart.resize() when triggered', async () => {
    const { observe, trigger } = stubResizeObserver();
    const { canvas, parent } = createTestCanvasWithParent();

    const handle = await createChartController(canvas, { type: 'bar', data: { datasets: [] } });

    expect(observe).toHaveBeenCalledWith(parent);
    trigger();
    expect((handle.chart as unknown as MockChartInstance).resizeCalls).toBe(1);
  });

  it('observes the canvas itself when it has no parent element', async () => {
    const { observe } = stubResizeObserver();
    // Deliberately NOT createTestCanvas() here — that helper attaches the
    // canvas to document.body (see its own doc comment), which means it
    // DOES have a parent (body itself), defeating the entire point of
    // this test. Confirmed via a real run: the observer was called with
    // the whole accumulated document.body, not the bare canvas, because
    // every other test's own canvases piled up under body too. A plain,
    // never-attached element is what "no parent" actually requires.
    const canvas = document.createElement('canvas');

    await createChartController(canvas, { type: 'bar', data: { datasets: [] } });

    expect(observe).toHaveBeenCalledWith(canvas);
  });

  it('resize() calls chart.resize() directly, independent of the observer', async () => {
    stubResizeObserver();
    const { canvas } = createTestCanvasWithParent();
    const handle = await createChartController(canvas, { type: 'bar', data: { datasets: [] } });

    handle.resize();

    expect((handle.chart as unknown as MockChartInstance).resizeCalls).toBe(1);
  });

  it('does not throw in an environment with no ResizeObserver, and every method still works', async () => {
    vi.stubGlobal('ResizeObserver', undefined);
    const { canvas } = createTestCanvasWithParent();

    const handle = await createChartController(canvas, { type: 'bar', data: { datasets: [] } });
    handle.resize();
    await handle.update({ type: 'line', data: { datasets: [] } });
    handle.destroy();

    expect((handle.chart as unknown as MockChartInstance).destroyed).toBe(true);
  });

  it('re-wires the ResizeObserver on the new instance after a type-change recreate', async () => {
    const { observe, trigger } = stubResizeObserver();
    const { canvas, parent } = createTestCanvasWithParent();

    const handle = await createChartController(canvas, { type: 'bar', data: { datasets: [] } });
    await handle.update({ type: 'line', data: { datasets: [] } });

    // Every other recreate test only checks that the old instance was
    // destroyed and a new one exists — not that the observer actually
    // gets re-attached to the NEW instance. A second `observe()` call is
    // what proves the recreate path's own `if (typeof ResizeObserver ...)`
    // block actually ran, not just that the type changed.
    expect(observe).toHaveBeenCalledTimes(2);
    expect(observe).toHaveBeenNthCalledWith(2, parent);

    // `stubResizeObserver()`'s captured callback is overwritten on every
    // `new ResizeObserver(cb)` call, so `trigger()` here invokes the
    // SECOND (post-recreate) callback specifically, bound to the new
    // chart instance via closure.
    trigger();
    expect((handle.chart as unknown as MockChartInstance).resizeCalls).toBe(1);
  });
});

describe('createChartController — applyTheme', () => {
  it('merges the patch into chart.options (one level deep) and calls chart.update(), without touching data', async () => {
    stubResizeObserver();
    const { canvas } = createTestCanvasWithParent();
    const handle = await createChartController(canvas, {
      type: 'bar',
      data: { datasets: [{ data: [1] }] },
      options: { plugins: { legend: { display: true } } },
    });

    handle.applyTheme({ color: '#fff' });

    const chart = handle.chart as unknown as MockChartInstance;
    expect((chart.options as Record<string, unknown>).color).toBe('#fff');
    expect((chart.options as { plugins: { legend: { display: boolean } } }).plugins.legend.display).toBe(true);
    expect(chart.updateCalls).toBe(1);
    expect(chart.data).toEqual({ datasets: [{ data: [1] }] });
  });

  it('applyTheme still works when the chart started with no options at all', async () => {
    stubResizeObserver();
    const { canvas } = createTestCanvasWithParent();
    // No `options` field in the initial payload — exercises the
    // `chart.options ?? {}` fallback specifically (every other applyTheme
    // test provides real initial options).
    const handle = await createChartController(canvas, {
      type: 'bar',
      data: { datasets: [] },
    });

    handle.applyTheme({ color: '#fff' });

    expect((handle.chart.options as Record<string, unknown>).color).toBe('#fff');
  });
});

describe('createChartController — destroy', () => {
  it('disconnects the ResizeObserver and destroys the Chart.js instance', async () => {
    const { disconnect } = stubResizeObserver();
    const { canvas } = createTestCanvasWithParent();
    const handle = await createChartController(canvas, { type: 'bar', data: { datasets: [] } });

    handle.destroy();

    expect(disconnect).toHaveBeenCalledTimes(1);
    expect((handle.chart as unknown as MockChartInstance).destroyed).toBe(true);
  });
});
