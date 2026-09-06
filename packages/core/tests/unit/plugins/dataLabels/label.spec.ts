import { describe, expect, it, vi } from 'vitest';
import { Label } from '../../../../src/plugins/dataLabels/label.js';
import { dataLabelsDefaults } from '../../../../src/plugins/dataLabels/dataLabelsPlugin.js';
import type { DataLabelsConfig } from '../../../../src/types.js';

// Testing the real per-label config resolution / draw logic directly
// (dissected from the real, installed package's own real, unminified
// ESM build — see utils.ts's own header comment for the full
// dissection rationale). Config passed to `Label` here already
// includes the plugin's own real defaults merged in (mirroring what
// Chart.js's own core plugin-options resolution does automatically at
// runtime, via the plugin object's own `defaults` field, before any of
// this code ever runs for a real chart).

function makeCtx() {
  return {
    font: '',
    measureText: (text: string) => ({ width: text.length * 6 }),
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
    fillText: vi.fn(),
    strokeText: vi.fn(),
    globalAlpha: 1,
  };
}

function makeContext(dataset: { data: unknown[] }) {
  return {
    active: false,
    chart: { chartArea: { left: 0, top: 0, right: 100, bottom: 100 }, getDatasetMeta: () => ({}) },
    dataIndex: 0,
    dataset,
    datasetIndex: 0,
  } as never;
}

describe('Label.update — hidden labels', () => {
  it('computes no model at all when display resolves to false', () => {
    const config: DataLabelsConfig = { ...dataLabelsDefaults, display: false };
    const label = new Label(config, makeCtx() as never, {}, 0);

    label.update(makeContext({ data: [42] }));

    expect(label.visible()).toBe(false);
    expect(label.getModel()).toBeNull();
    expect(label.geometry()).toEqual({});
  });

  it('computes no model when the formatted value has no real text lines', () => {
    const config: DataLabelsConfig = { ...dataLabelsDefaults, formatter: () => null };
    const label = new Label(config, makeCtx() as never, {}, 0);

    label.update(makeContext({ data: [42] }));

    expect(label.visible()).toBe(false);
  });
});

describe('Label.update — visible labels', () => {
  it('resolves a real, visible model for a plain numeric value', () => {
    const config: DataLabelsConfig = { ...dataLabelsDefaults };
    const label = new Label(config, makeCtx() as never, { x: 10, y: 10 }, 0);

    label.update(makeContext({ data: [42] }));

    expect(label.visible()).toBe(true);
    expect(label.getModel()?.lines).toEqual(['42']);
  });

  it("uses the config's own formatter to transform the value", () => {
    const config: DataLabelsConfig = { ...dataLabelsDefaults, formatter: (v) => `$${v}` };
    const label = new Label(config, makeCtx() as never, { x: 0, y: 0 }, 0);

    label.update(makeContext({ data: [7] }));

    expect(label.getModel()?.lines).toEqual(['$7']);
  });

  it('records the resolved rotation in radians, converted from real config degrees', () => {
    const config: DataLabelsConfig = { ...dataLabelsDefaults, rotation: 90 };
    const label = new Label(config, makeCtx() as never, { x: 0, y: 0 }, 0);

    label.update(makeContext({ data: [1] }));

    expect(label.rotation()).toBeCloseTo(Math.PI / 2, 5);
  });

  it('reports invisible when opacity resolves to 0', () => {
    const config: DataLabelsConfig = { ...dataLabelsDefaults, opacity: 0 };
    const label = new Label(config, makeCtx() as never, { x: 0, y: 0 }, 0);

    label.update(makeContext({ data: [1] }));

    expect(label.visible()).toBe(false);
  });

  it('exposes the real element it was constructed for', () => {
    const el = { x: 0, y: 0 };
    const label = new Label({ ...dataLabelsDefaults }, makeCtx() as never, el, 0);
    expect(label.getElement()).toBe(el);
  });
});

describe('Label.draw', () => {
  it('does nothing at all when the label is not visible', () => {
    const ctx = makeCtx();
    const config: DataLabelsConfig = { ...dataLabelsDefaults, display: false };
    const label = new Label(config, ctx as never, {}, 0);
    label.update(makeContext({ data: [1] }));

    label.draw({ ctx } as never, { x: 0, y: 0 });

    expect(ctx.save).not.toHaveBeenCalled();
  });

  it('translates to the given center and rotates by the resolved rotation', () => {
    const ctx = makeCtx();
    const config: DataLabelsConfig = { ...dataLabelsDefaults, rotation: 45 };
    const label = new Label(config, ctx as never, { x: 0, y: 0 }, 0);
    label.update(makeContext({ data: [1] }));

    label.draw({ ctx } as never, { x: 12, y: 34 });

    expect(ctx.translate).toHaveBeenCalledWith(12, 34);
    expect(ctx.rotate).toHaveBeenCalledWith(Math.PI / 4);
    expect(ctx.save).toHaveBeenCalled();
    expect(ctx.restore).toHaveBeenCalled();
  });

  it('clips to the real chart area when clip is configured', () => {
    const ctx = makeCtx();
    const config: DataLabelsConfig = { ...dataLabelsDefaults, clip: true };
    const label = new Label(config, ctx as never, { x: 0, y: 0 }, 0);
    label.update(makeContext({ data: [1] }));

    label.draw({ ctx } as never, { x: 0, y: 0 });

    expect(ctx.clip).toHaveBeenCalled();
  });

  it('does not clip when clip is not configured', () => {
    const ctx = makeCtx();
    const config: DataLabelsConfig = { ...dataLabelsDefaults, clip: false };
    const label = new Label(config, ctx as never, { x: 0, y: 0 }, 0);
    label.update(makeContext({ data: [1] }));

    label.draw({ ctx } as never, { x: 0, y: 0 });

    expect(ctx.clip).not.toHaveBeenCalled();
  });
});
