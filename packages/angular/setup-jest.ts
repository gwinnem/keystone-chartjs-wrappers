import { setupZoneTestEnv } from 'jest-preset-angular/setup-env/zone';

// Initializes zone.js's own testing patches so TestBed-based specs work
// correctly — jest-preset-angular's own current documented API for this
// (not the older bare `import 'jest-preset-angular/setup-jest'`
// string-import style still floating around in older docs/blog posts,
// which is for a previous major version of this package). Matches
// keystone-dashboard-layout's own real, working setup-jest.ts exactly.
setupZoneTestEnv();

/**
 * ResizeObserver mock — this package's own controller.ts wires a real
 * ResizeObserver on mount (see packages/core/src/controller.ts), so any
 * TestBed-mounted component test touching that path needs this the
 * moment it exists, not just once a real failure surfaces. jsdom (Jest's
 * own DOM environment here) implements no `ResizeObserver` at all.
 *
 * Deliberately a no-op (never calls its own callback) — jsdom also has
 * no real layout engine, so even a "working" mock that did fire would
 * only ever report 0 for any element's size, no more useful than not
 * firing at all. Matches keystone-dashboard-layout's own real
 * setup-jest.ts reasoning for the identical mock.
 */
class ResizeObserverMock {
  disconnect(): void {}
  observe(): void {}
  unobserve(): void {}
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).ResizeObserver = ResizeObserverMock;
