import { describe, expect, it } from 'vitest';
import { arrayDiff, bound, rasterize, textSize, toTextLines } from '../../../../src/plugins/dataLabels/utils.js';

// Testing the real shared utility functions directly (dissected from
// the real, installed package's own real, unminified ESM build — see
// utils.ts's own header comment for the full dissection rationale).

describe('toTextLines', () => {
  it('splits a real multi-line string on \\n', () => {
    expect(toTextLines('a\nb\nc')).toEqual(['a', 'b', 'c']);
  });

  it('flattens a real, nested array of strings', () => {
    expect(toTextLines(['a', ['b', 'c']])).toEqual(['a', 'b', 'c']);
  });

  it('stringifies a real, non-string, non-array value', () => {
    expect(toTextLines(42)).toEqual(['42']);
  });

  it('returns an empty array for null/undefined', () => {
    expect(toTextLines(null)).toEqual([]);
    expect(toTextLines(undefined)).toEqual([]);
  });
});

describe('textSize', () => {
  it('measures the real widest line and swaps the font in/out around it', () => {
    let currentFont = '';
    const ctx = {
      get font() {
        return currentFont;
      },
      set font(value: string) {
        currentFont = value;
      },
      measureText: (text: string) => ({ width: text.length * 10 }),
    } as unknown as CanvasRenderingContext2D;
    ctx.font = 'initial';

    const result = textSize(ctx, ['short', 'longer line'], { string: '12px Arial', lineHeight: 1.2 });

    expect(result.width).toBe(110); // 'longer line'.length === 11
    expect(result.height).toBeCloseTo(2 * 1.2, 5);
    expect(ctx.font).toBe('initial'); // restored
  });
});

describe('bound', () => {
  it('clamps a value into the real [min, max] range', () => {
    expect(bound(0, 5, 10)).toBe(5);
    expect(bound(0, -5, 10)).toBe(0);
    expect(bound(0, 15, 10)).toBe(10);
  });
});

describe('arrayDiff', () => {
  it('marks newly-added entries with direction 1', () => {
    expect(arrayDiff([], ['a'])).toEqual([['a', 1]]);
  });

  it('marks removed entries with direction -1', () => {
    expect(arrayDiff(['a'], [])).toEqual([['a', -1]]);
  });

  it('reports neither for an unchanged entry present in both', () => {
    expect(arrayDiff(['a'], ['a'])).toEqual([]);
  });

  it('handles a real mixed add/remove diff', () => {
    const result = arrayDiff(['a', 'b'], ['b', 'c']);
    expect(result).toContainEqual(['c', 1]);
    expect(result).toContainEqual(['a', -1]);
    expect(result).toHaveLength(2);
  });
});

describe('rasterize', () => {
  it('rounds to the nearest real pixel (devicePixelRatio defaults to 1 outside a real browser)', () => {
    expect(rasterize(10.3)).toBe(10);
    expect(rasterize(10.6)).toBe(11);
  });
});
