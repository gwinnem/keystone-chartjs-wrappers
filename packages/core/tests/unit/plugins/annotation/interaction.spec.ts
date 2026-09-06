import { describe, expect, it, vi } from 'vitest';
import { getElements, interaction } from '../../../../src/plugins/annotation/interaction.js';

// Testing the real hit-testing interaction modes directly (dissected
// from the real, installed package's own real, unminified ESM build —
// see geometry.ts's own header comment for the full dissection
// rationale).

function makeElement(inRangeResult: boolean, center: { x: number; y: number }, index = 0) {
  return {
    _index: index,
    inRange: vi.fn(() => inRangeResult),
    getCenterPoint: () => center,
  };
}

describe('interaction.modes.point', () => {
  it('returns only elements that intersect the exact event point', () => {
    const hit = makeElement(true, { x: 0, y: 0 });
    const miss = makeElement(false, { x: 0, y: 0 });
    const result = interaction.modes.point([hit, miss], { x: 5, y: 5 });
    expect(result).toEqual([hit]);
    expect(hit.inRange).toHaveBeenCalledWith(5, 5);
  });
});

describe('interaction.modes.x / interaction.modes.y', () => {
  it('restricts the real hit test to the x axis', () => {
    const el = makeElement(true, { x: 0, y: 0 });
    interaction.modes.x([el], { x: 1, y: 1 }, { intersect: false });
    expect(el.inRange).toHaveBeenCalledWith(1, 1, 'x', true);
  });

  it('restricts the real hit test to the y axis', () => {
    const el = makeElement(true, { x: 0, y: 0 });
    interaction.modes.y([el], { x: 1, y: 1 }, { intersect: false });
    expect(el.inRange).toHaveBeenCalledWith(1, 1, 'y', true);
  });

  it('uses real intersection testing when intersect is true', () => {
    const el = makeElement(true, { x: 0, y: 0 });
    interaction.modes.x([el], { x: 1, y: 1 }, { intersect: true });
    expect(el.inRange).toHaveBeenCalledWith(1, 1);
  });
});

describe('interaction.modes.nearest', () => {
  it('returns the single closest real element among the hits', () => {
    const near = makeElement(true, { x: 1, y: 1 }, 0);
    const far = makeElement(true, { x: 100, y: 100 }, 1);
    const result = interaction.modes.nearest([far, near], { x: 0, y: 0 }, {});
    expect(result).toEqual([near]);
  });

  it('returns an empty array when nothing matches', () => {
    const miss = makeElement(false, { x: 0, y: 0 });
    expect(interaction.modes.nearest([miss], { x: 0, y: 0 }, {})).toEqual([]);
  });

  it('breaks ties by real _index, ascending', () => {
    const first = makeElement(true, { x: 5, y: 0 }, 0);
    const second = makeElement(true, { x: -5, y: 0 }, 1);
    // Both are equidistant from (0,0) — real tie, sorted by _index.
    const result = interaction.modes.nearest([second, first], { x: 0, y: 0 }, {});
    expect(result).toHaveLength(1);
    expect(result[0]._index).toBe(0);
  });

  it('treats a real element with no _index at all as index 0 when sorting ties', () => {
    const noIndex = { inRange: vi.fn(() => true), getCenterPoint: () => ({ x: 5, y: 0 }) };
    const withIndex = makeElement(true, { x: -5, y: 0 }, 1);
    const result = interaction.modes.nearest([withIndex, noIndex], { x: 0, y: 0 }, {});
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(noIndex);
  });

  it('restricts the real nearest-distance measurement to a single axis when given', () => {
    const el = makeElement(true, { x: 10, y: 100 }, 0);
    const result = interaction.modes.nearest([el], { x: 10, y: 0 }, { axis: 'x' });
    expect(result).toEqual([el]);
  });

  it('restricts the real nearest-distance measurement to the y axis when given', () => {
    const el = makeElement(true, { x: 100, y: 10 }, 0);
    const result = interaction.modes.nearest([el], { x: 0, y: 10 }, { axis: 'y' });
    expect(result).toEqual([el]);
  });
});

describe('getElements', () => {
  it('dispatches to the named mode', () => {
    const el = makeElement(true, { x: 0, y: 0 });
    const result = getElements([el], { x: 0, y: 0 }, { mode: 'point' });
    expect(result).toEqual([el]);
  });

  it('falls back to nearest for an unknown/absent mode', () => {
    const el = makeElement(true, { x: 0, y: 0 });
    const result = getElements([el], { x: 0, y: 0 }, {});
    expect(result).toEqual([el]);
  });
});
