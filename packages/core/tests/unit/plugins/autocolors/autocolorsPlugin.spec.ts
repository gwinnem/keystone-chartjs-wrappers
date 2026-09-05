import { describe, expect, it, vi } from 'vitest';
import { autocolorPlugin } from '../../../../src/plugins/autocolors/autocolorsPlugin.js';

// Testing the real color-selection logic directly (dissected from the
// real package's own installed dist file, see autocolorsPlugin.ts's
// own header comment for the full rationale) against a fully mocked
// chart object, the same technique gradientPlugin.spec.ts/
// imageLabelPlugin.spec.ts/zoomPlugin.spec.ts all use.

function makeChart(datasets: Record<string, unknown>[]) {
  return { data: { datasets } } as never;
}

describe('autocolorPlugin', () => {
  it('has the real, expected id and beforeUpdate hook', () => {
    expect(autocolorPlugin).toMatchObject({ id: 'autocolors', beforeUpdate: expect.any(Function) });
  });

  it('does nothing at all when explicitly disabled', () => {
    const dataset: Record<string, unknown> = {};
    const chart = makeChart([dataset]);

    autocolorPlugin.beforeUpdate!(chart, {} as never, { enabled: false });

    expect(dataset.backgroundColor).toBeUndefined();
    expect(dataset.borderColor).toBeUndefined();
  });

  describe('dataset mode (the real default)', () => {
    it('assigns a real, distinct rgba background/border color to each dataset that has none set', () => {
      const datasets: Record<string, unknown>[] = [{}, {}];
      const chart = makeChart(datasets);

      autocolorPlugin.beforeUpdate!(chart, {} as never, {});

      expect(datasets[0].backgroundColor).toMatch(/^rgba\(\d+, \d+, \d+, 0\.\d+\)$/);
      expect(datasets[0].borderColor).toMatch(/^rgba\(\d+, \d+, \d+, 0\.\d+\)$/);
      // Two distinct datasets get two distinct colors — the real hue
      // generator advances between them, not the same value repeated.
      expect(datasets[0].backgroundColor).not.toBe(datasets[1].backgroundColor);
    });

    it('does not overwrite a color the consumer already set explicitly', () => {
      const dataset: Record<string, unknown> = { backgroundColor: 'blue', borderColor: 'navy' };
      const chart = makeChart([dataset]);

      autocolorPlugin.beforeUpdate!(chart, {} as never, {});

      expect(dataset.backgroundColor).toBe('blue');
      expect(dataset.borderColor).toBe('navy');
    });

    it('advances to the next generated color for the following dataset once the current one is genuinely applied', () => {
      // The real generator only advances once setColors() confirms the
      // current color was actually applied (i.e. the dataset had no
      // pre-existing color of its own) — a dataset with its own color
      // already set does NOT consume a turn, so the next real dataset
      // gets that same still-unused color instead of skipping ahead.
      const preColored: Record<string, unknown> = { backgroundColor: 'blue', borderColor: 'navy' };
      const uncolored: Record<string, unknown> = {};
      const chart = makeChart([preColored, uncolored]);

      autocolorPlugin.beforeUpdate!(chart, {} as never, {});

      // Compare against a fresh, single-dataset run — the color
      // uncolored ends up with should be the real FIRST generated
      // color, not the second, confirming preColored's own turn never
      // consumed one.
      const controlDataset: Record<string, unknown> = {};
      autocolorPlugin.beforeUpdate!(makeChart([controlDataset]), {} as never, {});

      expect(uncolored.backgroundColor).toBe(controlDataset.backgroundColor);
    });
  });

  describe('data mode', () => {
  it('assigns a real per-point color array, always overwriting any pre-existing single color', () => {
  const dataset: Record<string, unknown> = { data: [1, 2, 3], backgroundColor: 'blue' };
  const chart = makeChart([dataset]);

  autocolorPlugin.beforeUpdate!(chart, {} as never, { mode: 'data' });

  expect(Array.isArray(dataset.backgroundColor)).toBe(true);
  expect((dataset.backgroundColor as string[])).toHaveLength(3);
  expect(dataset.backgroundColor).not.toBe('blue');
  });

  it('advances the color for each individual data point within the same dataset, not just once per dataset', () => {
  const dataset: Record<string, unknown> = { data: [1, 2] };
  const chart = makeChart([dataset]);

  autocolorPlugin.beforeUpdate!(chart, {} as never, { mode: 'data' });

  const colors = dataset.backgroundColor as string[];
  expect(colors[0]).not.toBe(colors[1]);
  });

  it('exercises every hsv2rgb hue branch and a full wrap of the internal hue generator, given enough data points', () => {
    // hueGen()'s own real sequence (0, then ever-finer binary
    // subdivisions) only reaches hue values in every 60° segment of the
    // color wheel — and only wraps its own outer loop back to the start
    // — after enough distinct hues have been drawn. Every other test in
    // this file uses only a handful of datasets/points, which never
    // advances far enough to reach hsv2rgb's own `hPrime < 3`/`hPrime <
    // 5`/`else` branches, or to observe hueGen()'s own generator
    // actually wrapping back around (confirmed via a real coverage run:
    // those were the only lines in this file left uncovered). A large
    // number of data points in 'data' mode (each consuming its own real
    // hue draw, two colors per hue) comfortably exceeds the ~513 draws
    // needed to reach every branch and observe the wrap — this is
    // reachable, real behavior, not a mock or an artificial shortcut.
    const dataset: Record<string, unknown> = { data: new Array(2000).fill(0) };
    const chart = makeChart([dataset]);

    expect(() => autocolorPlugin.beforeUpdate!(chart, {} as never, { mode: 'data' })).not.toThrow();

    const colors = dataset.backgroundColor as string[];
    expect(colors).toHaveLength(2000);
    // A real, non-trivial spread of distinct generated colors, not just
    // the first couple of hues repeating — confirms real advancement
    // through the sequence, not merely that the call didn't throw.
    expect(new Set(colors).size).toBeGreaterThan(10);
  });
});

  describe('label mode', () => {
    it('assigns the identical color to two datasets sharing the same label', () => {
      const a: Record<string, unknown> = { label: 'Revenue' };
      const b: Record<string, unknown> = { label: 'Revenue' };
      const chart = makeChart([a, b]);

      autocolorPlugin.beforeUpdate!(chart, {} as never, { mode: 'label' });

      expect(a.backgroundColor).toBe(b.backgroundColor);
    });

    it('assigns a distinct color to a dataset with a different label', () => {
      const a: Record<string, unknown> = { label: 'Revenue' };
      const b: Record<string, unknown> = { label: 'Cost' };
      const chart = makeChart([a, b]);

      autocolorPlugin.beforeUpdate!(chart, {} as never, { mode: 'label' });

      expect(a.backgroundColor).not.toBe(b.backgroundColor);
    });

    it('treats a dataset with no label at all as the real, shared empty-string label', () => {
      const a: Record<string, unknown> = {};
      const b: Record<string, unknown> = {};
      const chart = makeChart([a, b]);

      autocolorPlugin.beforeUpdate!(chart, {} as never, { mode: 'label' });

      expect(a.backgroundColor).toBe(b.backgroundColor);
    });
  });

  describe('offset', () => {
    it('skips the given number of colors before assigning the first real one', () => {
      const controlDataset: Record<string, unknown> = {};
      autocolorPlugin.beforeUpdate!(makeChart([controlDataset]), {} as never, {});

      const offsetDataset: Record<string, unknown> = {};
      autocolorPlugin.beforeUpdate!(makeChart([offsetDataset]), {} as never, { offset: 3 });

      expect(offsetDataset.backgroundColor).not.toBe(controlDataset.backgroundColor);
    });
  });

  describe('repeat', () => {
    it('assigns the same color to the given number of adjacent datasets before advancing', () => {
      const datasets: Record<string, unknown>[] = [{}, {}, {}];
      const chart = makeChart(datasets);

      autocolorPlugin.beforeUpdate!(chart, {} as never, { repeat: 2 });

      expect(datasets[0].backgroundColor).toBe(datasets[1].backgroundColor);
      expect(datasets[1].backgroundColor).not.toBe(datasets[2].backgroundColor);
    });
  });

  describe('customize', () => {
    it('calls the given function with the real generated colors and real context, using its returned replacement', () => {
      const customize = vi.fn(() => ({ background: 'lightblue', border: 'darkblue' }));
      const dataset: Record<string, unknown> = {};
      const chart = makeChart([dataset]);

      autocolorPlugin.beforeUpdate!(chart, {} as never, { customize });

      expect(customize).toHaveBeenCalledWith(
        expect.objectContaining({ colors: expect.objectContaining({ background: expect.any(String), border: expect.any(String) }) }),
      );
      expect(dataset.backgroundColor).toBe('lightblue');
      expect(dataset.borderColor).toBe('darkblue');
    });
  });
});
