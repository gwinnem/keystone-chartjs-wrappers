/**
 * Shared testing helpers exported under the `keystone-chartjs-core/test-utils`
 * subpath (see package.json's own `exports` map — this file existing at
 * all closes a real gap: that subpath was declared before this file did).
 * Intended for the Vue/React/Angular packages' own component tests (Phase
 * 2-4) to import, so all three build against the same small set of DOM
 * fixtures instead of each hand-rolling their own.
 *
 * Deliberately does NOT export a mock Chart.js class — core's own tests
 * (tests/unit/*.spec.ts) each define their own via `vi.mock('chart.js', ...)`,
 * since Vitest's mock-factory hoisting doesn't play well with importing a
 * shared factory function into the factory callback itself. A consuming
 * package's component tests are expected to do the same.
 */

/** A bare `<canvas>`, attached to `document.body` (some layout/measurement
 * APIs — including `ResizeObserver` — behave differently on a detached
 * node in some environments). Caller is responsible for removing it. */
export function createTestCanvas(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  document.body.appendChild(canvas);
  return canvas;
}

/** A `<canvas>` inside a real parent `<div>`, both attached to
 * `document.body` — for exercising anything that observes the canvas's
 * *parent* specifically (the controller's ResizeObserver target is the
 * canvas's `parentElement`, not the canvas itself). */
export function createTestCanvasWithParent(): { canvas: HTMLCanvasElement; parent: HTMLDivElement } {
  const parent = document.createElement('div');
  const canvas = document.createElement('canvas');
  parent.appendChild(canvas);
  document.body.appendChild(parent);
  return { canvas, parent };
}
