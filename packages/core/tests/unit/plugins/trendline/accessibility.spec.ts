import { describe, expect, it } from 'vitest';
import { applyCanvasAccessibility, generateChartTrendlineDescription } from '../../../../src/plugins/trendline/accessibility.js';

// Testing the real ARIA-label generation directly (dissected from the
// real, installed package's own real source — see accessibility.ts's
// own header comment for the full port rationale, including the real,
// confirmed dead-code finding in the original this port deliberately
// omits).

function makeCanvas(initialAriaLabel?: string) {
  const attrs = new Map<string, string>();
  if (initialAriaLabel !== undefined) attrs.set('aria-label', initialAriaLabel);
  return {
    getAttribute: (name: string) => attrs.get(name) ?? null,
    setAttribute: (name: string, value: string) => attrs.set(name, value),
    hasAttribute: (name: string) => attrs.has(name),
    __attrs: attrs,
  };
}

describe('generateChartTrendlineDescription', () => {
  it('returns an empty string when no dataset has a real trendline config', () => {
    const chart = { data: { datasets: [{ label: 'A', data: [1, 2] }] } };
    expect(generateChartTrendlineDescription(chart as never)).toBe('');
  });

  it('uses a consumer-supplied accessibility.description verbatim when given', () => {
    const chart = {
      data: {
        datasets: [
          { label: 'Revenue', trendlineLinear: { accessibility: { description: 'Custom description.' } } },
        ],
      },
    };
    expect(generateChartTrendlineDescription(chart as never)).toBe('Custom description.');
  });

  it('folds accessibility.label into a short, generated sentence when no description is given', () => {
    const chart = {
      data: {
        datasets: [{ label: 'Revenue', trendlineLinear: { accessibility: { label: 'steady growth' } } }],
      },
    };
    expect(generateChartTrendlineDescription(chart as never)).toBe('Linear trendline for Revenue: steady growth');
  });

  it('falls back to a bare, generic sentence when neither description nor label is given', () => {
    const chart = { data: { datasets: [{ label: 'Revenue', trendlineLinear: {} }] } };
    expect(generateChartTrendlineDescription(chart as never)).toBe('Linear trendline for Revenue.');
  });

  it('uses "Exponential trendline" for a dataset configured with trendlineExponential', () => {
    const chart = { data: { datasets: [{ label: 'Decay', trendlineExponential: {} }] } };
    expect(generateChartTrendlineDescription(chart as never)).toBe('Exponential trendline for Decay.');
  });

  it('falls back to "Dataset" when the dataset itself has no label', () => {
    const chart = { data: { datasets: [{ trendlineLinear: {} }] } };
    expect(generateChartTrendlineDescription(chart as never)).toBe('Linear trendline for Dataset.');
  });

  it('joins descriptions from multiple datasets with a single space', () => {
    const chart = {
      data: {
        datasets: [
          { label: 'A', trendlineLinear: {} },
          { label: 'B', trendlineExponential: {} },
        ],
      },
    };
    expect(generateChartTrendlineDescription(chart as never)).toBe('Linear trendline for A. Exponential trendline for B.');
  });
});

describe('applyCanvasAccessibility', () => {
  it('does nothing at all when the chart has no real canvas', () => {
    expect(() => applyCanvasAccessibility({ canvas: null, data: { datasets: [] } } as never)).not.toThrow();
  });

  it('sets role="img" on the canvas regardless of whether any real trendline config exists', () => {
    const canvas = makeCanvas();
    applyCanvasAccessibility({ canvas, data: { datasets: [] } } as never);
    expect(canvas.getAttribute('role')).toBe('img');
  });

  it('leaves aria-label untouched when no dataset has a real trendline config', () => {
    const canvas = makeCanvas('Original label');
    applyCanvasAccessibility({ canvas, data: { datasets: [{ label: 'A' }] } } as never);
    expect(canvas.getAttribute('aria-label')).toBe('Original label');
  });

  it('appends the generated description to a real, pre-existing consumer aria-label on first call', () => {
    const canvas = makeCanvas('My chart');
    const chart = { canvas, data: { datasets: [{ label: 'Revenue', trendlineLinear: {} }] } };

    applyCanvasAccessibility(chart as never);

    expect(canvas.getAttribute('aria-label')).toBe('My chart. Linear trendline for Revenue.');
  });

  it('does not accumulate a duplicate description across repeated calls (afterInit + afterUpdate)', () => {
    const canvas = makeCanvas('My chart');
    const chart = { canvas, data: { datasets: [{ label: 'Revenue', trendlineLinear: {} }] } };

    applyCanvasAccessibility(chart as never);
    applyCanvasAccessibility(chart as never);
    applyCanvasAccessibility(chart as never);

    expect(canvas.getAttribute('aria-label')).toBe('My chart. Linear trendline for Revenue.');
  });

  it('captures an absent original aria-label as an empty string, not the literal string "null"', () => {
    const canvas = makeCanvas(); // no aria-label set at all
    const chart = { canvas, data: { datasets: [{ label: 'Revenue', trendlineLinear: {} }] } };

    applyCanvasAccessibility(chart as never);

    expect(canvas.getAttribute('aria-label')).toBe('Linear trendline for Revenue.');
  });
});
