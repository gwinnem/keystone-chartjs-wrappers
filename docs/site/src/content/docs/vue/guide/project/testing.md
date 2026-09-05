---
title: Testing philosophy
description: The test tiers keystone-chartjs-vue is held to, and what each one is responsible for catching.
---

Four tiers, each gating the next — a phase isn't considered done on partial
tiers.

1. **Unit** (Vitest, in `keystone-chartjs-core`) — registry resolution, lazy-
   import caching, update-vs-recreate decision logic, plugin option merging.
   Framework-agnostic, so these tests live in core, not here.
2. **Component** (Vitest + `@vue/test-utils`, in this package's own
   `tests/component`) — `keystone-chartjs-core` mocked entirely (its own
   internal logic is already covered by the unit tier), verifying instead
   that `<Chart>` calls core correctly and reacts correctly to what core
   returns: mount for all 15 chart kinds (8 built-in + 7 extension), an
   in-place update on data/options change, correct behavior when `type`
   itself changes (core decides update-vs-recreate, not this component),
   serialized ordering under overlapping prop changes, each plugin prop
   applied correctly, and the exposed `chart` ref's state at every stage
   of the lifecycle.
3. **End-to-end** (Playwright, real browser, real unmocked Chart.js) —
   the one tier that can catch what every mocked tier structurally can't:
   a real chart actually painting non-blank pixels to a real canvas
   (jsdom has no real 2D context at all), a real extension package
   actually resolving and registering, a real `ResizeObserver` actually
   resizing a chart on a real viewport change. Run across Chromium,
   Firefox, and WebKit. This tier already caught one real production bug
   in `keystone-chartjs-core` (a missing built-in registration call) that
   no earlier, fully-mocked tier could have found — direct evidence for
   why this tier exists, not just a formality.
4. **Mutation** (Stryker, Vitest runner) — confirms the test suite above
   would actually catch a broken implementation, not just execute one
   that happens to work. Every accepted surviving mutant is individually
   explained in `docs/IMPLEMENTATION_PLAN.md`, not silently ignored.

## Status

All four tiers are real and confirmed, not placeholder scaffolding:

- **Unit** (core): 520 tests. **98.92% statements/lines, 94.35%
  branches, 99.61% functions overall** — most files (`controller.ts`,
  `index.ts`, `plugins.ts`, `registry.ts`, `test-utils.ts`,
  `imageLabelPlugin.ts`) are a clean 100% across the board;
  `zoomPlugin.ts`, `hierarchicalScale.ts`, `deferredPlugin.ts`,
  `autocolorsPlugin.ts`, and the newer `plugins/trendline/*.ts` files
  each sit in the 87–99% branch range, their own documented, accepted
  gaps. Every file individually clears the project's own 90% floor on
  every metric — the remaining gaps are narrow, defensive edge cases
  (a handful of jsdom-style unreachable branches, or state genuinely
  unobservable through any external assertion), the same class of
  accepted gap across every local port in this project.
- **Component** (this package): 49 tests, 100% coverage on every metric.
- **End-to-end**: **84/84 passing** across all 3 browsers — every chart
  kind, all 10 plugins, and resize behavior pass on every browser. No
  known limitations remain.

See [docs/IMPLEMENTATION_PLAN.md](https://github.com/gwinnem/keystone-chartjs-wrappers/blob/main/docs/IMPLEMENTATION_PLAN.md)
for the full history — including every real bug this testing process
found along the way, not just the final numbers.
