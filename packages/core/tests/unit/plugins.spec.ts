import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('chart.js', () => ({
  Chart: { register: vi.fn() },
  registerables: [],
  // hierarchicalScale.ts (statically imported via plugins.ts as of the
  // local port) needs a real, extendable CategoryScale to subclass,
  // plus `defaults`/`registry` for its own static afterRegister()/
  // beforeDatasetsDraw() logic — minimal stubs are enough here, since
  // this file's own withHierarchical tests only assert that
  // Chart.register was called with the real HierarchicalScale class
  // itself, not on any of CategoryScale's own real behavior.
  CategoryScale: class CategoryScale {
    static defaults = {};
  },
  defaults: { color: '#666' },
  registry: { addPlugins: vi.fn() },
}));
// No mock for chartjs-plugin-zoom — it's no longer a dependency at all.
// Its logic was ported directly into zoomPlugin.ts (a plain, local,
// static plugin object with no dynamic import), so withZoom needs no
// module mock the way it used to.
vi.mock('chartjs-plugin-annotation', () => ({ default: { id: 'annotation' } }));
vi.mock('chartjs-plugin-datalabels', () => ({ default: { id: 'datalabels' } }));
// No mock for chartjs-plugin-autocolors — it's no longer a dependency
// at all. Its logic was ported directly into autocolorsPlugin.ts (a
// real, local plugin object, statically imported), so withAutocolors
// needs no module mock the way it used to.
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
// No mock for chartjs-plugin-hierarchical — it's no longer a dependency
// at all. Its logic was ported directly into hierarchicalScale.ts (a
// real HierarchicalScale class, statically imported), so withHierarchical
// needs no module mock the way it used to.
// No mock for chartjs-plugin-image-label — it's no longer a dependency at
// all. Its logic was ported directly into plugins.ts's own
// imageLabelPluginObject (a plain, local, static object with no dynamic
// import), so withImageLabel needs no module mock the way every other
// plugin helper in this file does.

import { Chart } from 'chart.js';
import {
  __resetPluginsForTests,
  withAnnotation,
  withAutocolors,
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

    expect(result.options.plugins).toEqual({
      legend: { display: false },
      zoom: { zoom: { wheel: { enabled: true } } },
    });
  });

  it('defaults to an empty zoom config when none is given', async () => {
    const result = await withZoom({});
    expect(result.options.plugins).toEqual({ zoom: {} });
  });

  it('never calls Chart.register at all — ported to a local, static plugin object with no registration step', async () => {
    await withZoom({});
    expect(registerMock).not.toHaveBeenCalled();
  });

  it('returns the exact same local plugin object reference on every call', async () => {
    const first = await withZoom({});
    const second = await withZoom({});

    expect(first.plugin).toBe(second.plugin);
    expect(first.plugin).toMatchObject({ id: 'zoom' });
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
    await withAnnotation({}, { annotations: {} });
    expect(registerMock).toHaveBeenCalledTimes(1);
    await withDataLabels({});
    expect(registerMock).toHaveBeenCalledTimes(2);
  });
});

describe('withAutocolors', () => {
  it('merges options into options.plugins.autocolors without touching other plugins entries', async () => {
    const result = await withAutocolors(
      { plugins: { legend: { display: true } } },
      { mode: 'data' },
    );

    expect(result.plugins).toEqual({
      legend: { display: true },
      autocolors: { mode: 'data' },
    });
  });

  it('defaults to an empty autocolors config when none is given', async () => {
    const result = await withAutocolors({});
    expect(result.plugins).toEqual({ autocolors: {} });
  });

  it('registers via a direct Chart.register(autocolorPlugin) call, the real local plugin object, not a dynamically-imported module', async () => {
    // As of the local port, autocolorPlugin is imported directly from
    // autocolorsPlugin.ts — the same real object reference is what gets
    // passed to Chart.register, no dynamic import or mod.default ?? mod
    // fallback involved at all anymore (matching withHierarchical's own
    // identical registration mechanism).
    await withAutocolors({});
    expect(registerMock).toHaveBeenCalledTimes(1);
    expect(registerMock).toHaveBeenCalledWith(expect.objectContaining({ id: 'autocolors' }));
  });

  it('registers the plugin exactly once no matter how many times it is called', async () => {
    await withAutocolors({});
    await withAutocolors({});
    await withAutocolors({});
    expect(registerMock).toHaveBeenCalledTimes(1);
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

  it('registers via a direct Chart.register(HierarchicalScale) call, the real local class, not a dynamically-imported module', async () => {
    // As of the local port, HierarchicalScale is imported directly from
    // hierarchicalScale.ts — the same real class reference is what gets
    // passed to Chart.register, no dynamic import or mod.default ??
    // mod fallback involved at all anymore.
    await withHierarchical({});
    expect(registerMock).toHaveBeenCalledTimes(1);
    expect(registerMock).toHaveBeenCalledWith(expect.objectContaining({ id: 'hierarchical' }));
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
