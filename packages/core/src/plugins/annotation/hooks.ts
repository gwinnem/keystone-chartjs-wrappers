/**
 * Real per-element draw-hook loading (`beforeDraw`/`afterDraw`),
 * faithfully ported from `chartjs-plugin-annotation` (v3.1.0, MIT) \u2014
 * real source dissected directly from the installed package's own
 * real, unminified ESM build. See `geometry.ts`'s own header comment
 * for the full dissection rationale.
 */
import { callback, isFunction } from 'chart.js/helpers';
import { loadHooks } from './labelGeometry.js';

export const elementHooks = ['afterDraw', 'beforeDraw'];

export interface HooksState {
  hooked: boolean;
  hooks: Record<string, unknown>;
}

/** Re-derives `state.hooked` on every real `afterUpdate` \u2014 true once
 * the chart-wide `options` or any individual visible element defines a
 * real `beforeDraw`/`afterDraw` hook of its own. */
export function updateHooks(_chart: unknown, state: HooksState, options: Record<string, unknown>, visibleElements: { options: Record<string, unknown> }[]): void {
  state.hooked = loadHooks(options, elementHooks, state.hooks);

  if (!state.hooked) {
    visibleElements.forEach((scope) => {
      if (!state.hooked) {
        elementHooks.forEach((hook) => {
          if (isFunction(scope.options[hook])) {
            state.hooked = true;
          }
        });
      }
    });
  }
}

/** Invokes `hook` (`beforeDraw`/`afterDraw`) for one real, drawn
 * element \u2014 its own real per-element hook if defined, otherwise the
 * chart-wide fallback \u2014 a no-op entirely when `state.hooked` is false
 * (the same real perf guard `events.ts`'s own `state.listened` check
 * provides for interaction). */
export function invokeHook(state: HooksState, element: { options: Record<string, unknown>; $context: unknown }, hook: string): unknown {
  if (state.hooked) {
    const callbackHook = element.options[hook] ?? state.hooks[hook];
    return callback(callbackHook as never, [element.$context]);
  }
  return undefined;
}
