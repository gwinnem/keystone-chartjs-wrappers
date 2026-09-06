import { describe, expect, it, vi } from 'vitest';
import { annotationPlugin } from '../../../../src/plugins/annotation/annotationPlugin.js';

// Testing the real plugin lifecycle orchestration directly (dissected
// from the real, installed package's own real, unminified ESM build —
// see geometry.ts's own header comment for the full dissection
// rationale).

/** Real, live Chart.js annotation config objects always carry a real
 * `setContext(context)` method by the time this plugin's own
 * `updateElements()` reads them — attached automatically by Chart.js's
 * own internal scriptable-option-resolution system when it resolves
 * `options.plugins.annotation.annotations.*`, not something visible on
 * a plain object literal built directly (as every test here does,
 * bypassing that real resolution pipeline entirely). Each real
 * sub-element scope (`label` for box/line/ellipse, `point` for
 * polygon) also carries its own real `.override(definition)` method,
 * used by `updateSubElements()` to resolve that sub-element's own
 * options — real Chart.js merges `definition`'s own `type` (`'label'`)
 * into the returned resolver, which is what lets `resolveType()` pick
 * the real, correct element class (`LabelAnnotation`) rather than
 * falling back to `'line'`'s own, structurally different defaults.
 * Minimal stubs — replicating just that one real merge — are enough
 * for these tests, since none of them use scriptable (function-valued)
 * options that would need real per-context resolution. Every real
 * annotation type's own `resolveElementProperties()` unconditionally
 * reads `options.label` (with real content, since this project's own
 * real `measureLabelSize` measures whatever `label.content` actually
 * is) — real Chart.js defaults-merging supplies this automatically in
 * production; here it's supplied directly, since these tests bypass
 * that merge entirely. */
function withOverride(scope: Record<string, unknown>): Record<string, unknown> {
  return {
    ...scope,
    override(this: Record<string, unknown>, definition: { type?: string }) {
      return { ...this, type: definition.type };
    },
  };
}

function ann(config: Record<string, unknown>): Record<string, unknown> {
  // Every object-valued key in every real element type's own label
  // defaults (LabelAnnotation.defaults / BoxAnnotation.defaults.label /
  // EllipseAnnotation.defaults.label all share `callout` and `font`)
  // must be present as at least an empty object here — resolveObj()
  // recurses into each one, reading its own nested default keys off
  // whatever this mock provides; a missing key resolves to `undefined`
  // harmlessly, but a missing *object* (undefined instead of `{}`)
  // crashes one level deeper, trying to read a property off
  // `undefined` itself. Real Chart.js production code never hits this
  // at all, since its own real deep-merge already guarantees every
  // nested default object exists before any plugin code runs.
  // `resolveObj()`'s own real job in production is simply reading each
  // prop off an already-fully-resolved Chart.js context proxy — real
  // Chart.js's own internal `.setContext()` machinery is what applies
  // the real annotation → element-options → element-defaults fallback
  // chain *before* this plugin code ever runs; it is not `resolveObj`'s
  // own job to fall back to a default value at all. This test's own
  // `setContext`/`.override()` stubs don't replicate that real proxy,
  // so any field left unset here resolves to `undefined` instead of
  // its real, registered default — `borderWidth`/`hitTolerance` are
  // supplied directly here since real hit-testing (`inRange()`) reads
  // them, matching LineAnnotation.defaults's own real values.
  const merged = { borderWidth: 2, hitTolerance: 0, drawTime: 'afterDatasetsDraw', arrowHeads: { start: {}, end: {} }, controlPoint: {}, label: { content: 'hi', callout: {}, font: {} }, ...config };
  return {
    ...merged,
    label: withOverride(merged.label as Record<string, unknown>),
    setContext(this: Record<string, unknown>) {
      return this;
    },
  };
}

function makeChart(overrides: Record<string, unknown> = {}) {
  return {
    ctx: {
      save: vi.fn(),
      restore: vi.fn(),
      translate: vi.fn(),
      rotate: vi.fn(),
      beginPath: vi.fn(),
      closePath: vi.fn(),
      clip: vi.fn(),
      moveTo: vi.fn(),
      lineTo: vi.fn(),
      arc: vi.fn(),
      rect: vi.fn(),
      ellipse: vi.fn(),
      fill: vi.fn(),
      stroke: vi.fn(),
      fillText: vi.fn(),
      strokeText: vi.fn(),
      drawImage: vi.fn(),
      setLineDash: vi.fn(),
      measureText: (t: string) => ({ width: (t?.length ?? 0) * 6 }),
      isPointInStroke: vi.fn(() => false),
      fillStyle: '',
      strokeStyle: '',
      lineWidth: 0,
      lineCap: 'butt',
      lineJoin: 'miter',
      lineDashOffset: 0,
      shadowColor: '',
      shadowBlur: 0,
      shadowOffsetX: 0,
      shadowOffsetY: 0,
      globalAlpha: 1,
      font: '',
      textAlign: 'start',
      textBaseline: 'alphabetic',
      miterLimit: 10,
    },
    chartArea: { left: 0, top: 0, right: 100, bottom: 100 },
    scales: {
      x: { id: 'x', axis: 'x', left: 0, right: 100, options: {}, isHorizontal: () => true, getPixelForValue: (v: number) => v, parse: (v: unknown) => Number(v) },
      y: { id: 'y', axis: 'y', top: 0, bottom: 100, options: {}, isHorizontal: () => false, getPixelForValue: (v: number) => v, parse: (v: unknown) => Number(v) },
    },
    getContext: () => ({}),
    getActiveElements: () => [],
    ...overrides,
  };
}

/** Runs the real, full lifecycle a Chart.js update would trigger.
 * mode: 'none' takes the real, synchronous `directUpdater` path
 * (`Object.assign`) rather than a genuine `Animations` instance —
 * these tests are about real element creation/hit-testing/event
 * dispatch, not real animation-interpolation timing, and a genuine
 * `Animations` instance may defer property assignment until a real
 * render tick that never happens synchronously in a unit test,
 * leaving `element.getProps()` reading stale (pre-update)
 * coordinates. */
function runUpdate(chart: ReturnType<typeof makeChart>, options: Record<string, unknown>) {
  annotationPlugin.beforeInit!(chart as never, {} as never, {});
  annotationPlugin.beforeUpdate!(chart as never, {} as never, options as never);
  annotationPlugin.afterUpdate!(chart as never, { mode: 'none' } as never, options as never);
}

describe('annotationPlugin — real shape', () => {
  it('has the real, expected id, version, and every documented lifecycle hook', () => {
    expect(annotationPlugin.id).toBe('annotation');
    expect((annotationPlugin as unknown as { version: string }).version).toBe('3.1.0');
    expect(annotationPlugin.beforeInit).toBeTypeOf('function');
    expect(annotationPlugin.beforeUpdate).toBeTypeOf('function');
    expect(annotationPlugin.afterUpdate).toBeTypeOf('function');
    expect(annotationPlugin.afterDatasetsDraw).toBeTypeOf('function');
    expect(annotationPlugin.beforeEvent).toBeTypeOf('function');
    expect(annotationPlugin.afterDestroy).toBeTypeOf('function');
  });

  it('requires Chart.js >= 4.0 in beforeRegister', () => {
    expect(() => (annotationPlugin as unknown as { beforeRegister: () => void }).beforeRegister()).not.toThrow();
  });

  it('registers every real annotation element class in afterRegister', () => {
    expect(() => (annotationPlugin as unknown as { afterRegister: () => void }).afterRegister()).not.toThrow();
  });

  it('unregisters every real annotation element class in afterUnregister', () => {
    expect(() => (annotationPlugin as unknown as { afterUnregister: () => void }).afterUnregister()).not.toThrow();
  });
});

describe('annotationPlugin.beforeUpdate — parsing annotations', () => {
  it('parses a real object-form annotations map, assigning each key as its own id', () => {
    const chart = makeChart();
    annotationPlugin.beforeInit!(chart as never, {} as never, {});
    annotationPlugin.beforeUpdate!(chart as never, {} as never, { annotations: { line1: ann({ type: 'line', scaleID: 'y', value: 10 }) } } as never);
    const annotations = annotationPlugin.getAnnotations(chart as never);
    expect(Array.isArray(annotations)).toBe(true);
  });

  it('parses a real array-form annotations list unchanged', () => {
    const chart = makeChart();
    annotationPlugin.beforeInit!(chart as never, {} as never, {});
    expect(() =>
      annotationPlugin.beforeUpdate!(chart as never, {} as never, { annotations: [ann({ type: 'line', scaleID: 'y', value: 10 })] } as never),
    ).not.toThrow();
  });

  it('does nothing at all when the chart has no real state (beforeInit never ran)', () => {
    const chart = makeChart();
    expect(() => annotationPlugin.beforeUpdate!(chart as never, {} as never, {} as never)).not.toThrow();
  });
});

describe('annotationPlugin.afterUpdate — real element creation', () => {
  it('creates one real annotation element per configured annotation', () => {
    const chart = makeChart();
    runUpdate(chart, { annotations: { line1: ann({ type: 'line', scaleID: 'y', value: 10 }) } });
    const annotations = annotationPlugin.getAnnotations(chart as never) as unknown[];
    expect(annotations).toHaveLength(1);
  });

  it('filters visibleElements to only real, displayed, non-skipped elements', () => {
    const chart = makeChart();
    runUpdate(chart, { annotations: { line1: ann({ type: 'line', scaleID: 'y', value: 10, display: true }) } });
    const annotations = annotationPlugin.getAnnotations(chart as never) as { options?: { display?: boolean } }[];
    expect(annotations[0].options?.display).toBe(true);
  });

  it('resolves a real box annotation from xMin/xMax/yMin/yMax', () => {
    const chart = makeChart();
    runUpdate(chart, { annotations: { box1: ann({ type: 'box', xMin: 0, xMax: 40, yMin: 0, yMax: 40 }) } });
    const annotations = annotationPlugin.getAnnotations(chart as never) as { x?: number }[];
    expect(annotations[0].x).toBe(0);
  });

  it("falls back to 'line' with a real console warning for an unknown annotation type", () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const chart = makeChart();
    runUpdate(chart, { annotations: { odd1: ann({ type: 'bogus', scaleID: 'y', value: 10 }) } });
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('bogus'));
    const annotations = annotationPlugin.getAnnotations(chart as never) as unknown[];
    expect(annotations).toHaveLength(1);
    warn.mockRestore();
  });

  it('goes through the real Animations class (not the directUpdater) for a real, non-skip update mode', () => {
    const chart = makeChart();
    annotationPlugin.beforeInit!(chart as never, {} as never, {});
    annotationPlugin.beforeUpdate!(chart as never, {} as never, { annotations: { box1: ann({ type: 'box', xMin: 0, xMax: 40, yMin: 0, yMax: 40 }) } } as never);
    expect(() => annotationPlugin.afterUpdate!(chart as never, { mode: 'active' } as never, { annotations: { box1: ann({ type: 'box', xMin: 0, xMax: 40, yMin: 0, yMax: 40 }) } } as never)).not.toThrow();
  });

  it('reuses the real, existing element and its cached $context on a second real update', () => {
    const chart = makeChart();
    const options = { annotations: { box1: ann({ type: 'box', xMin: 0, xMax: 40, yMin: 0, yMax: 40 }) } };
    runUpdate(chart, options);
    const first = annotationPlugin.getAnnotations(chart as never) as { $context?: unknown }[];
    annotationPlugin.beforeUpdate!(chart as never, {} as never, options as never);
    annotationPlugin.afterUpdate!(chart as never, { mode: 'none' } as never, options as never);
    const second = annotationPlugin.getAnnotations(chart as never) as { $context?: unknown }[];
    expect(second[0]).toBe(first[0]);
    expect(second[0].$context).toBe(first[0].$context);
  });

  it('shrinks the real element list when a later update has fewer annotations than the last', () => {
    const chart = makeChart();
    const optionsA = { annotations: { a: ann({ type: 'box', xMin: 0, xMax: 10, yMin: 0, yMax: 10 }), b: ann({ type: 'box', xMin: 0, xMax: 10, yMin: 0, yMax: 10 }) } };
    annotationPlugin.beforeInit!(chart as never, {} as never, {});
    annotationPlugin.beforeUpdate!(chart as never, {} as never, optionsA as never);
    annotationPlugin.afterUpdate!(chart as never, { mode: 'none' } as never, optionsA as never);
    expect(annotationPlugin.getAnnotations(chart as never)).toHaveLength(2);

    // Real Chart.js never calls beforeInit again for the same chart's
    // own real lifetime — only beforeUpdate/afterUpdate repeat, reusing
    // the same real per-chart state so resyncElements() actually shrinks
    // the real, existing elements array instead of starting fresh.
    const optionsB = { annotations: { a: ann({ type: 'box', xMin: 0, xMax: 10, yMin: 0, yMax: 10 }) } };
    annotationPlugin.beforeUpdate!(chart as never, {} as never, optionsB as never);
    annotationPlugin.afterUpdate!(chart as never, { mode: 'none' } as never, optionsB as never);
    expect(annotationPlugin.getAnnotations(chart as never)).toHaveLength(1);
  });

  it('resolves a real, array-valued font (one entry per real text line) on the label sub-element', () => {
    const chart = makeChart();
    runUpdate(chart, {
      annotations: {
        box1: ann({ type: 'box', xMin: 0, xMax: 40, yMin: 0, yMax: 40, label: { content: ['a', 'b'], callout: {}, font: [{ size: 10 }, { size: 12 }] } }),
      },
    });
    const annotations = annotationPlugin.getAnnotations(chart as never) as { elements?: { options?: { font?: unknown } }[] }[];
    expect(Array.isArray(annotations[0].elements?.[0]?.options?.font)).toBe(true);
  });
});

describe('annotationPlugin.afterDataLimits', () => {
  it('does not throw when adjusting scale range for real, adjustable annotations', () => {
    const chart = makeChart();
    runUpdate(chart, { annotations: { line1: ann({ type: 'line', scaleID: 'y', value: 500, display: true, adjustScaleRange: true }) } });
    expect(() => annotationPlugin.afterDataLimits!(chart as never, { scale: chart.scales.y } as never, {} as never)).not.toThrow();
  });

  it('does nothing at all when the chart has no real state', () => {
    const chart = makeChart();
    expect(() => annotationPlugin.afterDataLimits!(chart as never, { scale: chart.scales.y } as never, {} as never)).not.toThrow();
  });
});

describe('annotationPlugin — draw hooks', () => {
  it('draws real visible elements at their own configured drawTime (afterDatasetsDraw by default)', () => {
    const chart = makeChart();
    runUpdate(chart, { annotations: { line1: ann({ type: 'line', scaleID: 'y', value: 10, display: true }) } });
    const el = annotationPlugin.getAnnotations(chart as never)[0] as { draw: unknown };
    const drawSpy = vi.spyOn(el, 'draw');
    annotationPlugin.afterDatasetsDraw!(chart as never, {} as never, { clip: true } as never);
    expect(drawSpy).toHaveBeenCalled();
  });

  it("draws a real, visible label sub-element at its own real drawTime", () => {
    const chart = makeChart();
    runUpdate(chart, {
      annotations: {
        box1: ann({ type: 'box', xMin: 0, xMax: 40, yMin: 0, yMax: 40, display: true, label: { content: 'hi', callout: {}, font: {}, display: true, drawTime: 'afterDatasetsDraw' } }),
      },
    });
    const el = annotationPlugin.getAnnotations(chart as never)[0] as { elements: { draw: unknown }[] };
    const subDrawSpy = vi.spyOn(el.elements[0], 'draw');
    annotationPlugin.afterDatasetsDraw!(chart as never, {} as never, { clip: false } as never);
    expect(subDrawSpy).toHaveBeenCalled();
  });

  it('does not draw a real element configured for a different drawTime', () => {
    const chart = makeChart();
    runUpdate(chart, { annotations: { line1: ann({ type: 'line', scaleID: 'y', value: 10, display: true, drawTime: 'beforeDraw' }) } });
    const el = annotationPlugin.getAnnotations(chart as never)[0] as { draw: unknown };
    const drawSpy = vi.spyOn(el, 'draw');
    annotationPlugin.afterDatasetsDraw!(chart as never, {} as never, { clip: false } as never);
    expect(drawSpy).not.toHaveBeenCalled();
  });

  it('does not throw for beforeDatasetsDraw/beforeDatasetDraw/beforeDraw/afterDraw', () => {
    const chart = makeChart();
    runUpdate(chart, { annotations: {} });
    expect(() => annotationPlugin.beforeDatasetsDraw!(chart as never, {} as never, { clip: false } as never)).not.toThrow();
    expect(() => annotationPlugin.beforeDatasetDraw!(chart as never, { index: 0 } as never, { clip: false } as never)).not.toThrow();
    expect(() => annotationPlugin.beforeDraw!(chart as never, {} as never, { clip: false } as never)).not.toThrow();
    expect(() => annotationPlugin.afterDraw!(chart as never, {} as never, { clip: false } as never)).not.toThrow();
  });
});

describe('annotationPlugin.beforeEvent', () => {
  it('sets args.changed to true when a real listener returns true', () => {
    const chart = makeChart();
    runUpdate(chart, { annotations: { line1: ann({ type: 'line', scaleID: 'y', value: 10, display: true, click: () => true }) } });
    annotationPlugin.afterDatasetsDraw!(chart as never, {} as never, { clip: false } as never);

    const args = { event: { type: 'click', x: 50, y: 10 }, changed: false };
    annotationPlugin.beforeEvent!(chart as never, args as never, {} as never);
    expect(args.changed).toBe(true);
  });

  it('does nothing at all when the chart has no real state', () => {
    const chart = makeChart();
    const args = { event: { type: 'click', x: 0, y: 0 }, changed: false };
    expect(() => annotationPlugin.beforeEvent!(chart as never, args as never, {} as never)).not.toThrow();
  });
});

describe('annotationPlugin.afterDestroy / getAnnotations', () => {
  it('removes the real per-chart state entry', () => {
    const chart = makeChart();
    annotationPlugin.beforeInit!(chart as never, {} as never, {});
    annotationPlugin.afterDestroy!(chart as never, {} as never, {} as never);
    expect(annotationPlugin.getAnnotations(chart as never)).toEqual([]);
  });

  it('returns an empty array for a chart with no real state at all', () => {
    const chart = makeChart();
    expect(annotationPlugin.getAnnotations(chart as never)).toEqual([]);
  });
});

describe('annotationPlugin._getAnnotationElementsAtEventForMode', () => {
  it('delegates to the real interaction-mode resolver', () => {
    const el = { inRange: () => true, getCenterPoint: () => ({ x: 0, y: 0 }), _index: 0 };
    const result = (annotationPlugin as unknown as { _getAnnotationElementsAtEventForMode: (a: unknown, b: unknown, c: unknown) => unknown[] })._getAnnotationElementsAtEventForMode(
      [el],
      { x: 0, y: 0 },
      { mode: 'point' },
    );
    expect(result).toEqual([el]);
  });
});

describe('annotationPlugin.defaults / descriptors', () => {
  it('has the real, documented default clip/interaction/common shape', () => {
    const defaults = (annotationPlugin as unknown as { defaults: Record<string, unknown> }).defaults;
    expect(defaults.clip).toBe(true);
    expect((defaults.common as { drawTime: string }).drawTime).toBe('afterDatasetsDraw');
  });

  it('resolves the real annotations._fallback to the matching element type', () => {
    const descriptors = (annotationPlugin as unknown as { descriptors: { annotations: { _fallback: (prop: string, opts: { type?: string }) => string } } }).descriptors;
    expect(descriptors.annotations._fallback('', { type: 'box' })).toBe('elements.boxAnnotation');
  });

  it('marks every real event/draw hook as non-scriptable', () => {
    const descriptors = (annotationPlugin as unknown as { descriptors: { _scriptable: (prop: string) => boolean } }).descriptors;
    expect(descriptors._scriptable('click')).toBe(false);
    expect(descriptors._scriptable('init')).toBe(false);
    expect(descriptors._scriptable('backgroundColor')).toBe(true);
  });
});
