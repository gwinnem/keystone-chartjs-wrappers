# CLAUDE.md

Guidance for Claude Code (and other agentic tools) working in this repo.

## What this is

A pnpm/Turborepo monorepo shipping a single generic `<Chart type="...">`
component for Vue, React, and Angular, wrapping Chart.js — the 8 built-in
chart types plus 5 ecosystem extensions (financial/candlestick, boxplot,
matrix, sankey, treemap) and 3 official plugins (zoom, annotation,
datalabels). See `docs/CHARTJS_ANALYSIS.md` for the full Chart.js inventory
this is built against, and `docs/IMPLEMENTATION_PLAN.md` for the phased
build-out (Phase 0 toolchain → Phase 1 core → Phases 2–4 per-framework →
Phase 5 extensions/plugins → Phase 6 docs site → Phase 7 release).

## Packages

| Package | Path | What it is |
|---|---|---|
| `keystone-chartjs-core` | `packages/core` | Framework-agnostic engine — chart lifecycle, lazy type registration, plugin helpers. Zero framework dependency. Private/workspace-internal. |
| `keystone-chartjs-vue` | `packages/vue` | Vue 3 `<Chart>` component. |
| `keystone-chartjs-react` | `packages/react` | React `<Chart>` component. |
| `keystone-chartjs-angular` | `packages/angular` | Angular standalone `KeystoneChartComponent`. |

All three framework packages depend on `keystone-chartjs-core` as a
`workspace:*` dependency and never re-implement chart lifecycle/registration
logic themselves — that logic belongs in core, full stop. If a bug or
feature seems to need duplicating something core already does, that's a
signal to fix/extend core instead.

## Commands

```
pnpm install              # from repo root
pnpm build                # turbo run build, all packages
pnpm test                 # turbo run test
pnpm test:coverage        # turbo run test:coverage
pnpm test:ui              # turbo run test:ui (Vitest UI + coverage panel,
                           # core/vue/react in parallel — each package's
                           # own script runs `vitest --ui --coverage`, not
                           # just `--ui` alone: the UI's own Coverage tab
                           # has nothing to show without that flag,
                           # confirmed by a real gap here —
                           # persistent/uncached in turbo.json, same shape
                           # as `dev`, since it's an interactive dev server
                           # not a one-shot pass/fail task. Angular has no
                           # `test:ui` script at all (Jest has no built-in
                           # equivalent) — turbo skips tasks a package
                           # doesn't define, so this stays green for
                           # Angular rather than failing.)
pnpm test:e2e             # turbo run test:e2e (Playwright)
pnpm test:mutation        # turbo run test:mutation (Stryker)
pnpm lint / lint:fix       # turbo run lint[:fix]
pnpm typecheck            # turbo run typecheck
pnpm docs:dev             # Astro docs site (docs/site) — standalone, not
                           # part of the pnpm workspace; run from docs/site
                           # directly if this filtered script isn't wired yet
```

Per-package equivalents (e.g. `pnpm --filter keystone-chartjs-vue test:component`)
work the same way `keystone-grid` and `keystone-dashboard-layout` use them.
`pnpm --filter <pkg> test:ui` opens just that one package's Vitest UI
without starting the other three.

## Conventions carried over from sibling Keystone projects

These aren't guesses — they're patterns already proven (and in some cases,
already debugged) in `keystone-grid` and `keystone-dashboard-layout`, both at
`C:\gwinnem\`. Prefer them over inventing new conventions:

- **Barrel exports matter.** `packages/angular/src/index.ts` must re-export
  every public symbol. `keystone-dashboard-layout` shipped a broken build
  once from exactly this gap — don't repeat it.
- **Update in place, don't destroy-and-recreate.** All three framework
  components currently scaffolded rebuild the whole chart on any prop/input
  change (a known placeholder gap — see Phase 2–4 in the implementation
  plan). Real implementations must diff and call `chart.update()`, not
  `destroy()` + reconstruct, both for performance and to avoid the
  stale-closure class of bugs `keystone-grid`'s React package hit.
- **Angular examples are a standalone app, not an Astro island.**
  `keystone-dashboard-layout` tried `@analogjs/astro-angular` for embedding
  Angular examples in the Astro docs site and abandoned it after real,
  unresolved rendering issues. Don't re-attempt that path here — Angular
  examples get their own CLI app under `examples/angular`, linked to from
  the docs site, same as that project's `angular-examples-app`.
- **Docs site is standalone.** `docs/site` (once scaffolded per Phase 6) is
  not a pnpm workspace member — it installs and runs independently, same as
  `keystone-dashboard-layout/astro-docs`.
- **Angular tests run on Jest, not Vitest or Karma.** A real course
  correction, not the original plan: this package originally tried
  `@analogjs/vite-plugin-angular` + Vitest (to share one test runner
  across all four packages), but hit the same genuinely unresolved
  upstream ecosystem bug `keystone-dashboard-layout`'s own Angular
  package already ran into and abandoned Vitest for
  (analogjs/analog#1502, angular/angular-cli#31732) — confirmed
  directly against a real failing run here too
  (`ɵgetCleanupHook is not a function`), not assumed. Switched to Jest +
  `jest-preset-angular`, matching KDL's own real, working setup
  (including no `"type": "module"` in this one package's `package.json`
  — unlike core/vue/react, since ts-jest/jest-preset-angular are
  fundamentally CommonJS-oriented). This makes Angular the one package
  in this monorepo with its own separate test runner and its own
  separate Stryker mutation-testing runner (`@stryker-mutator/jest-runner`,
  not `-vitest-runner`) — see `packages/angular/jest.config.ts` and
  `setup-jest.ts`.
- **Design tokens.** The landing page mockup (`docs/_design/mockup-landing.html`)
  reuses the `--kg-*` token palette (ink/paper/amber/blueprint, IBM Plex
  fonts) from `keystone-dashboard-layout`'s `tokens.css`, for visual
  consistency across your Keystone projects.

## Testing philosophy

Four tiers, in order, each gating the next (per `docs/IMPLEMENTATION_PLAN.md`'s
"cross-cutting acceptance bar"): unit (core) → component (Vitest for
vue/react, Jest for angular — see this file's own "Conventions" section
above for why angular differs) → e2e (Playwright) → mutation (Stryker).
Don't consider a phase done on partial tiers — this repo's sibling projects
treat that as incomplete work, not a checkpoint.

**≥90% coverage floor (statements/branches/functions/lines), every
package.** Enforced via `coverage.thresholds` in each package's own test
config (`vitest.config.ts` for core, the `test` block of `vite.config.ts`
for vue/react, `jest.config.ts` for angular) — `pnpm --filter <pkg>
test:coverage` fails the run if any metric dips below 90 in that package.
This is a floor, not a ceiling.

## Documentation

Full Astro documentation: https://docs.astro.build (relevant once Phase 6
starts). Consult before working on the docs site specifically:

- [Adding pages, dynamic routes, or middleware](https://docs.astro.build/en/guides/routing/)
- [Working with Astro components](https://docs.astro.build/en/basics/astro-components/)
- [Using React, Vue, or other framework components](https://docs.astro.build/en/guides/framework-components/)
- [Starlight (docs theme)](https://starlight.astro.build/)
