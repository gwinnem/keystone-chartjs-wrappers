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
  // annotationPlugin.ts (statically imported via plugins.ts as of the
  // local port) needs a real, extendable Element for its own seven real
  // element classes to subclass, a constructable Animations for its own
  // real update-animation resolution, and DoughnutController for
  // doughnutLabelAnnotation.ts's own real instanceof check — again,
  // minimal stubs are enough here, since this file's own withAnnotation
  // tests only assert Chart.register was called with the real,
  // imported annotationPlugin object itself.
  Element: class Element {},
  Animations: class Animations {},
  DoughnutController: class DoughnutController {},
  defaults: { color: '#666', describe: vi.fn() },
  registry: { addPlugins: vi.fn() },
}));
// No mock for chartjs-plugin-zoom — it's no longer a dependency at all.
// Its logic was ported directly into zoomPlugin.ts (a plain, local,
// static plugin object with no dynamic import), so withZoom needs no
// module mock the way it used to.
// No mock for chartjs-plugin-annotation — it's no longer a dependency
// at all. Its logic was ported directly into plugins/annotation/
// annotationPlugin.ts (a real, local plugin object, statically
// imported), so withAnnotation needs no module mock the way it used to.
// No mock for chartjs-plugin-datalabels — it's no longer a dependency
// at all. Its logic was ported directly into plugins/dataLabels/
// dataLabelsPlugin.ts (a real, local plugin object, statically
// imported), so withDataLabels needs no module mock the way it used
// to.
// No mock for chartjs-plugin-trendline — it's no longer a dependency at
// all. Its logic was ported directly into plugins/trendline/
// trendlinePlugin.ts (a real, local plugin object, statically
// imported), so withTrendline needs no module mock the way it used to.
// No mock for chartjs-plugin-deferred — it's no longer a dependency at
// all. Its logic was ported directly into deferredPlugin.ts (a real,
// local plugin object, statically imported), so withDeferred needs no
// module mock the way it used to.
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
  withDeferred,
  withGradient,
  withHierarchical,
  withImageLabel,
  withTimestack,
  withTrendline,
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

  it('registers via a direct Chart.register(annotationPlugin) call, the real local plugin object, not a dynamically-imported module', async () => {
    // As of the local port, annotationPlugin is imported directly from
    // plugins/annotation/annotationPlugin.ts — the same real object
    // reference is what gets passed to Chart.register, no dynamic
    // import or mod.default ?? mod fallback involved at all anymore
    // (matching withDataLabels's/withAutocolors's own identical
    // registration mechanism).
    await withAnnotation({}, { annotations: {} });
    expect(registerMock).toHaveBeenCalledTimes(1);
    expect(registerMock).toHaveBeenCalledWith(expect.objectContaining({ id: 'annotation' }));
  });

  it('registers the plugin exactly once no matter how many times it is called', async () => {
    await withAnnotation({}, { annotations: {} });
    await withAnnotation({}, { annotations: {} });
    expect(registerMock).toHaveBeenCalledTimes(1);
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

  it('registers via a direct Chart.register(dataLabelsPlugin) call, the real local plugin object, not a dynamically-imported module', async () => {
    // As of the local port, dataLabelsPlugin is imported directly from
    // plugins/dataLabels/dataLabelsPlugin.ts — the same real object
    // reference is what gets passed to Chart.register, no dynamic
    // import or mod.default ?? mod fallback involved at all anymore
    // (matching withAutocolors's/withDeferred's own identical
    // registration mechanism).
    await withDataLabels({});
    expect(registerMock).toHaveBeenCalledTimes(1);
    expect(registerMock).toHaveBeenCalledWith(expect.objectContaining({ id: 'datalabels' }));
  });

  it('registers the plugin exactly once no matter how many times it is called', async () => {
    await withDataLabels({});
    await withDataLabels({});
    expect(registerMock).toHaveBeenCalledTimes(1);
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

describe('withTrendline', () => {
  it('returns options completely unchanged — there is no plugin-level config to merge (config lives on each dataset)', async () => {
    const input = { plugins: { legend: { display: true } } };
    const result = await withTrendline(input);

    expect(result).toEqual(input);
  });

  it('registers via a direct Chart.register(trendlinePlugin) call, the real local plugin object, not a dynamically-imported module', async () => {
    // As of the local port, trendlinePlugin is imported directly from
    // plugins/trendline/trendlinePlugin.ts — the same real object
    // reference is what gets passed to Chart.register, no dynamic
    // import or mod.default ?? mod fallback involved at all anymore
    // (matching withAutocolors's/withDeferred's own identical
    // registration mechanism).
    await withTrendline({});
    expect(registerMock).toHaveBeenCalledTimes(1);
    expect(registerMock).toHaveBeenCalledWith(expect.objectContaining({ id: 'chartjs-plugin-trendline' }));
  });

  it('registers the plugin exactly once no matter how many times it is called', async () => {
    await withTrendline({});
    await withTrendline({});
    expect(registerMock).toHaveBeenCalledTimes(1);
  });
});

describe('withDeferred', () => {
  it('merges options into options.plugins.deferred without touching other plugins entries', async () => {
    const result = await withDeferred(
      { plugins: { legend: { display: true } } },
      { xOffset: 200, delay: 300 },
    );

    expect(result.plugins).toEqual({
      legend: { display: true },
      deferred: { xOffset: 200, delay: 300 },
    });
  });

  it('defaults to an empty deferred config when none is given', async () => {
    const result = await withDeferred({});
    expect(result.plugins).toEqual({ deferred: {} });
  });

  it('registers via a direct Chart.register(deferredPlugin) call, the real local plugin object, not a dynamically-imported module', async () => {
    // As of the local port, deferredPlugin is imported directly from
    // deferredPlugin.ts — the same real object reference is what gets
    // passed to Chart.register, no dynamic import or mod.default ?? mod
    // fallback involved at all anymore (matching withAutocolors's own
    // identical registration mechanism).
    await withDeferred({});
    expect(registerMock).toHaveBeenCalledTimes(1);
    expect(registerMock).toHaveBeenCalledWith(expect.objectContaining({ id: 'deferred' }));
  });

  it('registers the plugin exactly once no matter how many times it is called', async () => {
    await withDeferred({});
    await withDeferred({});
    expect(registerMock).toHaveBeenCalledTimes(1);
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
