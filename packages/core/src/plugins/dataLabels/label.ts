/**
 * The per-label object, faithfully ported from `chartjs-plugin-
 * datalabels` (v2.2.0, MIT) \u2014 real source dissected directly from the
 * installed package's own real, unminified ESM build. See `utils.ts`'s
 * own header comment for the full dissection rationale.
 *
 * Converted from the original's own real prototype-based constructor
 * (`function Label(...) {...}`, `merge(Label.prototype, {...})`) into
 * an idiomatic TS class \u2014 identical real logic and field names, no
 * behavior change. **One real, deliberate structural improvement**:
 * the original attaches its own per-label bookkeeping (`$groups`,
 * `$context`, and \u2014 in `layout.ts` \u2014 `$layout`) as ad-hoc,
 * dollar-prefixed properties monkey-patched directly onto each real
 * `Label` instance after construction. Since `Label` is this project's
 * own class (not a third-party object or a DOM element, unlike the
 * `chart[EXPANDO_KEY]`/`element[EXPANDO_KEY]` pattern `deferredPlugin.ts`'s
 * own port replaced with `WeakMap`s), there's no real reason to keep
 * that same ad-hoc-property style here \u2014 the identical state is
 * declared as real, typed public fields on the class instead
 * (`groups`, `context`, `layoutState`), set directly rather than via
 * dynamic property assignment.
 */
import { defaults as chartDefaults, type Chart } from 'chart.js';
import { callback, isNullOrUndef, resolve, toFont, toPadding, valueOrDefault } from 'chart.js/helpers';
import { boundingRects, drawFrame, drawText, getPositioner, getScaleOrigin, type LabelModel, type LabelRects } from './drawing.js';
import { bound, toTextLines, textSize, rasterize } from './utils.js';
import type { HitBox } from './layout.js';
import type { DataLabelsConfig, DataLabelsContext } from '../../types.js';

/** A thin, typed wrapper around Chart.js's own real `resolve()` helper
 * (from `chart.js/helpers`) \u2014 that helper's own real signature is
 * generic over an `unknown[]` of scriptable inputs and returns
 * `unknown`, which doesn't line up with this file's own precisely-
 * modeled `DataLabelsConfig` field types. Safe at runtime: Chart.js
 * itself does no compile-time shape checking here either, only reads
 * whatever value each real field resolves to (the same "cast is safe,
 * Chart.js checks nothing at compile time" reasoning already used for
 * `AnnotationPluginOptions`/`ZoomPluginOptions`/etc. elsewhere in this
 * project). */
function resolveOpt<T>(inputs: unknown[], context: DataLabelsContext, index: number): T {
  return resolve(inputs as never, context as never, index) as T;
}

export type LabelContext = DataLabelsContext;

/** Which dataset/named-label group this label belongs to \u2014 used to
 * key its own event listeners (`options.plugins.datalabels.labels.
 * <key>.listeners`) and to look up the label a real event landed on. */
export interface LabelGroups {
  set: string;
  key: string;
}

/** Real per-label overlap-detection bookkeeping, populated by
 * `layout.ts`'s own `prepare()`/`update()` \u2014 kept as a typed field on
 * `Label` itself (see this file's own header comment for why), not a
 * separate map keyed by label. */
export interface LayoutState {
  box: HitBox;
  hidable: boolean;
  visible: boolean;
  set: number;
  idx: number;
}

/** One real, resolved data label \u2014 its own `update(context)` re-resolves
 * every scriptable option (display, formatter, align, anchor, colors,
 * font, \u2026) against the current context, computing a fresh `model`/
 * `rects` pair; `draw()` paints the already-computed frame + text at a
 * given screen position. */
export class Label {
  private readonly config: DataLabelsConfig;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly el: unknown;
  private readonly index: number;
  private model: LabelModel | null = null;
  private rects: LabelRects | null = null;

  /** Which dataset/named-label group this label belongs to \u2014 set once,
   * right after construction, by `dataLabelsPlugin.ts`. */
  groups: LabelGroups | undefined;
  /** The most recently resolved real context this label's own `update()`
   * was last called with \u2014 re-used by `dataLabelsPlugin.ts`'s own real
   * event dispatch to re-`update()` a label after toggling its own
   * `context.active` flag on hover. */
  context: DataLabelsContext | undefined;
  /** Real overlap-detection state, populated by `layout.ts`. */
  layoutState: LayoutState | undefined;

  constructor(config: DataLabelsConfig, ctx: CanvasRenderingContext2D, el: unknown, index: number) {
    this.config = config;
    this.ctx = ctx;
    this.el = el;
    this.index = index;
  }

  private modelize(display: boolean | 'auto', lines: string[], config: DataLabelsConfig, context: DataLabelsContext): LabelModel {
    const index = this.index;
    const font = toFont(resolveOpt<never>([config.font, {}], context, index));
    // `chartDefaults.color` is bound to an intermediate `unknown`-typed
    // variable before use in the array literal below — Chart.js's own
    // real, deeply recursive scriptable-color type otherwise blows past
    // TypeScript's own union-complexity limit (TS2590) the moment it's
    // placed directly into an array literal, even with an `as unknown[]`
    // cast on the literal itself (that cast applies too late — TS
    // widens/evaluates each element's own type first).
    const defaultColor: unknown = chartDefaults.color;
    const color = resolveOpt<string | undefined>([config.color, defaultColor], context, index);
    return {
      align: resolveOpt<string | number>([config.align, 'center'], context, index),
      anchor: resolveOpt<'start' | 'end' | 'center'>([config.anchor, 'center'], context, index),
      area: context.chart.chartArea,
      backgroundColor: resolveOpt<string | null>([config.backgroundColor, null], context, index),
      borderColor: resolveOpt<string | null>([config.borderColor, null], context, index),
      borderRadius: resolveOpt<number>([config.borderRadius, 0], context, index),
      borderWidth: resolveOpt<number>([config.borderWidth, 0], context, index),
      clamp: resolveOpt<boolean>([config.clamp, false], context, index),
      clip: resolveOpt<boolean>([config.clip, false], context, index),
      color,
      display,
      font,
      lines,
      offset: resolveOpt<number>([config.offset, 4], context, index),
      opacity: resolveOpt<number>([config.opacity, 1], context, index),
      origin: getScaleOrigin(this.el as { horizontal?: boolean }, context) ?? { x: null, y: null },
      padding: toPadding(resolveOpt<never>([config.padding, 4], context, index)),
      positioner: getPositioner(this.el),
      rotation: resolveOpt<number>([config.rotation, 0], context, index) * (Math.PI / 180),
      size: textSize(this.ctx, lines, font),
      textAlign: resolveOpt<CanvasTextAlign>([config.textAlign, 'start'], context, index),
      textShadowBlur: resolveOpt<number>([config.textShadowBlur, 0], context, index),
      textShadowColor: resolveOpt<string | undefined>([config.textShadowColor, color], context, index),
      textStrokeColor: resolveOpt<string | undefined>([config.textStrokeColor, color], context, index),
      textStrokeWidth: resolveOpt<number>([config.textStrokeWidth, 0], context, index),
    };
  }

  /** Re-resolves this label's own full config against `context` \u2014
   * `display` is resolved first, on its own, so a hidden label
   * (`display: false`) skips every other real computation entirely. */
  update(context: DataLabelsContext): void {
    this.context = context;
    const config = this.config;
    const index = this.index;
    const display = resolveOpt<boolean | 'auto'>([config.display, true], context, index);

    let model: LabelModel | null = null;
    let rects: LabelRects | null = null;

    if (display) {
      const dataset = context.dataset as { data: unknown[] };
      const value = dataset.data[index];
      const label = valueOrDefault(callback(config.formatter as never, [value, context]), value);
      const lines = isNullOrUndef(label) ? [] : toTextLines(label);
      if (lines.length) {
        model = this.modelize(display, lines, config, context);
        rects = boundingRects(model);
      }
    }

    this.model = model;
    this.rects = rects;
  }

  /** The label's own real, un-translated bounding frame \u2014 `{}` when
   * hidden (no real model computed at all). */
  geometry(): LabelRects['frame'] | Record<string, never> {
    return this.rects ? this.rects.frame : {};
  }

  rotation(): number {
    return this.model ? this.model.rotation : 0;
  }

  /** A label counts as visible once it has a real, computed model with
   * a non-zero opacity \u2014 used both to skip drawing and (in
   * `layout.ts`) to decide whether it participates in overlap
   * detection at all. */
  visible(): boolean {
    return !!this.model && this.model.opacity > 0;
  }

  getModel(): LabelModel | null {
    return this.model;
  }

  /** Exposes the real element this label was constructed for \u2014 read
   * by `layout.ts`'s own final-position computation (via a real
   * `Proxy` reading each requested property through Chart.js's own
   * `getProps([p], true)`, bypassing any in-flight animation
   * interpolation \u2014 see that file's own header comment). */
  getElement(): unknown {
    return this.el;
  }

  /** Draws the label's own already-computed frame + text at `center`
   * (its own real, final screen position \u2014 resolved separately in
   * `layout.ts`, since that's also where overlap detection reads it
   * from). */
  draw(chart: Chart, center: { x: number; y: number }): void {
    if (!this.visible()) return;
    const model = this.model!;
    const rects = this.rects!;
    const ctx = chart.ctx;

    ctx.save();

    if (model.clip) {
      const area = model.area;
      ctx.beginPath();
      ctx.rect(area.left, area.top, area.right - area.left, area.bottom - area.top);
      ctx.clip();
    }

    ctx.globalAlpha = bound(0, model.opacity, 1);
    ctx.translate(rasterize(center.x), rasterize(center.y));
    ctx.rotate(model.rotation);

    drawFrame(ctx, rects.frame, model);
    drawText(ctx, model.lines, rects.text, model);

    ctx.restore();
  }
}
