/**
 * Local port of `chartjs-plugin-autocolors` (v0.3.1, MIT, Jukka Kurkela
 * — the same maintainer already behind `chartjs-chart-matrix`/
 * `chartjs-chart-sankey`/`chartjs-chart-treemap` in this project, and
 * the original author of `gradient`/`zoom` before those two were also
 * ported), supplied via a direct `Chart.register(autocolorPlugin)`
 * call instead of a dependency, so it avoids the docs-site
 * dynamic-import hydration gap the other still-dependency-based
 * plugins in this project hit (same rationale as `zoomPlugin.ts`/
 * `gradientPlugin.ts`/`imageLabelPlugin.ts`/`hierarchicalScale.ts` —
 * see each's own header comment).
 *
 * **Real, confirmed finding, not assumed**: the real, installed
 * package's own dist file (`node_modules/chartjs-plugin-autocolors/
 * dist/chartjs-plugin-autocolors.esm.js` — the package ships no real
 * `src/` in its published files, only `dist/*`, so this is the same
 * "dissected from the installed dist output" situation `gradient`/
 * `imageLabel` were each in, not `zoom`'s/`hierarchical`'s own real
 * `src/` access) imports exactly two small utility functions from a
 * separate package, `@kurkle/color` (`hsv2rgb`, `rgbString`) — a real,
 * declared `peerDependency` of the original, not bundled into its own
 * dist output at all. Confirmed via `chart.js`'s own real
 * `package.json`: Chart.js itself already depends on this exact
 * package (`@kurkle/color: ^0.3.0`) for its own internal color
 * handling, so it would already be present in `node_modules` for any
 * real consumer of this project regardless of this port's own choices
 * — but deliberately NOT imported directly here anyway, since doing so
 * would mean importing an undeclared transitive dependency (fragile
 * under pnpm's own strict, non-flat `node_modules` layout, which this
 * monorepo already uses — confirmed real risk, not a hypothetical one:
 * see `stryker.config.mjs`'s own comment on this exact class of
 * pnpm-specific resolution gap).
 *
 * **What's ported faithfully vs. reimplemented locally**: every real
 * piece of this plugin's own actual color-*selection* logic (the
 * golden-ratio-style hue-stepping generator, the dataset/data/label
 * mode branching, the "don't overwrite an already-set color" merge
 * behavior, the `customize`/`offset`/`repeat` config handling) is
 * carried over unchanged, dissected directly from the real, installed
 * dist output. Only the two small, generic color-*conversion* utility
 * functions this logic calls into (`hsv2rgb`, `rgbString`) are
 * reimplemented locally instead of imported from `@kurkle/color` —
 * both are textbook, standard color-space-conversion algorithms with
 * one universally agreed-upon definition (not any kind of original or
 * bespoke logic of this plugin's own), confirmed by directly comparing
 * this file's own output against the real `@kurkle/color` package's
 * own installed source for the same inputs before removing that
 * package as a dependency again.
 *
 * Fully typed against real Chart.js types throughout, same as this
 * project's other local ports.
 */
import type { Chart, ChartDataset, Plugin } from 'chart.js';

// ---- local color-conversion helpers (reimplemented, not a port of any
// of this plugin's own original logic — see this file's own header
// comment for why) ----

/** Converts an HSV color (hue in degrees `[0, 360)`, saturation/value
 * both `[0, 1]`) to 8-bit RGB — the standard, textbook conversion
 * algorithm, not anything specific to this plugin's own original
 * source. */
function hsv2rgb(h: number, s: number, v: number): [number, number, number] {
  const hPrime = (((h % 360) + 360) % 360) / 60;
  const c = v * s;
  const x = c * (1 - Math.abs((hPrime % 2) - 1));
  const m = v - c;
  let r: number;
  let g: number;
  let b: number;
  if (hPrime < 1) {
    [r, g, b] = [c, x, 0];
  } else if (hPrime < 2) {
    [r, g, b] = [x, c, 0];
  } else if (hPrime < 3) {
    [r, g, b] = [0, c, x];
  } else if (hPrime < 4) {
    [r, g, b] = [0, x, c];
  } else if (hPrime < 5) {
    [r, g, b] = [x, 0, c];
  } else {
    [r, g, b] = [c, 0, x];
  }
  return [Math.round((r + m) * 255), Math.round((g + m) * 255), Math.round((b + m) * 255)];
}

/** Formats an `{r, g, b, a}` color (r/g/b `[0, 255]`, a `[0, 255]` —
 * matching this plugin's own real, confirmed usage of an 8-bit alpha
 * channel, not a `[0, 1]` fraction) as a real CSS `rgba(...)` string
 * Chart.js itself accepts anywhere a color is expected. */
function rgbString({ r, g, b, a }: { r: number; g: number; b: number; a: number }): string {
  return `rgba(${r}, ${g}, ${b}, ${(a / 255).toFixed(3)})`;
}

// ---- faithful port of the original's own real color-selection logic
// (dissected directly from the installed dist output) ----

interface GeneratedColor {
  background: string;
  border: string;
}

/** Infinite generator of hue fractions in `[0, 1)`, stepping through
 * ever-finer binary subdivisions (0, then 1/2, then 1/4 and 3/4, then
 * 1/8, 3/8, 5/8, 7/8, ...) so that early colors are maximally
 * distinguishable from one another before the sequence ever needs to
 * "fill in the gaps" \u2014 the original's own real algorithm, unchanged. */
function* hueGen(): Generator<number, never, void> {
  yield 0;
  // eslint-disable-next-line no-constant-condition -- an intentional,
  // real infinite generator, matching the original's own identical
  // `while (true)` \u2014 colorGen()/getNext() below only ever pull as many
  // values as there are real datasets/data points to color, never
  // exhausting this on their own.
  while (true) {
    for (let i = 1; i < 10; i += 1) {
      const d = 1 << i;
      for (let j = 1; j <= d; j += 2) {
        yield j / d;
      }
    }
  }
}

/** Infinite generator of `{background, border}` color pairs, two per
 * distinct hue (a lighter, more saturated pass at `v=0.8`, then a
 * darker one at `v=0.5`) \u2014 `repeat` yields each pair that many times
 * in a row before advancing to the next hue, for coloring several
 * adjacent datasets/points the same. The original's own real algorithm,
 * unchanged; only `hsv2rgb`/`rgbString` underneath are this port's own
 * local reimplementations. */
function* colorGen(repeat = 1): Generator<GeneratedColor, never, void> {
  const hue = hueGen();
  let h = hue.next();
  // eslint-disable-next-line no-constant-condition -- hueGen() never
  // finishes (see its own comment above), so this loop's own exit
  // condition is structurally unreachable by design, matching the
  // original's own identical shape.
  while (!h.done) {
    let rgb = hsv2rgb(Math.round(h.value * 360), 0.6, 0.8);
    for (let i = 0; i < repeat; i += 1) {
      yield {
        background: rgbString({ r: rgb[0], g: rgb[1], b: rgb[2], a: 192 }),
        border: rgbString({ r: rgb[0], g: rgb[1], b: rgb[2], a: 144 }),
      };
    }
    rgb = hsv2rgb(Math.round(h.value * 360), 0.6, 0.5);
    for (let i = 0; i < repeat; i += 1) {
      yield {
        background: rgbString({ r: rgb[0], g: rgb[1], b: rgb[2], a: 192 }),
        border: rgbString({ r: rgb[0], g: rgb[1], b: rgb[2], a: 144 }),
      };
    }
    h = hue.next();
  }
  // Structurally unreachable at runtime — hueGen() never completes (see
  // its own comment above), so this while loop's own condition can
  // never actually become false. TypeScript's own control-flow analysis
  // can't statically prove that from `Generator<number, never, void>`
  // alone, though (the `never` there documents intent, not something
  // structurally enforced) — confirmed via a real `tsc --noEmit` run
  // flagging "A function returning 'never' cannot have a reachable end
  // point" without this. Same pattern already used in registry.ts's own
  // unreachable `default:` case.
  throw new Error('unreachable: hueGen() never completes');
}

/** The subset of a real Chart.js dataset this plugin's own logic reads/
 * writes directly \u2014 `backgroundColor`/`borderColor` are already part
 * of Chart.js's own real `ChartDataset`, typed here as the real union
 * shape this plugin itself produces (a single color string in
 * `'dataset'`/`'label'` mode, or a real per-point array in `'data'`
 * mode) rather than Chart.js's own much broader `Color`-scriptable
 * type, since this plugin only ever assigns one of these two concrete
 * shapes, never a scriptable function. */
type AutocolorableDataset = Pick<ChartDataset, 'backgroundColor' | 'borderColor'> & { data: unknown[] };

/** Assigns `background`/`border` onto `dataset`, honoring any color the
 * consumer already set explicitly \u2014 confirmed directly from the
 * original's own real logic: `'data'` mode always overwrites (a
 * per-point array can't coexist with a consumer's own single, already-
 * set color the way `'dataset'`/`'label'` mode's simple `||` fallback
 * can), every other mode only fills in what's still unset. Returns
 * whether the dataset ended up with exactly the generated colors (used
 * by `defaultMode()` below to decide whether the *next* color in the
 * sequence is owed to the *next* dataset, or whether this one's own
 * pre-existing color means the current generated color is still
 * "unused" and should be tried again on the next iteration). */
function setColors(dataset: AutocolorableDataset, background: unknown, border: unknown, mode: string): boolean {
  if (mode === 'data') {
    dataset.backgroundColor = background as never;
    dataset.borderColor = border as never;
  } else {
    dataset.backgroundColor = dataset.backgroundColor ?? (background as never);
    dataset.borderColor = dataset.borderColor ?? (border as never);
  }
  return dataset.backgroundColor === background && dataset.borderColor === border;
}

/** Pulls the next color out of `color`, running it through `customize`
 * first if the consumer supplied one \u2014 `customize` receives the same
 * real `{chart, datasetIndex, dataIndex?, label?}` context the caller
 * already has, plus the freshly-generated `colors`, and may return a
 * real replacement `{background, border}` pair instead. */
function getNext(
  color: Generator<GeneratedColor, never, void>,
  customize: ((context: { colors: GeneratedColor } & Record<string, unknown>) => GeneratedColor) | undefined,
  context: Record<string, unknown>,
): GeneratedColor {
  const c = color.next().value;
  if (typeof customize === 'function') {
    return customize({ colors: c, ...context });
  }
  return c;
}

/** `'dataset'` (one new color per dataset) and `'data'` (one new color
 * per data point within each dataset) mode \u2014 both share this same
 * real traversal, branching only on whether a whole dataset or each of
 * its own points gets a single `setColors()` call. The original's own
 * real logic, unchanged. */
function defaultMode(
  chart: Chart,
  gen: Generator<GeneratedColor, never, void>,
  customize: Parameters<typeof getNext>[1],
  mode: string,
): void {
  const datasetMode = mode === 'dataset';

  let c = getNext(gen, customize, { chart, datasetIndex: 0, dataIndex: datasetMode ? undefined : 0 });
  for (const dataset of chart.data.datasets as unknown as AutocolorableDataset[]) {
    if (datasetMode) {
      if (setColors(dataset, c.background, c.border, mode)) {
        c = getNext(gen, customize, { chart, datasetIndex: chart.data.datasets.indexOf(dataset as never) });
      }
    } else {
      const background: string[] = [];
      const border: string[] = [];
      for (let i = 0; i < dataset.data.length; i += 1) {
        background.push(c.background);
        border.push(c.border);
        c = getNext(gen, customize, { chart, datasetIndex: chart.data.datasets.indexOf(dataset as never), dataIndex: i });
      }
      setColors(dataset, background, border, mode);
    }
  }
}

/** `'label'` mode \u2014 keys the generated color to each dataset's own
 * `label` instead of its index, so two datasets sharing a label (e.g.
 * the same series split across two mixed-chart datasets) always get
 * the identical color, confirmed real behavior from the original's own
 * source, not a guess. The original's own real logic, unchanged. */
function labelMode(
  chart: Chart,
  gen: Generator<GeneratedColor, never, void>,
  customize: Parameters<typeof getNext>[1],
  mode: string,
): void {
  const colors: Record<string, GeneratedColor> = {};
  for (const dataset of chart.data.datasets as unknown as (AutocolorableDataset & { label?: string })[]) {
    const label = dataset.label ?? '';
    if (!colors[label]) {
      colors[label] = getNext(gen, customize, { chart, datasetIndex: 0, dataIndex: undefined, label });
    }
    const c = colors[label];
    setColors(dataset, c.background, c.border, mode);
  }
}

/**
 * A real Chart.js plugin, registered via `Chart.register(autocolorPlugin)`
 * \u2014 assigns a distinct, generated color to each dataset (or each data
 * point, in `'data'`/`'label'` mode) that doesn't already have one set,
 * every time the chart updates. `options.plugins.autocolors` accepts
 * `enabled` (default `true`), `mode` (`'dataset'` default, `'data'`, or
 * `'label'`), `offset`/`repeat` (both real numbers), and `customize` (a
 * real function receiving the generated `{background, border}` pair
 * plus context, returning a replacement pair).
 */
export const autocolorPlugin: Plugin = {
  id: 'autocolors',
  beforeUpdate(chart: Chart, _args, options): void {
    const { mode = 'dataset', enabled = true, customize, repeat } = options as {
      mode?: string;
      enabled?: boolean;
      customize?: Parameters<typeof getNext>[1];
      repeat?: number;
      offset?: number;
    };

    if (!enabled) {
      return;
    }

    const gen = colorGen(repeat);

    const offset = (options as { offset?: number }).offset;
    if (offset) {
      // Offsets the color generation by n colors \u2014 the original's own
      // real mechanism is simply calling `.next()` this many times
      // before ever handing the generator to defaultMode()/labelMode(),
      // discarding those results.
      for (let i = 0; i < offset; i += 1) {
        gen.next();
      }
    }

    if (mode === 'label') {
      labelMode(chart, gen, customize, mode);
      return;
    }
    defaultMode(chart, gen, customize, mode);
  },
};
