import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('chart.js', () => ({ Chart: { register: vi.fn() }, registerables: [] }));
vi.mock('chartjs-plugin-zoom', () => ({ default: { id: 'zoom' } }));
vi.mock('chartjs-plugin-annotation', () => ({ default: { id: 'annotation' } }));
vi.mock('chartjs-plugin-datalabels', () => ({ default: { id: 'datalabels' } }));
// No mock for chartjs-plugin-gradient — it's no longer a dependency at
// all. Its logic was ported directly into gradientPlugin.ts (a plain,
// local, static plugin object with no dynamic import), so withGradient
// needs no module mock the way it used to.
// No default (or any) export shape matters here — unlike the other four
// mocks above, withTimestack never reads anything off this module at
// all, it only awaits the import for its side effect. An empty object
// is enough to let the dynamic import resolve successfully in tests
// without pulling in the real, luxon-dependent package.
vi.mock('chartjs-scale-timestack', () => ({}));
vi.mock('chartjs-plugin-hierarchical', () => ({ HierarchicalScale: { id: 'hierarchical' } }));
// No mock for chartjs-plugin-image-label — it's no longer a dependency at
// all. Its logic was ported directly into plugins.ts's own
// imageLabelPluginObject (a plain, local, static object with no dynamic
// import), so withImageLabel needs no module mock the way every other
// plugin helper in this file does.

import { Chart } from 'chart.js';
import {
  __resetPluginsForTests,
  withAnnotation,
  withDataLabels,
  withGradient,
  withHierarchical,
  withImageLabel,
  withTimestack,
  withZoom,
} from '../../src/plugins.js';

const registerMock = vi.mocked(Chart.register);

beforeEach(() => {
  __resetPluginsForTests();
  registerMock.mockClear();
});

describe('withZoom', () => {
  it('merges pan/zoom options into options.plugins.zoom without touching other plugins entries', async () => {
    const result = await withZoom(
      { plugins: { legend: { display: false } } },
      { zoom: { wheel: { enabled: true } } },
    );

    expect(result.plugins).toEqual({
      legend: { display: false },
      zoom: { zoom: { wheel: { enabled: true } } },
    });
  });

  it('defaults to an empty zoom config when none is given', async () => {
    const result = await withZoom({});
    expect(result.plugins).toEqual({ zoom: {} });
  });

  it('registers the plugin exactly once no matter how many times it is called', async () => {
    await withZoom({});
    await withZoom({});
    await withZoom({});
    expect(registerMock).toHaveBeenCalledTimes(1);
    expect(registerMock).toHaveBeenCalledWith({ id: 'zoom' });
  });
});

describe('withAnnotation', () => {
  it('merges annotations into options.plugins.annotation without touching other plugins entries', async () => {
    const result = await withAnnotation(
      { plugins: { legend: { display: true } } },
      { annotations: { line1: { type: 'line' } } },
    );

    expect(result.plugins).toEqual({
      legend: { display: true },
      annotation: { annotations: { line1: { type: 'line' } } },
    });
  });

  it('registers the plugin exactly once no matter how many times it is called', async () => {
    await withAnnotation({}, { annotations: {} });
    await withAnnotation({}, { annotations: {} });
    expect(registerMock).toHaveBeenCalledTimes(1);
    expect(registerMock).toHaveBeenCalledWith({ id: 'annotation' });
  });
});

describe('withDataLabels', () => {
  it('merges options into options.plugins.datalabels without touching other plugins entries', async () => {
    const result = await withDataLabels(
      { plugins: { legend: { display: true } } },
      { color: '#fff' },
    );

    expect(result.plugins).toEqual({
      legend: { display: true },
      datalabels: { color: '#fff' },
    });
  });

  it('defaults to an empty datalabels config when none is given', async () => {
    const result = await withDataLabels({});
    expect(result.plugins).toEqual({ datalabels: {} });
  });

  it('registers the plugin exactly once no matter how many times it is called', async () => {
    await withDataLabels({});
    await withDataLabels({});
    expect(registerMock).toHaveBeenCalledTimes(1);
    expect(registerMock).toHaveBeenCalledWith({ id: 'datalabels' });
  });
});

describe('cross-plugin isolation', () => {
  it('registering one plugin does not register the other two', async () => {
    await withZoom({});
    expect(registerMock).toHaveBeenCalledTimes(1);
    await withAnnotation({}, { annotations: {} });
    expect(registerMock).toHaveBeenCalledTimes(2);
    await withDataLabels({});
    expect(registerMock).toHaveBeenCalledTimes(3);
  });
});

describe('withGradient', () => {
  it('returns options completely unchanged — there is no plugin-level config to merge', async () => {
    const input = { plugins: { legend: { display: true } } };
    const result = await withGradient(input);

    expect(result.options).toEqual(input);
  });

  it('never calls Chart.register at all — ported to a local, static plugin object with no registration step', async () => {
    await withGradient({});
    expect(registerMock).not.toHaveBeenCalled();
  });

  it('returns the exact same local plugin object reference on every call', async () => {
    const first = await withGradient({});
    const second = await withGradient({});

    expect(first.plugin).toBe(second.plugin);
    expect(first.plugin).toMatchObject({ id: 'gradient' });
  });
});

describe('withTimestack', () => {
  it('returns options completely unchanged — like withGradient, there is no plugin-level config to merge', async () => {
    const input = { plugins: { legend: { display: true } } };
    const result = await withTimestack(input);

    expect(result).toEqual(input);
  });

  it('never calls Chart.register at all, unlike every other plugin helper in this file', async () => {
    // Confirmed directly from the real package's own README
    // (github.com/jkmnt/chartjs-scale-timestack): it registers its own
    // scale as a side effect of being imported, with no exported plugin
    // object to pass to Chart.register at all — so this helper's own
    // dynamic import is the whole mechanism, not a precursor to a
    // register() call the way it is for the other four.
    await withTimestack({});
    expect(registerMock).not.toHaveBeenCalled();
  });

  it('does not throw when called multiple times', async () => {
    await expect(withTimestack({})).resolves.toBeDefined();
    await expect(withTimestack({})).resolves.toBeDefined();
    await expect(withTimestack({})).resolves.toBeDefined();
  });
});

describe('withHierarchical', () => {
  it('returns options completely unchanged — like withGradient/withTimestack, there is no plugin-level config to merge', async () => {
    const input = { plugins: { legend: { display: true } } };
    const result = await withHierarchical(input);

    expect(result).toEqual(input);
  });

  it('registers via its own real, confirmed named export (HierarchicalScale), not mod.default ?? mod', async () => {
    // Confirmed directly from the real package's own README
    // (github.com/sgratzl/chartjs-plugin-hierarchical): the ESM build is
    // genuinely tree-shakeable with no side effects, so this is the one
    // helper in this file that both calls Chart.register AND has no
    // `mod.default ?? mod` fallback — the named export is the whole,
    // real, confirmed API surface, not a defensive guess.
    await withHierarchical({});
    expect(registerMock).toHaveBeenCalledTimes(1);
    expect(registerMock).toHaveBeenCalledWith({ id: 'hierarchical' });
  });

  it('registers the scale exactly once no matter how many times it is called', async () => {
    await withHierarchical({});
    await withHierarchical({});
    await withHierarchical({});
    expect(registerMock).toHaveBeenCalledTimes(1);
  });
});

describe('mod.default ?? mod fallback (a plugin package with no default export)', () => {
  // Every real plugin package here does have a default export (confirmed
  // via CHARTJS_ANALYSIS.md §4's own research) — this branch is defensive
  // code for a package that doesn't, which still needs its own coverage.
  // Each test uses vi.resetModules() + vi.doMock() (same technique as
  // registry.spec.ts's own negative-path test) to simulate that, and
  // re-imports 'chart.js' fresh alongside the plugin module: resetModules
  // invalidates the whole module registry, so the outer-scope
  // `registerMock` captured at the top of this file would not see calls
  // made through a freshly re-evaluated 'chart.js' mock instance.
  //
  // `default: undefined` is explicit, not omitted — confirmed via a real
  // run: Vitest's own mock wrapper throws its own "No 'default' export is
  // defined on the mock" error the instant that key is accessed at all
  // if it's genuinely absent from the factory's returned object, which
  // would mask the fallback behavior these tests exist to exercise (the
  // exact same class of issue registry.spec.ts's own negative-path test
  // hit earlier). An explicit `undefined` value satisfies Vitest's
  // completeness check while still being falsy, so plugins.ts's own
  // `?? mod` fallback is what actually runs.

  it('withZoom registers the module namespace itself when there is no default export', async () => {
    vi.resetModules();
    vi.doMock('chartjs-plugin-zoom', () => ({ default: undefined, id: 'zoom-named-only' }));
    const freshChart = await import('chart.js');
    const freshPlugins = await import('../../src/plugins.js');

    await freshPlugins.withZoom({});

    expect(freshChart.Chart.register).toHaveBeenCalledWith({ default: undefined, id: 'zoom-named-only' });
  });

  it('withAnnotation registers the module namespace itself when there is no default export', async () => {
    vi.resetModules();
    vi.doMock('chartjs-plugin-annotation', () => ({ default: undefined, id: 'annotation-named-only' }));
    const freshChart = await import('chart.js');
    const freshPlugins = await import('../../src/plugins.js');

    await freshPlugins.withAnnotation({}, { annotations: {} });

    expect(freshChart.Chart.register).toHaveBeenCalledWith({ default: undefined, id: 'annotation-named-only' });
  });

  it('withDataLabels registers the module namespace itself when there is no default export', async () => {
    vi.resetModules();
    vi.doMock('chartjs-plugin-datalabels', () => ({ default: undefined, id: 'datalabels-named-only' }));
    const freshChart = await import('chart.js');
    const freshPlugins = await import('../../src/plugins.js');

    await freshPlugins.withDataLabels({});

    expect(freshChart.Chart.register).toHaveBeenCalledWith({ default: undefined, id: 'datalabels-named-only' });
  });
});

describe('withHierarchical — fresh-module registration (kills the initial-flag-value mutant)', () => {
  // withHierarchical has no `mod.default ?? mod` fallback (see its own
  // describe block above for why), so it doesn't belong in the describe
  // block above — but it needs the identical `vi.resetModules()` + fresh
  // import technique for a different reason: a real mutation run showed
  // `hierarchicalRegistered`'s own initial `= false` value (mutated to
  // `= true`) surviving. That's invisible to every other test in this
  // file, since `beforeEach`'s own `__resetPluginsForTests()` always
  // resets the flag on the *already-imported* module before any test
  // body runs, regardless of what its initial value was — the only way
  // to observe the real, un-reset initial value is a genuinely fresh
  // module instance, imported after `vi.resetModules()`, exactly as the
  // `mod.default ?? mod` fallback tests above already do for the other
  // four plugins.
  it('registers on the very first call against a freshly-imported module instance', async () => {
    vi.resetModules();
    vi.doMock('chartjs-plugin-hierarchical', () => ({ HierarchicalScale: { id: 'hierarchical-fresh' } }));
    const freshChart = await import('chart.js');
    const freshPlugins = await import('../../src/plugins.js');

    await freshPlugins.withHierarchical({});

    expect(freshChart.Chart.register).toHaveBeenCalledWith({ id: 'hierarchical-fresh' });
  });
});

describe('withImageLabel', () => {
  it('merges the given config into options.plugins.imageLabel without touching other plugins entries', async () => {
    const result = await withImageLabel(
      { plugins: { legend: { display: true } } },
      { imagesList: [{ imageUrl: 'a.png', imageWidth: 40, imageHeight: 40 }] },
    );

    expect(result.options.plugins).toEqual({
      legend: { display: true },
      imageLabel: { imagesList: [{ imageUrl: 'a.png', imageWidth: 40, imageHeight: 40 }] },
    });
  });

  it('never calls Chart.register at all — ported to a local, static plugin object with no registration step', async () => {
    // Unlike every helper above (including withTimestack, whose own
    // dynamic import at least runs *something* on first use), this one
    // never touches Chart.register or any dynamic import at all —
    // confirmed here as a real, standing property of the port, not an
    // implementation detail worth losing track of.
    await withImageLabel({}, { imagesList: [] });
    expect(registerMock).not.toHaveBeenCalled();
  });

  it('returns the exact same local plugin object reference on every call', async () => {
    const first = await withImageLabel({}, { imagesList: [] });
    const second = await withImageLabel({}, { imagesList: [] });

    expect(first.plugin).toBe(second.plugin);
    expect(first.plugin).toMatchObject({ id: 'imageLabel', afterDraw: expect.any(Function) });
  });
});
