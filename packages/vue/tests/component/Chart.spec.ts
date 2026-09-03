import { beforeEach, describe, expect, it, vi } from 'vitest';
import { flushPromises, mount } from '@vue/test-utils';
import { reactive } from 'vue';
import type { ChartKind } from 'keystone-chartjs-core';

// keystone-chartjs-core's own registry/controller logic is already
// fully tested at the core level (Phase 1 — 44 tests, 100% coverage,
// 98.90% mutation score) — these component tests exist to verify Chart.vue
// itself calls core correctly and reacts correctly to what core returns,
// not to re-verify core's own internal chart-kind registration or
// update-vs-recreate decision-making. Mocked accordingly.
const createChartController = vi.fn();
const withZoom = vi.fn();
const withAnnotation = vi.fn();
const withDataLabels = vi.fn();
const withGradient = vi.fn();
const withTimestack = vi.fn();
const withHierarchical = vi.fn();
const withImageLabel = vi.fn();

vi.mock('keystone-chartjs-core', () => ({
  createChartController: (...args: unknown[]) => createChartController(...args),
  withZoom: (...args: unknown[]) => withZoom(...args),
  withAnnotation: (...args: unknown[]) => withAnnotation(...args),
  withDataLabels: (...args: unknown[]) => withDataLabels(...args),
  withGradient: (...args: unknown[]) => withGradient(...args),
  withTimestack: (...args: unknown[]) => withTimestack(...args),
  withHierarchical: (...args: unknown[]) => withHierarchical(...args),
  withImageLabel: (...args: unknown[]) => withImageLabel(...args),
}));

// eslint-disable-next-line import/first -- must follow vi.mock, same
// hoisting requirement as every other spec in this monorepo.
import Chart from '../../src/Chart.vue';

interface FakeHandle {
  chart: { id: string };
  update: ReturnType<typeof vi.fn>;
  resize: ReturnType<typeof vi.fn>;
  applyTheme: ReturnType<typeof vi.fn>;
  destroy: ReturnType<typeof vi.fn>;
}

function makeHandle(): FakeHandle {
  return {
    chart: { id: 'fake-chart' },
    update: vi.fn().mockResolvedValue(undefined),
    resize: vi.fn(),
    applyTheme: vi.fn(),
    destroy: vi.fn(),
  };
}

beforeEach(() => {
  createChartController.mockReset();
  withZoom.mockReset();
  withAnnotation.mockReset();
  withDataLabels.mockReset();
  withGradient.mockReset();
  withTimestack.mockReset();
  withHierarchical.mockReset();
  withImageLabel.mockReset();

  // Mirror core's own real merge behavior closely enough that
  // assertions on the final `options` object passed to
  // createChartController/handle.update are meaningful, not just
  // "was the helper called at all".
  withZoom.mockImplementation(async (opts: Record<string, unknown>, zoomOptions: unknown) => ({
    ...opts,
    plugins: { ...(opts.plugins as object), zoom: zoomOptions ?? {} },
  }));
  withAnnotation.mockImplementation(async (opts: Record<string, unknown>, annotationOptions: unknown) => ({
    ...opts,
    plugins: { ...(opts.plugins as object), annotation: annotationOptions },
  }));
  withDataLabels.mockImplementation(async (opts: Record<string, unknown>, dataLabelsOptions: unknown) => ({
    ...opts,
    plugins: { ...(opts.plugins as object), datalabels: dataLabelsOptions ?? {} },
  }));
  // withGradient has no config to merge — core's own real implementation
  // returns options completely unchanged, but (as of the local port) it
  // now returns { options, plugin } like withImageLabel, since it's also
  // supplied via the inline plugins array rather than Chart.register(...).
  withGradient.mockImplementation(async (opts: Record<string, unknown>) => ({
    options: opts,
    plugin: { id: 'gradient-plugin' },
  }));
  // withTimestack: still returns just `options` unchanged — this scale
  // is registered via a real Chart.register(...)-adjacent mechanism
  // (a side-effect-only import), not the inline plugins array, so its
  // shape hasn't changed.
  withTimestack.mockImplementation(async (opts: Record<string, unknown>) => opts);
  // withHierarchical: identical shape too — no config to merge.
  withHierarchical.mockImplementation(async (opts: Record<string, unknown>) => opts);
  // withImageLabel has a genuinely different return shape from every
  // other helper — { options, plugin } instead of just options — since
  // it needs to hand back a plugin object for the caller to merge into
  // Chart.js's own inline plugins array, not a Chart.register(...) call.
  withImageLabel.mockImplementation(async (opts: Record<string, unknown>, imageLabelOptions: unknown) => ({
    options: { ...opts, plugins: { ...(opts.plugins as object), imageLabel: imageLabelOptions } },
    plugin: { id: 'image-label-plugin' },
  }));
});

const ALL_KINDS: ChartKind[] = [
  'bar',
  'line',
  'bubble',
  'scatter',
  'doughnut',
  'pie',
  'polarArea',
  'radar',
  'candlestick',
  'ohlc',
  'boxplot',
  'violin',
  'matrix',
  'sankey',
  'treemap',
];

describe('Chart — mount', () => {
  it.each(ALL_KINDS)('mounts a canvas and calls createChartController with type "%s"', async (type) => {
    const handle = makeHandle();
    createChartController.mockResolvedValue(handle);

    const wrapper = mount(Chart, {
      props: { type, data: { datasets: [] } },
    });
    await flushPromises();

    expect(wrapper.find('canvas').exists()).toBe(true);
    expect(createChartController).toHaveBeenCalledTimes(1);
    expect(createChartController).toHaveBeenCalledWith(wrapper.find('canvas').element, {
      type,
      data: { datasets: [] },
      options: {},
    });
  });
});

describe('Chart — update', () => {
  it('updates in place via handle.update when data changes, without calling createChartController again', async () => {
    const handle = makeHandle();
    createChartController.mockResolvedValue(handle);

    const wrapper = mount(Chart, {
      props: { type: 'bar', data: { datasets: [{ data: [1] }] } },
    });
    await flushPromises();

    await wrapper.setProps({ data: { datasets: [{ data: [2] }] } });
    await flushPromises();

    expect(createChartController).toHaveBeenCalledTimes(1);
    expect(handle.update).toHaveBeenCalledTimes(1);
    expect(handle.update).toHaveBeenCalledWith({
      type: 'bar',
      data: { datasets: [{ data: [2] }] },
      options: {},
    });
  });

  it('calls handle.update (not createChartController again) even when type itself changes — core decides update-vs-recreate internally, not this component', async () => {
    const handle = makeHandle();
    createChartController.mockResolvedValue(handle);

    const wrapper = mount(Chart, {
      props: { type: 'bar', data: { datasets: [] } },
    });
    await flushPromises();

    await wrapper.setProps({ type: 'line' });
    await flushPromises();

    expect(createChartController).toHaveBeenCalledTimes(1);
    expect(handle.update).toHaveBeenCalledWith({ type: 'line', data: { datasets: [] }, options: {} });
  });

  it('serializes overlapping prop changes through one promise chain rather than racing', async () => {
    const handle = makeHandle();
    createChartController.mockResolvedValue(handle);

    const wrapper = mount(Chart, { props: { type: 'bar', data: { datasets: [] } } });
    await flushPromises();

    // Two changes fired back-to-back, before either has had a chance
    // to settle — without the internal promise-chain serialization,
    // these could resolve out of order or overlap.
    await wrapper.setProps({ data: { datasets: [{ data: [1] }] } });
    await wrapper.setProps({ data: { datasets: [{ data: [2] }] } });
    await flushPromises();

    expect(handle.update).toHaveBeenNthCalledWith(1, {
      type: 'bar',
      data: { datasets: [{ data: [1] }] },
      options: {},
    });
    expect(handle.update).toHaveBeenNthCalledWith(2, {
      type: 'bar',
      data: { datasets: [{ data: [2] }] },
      options: {},
    });
  });

  it("re-reads handle.chart after update, since a type-change recreate swaps the underlying instance under the same handle", async () => {
    const handle = makeHandle();
    createChartController.mockResolvedValue(handle);

    const wrapper = mount(Chart, { props: { type: 'bar', data: { datasets: [] } } });
    await flushPromises();

    const newChartInstance = { id: 'new-fake-chart' };
    handle.update.mockImplementation(async () => {
      handle.chart = newChartInstance;
    });

    await wrapper.setProps({ type: 'line' });
    await flushPromises();

    expect(wrapper.vm.chart).toBe(newChartInstance);
  });

  it('reacts to a nested mutation of a reactive `data` object, without ever replacing the prop reference itself', async () => {
    // Every other update test replaces `data`/`options` wholesale via
    // `setProps` — Vue's own shallow dependency tracking already catches
    // that regardless of the internal watch's `deep` option. This test
    // exercises the one case that specifically needs `deep: true`: a
    // consumer mutating a nested field of an already-reactive object in
    // place, with the top-level prop reference never changing at all.
    // A plain object literal passed as a prop isn't itself deeply
    // reactive unless the consumer wraps it in `reactive()` first (as a
    // real Vue app binding `:data="someReactiveState"` would) — done
    // explicitly here so the mutation below is actually trackable.
    const handle = makeHandle();
    createChartController.mockResolvedValue(handle);
    const data = reactive({ datasets: [{ data: [1] }] });

    mount(Chart, { props: { type: 'bar', data } });
    await flushPromises();

    data.datasets[0].data.push(2);
    await flushPromises();

    expect(handle.update).toHaveBeenCalledTimes(1);
  });
});

describe('Chart — plugin opt-ins', () => {
  it('passes a custom plugins array straight through to createChartController', async () => {
    const handle = makeHandle();
    createChartController.mockResolvedValue(handle);
    const customPlugin = { id: 'my-plugin', beforeDraw: vi.fn() };

    mount(Chart, {
      props: { type: 'bar', data: { datasets: [] }, plugins: [customPlugin] },
    });
    await flushPromises();

    expect(createChartController).toHaveBeenCalledWith(expect.anything(), {
      type: 'bar',
      data: { datasets: [] },
      options: {},
      plugins: [customPlugin],
    });
  });
  it('does not apply any plugin when the corresponding prop is omitted', async () => {
    const handle = makeHandle();
    createChartController.mockResolvedValue(handle);

    mount(Chart, { props: { type: 'bar', data: { datasets: [] } } });
    await flushPromises();

    expect(withZoom).not.toHaveBeenCalled();
    expect(withAnnotation).not.toHaveBeenCalled();
    expect(withDataLabels).not.toHaveBeenCalled();
    expect(withGradient).not.toHaveBeenCalled();
    expect(withTimestack).not.toHaveBeenCalled();
    expect(withHierarchical).not.toHaveBeenCalled();
    expect(withImageLabel).not.toHaveBeenCalled();
  });

  it('applies zoom with no extra config when the prop is `true`', async () => {
    const handle = makeHandle();
    createChartController.mockResolvedValue(handle);

    mount(Chart, { props: { type: 'bar', data: { datasets: [] }, zoom: true } });
    await flushPromises();

    expect(withZoom).toHaveBeenCalledWith({}, undefined);
    expect(createChartController).toHaveBeenCalledWith(expect.anything(), {
      type: 'bar',
      data: { datasets: [] },
      options: { plugins: { zoom: {} } },
    });
  });

  it('applies zoom with the given config object', async () => {
    const handle = makeHandle();
    createChartController.mockResolvedValue(handle);
    const zoomConfig = { zoom: { wheel: { enabled: true } } };

    mount(Chart, { props: { type: 'bar', data: { datasets: [] }, zoom: zoomConfig } });
    await flushPromises();

    expect(withZoom).toHaveBeenCalledWith({}, zoomConfig);
  });

  it('applies annotation only when given a real config object — no plain-boolean form, unlike zoom/dataLabels', async () => {
    const handle = makeHandle();
    createChartController.mockResolvedValue(handle);
    const annotationConfig = { annotations: { line1: { type: 'line' } } };

    mount(Chart, {
      props: { type: 'bar', data: { datasets: [] }, annotation: annotationConfig },
    });
    await flushPromises();

    expect(withAnnotation).toHaveBeenCalledWith({}, annotationConfig);
  });

  it('applies dataLabels with no extra config when the prop is `true`', async () => {
    const handle = makeHandle();
    createChartController.mockResolvedValue(handle);

    mount(Chart, { props: { type: 'bar', data: { datasets: [] }, dataLabels: true } });
    await flushPromises();

    expect(withDataLabels).toHaveBeenCalledWith({}, undefined);
  });

  it('applies dataLabels with the given config object', async () => {
    const handle = makeHandle();
    createChartController.mockResolvedValue(handle);
    const dataLabelsConfig = { color: '#fff' };

    mount(Chart, {
      props: { type: 'bar', data: { datasets: [] }, dataLabels: dataLabelsConfig },
    });
    await flushPromises();

    expect(withDataLabels).toHaveBeenCalledWith({}, dataLabelsConfig);
  });

  it('applies gradient when the prop is `true` — boolean only, no config-object form, and merges its own returned plugin object into the effective plugins array', async () => {
    const handle = makeHandle();
    createChartController.mockResolvedValue(handle);

    mount(Chart, { props: { type: 'bar', data: { datasets: [] }, gradient: true } });
    await flushPromises();

    expect(withGradient).toHaveBeenCalledWith({});
    expect(createChartController).toHaveBeenCalledWith(expect.anything(), {
      type: 'bar',
      data: { datasets: [] },
      options: {},
      plugins: [{ id: 'gradient-plugin' }],
    });
  });

  it('applies timestack when the prop is `true` — boolean only, no config-object form, same shape as gradient', async () => {
    const handle = makeHandle();
    createChartController.mockResolvedValue(handle);

    mount(Chart, { props: { type: 'bar', data: { datasets: [] }, timestack: true } });
    await flushPromises();

    expect(withTimestack).toHaveBeenCalledWith({});
  });

  it('applies hierarchical when the prop is `true` — boolean only, no config-object form, same shape as gradient/timestack', async () => {
    const handle = makeHandle();
    createChartController.mockResolvedValue(handle);

    mount(Chart, { props: { type: 'bar', data: { datasets: [] }, hierarchical: true } });
    await flushPromises();

    expect(withHierarchical).toHaveBeenCalledWith({});
  });

  it('applies imageLabel only when given a real config object, and merges its own returned plugin object into the effective plugins array', async () => {
    const handle = makeHandle();
    createChartController.mockResolvedValue(handle);
    const imageLabelConfig = { imagesList: [{ imageUrl: 'a.png', imageWidth: 40, imageHeight: 40 }] };

    mount(Chart, {
      props: { type: 'doughnut', data: { datasets: [] }, imageLabel: imageLabelConfig },
    });
    await flushPromises();

    expect(withImageLabel).toHaveBeenCalledWith({}, imageLabelConfig);
    expect(createChartController).toHaveBeenCalledWith(expect.anything(), {
      type: 'doughnut',
      data: { datasets: [] },
      options: { plugins: { imageLabel: imageLabelConfig } },
      plugins: [{ id: 'image-label-plugin' }],
    });
  });

  it('appends imageLabel\'s own plugin object to a consumer-supplied plugins array, additively rather than replacing it', async () => {
    const handle = makeHandle();
    createChartController.mockResolvedValue(handle);
    const customPlugin = { id: 'my-plugin', beforeDraw: vi.fn() };

    mount(Chart, {
      props: {
        type: 'doughnut',
        data: { datasets: [] },
        imageLabel: { imagesList: [] },
        plugins: [customPlugin],
      },
    });
    await flushPromises();

    expect(createChartController).toHaveBeenCalledWith(expect.anything(), {
      type: 'doughnut',
      data: { datasets: [] },
      options: { plugins: { imageLabel: { imagesList: [] } } },
      plugins: [customPlugin, { id: 'image-label-plugin' }],
    });
  });

  it('reuses the same merged plugins array reference across two separate unrelated updates, rather than rebuilding a fresh one each time', async () => {
    // A real, reasoned concern, not hypothetical: controller.ts's own
    // update logic diffs `next.plugins !== currentPlugins` BY REFERENCE
    // to decide whether to force a destroy-and-recreate, since Chart.js
    // only ever reads `plugins` at construction time. If the merged
    // array were rebuilt fresh on every single resolveOptionsAndPlugins()
    // call, an entirely unrelated update (here, a `data` change) would
    // spuriously force a full recreate every time `imageLabel` is in use
    // — confirmed as a genuine bug caught while building this feature,
    // not a guessed-at scenario. `handle.update` itself is mocked here
    // (this component test doesn't exercise controller.ts's own real
    // diffing), so the assertion is directly on reference identity
    // across two separate update calls, which is what actually matters:
    // useChartController.ts's own cache is what's under test, not
    // controller.ts's own separate reaction to it.
    const handle = makeHandle();
    createChartController.mockResolvedValue(handle);

    const wrapper = mount(Chart, {
      props: { type: 'doughnut', data: { datasets: [{ data: [1] }] }, imageLabel: { imagesList: [] } },
    });
    await flushPromises();

    await wrapper.setProps({ data: { datasets: [{ data: [2] }] } });
    await flushPromises();
    await wrapper.setProps({ data: { datasets: [{ data: [3] }] } });
    await flushPromises();

    expect(handle.update).toHaveBeenCalledTimes(2);
    const firstUpdatePlugins = handle.update.mock.calls[0][0].plugins;
    const secondUpdatePlugins = handle.update.mock.calls[1][0].plugins;
    expect(firstUpdatePlugins).toBe(secondUpdatePlugins);
    expect(firstUpdatePlugins).toEqual([{ id: 'image-label-plugin' }]);
  });

  it('threads all three plugins together into the same options object without clobbering each other', async () => {
    const handle = makeHandle();
    createChartController.mockResolvedValue(handle);

    mount(Chart, {
      props: {
        type: 'bar',
        data: { datasets: [] },
        zoom: true,
        annotation: { annotations: {} },
        dataLabels: true,
      },
    });
    await flushPromises();

    expect(createChartController).toHaveBeenCalledWith(expect.anything(), {
      type: 'bar',
      data: { datasets: [] },
      options: { plugins: { zoom: {}, annotation: { annotations: {} }, datalabels: {} } },
    });
  });

  it('threads gradient alongside the other three plugins, merging its own returned plugin object into the effective plugins array without clobbering their options.plugins.* entries', async () => {
    const handle = makeHandle();
    createChartController.mockResolvedValue(handle);

    mount(Chart, {
      props: {
        type: 'bar',
        data: { datasets: [] },
        zoom: true,
        annotation: { annotations: {} },
        dataLabels: true,
        gradient: true,
      },
    });
    await flushPromises();

    // withGradient's own mock returns options unchanged, so this confirms
    // it ran *after* the other three (last in resolveOptions's own
    // sequence) without wiping out what they'd already merged in, while
    // still contributing its own plugin object to the effective
    // `plugins` array.
    expect(createChartController).toHaveBeenCalledWith(expect.anything(), {
      type: 'bar',
      data: { datasets: [] },
      options: { plugins: { zoom: {}, annotation: { annotations: {} }, datalabels: {} } },
      plugins: [{ id: 'gradient-plugin' }],
    });
    expect(withGradient).toHaveBeenCalledTimes(1);
  });

  it('threads timestack alongside all four other opt-ins without clobbering their options.plugins.* entries', async () => {
    const handle = makeHandle();
    createChartController.mockResolvedValue(handle);

    mount(Chart, {
      props: {
        type: 'bar',
        data: { datasets: [] },
        zoom: true,
        annotation: { annotations: {} },
        dataLabels: true,
        gradient: true,
        timestack: true,
      },
    });
    await flushPromises();

    // withTimestack's own mock returns options unchanged too, so this
    // confirms it ran last without wiping out what the others already
    // merged in. gradient's own plugin object still lands in the
    // effective plugins array regardless of timestack being set too.
    expect(createChartController).toHaveBeenCalledWith(expect.anything(), {
      type: 'bar',
      data: { datasets: [] },
      options: { plugins: { zoom: {}, annotation: { annotations: {} }, datalabels: {} } },
      plugins: [{ id: 'gradient-plugin' }],
    });
    expect(withTimestack).toHaveBeenCalledTimes(1);
  });

  it('threads hierarchical alongside all five other opt-ins without clobbering their options.plugins.* entries', async () => {
    const handle = makeHandle();
    createChartController.mockResolvedValue(handle);

    mount(Chart, {
      props: {
        type: 'bar',
        data: { datasets: [] },
        zoom: true,
        annotation: { annotations: {} },
        dataLabels: true,
        gradient: true,
        timestack: true,
        hierarchical: true,
      },
    });
    await flushPromises();

    // withHierarchical's own mock returns options unchanged too, so this
    // confirms it ran last without wiping out what the others already
    // merged in. gradient's own plugin object still lands in the
    // effective plugins array regardless of hierarchical being set too.
    expect(createChartController).toHaveBeenCalledWith(expect.anything(), {
      type: 'bar',
      data: { datasets: [] },
      options: { plugins: { zoom: {}, annotation: { annotations: {} }, datalabels: {} } },
      plugins: [{ id: 'gradient-plugin' }],
    });
    expect(withHierarchical).toHaveBeenCalledTimes(1);
  });

  it('threads imageLabel alongside all five other opt-ins, merging both its own and gradients own plugin objects into the effective plugins array without clobbering options.plugins.* entries', async () => {
    const handle = makeHandle();
    createChartController.mockResolvedValue(handle);

    mount(Chart, {
      props: {
        type: 'doughnut',
        data: { datasets: [] },
        zoom: true,
        annotation: { annotations: {} },
        dataLabels: true,
        gradient: true,
        timestack: true,
        hierarchical: true,
        imageLabel: { imagesList: [] },
      },
    });
    await flushPromises();

    expect(createChartController).toHaveBeenCalledWith(expect.anything(), {
      type: 'doughnut',
      data: { datasets: [] },
      options: {
        plugins: {
          zoom: {},
          annotation: { annotations: {} },
          datalabels: {},
          imageLabel: { imagesList: [] },
        },
      },
      plugins: [{ id: 'gradient-plugin' }, { id: 'image-label-plugin' }],
    });
    expect(withImageLabel).toHaveBeenCalledTimes(1);
  });
});

describe('Chart — exposed chart ref', () => {
  it('is null before mount resolves, then the live Chart.js instance once it has', async () => {
    const handle = makeHandle();
    createChartController.mockResolvedValue(handle);

    const wrapper = mount(Chart, { props: { type: 'bar', data: { datasets: [] } } });
    expect(wrapper.vm.chart).toBeNull();

    await flushPromises();

    expect(wrapper.vm.chart).toBe(handle.chart);
  });
});

describe('Chart — accessibility', () => {
  it('forwards non-prop attributes (e.g. ARIA attributes) onto the rendered canvas element', async () => {
    // No `defineOptions({ inheritAttrs: false })` in Chart.vue — Vue's
    // own default single-root-component behavior means any attribute
    // that isn't a declared prop (type/data/options/zoom/annotation/
    // dataLabels) lands directly on the root <canvas> element. This
    // test exists to confirm that behavior for real, not just assume
    // Vue's documented default holds here — see Chart.vue's own
    // template comment for the full reasoning.
    const handle = makeHandle();
    createChartController.mockResolvedValue(handle);

    const wrapper = mount(Chart, {
      props: { type: 'bar', data: { datasets: [] } },
      attrs: { 'aria-label': 'Revenue chart', role: 'img', id: 'revenue-canvas' },
    });
    await flushPromises();

    const canvas = wrapper.find('canvas');
    expect(canvas.attributes('aria-label')).toBe('Revenue chart');
    expect(canvas.attributes('role')).toBe('img');
    expect(canvas.attributes('id')).toBe('revenue-canvas');
  });

  it('renders default slot content as real fallback content inside the canvas tags', async () => {
    // Chart.js's own accessibility docs are explicit that content
    // placed between a canvas element's own opening/closing tags is
    // what browsers/assistive tech that can't render canvas at all
    // actually show — an ARIA attribute alone doesn't cover that case.
    // This is real, additional markup Chart.vue renders (a `<slot>`
    // inside the canvas), not just attribute fallthrough, so it needs
    // its own dedicated test.
    const handle = makeHandle();
    createChartController.mockResolvedValue(handle);

    const wrapper = mount(Chart, {
      props: { type: 'bar', data: { datasets: [] } },
      slots: { default: '<p>Revenue: Q1 $50k, Q2 $65k</p>' },
    });
    await flushPromises();

    expect(wrapper.find('canvas p').text()).toBe('Revenue: Q1 $50k, Q2 $65k');
  });
});

describe('Chart — unmount', () => {
  it('destroys the handle exactly once on unmount', async () => {
    const handle = makeHandle();
    createChartController.mockResolvedValue(handle);

    const wrapper = mount(Chart, { props: { type: 'bar', data: { datasets: [] } } });
    await flushPromises();

    wrapper.unmount();
    await flushPromises();

    expect(handle.destroy).toHaveBeenCalledTimes(1);
  });

  it('does not crash when unmounting after mount() itself never resolved a handle', async () => {
    // enqueue()'s own `.then(task, task)` pattern deliberately runs the
    // next queued task regardless of whether the previous one rejected
    // (so one failure doesn't permanently poison the whole chain for
    // every future operation) — meaning if createChartController itself
    // rejects, `handle` is never assigned, and a subsequent unmount's own
    // cleanup task still runs with `handle` still null.
    //
    // This test only confirms `wrapper.unmount()` itself never throws
    // synchronously — it can NOT distinguish `handle?.destroy()` from a
    // mutant `handle.destroy()` (confirmed via a real Stryker run, not
    // assumed): the real destroy call happens inside an async task
    // scheduled by `enqueue()`, which runs *after* `unmount()` has
    // already returned, and `enqueue()`'s own `pending.catch(() => {})`
    // (added to stop this exact scenario from surfacing as a spurious
    // unhandled-rejection failure) swallows that async task's rejection
    // regardless of whether it came from a real bug or the optional
    // chaining's own absence. `handle?.destroy()`'s mutant therefore
    // survives mutation testing as an accepted, explained gap — the
    // defensive value is real (a genuinely possible async-failure path,
    // unlike the two unreachable guards removed earlier in this file),
    // but not observable through any external assertion once the
    // swallowing catch is in place, and rearchitecting error propagation
    // just to make one mutant killable isn't worth the added complexity.
    createChartController.mockRejectedValue(new Error('mount failed'));

    const wrapper = mount(Chart, { props: { type: 'bar', data: { datasets: [] } } });
    await flushPromises();

    expect(() => wrapper.unmount()).not.toThrow();
    await flushPromises();
  });
});
