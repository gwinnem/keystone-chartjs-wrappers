/**
 * Real click/enter/leave event dispatch, faithfully ported from
 * `chartjs-plugin-annotation` (v3.1.0, MIT) \u2014 real source dissected
 * directly from the installed package's own real, unminified ESM
 * build. See `geometry.ts`'s own header comment for the full
 * dissection rationale.
 *
 * Real, confirmed two-level listener fallback: each individual
 * annotation can define its own `click`/`enter`/`leave` handler; if it
 * doesn't, the chart-wide `options.click`/`.enter`/`.leave` (the
 * plugin-level fallback) is used instead \u2014 `state.listened` becomes
 * true if *either* level has at least one real handler defined
 * anywhere, so the real perf-guard `beforeEvent` check below only
 * activates when there's truly nothing to dispatch to.
 */
import { callback, isFunction } from 'chart.js/helpers';
import { getElements, type AnnotationLikeElement, type ChartEventLike, type InteractionOptions } from './interaction.js';
import { loadHooks } from './labelGeometry.js';

const moveHooks = ['enter', 'leave'] as const;
export const eventHooks = [...moveHooks, 'click'];

export interface AnnotationElementLike extends AnnotationLikeElement {
  options: Record<string, unknown>;
  $context: unknown;
}

export interface EventState {
  annotations: Record<string, unknown>[];
  listeners: Record<string, unknown>;
  listened: boolean;
  moveListened: boolean;
  visibleElements: AnnotationElementLike[];
  hovered: AnnotationElementLike[];
}

export interface AnnotationPluginOptionsLike extends InteractionOptions {
  click?: unknown;
  enter?: unknown;
  leave?: unknown;
  interaction?: InteractionOptions;
}

/** Re-derives `state.listened`/`state.moveListened` on every real
 * `afterUpdate` \u2014 checked at both the chart-wide (`options`) level and
 * (if the chart-wide level found nothing) each individual annotation's
 * own real `click`/`enter`/`leave` handler. */
export function updateListeners(_chart: unknown, state: EventState, options: AnnotationPluginOptionsLike): void {
  state.listened = loadHooks(options as never, eventHooks, state.listeners);
  state.moveListened = false;

  moveHooks.forEach((hook) => {
    if (isFunction((options as Record<string, unknown>)[hook])) {
      state.moveListened = true;
    }
  });

  if (!state.listened || !state.moveListened) {
    state.annotations.forEach((scope) => {
      if (!state.listened && isFunction(scope.click)) {
        state.listened = true;
      }
      if (!state.moveListened) {
        moveHooks.forEach((hook) => {
          if (isFunction(scope[hook])) {
            state.listened = true;
            state.moveListened = true;
          }
        });
      }
    });
  }
}

/** The real, top-level event router \u2014 only `mousemove`/`mouseout`/
 * `click` are handled at all, and only once `state.listened` is true
 * (the real perf guard: nothing to dispatch to means skip every
 * further computation for incoming events entirely). */
export function handleEvent(state: EventState, event: ChartEventLike & { type: string }, options: AnnotationPluginOptionsLike): boolean | undefined {
  if (state.listened) {
    switch (event.type) {
      case 'mousemove':
      case 'mouseout':
        return handleMoveEvents(state, event, options);
      case 'click':
        return handleClickEvents(state, event, options);
    }
  }
  return undefined;
}

function handleMoveEvents(state: EventState, event: ChartEventLike, options: AnnotationPluginOptionsLike): boolean | undefined {
  if (!state.moveListened) return undefined;

  let elements: AnnotationElementLike[];
  if ((event as { type?: string }).type === 'mousemove') {
    elements = getElements(state.visibleElements, event, options.interaction ?? {});
  } else {
    elements = [];
  }

  const previous = state.hovered;
  state.hovered = elements;

  const context = { state, event };
  const changed = dispatchMoveEvents(context, 'leave', previous, elements);
  return dispatchMoveEvents(context, 'enter', elements, previous) || changed;
}

function dispatchMoveEvents({ state, event }: { state: EventState; event: ChartEventLike }, hook: 'enter' | 'leave', elements: AnnotationElementLike[], checkElements: AnnotationElementLike[]): boolean | undefined {
  let changed: boolean | undefined;
  for (const element of elements) {
    if (checkElements.indexOf(element) < 0) {
      changed = dispatchEvent((element.options[hook] as never) ?? state.listeners[hook], element, event) || changed;
    }
  }
  return changed;
}

function handleClickEvents(state: EventState, event: ChartEventLike, options: AnnotationPluginOptionsLike): boolean | undefined {
  const listeners = state.listeners;
  const elements = getElements(state.visibleElements, event, options.interaction ?? {});
  let changed: boolean | undefined;
  for (const element of elements) {
    changed = dispatchEvent((element.options.click as never) ?? listeners.click, element, event) || changed;
  }
  return changed;
}

function dispatchEvent(handler: ((context: unknown, event: unknown) => boolean) | undefined, element: AnnotationElementLike, event: unknown): boolean {
  return callback(handler as never, [element.$context, event]) === true;
}
