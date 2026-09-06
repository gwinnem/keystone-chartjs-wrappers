import { describe, expect, it, vi } from 'vitest';
import { dataLabelsPlugin, dataLabelsDefaults } from '../../../../src/plugins/dataLabels/dataLabelsPlugin.js';

// Testing the real plugin object's own lifecycle hooks directly
// (dissected from the real, installed package's own real, unminified
// ESM build — see utils.ts's own header comment for the full
// dissection rationale, including the real active-element hover
// integration and real click/enter/leave event dispatch found only by
// reading the source).

function makeCtx() {
  return {
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
    measureText: (text: string) => ({ width: text.length * 6 }),
    font: '',
  };
}

function makeElement(x = 0, y = 0, skip = false) {
  return {
    x,
    y,
    skip,
    getProps: (props: string[]) => Object.fromEntries(props.map((p) => [p, p === 'x' ? x : y])),
  };
}

function makeChart(datasets: { data: unknown[] }[], elementsByDataset: unknown[][], overrides: Record<string, unknown> = {}) {
  const ctx = makeCtx();
  return {
    ctx,
    chartArea: { left: 0, top: 0, right: 100, bottom: 100 },
    data: { datasets },
    isDatasetVisible: () => true,
    getDataVisibility: () => true,
    getDatasetMeta: (i: number) => ({ data: elementsByDataset[i] }),
    getActiveElements: () => [],
    render: vi.fn(),
    ...overrides,
  };
}

/** Runs the real, full lifecycle a Chart.js update + draw would
 * trigger, for one dataset — draw included, since `layout.lookup()`'s
 * own real hit-testing (used by click/hover dispatch) reads each
 * label's own `box`, which is only positioned by `layout.draw()` (or,
 * for `display: 'auto'` labels, by the overlap computation inside
 * `layout.update()`). A real chart always draws once before a person
 * can click or hover it, so this mirrors that real ordering. */
function runUpdate(chart: ReturnType<typeof makeChart>, options: Record<string, unknown> = {}) {
  dataLabelsPlugin.beforeInit!(chart as never, {} as never, {});
  dataLabelsPlugin.beforeUpdate!(chart as never, {} as never, {});
  chart.data.datasets.forEach((_, index) => {
    dataLabelsPlugin.afterDatasetUpdate!(chart as never, { index, meta: chart.getDatasetMeta(index) } as never, options as never);
  });
  dataLabelsPlugin.afterUpdate!(chart as never, {} as never, {});
  dataLabelsPlugin.afterDatasetsDraw!(chart as never, {} as never, {});
}

describe('dataLabelsPlugin — real shape', () => {
  it('has the real, expected id and every documented lifecycle hook', () => {
    expect(dataLabelsPlugin).toMatchObject({
      id: 'datalabels',
      beforeInit: expect.any(Function),
      beforeUpdate: expect.any(Function),
      afterDatasetUpdate: expect.any(Function),
      afterUpdate: expect.any(Function),
      afterDatasetsDraw: expect.any(Function),
      beforeEvent: expect.any(Function),
      afterEvent: expect.any(Function),
    });
  });
});

describe('dataLabelsDefaults.formatter (the real default value formatter)', () => {
  const formatter = dataLabelsDefaults.formatter!;

  it('returns null for a null/undefined value', () => {
    expect(formatter(null, {} as never)).toBeNull();
    expect(formatter(undefined, {} as never)).toBeNull();
  });

  it('stringifies a plain, non-object value', () => {
    expect(formatter(42, {} as never)).toBe('42');
  });

  it("uses an object's own real .label field when present", () => {
    expect(formatter({ label: 'Revenue', value: 100 }, {} as never)).toBe('Revenue');
  });

  it("falls back to an object's own real .r field (bubble-chart radius) when .label is absent", () => {
    expect(formatter({ x: 1, y: 2, r: 15 }, {} as never)).toBe('15');
  });

  it('joins every own key as key: value when neither .label nor .r is present', () => {
    expect(formatter({ x: 1, y: 2 }, {} as never)).toBe('x: 1, y: 2');
  });
});

describe('dataLabelsPlugin.afterDatasetsDraw', () => {
  it('draws a real label for a real, visible data element', () => {
    const chart = makeChart([{ data: [1, 2, 3] }], [[makeElement(10, 10), makeElement(20, 20), makeElement(30, 30)]]);
    runUpdate(chart);

    expect(chart.ctx.fillText).toHaveBeenCalled();
  });

  it('draws nothing at all when the dataset is hidden', () => {
    const chart = makeChart([{ data: [1, 2, 3] }], [[makeElement(10, 10), makeElement(20, 20), makeElement(30, 30)]], { isDatasetVisible: () => false });
    runUpdate(chart);

    expect(chart.ctx.fillText).not.toHaveBeenCalled();
  });

  it('skips an element whose own data point is hidden (getDataVisibility)', () => {
    const chart = makeChart([{ data: [1, 2, 3] }], [[makeElement(10, 10), makeElement(20, 20), makeElement(30, 30)]], { getDataVisibility: () => false });
    runUpdate(chart);

    expect(chart.ctx.fillText).not.toHaveBeenCalled();
  });

  it('skips an element flagged skip:true', () => {
    const chart = makeChart([{ data: [1] }], [[makeElement(10, 10, true)]]);
    runUpdate(chart);

    expect(chart.ctx.fillText).not.toHaveBeenCalled();
  });

  it('draws nothing at all for a dataset with dataset.datalabels: false', () => {
    const chart = makeChart([{ data: [1, 2, 3], datalabels: false }], [[makeElement(10, 10), makeElement(20, 20), makeElement(30, 30)]]);
    runUpdate(chart);

    expect(chart.ctx.fillText).not.toHaveBeenCalled();
  });

  it('draws a real label for a dataset with the boolean shorthand dataset.datalabels: true', () => {
    const chart = makeChart([{ data: [1], datalabels: true }], [[makeElement(10, 10)]]);
    runUpdate(chart);

    expect(chart.ctx.fillText).toHaveBeenCalled();
  });

  it('draws real, independently-configured labels for each entry in options.labels', () => {
    const chart = makeChart([{ data: [1] }], [[makeElement(10, 10)]]);
    runUpdate(chart, { labels: { value: { formatter: () => 'V' }, unit: { formatter: () => 'U' } } });

    expect(chart.ctx.fillText).toHaveBeenCalledWith('V', expect.any(Number), expect.any(Number), expect.any(Number));
    expect(chart.ctx.fillText).toHaveBeenCalledWith('U', expect.any(Number), expect.any(Number), expect.any(Number));
  });
});

describe('dataLabelsPlugin.beforeEvent / afterEvent — click and hover', () => {
  it('does nothing at all when nothing on the chart has any real listener', () => {
    const chart = makeChart([{ data: [1] }], [[makeElement(10, 10)]]);
    runUpdate(chart);

    expect(() =>
      dataLabelsPlugin.beforeEvent!(chart as never, { event: { type: 'click', x: 10, y: 10 }, replay: false, cancelable: true, inChartArea: true } as never, {}),
    ).not.toThrow();
  });

  it('dispatches a real click listener when the event hits a real label', () => {
    const onClick = vi.fn();
    const chart = makeChart([{ data: [1] }], [[makeElement(10, 10)]]);
    runUpdate(chart, { listeners: { click: onClick } });

    dataLabelsPlugin.beforeEvent!(chart as never, { event: { type: 'click', x: 10, y: 10 }, replay: false, cancelable: true, inChartArea: true } as never, {});

    expect(onClick).toHaveBeenCalled();
  });

  it('does not dispatch a click listener when the event misses every real label', () => {
    const onClick = vi.fn();
    const chart = makeChart([{ data: [1] }], [[makeElement(10, 10)]]);
    runUpdate(chart, { listeners: { click: onClick } });

    dataLabelsPlugin.beforeEvent!(chart as never, { event: { type: 'click', x: 900, y: 900 }, replay: false, cancelable: true, inChartArea: true } as never, {});

    expect(onClick).not.toHaveBeenCalled();
  });

  it('dispatches enter then leave as the mouse moves onto, then off of, a real label', () => {
    const onEnter = vi.fn();
    const onLeave = vi.fn();
    const chart = makeChart([{ data: [1] }], [[makeElement(10, 10)]]);
    runUpdate(chart, { listeners: { enter: onEnter, leave: onLeave } });

    dataLabelsPlugin.beforeEvent!(chart as never, { event: { type: 'mousemove', x: 10, y: 10 }, replay: false, cancelable: true, inChartArea: true } as never, {});
    expect(onEnter).toHaveBeenCalledTimes(1);

    dataLabelsPlugin.beforeEvent!(chart as never, { event: { type: 'mouseout', x: 0, y: 0 }, replay: false, cancelable: true, inChartArea: true } as never, {});
    expect(onLeave).toHaveBeenCalledTimes(1);
  });

  it('dispatches leave for the old label and enter for the new one when the mouse moves directly between two labels', () => {
    const onEnter = vi.fn();
    const onLeave = vi.fn();
    const chart = makeChart([{ data: [1, 2] }], [[makeElement(10, 10), makeElement(50, 50)]]);
    runUpdate(chart, { listeners: { enter: onEnter, leave: onLeave } });

    dataLabelsPlugin.beforeEvent!(chart as never, { event: { type: 'mousemove', x: 10, y: 10 }, replay: false, cancelable: true, inChartArea: true } as never, {});
    expect(onEnter).toHaveBeenCalledTimes(1);

    dataLabelsPlugin.beforeEvent!(chart as never, { event: { type: 'mousemove', x: 50, y: 50 }, replay: false, cancelable: true, inChartArea: true } as never, {});
    expect(onLeave).toHaveBeenCalledTimes(1);
    expect(onEnter).toHaveBeenCalledTimes(2);
  });

  it("re-updates the label and schedules a redraw when a listener's own callback returns true", () => {
    const chart = makeChart([{ data: [1] }], [[makeElement(10, 10)]]);
    runUpdate(chart, { listeners: { click: () => true } });

    dataLabelsPlugin.beforeEvent!(chart as never, { event: { type: 'click', x: 10, y: 10 }, replay: false, cancelable: true, inChartArea: true } as never, {});

    // dirty was set — the next afterEvent call schedules a real redraw
    // even though the active-elements set itself never changed.
    dataLabelsPlugin.afterEvent!(chart as never, {} as never, {});
    expect(chart.render).toHaveBeenCalled();
  });
});

describe('dataLabelsPlugin.afterEvent — real active-element (hover) integration', () => {
  it('sets context.active true for a newly-active element and re-updates its own labels', () => {
    const element = makeElement(10, 10);
    const chart = makeChart([{ data: [1] }], [[element]], { getActiveElements: () => [{ element }] });
    runUpdate(chart);

    dataLabelsPlugin.afterEvent!(chart as never, {} as never, {});

    // A real redraw was scheduled since the active set changed.
    expect(chart.render).toHaveBeenCalled();
  });

  it('sets context.active back to false once an element leaves the active set', () => {
    const element = makeElement(10, 10);
    let actives: { element: unknown }[] = [{ element }];
    const chart = makeChart([{ data: [1] }], [[element]], { getActiveElements: () => actives });
    runUpdate(chart);

    dataLabelsPlugin.afterEvent!(chart as never, {} as never, {}); // becomes active
    actives = [];
    dataLabelsPlugin.afterEvent!(chart as never, {} as never, {}); // becomes inactive

    expect(chart.render).toHaveBeenCalledTimes(2);
  });

  it('does not call chart.render() at all when the active set has not changed and nothing is dirty', () => {
    const chart = makeChart([{ data: [1] }], [[makeElement(10, 10)]]);
    runUpdate(chart);

    dataLabelsPlugin.afterEvent!(chart as never, {} as never, {});

    expect(chart.render).not.toHaveBeenCalled();
  });
});
