import { describe, expect, it, vi } from 'vitest';
import { DoughnutController } from 'chart.js';
import { DoughnutLabelAnnotation } from '../../../../../src/plugins/annotation/elements/doughnutLabelAnnotation.js';

function makeCtx() {
  return {
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    fillText: vi.fn(),
    strokeText: vi.fn(),
    setLineDash: vi.fn(),
    measureText: (t: string) => ({ width: t.length * 6 }),
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
    shadowColor: '',
    font: '',
    textAlign: 'start',
    textBaseline: 'alphabetic',
  };
}

function makeLabel(props: Record<string, unknown> = {}, options: Record<string, unknown> = {}) {
  const label = new DoughnutLabelAnnotation();
  Object.assign(label, { rotation: 0, _fitRatio: 1, ...props });
  (label as unknown as { options: Record<string, unknown> }).options = { display: true, content: 'hi', hitTolerance: 0, ...options };
  return label;
}

describe('DoughnutLabelAnnotation — static config', () => {
  it('has the real id and defaults', () => {
    expect(DoughnutLabelAnnotation.id).toBe('doughnutLabelAnnotation');
    expect(DoughnutLabelAnnotation.defaults.autoFit).toBe(true);
    expect(DoughnutLabelAnnotation.defaults.autoHide).toBe(true);
  });
});

describe('DoughnutLabelAnnotation#inRange / getCenterPoint', () => {
  it('detects a point inside the real label rect via getProps', () => {
    const label = makeLabel();
    (label as unknown as { getProps: () => Record<string, number> }).getProps = () => ({ x: 0, y: 0, x2: 40, y2: 20, centerX: 20, centerY: 10 });
    expect(label.inRange(20, 10)).toBe(true);
  });

  it('returns the real center point', () => {
    const label = makeLabel();
    (label as unknown as { getProps: () => Record<string, number> }).getProps = () => ({ centerX: 20, centerY: 10 });
    expect(label.getCenterPoint()).toEqual({ x: 20, y: 10 });
  });
});

describe('DoughnutLabelAnnotation#draw', () => {
  it('does nothing at all when display is false', () => {
    const ctx = makeCtx();
    const label = makeLabel({}, { display: false });
    label.draw(ctx as never);
    expect(ctx.save).not.toHaveBeenCalled();
  });

  it('does nothing when content is falsy', () => {
    const ctx = makeCtx();
    const label = makeLabel({}, { content: null });
    label.draw(ctx as never);
    expect(ctx.save).not.toHaveBeenCalled();
  });

  it('draws real background + label content when visible', () => {
    const ctx = makeCtx();
    const label = makeLabel(
      { _centerX: 50, _centerY: 50, _radius: 20, _startAngle: 0, _endAngle: Math.PI * 2, _counterclockwise: false },
      { display: true, content: 'hi', color: 'black', textAlign: 'center', font: {} },
    );
    (label as unknown as { getCenterPoint: () => { x: number; y: number } }).getCenterPoint = () => ({ x: 50, y: 50 });
    label.draw(ctx as never);
    expect(ctx.arc).toHaveBeenCalled();
    expect(ctx.fillText).toHaveBeenCalled();
  });
});

describe('DoughnutLabelAnnotation#resolveElementProperties', () => {
  function makeDoughnutChart(visible = true) {
    const controller = Object.create(DoughnutController.prototype) as unknown as {
      innerRadius: number;
      offsetX: number;
      offsetY: number;
      options: { circumference: number };
    };
    Object.assign(controller, { innerRadius: 40, offsetX: 0, offsetY: 0, options: { circumference: 360 } });
    const meta = { controller, data: [{ hidden: !visible }] };
    return {
      chartArea: { left: 0, top: 0, right: 200, bottom: 200 },
      ctx: makeCtx(),
      getSortedVisibleDatasetMetas: () => [meta],
      getDataVisibility: () => visible,
    };
  }

  it('returns {} when no visible doughnut dataset is found', () => {
    const chart = makeDoughnutChart(false);
    const label = makeLabel();
    const result = label.resolveElementProperties(chart as never, { autoHide: true, autoFit: true, content: 'hi', font: {}, position: 'center', xAdjust: 0, yAdjust: 0, spacing: 1, borderWidth: 0 } as never);
    expect(result).toEqual({});
  });

  it('finds a real hidden dataset anyway when autoHide is false', () => {
    const chart = makeDoughnutChart(false);
    const label = makeLabel();
    const result = label.resolveElementProperties(chart as never, { autoHide: false, autoFit: true, content: 'hi', font: {}, position: 'center', xAdjust: 0, yAdjust: 0, spacing: 1, borderWidth: 0 } as never) as Record<string, unknown>;
    expect(result).toHaveProperty('_radius');
  });

  it('excludes a real doughnut ring whose own circumference is below 90 degrees', () => {
    const chart = makeDoughnutChart(true);
    (chart.getSortedVisibleDatasetMetas()[0].controller as unknown as { options: { circumference: number } }).options.circumference = 45;
    const label = makeLabel();
    const result = label.resolveElementProperties(chart as never, { autoHide: true, autoFit: true, content: 'hi', font: {}, position: 'center', xAdjust: 0, yAdjust: 0, spacing: 1, borderWidth: 0 } as never);
    expect(result).toEqual({});
  });

  it('resolves a real, centered label position within the doughnut hole', () => {
    const chart = makeDoughnutChart(true);
    const label = makeLabel();
    const result = label.resolveElementProperties(chart as never, { autoHide: true, autoFit: true, content: 'hi', font: {}, position: 'center', xAdjust: 0, yAdjust: 0, spacing: 1, borderWidth: 0 } as never) as Record<string, unknown>;
    expect(result).toHaveProperty('_radius');
    expect(result).toHaveProperty('_fitRatio');
  });

  it("shrinks the real label font when it doesn't fit inside a small doughnut hole (autoFit)", () => {
    const chart = makeDoughnutChart(true);
    (chart.getSortedVisibleDatasetMetas()[0].controller as unknown as { innerRadius: number }).innerRadius = 5;
    const label = makeLabel();
    const result = label.resolveElementProperties(chart as never, {
      autoHide: true,
      autoFit: true,
      content: 'a very long piece of label content',
      font: { size: 40 },
      position: 'center',
      xAdjust: 0,
      yAdjust: 0,
      spacing: 1,
      borderWidth: 0,
    } as never) as Record<string, unknown> & { _fitRatio: number };
    expect(result._fitRatio).toBeLessThan(1);
  });

  it('resolves a real, non-degenerate background arc when the doughnut ring is offset off-center', () => {
    const chart = makeDoughnutChart(true);
    // Pushing the ring's own real center upward (a real, non-zero
    // offsetY) puts the square's own real vertical midpoint above the
    // ring's true center — the real, confirmed condition under which
    // getAngles()'s own quadratic actually has two real roots, unlike
    // this file's own other tests, whose symmetric setup always lands
    // in the degenerate (delta <= 0) fallback.
    (chart.getSortedVisibleDatasetMetas()[0].controller as unknown as { offsetY: number }).offsetY = -80;
    const label = makeLabel();
    const result = label.resolveElementProperties(chart as never, { autoHide: true, autoFit: true, content: 'hi', font: {}, position: 'center', xAdjust: 0, yAdjust: 0, spacing: 1, borderWidth: 0 } as never) as Record<string, unknown>;
    expect(result).toHaveProperty('_startAngle');
    expect(result).toHaveProperty('_endAngle');
  });
});
