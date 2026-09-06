import { describe, expect, it, vi } from 'vitest';
import { handleEvent, updateListeners } from '../../../../src/plugins/annotation/events.js';

// Testing the real click/enter/leave event dispatch directly (dissected
// from the real, installed package's own real, unminified ESM build —
// see geometry.ts's own header comment for the full dissection
// rationale).

function makeElement(x: number, y: number, overrides: Record<string, unknown> = {}) {
  return {
    inRange: (ex: number, ey: number) => ex === x && ey === y,
    getCenterPoint: () => ({ x, y }),
    options: {},
    $context: {},
    ...overrides,
  };
}

function makeState(overrides: Record<string, unknown> = {}) {
  return {
    annotations: [],
    listeners: {},
    listened: false,
    moveListened: false,
    visibleElements: [],
    hovered: [],
    ...overrides,
  };
}

describe('updateListeners', () => {
  it('is listened when the chart-wide options define a real click handler', () => {
    const state = makeState();
    updateListeners({}, state as never, { click: vi.fn() });
    expect(state.listened).toBe(true);
  });

  it('is moveListened when the chart-wide options define enter/leave', () => {
    const state = makeState();
    updateListeners({}, state as never, { enter: vi.fn() });
    expect(state.moveListened).toBe(true);
    expect(state.listened).toBe(true);
  });

  it('is listened when an individual annotation defines its own click handler, even with no chart-wide one', () => {
    const state = makeState({ annotations: [{ click: vi.fn() }] });
    updateListeners({}, state as never, {});
    expect(state.listened).toBe(true);
  });

  it('is not listened when nothing anywhere defines a real handler', () => {
    const state = makeState({ annotations: [{}] });
    updateListeners({}, state as never, {});
    expect(state.listened).toBe(false);
    expect(state.moveListened).toBe(false);
  });
});

describe('handleEvent', () => {
  it('does nothing at all when state.listened is false', () => {
    const state = makeState({ listened: false });
    const result = handleEvent(state as never, { type: 'click', x: 0, y: 0 } as never, {});
    expect(result).toBeUndefined();
  });

  it('dispatches a real click to the element under the event point', () => {
    const onClick = vi.fn();
    const el = makeElement(10, 10, { options: { click: onClick } });
    const state = makeState({ listened: true, visibleElements: [el] });
    handleEvent(state as never, { type: 'click', x: 10, y: 10 } as never, {});
    expect(onClick).toHaveBeenCalled();
  });

  it('falls back to the chart-wide click listener when the element has none of its own', () => {
    const onClick = vi.fn();
    const el = makeElement(10, 10);
    const state = makeState({ listened: true, visibleElements: [el], listeners: { click: onClick } });
    handleEvent(state as never, { type: 'click', x: 10, y: 10 } as never, {});
    expect(onClick).toHaveBeenCalled();
  });

  it('does not dispatch click for a mousemove event', () => {
    const onClick = vi.fn();
    const el = makeElement(10, 10, { options: { click: onClick } });
    const state = makeState({ listened: true, moveListened: false, visibleElements: [el] });
    handleEvent(state as never, { type: 'mousemove', x: 10, y: 10 } as never, {});
    expect(onClick).not.toHaveBeenCalled();
  });

  it('dispatches enter when the mouse moves onto a real element', () => {
    const onEnter = vi.fn();
    const el = makeElement(10, 10, { options: { enter: onEnter } });
    const state = makeState({ listened: true, moveListened: true, visibleElements: [el] });
    handleEvent(state as never, { type: 'mousemove', x: 10, y: 10 } as never, {});
    expect(onEnter).toHaveBeenCalled();
  });

  it('dispatches leave when the mouse moves off a previously-hovered element', () => {
    const onLeave = vi.fn();
    const el = makeElement(10, 10, { options: { leave: onLeave } });
    const state = makeState({ listened: true, moveListened: true, visibleElements: [el], hovered: [el] });
    handleEvent(state as never, { type: 'mouseout', x: 0, y: 0 } as never, {});
    expect(onLeave).toHaveBeenCalled();
  });

  it('does not dispatch move events at all when moveListened is false', () => {
    const onEnter = vi.fn();
    const el = makeElement(10, 10, { options: { enter: onEnter } });
    const state = makeState({ listened: true, moveListened: false, visibleElements: [el] });
    handleEvent(state as never, { type: 'mousemove', x: 10, y: 10 } as never, {});
    expect(onEnter).not.toHaveBeenCalled();
  });
});
