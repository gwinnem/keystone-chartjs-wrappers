import { describe, expect, it, vi } from 'vitest';
import { invokeHook, updateHooks } from '../../../../src/plugins/annotation/hooks.js';

// Testing the real per-element draw-hook loading directly (dissected
// from the real, installed package's own real, unminified ESM build —
// see geometry.ts's own header comment for the full dissection
// rationale).

describe('updateHooks', () => {
  it('is hooked when the chart-wide options define a real beforeDraw/afterDraw', () => {
    const state = { hooked: false, hooks: {} };
    updateHooks({}, state, { beforeDraw: vi.fn() }, []);
    expect(state.hooked).toBe(true);
  });

  it('is hooked when an individual visible element defines its own real hook', () => {
    const state = { hooked: false, hooks: {} };
    updateHooks({}, state, {}, [{ options: { afterDraw: vi.fn() } }]);
    expect(state.hooked).toBe(true);
  });

  it('is not hooked when nothing anywhere defines a real hook', () => {
    const state = { hooked: false, hooks: {} };
    updateHooks({}, state, {}, [{ options: {} }]);
    expect(state.hooked).toBe(false);
  });
});

describe('invokeHook', () => {
  it('does nothing at all when state.hooked is false', () => {
    const state = { hooked: false, hooks: {} };
    const fn = vi.fn();
    invokeHook(state, { options: { beforeDraw: fn }, $context: {} }, 'beforeDraw');
    expect(fn).not.toHaveBeenCalled();
  });

  it("calls the element's own real hook when hooked", () => {
    const state = { hooked: true, hooks: {} };
    const fn = vi.fn();
    invokeHook(state, { options: { beforeDraw: fn }, $context: {} }, 'beforeDraw');
    expect(fn).toHaveBeenCalled();
  });

  it('falls back to the chart-wide hook when the element has none of its own', () => {
    const fn = vi.fn();
    const state = { hooked: true, hooks: { beforeDraw: fn } };
    invokeHook(state, { options: {}, $context: {} }, 'beforeDraw');
    expect(fn).toHaveBeenCalled();
  });
});
