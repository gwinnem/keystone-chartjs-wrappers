---
title: Roadmap
description: What's built, what's next, for keystone-chartjs-vue.
---

Tracked in full in
[docs/IMPLEMENTATION_PLAN.md](https://github.com/gwinnem/keystone-chartjs-wrappers/blob/main/docs/IMPLEMENTATION_PLAN.md),
including that document's own "Current status & open issues" section — the
single most up-to-date summary of open work. What follows is a snapshot as
it applies to this package specifically.

## Done

- **Phase 0 — Toolchain verification** — dependency versions confirmed,
  per-package ESLint overrides, CI skeleton across all four packages,
  Vue/React Vitest wiring confirmed working end-to-end. Angular runs on
  Jest rather than Vitest (a real, confirmed upstream Angular/Vite/Vitest
  ecosystem bug forced this switch — not a local config choice).
- **Phase 1 — Core engine** (`keystone-chartjs-core`) — chart lifecycle
  (construct, diffed update, destroy), lazy chart-kind registration, the
  six official-plugin helpers, resize handling, the theme
  re-application hook, and inline-plugin support. 62 unit tests, 100%
  coverage on every metric, 93.55% mutation score overall (`plugins.ts`
  alone: 88.14%, with 7 accepted survivors, all one root cause — see
  that file's own doc comment on `withTimestack` for the full
  explanation; `controller.ts`/`registry.ts` both unaffected, at
  98.08%/100% respectively).
- **Phase 2 — This package** — the real `<Chart>` component: all 15 chart
  kinds, all 6 official plugins as opt-in props, reactive updates
  (diffed on top-level `type` and the `plugins` array's own reference,
  not a blanket destroy/recreate), automatic resize, an exposed
  chart-instance ref, and mixed-chart support (see
  [Mixed charts](/vue/guide/concepts/mixed-charts)). 40 unit/component
  tests, 100% coverage, 97.73% mutation score. End-to-end: **69/69
  passing** across Chromium/Firefox/WebKit — every one of the 15 chart
  kinds, all 6 plugins, and resize behavior render/behave correctly on
  every browser. (An earlier state of this suite sat at 51/57, with 6
  extension kinds failing for a fully diagnosed reason — a
  variable-specifier dynamic import in `registry.ts`'s own
  lazy-registration mechanism that Vite's static crawler couldn't
  discover ahead of time. That was fixed by rewriting the dynamic
  import to use static, literal `import()` calls per kind; full
  diagnosis and verification chain in
  `docs/IMPLEMENTATION_PLAN.md`'s own Phase 1/2 sections.)
- **Accessibility** — ARIA-attribute fallthrough (confirmed via a real
  component test, not just Vue's documented default) and a default slot
  for real fallback content (also confirmed via a dedicated test). See
  [Accessibility](/vue/guide/concepts/accessibility) for the full guide.
- **Inline, custom Chart.js plugins** — Chart.js's own
  `ChartConfiguration.plugins` field, distinct from this package's 6
  official opt-in props, via a `plugins` prop. Unlike `data`/`options`,
  a changed `plugins` reference forces a destroy-and-reconstruct, since
  Chart.js only reads this field at construction time. See
  [API → Plugins](/vue/api/plugins) for the full guide.
- **Gradient plugin** — `chartjs-plugin-gradient`, via a boolean-only
  `gradient` prop — its real config lives on each dataset rather than
  `options.plugins.gradient`. Confirmed via a real e2e test
  (`packages/vue/tests/e2e/gradient-plugin.spec.ts`) that a real,
  multi-color gradient actually renders. See
  [API → Plugins](/vue/api/plugins) for the full guide.
- **Timestack scale** — `chartjs-scale-timestack`, via a boolean-only
  `timestack` prop — registers via a side-effect-only import, unlike
  every other plugin here (no `Chart.register(...)` call at all).
  Confirmed via a real e2e test
  (`packages/vue/tests/e2e/timestack-scale.spec.ts`). See
  [API → Plugins](/vue/api/plugins) for the full guide, including the
  real, hard dependency on Luxon worth knowing about.
- **Hierarchical scale** — `chartjs-plugin-hierarchical`, via a
  boolean-only `hierarchical` prop — a third, distinct registration
  shape (a real named export, `HierarchicalScale`, with an explicit
  `Chart.register(...)` call). Requires data in this scale's own real
  tree-node shape (`ILabelNode`/`IValueNode`), not the flat arrays every
  other kind/plugin accepts. Confirmed via a real e2e test
  (`packages/vue/tests/e2e/hierarchical-scale.spec.ts`). See
  [API → Plugins](/vue/api/plugins) for the full guide.

## Open, real gaps (not just "not started yet")

- **Vue-native lifecycle events** (`ready`/`update`/`destroy`) — not
  implemented; the exposed `chart` ref is the only escape hatch today.

## Not yet started

- **Phase 3 — React package**, **Phase 4 — Angular package** — this
  project's current stated priority is finishing Vue completely before
  either starts.
- **Phase 5 — Ecosystem extensions & plugins hardening** — confirmed
  current versions of the 5 extension packages, example + e2e coverage
  per extension kind and per plugin, across all three frameworks.
- **Phase 6 — Documentation site** — this site. React/Angular sections
  aren't published yet; live interactive examples exist for the 8
  built-ins plus mixed charts and multiple axes (all live-hydrated), with
  `sankey` and the zoom plugin shown as real source code only, not yet
  live-embedded (a docs-site-specific build-pipeline gap, not the same
  issue as the e2e one above); SEO/meta parity (OG/Twitter tags,
  JSON-LD) is still open.
- **Phase 7 — Release** — semantic-release isn't set up yet.

Nothing here is committed to a date — phases gate on the previous one's
tests being green, not on a calendar.
