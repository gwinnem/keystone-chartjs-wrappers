import { describe, expect, it, vi } from 'vitest';
import { HitBox, layout } from '../../../../src/plugins/dataLabels/layout.js';
import { Label } from '../../../../src/plugins/dataLabels/label.js';
import { dataLabelsDefaults } from '../../../../src/plugins/dataLabels/dataLabelsPlugin.js';

// Testing the real overlap-detection (Separating Axis Theorem) and
// per-label final-position orchestration directly (dissected from the
// real, installed package's own real, unminified ESM build — see
// utils.ts's own header comment for the full dissection rationale).

describe('HitBox', () => {
  it('reports its own real center from the last update() call', () => {
    const box = new HitBox();
    box.update({ x: 10, y: 20 }, { x: -5, y: -5, w: 10, h: 10 }, 0);
    expect(box.center()).toEqual({ x: 10, y: 20 });
  });

  it('contains a point inside its own real bounds (with the 1px margin)', () => {
    const box = new HitBox();
    box.update({ x: 0, y: 0 }, { x: -10, y: -10, w: 20, h: 20 }, 0);
    expect(box.contains({ x: 0, y: 0 })).toBe(true);
    expect(box.contains({ x: 100, y: 100 })).toBe(false);
  });

  it('detects a real overlap between two intersecting, unrotated boxes', () => {
    const a = new HitBox();
    a.update({ x: 0, y: 0 }, { x: -10, y: -10, w: 20, h: 20 }, 0);
    const b = new HitBox();
    b.update({ x: 5, y: 5 }, { x: -10, y: -10, w: 20, h: 20 }, 0);
    expect(a.intersects(b)).toBe(true);
  });

  it('reports no overlap for two clearly separated boxes', () => {
    const a = new HitBox();
    a.update({ x: 0, y: 0 }, { x: -5, y: -5, w: 10, h: 10 }, 0);
    const b = new HitBox();
    b.update({ x: 100, y: 100 }, { x: -5, y: -5, w: 10, h: 10 }, 0);
    expect(a.intersects(b)).toBe(false);
  });

  it('handles a real overlap test between two differently-rotated boxes', () => {
    const a = new HitBox();
    a.update({ x: 0, y: 0 }, { x: -10, y: -10, w: 20, h: 20 }, 0);
    const b = new HitBox();
    b.update({ x: 5, y: 5 }, { x: -10, y: -10, w: 20, h: 20 }, Math.PI / 6);
    expect(() => a.intersects(b)).not.toThrow();
  });
});

function makeCtx() {
  return {
    measureText: (text: string) => ({ width: text.length * 6 }),
    fillText: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    translate: vi.fn(),
    rotate: vi.fn(),
    beginPath: vi.fn(),
    rect: vi.fn(),
    clip: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    arc: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    font: '',
  };
}

function makeChartContext(dataIndex = 0) {
  return {
    active: false,
    chart: { chartArea: { left: 0, top: 0, right: 100, bottom: 100 }, getDatasetMeta: () => ({}) },
    dataIndex,
    dataset: { data: [1, 2, 3] },
    datasetIndex: 0,
  } as never;
}

function makeElement(x: number, y: number) {
  return {
    x,
    y,
    getProps: (props: string[]) => Object.fromEntries(props.map((p) => [p, p === 'x' ? x : y])),
  };
}

describe('layout.prepare / layout.update', () => {
  it('assigns real layout state to every label across every dataset', () => {
    const label = new Label({ ...dataLabelsDefaults }, makeCtx() as never, makeElement(0, 0), 0);
    label.update(makeChartContext(0));

    const result = layout.prepare([[label]]);

    expect(result).toHaveLength(1);
    expect(label.layoutState).toBeDefined();
    expect(label.layoutState?.visible).toBe(true);
  });

  it('does not run overlap computation at all when no label is display:auto', () => {
    const label1 = new Label({ ...dataLabelsDefaults }, makeCtx() as never, makeElement(0, 0), 0);
    label1.update(makeChartContext(0));
    const label2 = new Label({ ...dataLabelsDefaults }, makeCtx() as never, makeElement(0, 0), 1);
    label2.update(makeChartContext(1));

    layout.prepare([[label1, label2]]);

    // Both stay visible — real overlap detection never ran (no
    // display: 'auto' label present), even though both share the exact
    // same real position and would otherwise collide.
    expect(label1.layoutState?.visible).toBe(true);
    expect(label2.layoutState?.visible).toBe(true);
  });

  it('auto-hides one of two genuinely overlapping display:"auto" labels', () => {
    const label1 = new Label({ ...dataLabelsDefaults, display: 'auto' }, makeCtx() as never, makeElement(0, 0), 0);
    label1.update(makeChartContext(0));
    const label2 = new Label({ ...dataLabelsDefaults, display: 'auto' }, makeCtx() as never, makeElement(0, 0), 1);
    label2.update(makeChartContext(1));

    layout.prepare([[label1, label2]]);

    const visibleCount = [label1, label2].filter((l) => l.layoutState?.visible).length;
    expect(visibleCount).toBe(1);
  });

  it('auto-hides the real display:"auto" label, not the always-visible one, when they overlap', () => {
    const alwaysVisible = new Label({ ...dataLabelsDefaults }, makeCtx() as never, makeElement(0, 0), 0);
    alwaysVisible.update(makeChartContext(0));
    const autoLabel = new Label({ ...dataLabelsDefaults, display: 'auto' }, makeCtx() as never, makeElement(0, 0), 1);
    autoLabel.update(makeChartContext(1));

    layout.prepare([[alwaysVisible, autoLabel]]);

    expect(alwaysVisible.layoutState?.visible).toBe(true);
    expect(autoLabel.layoutState?.visible).toBe(false);
  });
});

describe('layout.lookup', () => {
  it('finds the real, topmost label whose own hit box contains the point', () => {
    const label = new Label({ ...dataLabelsDefaults }, makeCtx() as never, makeElement(50, 50), 0);
    label.update(makeChartContext(0));
    const labels = layout.prepare([[label]]);
    // A real chart always draws once before a person can click/hover it
    // — layout.draw() is what actually positions each label's own box
    // (layout.prepare()/update() only do so for display:'auto' labels,
    // via overlap computation).
    layout.draw({ ctx: makeCtx() } as never, labels);

    const found = layout.lookup(labels, { x: 50, y: 50 });
    expect(found).toBe(label);
  });

  it('returns null when no label contains the point', () => {
    const label = new Label({ ...dataLabelsDefaults }, makeCtx() as never, makeElement(50, 50), 0);
    label.update(makeChartContext(0));
    const labels = layout.prepare([[label]]);
    layout.draw({ ctx: makeCtx() } as never, labels);

    const found = layout.lookup(labels, { x: 900, y: 900 });
    expect(found).toBeNull();
  });

  it('returns null for a hidden (invisible) label even at its own real position', () => {
    const label = new Label({ ...dataLabelsDefaults, display: false }, makeCtx() as never, makeElement(50, 50), 0);
    label.update(makeChartContext(0));
    const labels = layout.prepare([[label]]);
    layout.draw({ ctx: makeCtx() } as never, labels);

    expect(layout.lookup(labels, { x: 50, y: 50 })).toBeNull();
  });
});

describe('layout.draw', () => {
  it('draws every currently-visible label, skipping hidden ones', () => {
    const visibleLabel = new Label({ ...dataLabelsDefaults }, makeCtx() as never, makeElement(10, 10), 0);
    visibleLabel.update(makeChartContext(0));
    const hiddenLabel = new Label({ ...dataLabelsDefaults, display: false }, makeCtx() as never, makeElement(20, 20), 1);
    hiddenLabel.update(makeChartContext(1));

    const labels = layout.prepare([[visibleLabel, hiddenLabel]]);
    const drawSpy = vi.spyOn(visibleLabel, 'draw');
    const drawSpyHidden = vi.spyOn(hiddenLabel, 'draw');

    layout.draw({ ctx: makeCtx() } as never, labels);

    expect(drawSpy).toHaveBeenCalled();
    expect(drawSpyHidden).not.toHaveBeenCalled();
  });
});
