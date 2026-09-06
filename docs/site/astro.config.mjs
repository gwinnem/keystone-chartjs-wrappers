import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';
import vue from '@astrojs/vue';
import sitemap from '@astrojs/sitemap';

// Standalone Astro + Starlight site — not part of the pnpm workspace,
// same convention as keystone-dashboard-layout/astro-docs (see that
// project's own package.json description).
//
// `@astrojs/vue` is now added: Phase 6's live-example work has started
// for Vue, now that Phase 2 (packages/vue) is a real, tested
// implementation. `@astrojs/react` stays out until Phase 3 lands.
export default defineConfig({
  site: 'https://kcw.winnem.tech',
  // Both `keystone-chartjs-vue` and `keystone-chartjs-core` resolve via
  // explicit aliases straight to their real TypeScript source — no
  // published npm package or built `dist/` output exists yet for either
  // (Phase 7/release hasn't happened, no `pnpm build` run). At your
  // explicit request, `keystone-chartjs-core` moved off the `link:`
  // dependency it previously used in `package.json`
  // (`link:../../packages/core`, a real `node_modules` symlink), onto
  // this same direct-alias shape. That `link:` choice was originally
  // made to avoid a real, confirmed bug: registry.ts's own
  // `import(/* @vite-ignore */ entry.packageName)` calls (lazily
  // registering the 5 ecosystem extension packages) reached the browser
  // as a raw, unrewritten bare specifier and threw "Failed to resolve
  // module specifier" when `keystone-chartjs-core` was only reachable
  // via an `@fs/`-external alias — `@vite-ignore` suppresses Vite's own
  // URL-rewriting for that import entirely, and since `entry.packageName`
  // is a variable, not a literal, Vite's static crawler can never
  // discover it either. **That reasoning turned out incomplete**: every
  // plugin/scale needing this same dynamic-import mechanism (zoom,
  // sankey, gradient, timestack, hierarchical) has hit the identical
  // hydration gap regardless, confirmed live in a real browser for each
  // one, even with `keystone-chartjs-core` `link:`ed — see "Current
  // status & open issues" item #4 in docs/IMPLEMENTATION_PLAN.md. The
  // `link:` dependency wasn't actually preventing the gap it was chosen
  // to avoid, so there's no remaining reason to keep it over the
  // simpler, single alias mechanism both packages now share.
  vite: {
    resolve: {
      alias: {
        'keystone-chartjs-vue': fileURLToPath(new URL('../../packages/vue/src/index.ts', import.meta.url)),
        'keystone-chartjs-core': fileURLToPath(new URL('../../packages/core/src/index.ts', import.meta.url)),
      },
    },
    server: {
      fs: {
        // Explicit, not left to Vite's own auto-detection: this site is
        // deliberately outside the pnpm workspace (see this file's own
        // top-of-file comment), so Vite has no lockfile/workspace-root
        // marker to walk up to on its own, and its default `fs.allow`
        // only covers this project's own root plus its `node_modules`.
        // Confirmed as a real, reproducible break: a dev server started
        // one way served `packages/core/src/*.ts` via the alias above
        // just fine; a later restart (different cwd/invocation) 403'd
        // on the exact same files with "outside of Vite serving allow
        // list" — not a config regression from any single change here,
        // since it broke registry.ts (untouched that session) identically
        // to imageLabelPlugin.ts (a brand new file). Listing the
        // monorepo root explicitly removes the dependency on whatever
        // Vite's own auto-detection happens to guess.
        allow: [fileURLToPath(new URL('../../', import.meta.url))],
      },
    },
  },
  integrations: [
    vue(),
    // Starlight's own default Head.astro (confirmed directly from the
    // installed 0.30.6 source) unconditionally emits a
    // <link rel="sitemap" href="/sitemap-index.xml"> whenever `site` is
    // set above — but Starlight does not generate that file itself; it
    // assumes a separate sitemap integration is present. Without one,
    // that link was a dead 404. This integration is what actually
    // produces `sitemap-index.xml`/`sitemap-0.xml` at build time.
    sitemap(),
    starlight({
      title: 'Keystone Chart.js Wrappers',
      favicon: '/favicon.svg',
      customCss: ['./src/styles/tokens.css'],
      // Site-wide extra <head> tags Starlight's own defaults don't cover:
      // a static Open Graph / Twitter preview image (Starlight's own
      // default Head.astro — confirmed directly from the installed
      // 0.30.6 source — already emits og:title/og:type/og:url/
      // og:locale/og:description/og:site_name and twitter:card, but no
      // image tag at all), plus a real JSON-LD SoftwareSourceCode block
      // for search-engine rich results. `head` entries here apply
      // site-wide, merged with each page's own `data.head` frontmatter
      // by Starlight's own `createHead()`.
      head: [
        {
          tag: 'meta',
          attrs: { property: 'og:image', content: 'https://kcw.winnem.tech/og-image.png' },
        },
        {
          tag: 'meta',
          attrs: { property: 'og:image:width', content: '1200' },
        },
        {
          tag: 'meta',
          attrs: { property: 'og:image:height', content: '630' },
        },
        {
          tag: 'meta',
          attrs: { name: 'twitter:image', content: 'https://kcw.winnem.tech/og-image.png' },
        },
        {
          tag: 'script',
          attrs: { type: 'application/ld+json' },
          content: JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'SoftwareSourceCode',
            name: 'Keystone Chart.js Wrappers',
            description:
              'Idiomatic Chart.js wrapper components for Vue 3, React, and Angular, sharing a single framework-agnostic core.',
            codeRepository: 'https://github.com/gwinnem/keystone-chartjs-wrappers',
            programmingLanguage: 'TypeScript',
            license: 'https://github.com/gwinnem/keystone-chartjs-wrappers/blob/main/LICENSE',
            author: { '@type': 'Person', name: 'Geirr Winnem' },
          }),
        },
      ],
      // Disables the right-hand table of contents on every Starlight
      // page by default (per-page override still available via
      // `tableOfContents: false` — or a real heading list — in that
      // page's own frontmatter, but the site-wide default is off).
      tableOfContents: false,
      // "Edit page" link at the bottom of every doc page, pointing at
      // this repo's own real source path for that page (confirmed
      // branch name: `main`, matching every other cross-reference to
      // this repo elsewhere in this project's own docs).
      editLink: {
        baseUrl: 'https://github.com/gwinnem/keystone-chartjs-wrappers/edit/main/docs/site/src/content/docs/',
      },
      components: {
        // Top navbar for Starlight doc pages ONLY — a VitePress-style
        // section nav (Guide/Features/Components/API/Examples/Changelog
        // scoped to whichever framework the current URL is under, plus
        // Starlight's own search and social icons), matching
        // keystone-dashboard-layout's actual reference site at
        // localhost:4321. Deliberately NOT SiteNav.astro (the plain
        // landing page's own Docs/Examples-dropdown nav) — that was
        // reused here previously and was the bug: KDL's own reference
        // uses two different navs for these two surfaces, not one
        // shared one. See DocsHeader.astro's own header comment.
        Header: './src/components/DocsHeader.astro',
        // Scopes the left sidebar to just the current top-level section
        // (Vue vs Core) instead of always showing every section's own
        // tree at once — adapted directly from KDL's own real
        // Sidebar.astro override (see that file's own header comment
        // for the full rationale, including why this depends on the
        // exact installed Starlight version's route-data API shape).
        Sidebar: './src/components/Sidebar.astro',
        // Injects one page-specific CSS tweak (a wider content column
        // for /vue/features) — see that file's own header comment for
        // the exact value and why it's scoped to just that route.
        Head: './src/components/Head.astro',
      },
      social: {
        github: 'https://github.com/gwinnem/keystone-chartjs-wrappers',
      },
      sidebar: [
        {
          label: 'Vue',
          items: [
            { label: 'Overview', slug: 'vue' },
            {
              label: 'Guide',
              items: [
                { label: 'Introduction', slug: 'vue/guide/introduction' },
                { label: 'Installation', slug: 'vue/guide/installation' },
                { label: 'Migrating from vue-chartjs', slug: 'vue/guide/migrating-from-vue-chartjs' },
                { label: 'Recipes', slug: 'vue/guide/recipes' },
                { label: 'Troubleshooting & FAQ', slug: 'vue/guide/troubleshooting' },
                {
                  label: 'Concepts',
                  collapsed: false,
                  items: [
                    { label: 'Data structures', slug: 'vue/guide/concepts/data-structures' },
                    { label: 'Options resolution', slug: 'vue/guide/concepts/options-resolution' },
                    { label: 'Axes & scales', slug: 'vue/guide/concepts/axes-and-scales' },
                    { label: 'Mixed charts', slug: 'vue/guide/concepts/mixed-charts' },
                    { label: 'Colors, fonts & padding', slug: 'vue/guide/concepts/styling' },
                    { label: 'Performance', slug: 'vue/guide/concepts/performance' },
                    { label: 'Accessibility', slug: 'vue/guide/concepts/accessibility' },
                  ],
                },
                {
                  label: 'Project',
                  collapsed: false,
                  items: [
                    { label: 'Architecture', slug: 'vue/guide/project/architecture' },
                    { label: 'Testing philosophy', slug: 'vue/guide/project/testing' },
                    { label: 'Roadmap', slug: 'vue/guide/project/roadmap' },
                  ],
                },
                { label: 'Changelog', slug: 'vue/guide/changelog' },
              ],
            },
            { label: 'Features', slug: 'vue/features' },
            {
              label: 'Components',
              items: [
                { label: 'Overview', slug: 'vue/components' },
                { label: 'Props', slug: 'vue/components/props' },
                { label: 'Slots', slug: 'vue/components/slots' },
                { label: 'Events', slug: 'vue/components/events' },
              ],
            },
            {
              label: 'API',
              items: [
                { label: 'Overview', slug: 'vue/api' },
                { label: 'Chart kinds', slug: 'vue/api/chart-kinds' },
                { label: 'Plugins', slug: 'vue/api/plugins' },
              ],
            },
            {
              label: 'Examples',
              collapsed: true,
              items: [
                { label: 'Gallery', slug: 'vue/examples' },
                {
                  label: 'Chart types',
                  collapsed: true,
                  items: [
                    { label: 'Bar chart', slug: 'vue/examples/bar-chart' },
                    { label: 'Horizontal bar chart', slug: 'vue/examples/horizontal-bar-chart' },
                    { label: 'Line chart', slug: 'vue/examples/line-chart' },
                    { label: 'Bubble chart', slug: 'vue/examples/bubble-chart' },
                    { label: 'Scatter chart', slug: 'vue/examples/scatter-chart' },
                    { label: 'Doughnut chart', slug: 'vue/examples/doughnut-chart' },
                    { label: 'Pie chart', slug: 'vue/examples/pie-chart' },
                    { label: 'Polar area chart', slug: 'vue/examples/polar-area-chart' },
                    { label: 'Radar chart', slug: 'vue/examples/radar-chart' },
                  ],
                },
                {
                  label: 'Extension chart types',
                  collapsed: true,
                  items: [
                    { label: 'Candlestick chart', slug: 'vue/examples/candlestick-chart' },
                    { label: 'OHLC chart', slug: 'vue/examples/ohlc-chart' },
                    { label: 'Box plot chart', slug: 'vue/examples/boxplot-chart' },
                    { label: 'Violin chart', slug: 'vue/examples/violin-chart' },
                    { label: 'Matrix chart', slug: 'vue/examples/matrix-chart' },
                    { label: 'Sankey chart', slug: 'vue/examples/sankey' },
                    { label: 'Treemap chart', slug: 'vue/examples/treemap-chart' },
                  ],
                },
                {
                  label: 'Composition',
                  collapsed: true,
                  items: [
                    { label: 'Area chart', slug: 'vue/examples/area-chart' },
                    { label: 'Mixed chart', slug: 'vue/examples/mixed-chart' },
                    { label: 'Multiple axes', slug: 'vue/examples/multi-axis' },
                  ],
                },
                {
                  label: 'Official plugins',
                  collapsed: true,
                  items: [
                    { label: 'Overview', slug: 'vue/examples/official-plugins' },
                    { label: 'Colors plugin', slug: 'vue/examples/colors-plugin' },
                    { label: 'Zoom plugin', slug: 'vue/examples/zoom-plugin' },
                    { label: 'Annotation plugin', slug: 'vue/examples/annotation-plugin' },
                    { label: 'Data labels plugin', slug: 'vue/examples/data-labels-plugin' },
                    { label: 'Gradient plugin', slug: 'vue/examples/gradient-plugin' },
                    { label: 'Timestack scale', slug: 'vue/examples/timestack-scale' },
                    { label: 'Hierarchical scale', slug: 'vue/examples/hierarchical-scale' },
                    { label: 'Image label plugin', slug: 'vue/examples/image-label-plugin' },
                    { label: 'Autocolors plugin', slug: 'vue/examples/autocolors-plugin' },
                    { label: 'Deferred plugin', slug: 'vue/examples/deferred-plugin' },
                    { label: 'Trendline plugin', slug: 'vue/examples/trendline-plugin' },
                  ],
                },
                {
                  label: 'Interactivity',
                  collapsed: true,
                  items: [
                    { label: 'Chart events', slug: 'vue/examples/chart-events' },
                  ],
                },
              ],
            },
          ],
        },
        // React/Angular sections remain removed from the site (see
        // docs/site/_archived-pages/ — content preserved there, not
        // deleted, since this Filesystem connector has no delete
        // capability). Re-add sidebar entries here alongside restoring
        // those folders under src/content/docs/ if/when they come back.
        {
          label: 'Core',
          items: [
            { label: 'Overview', slug: 'core' },
            {
              label: 'Guide',
              items: [
                { label: 'Introduction', slug: 'core/guide/introduction' },
                { label: 'Installation', slug: 'core/guide/installation' },
              ],
            },
            {
              label: 'API',
              items: [
                { label: 'Overview', slug: 'core/api' },
                { label: 'Lifecycle', slug: 'core/api/lifecycle' },
                { label: 'Chart kinds', slug: 'core/api/chart-kinds' },
                { label: 'Plugins', slug: 'core/api/plugins' },
                { label: 'Test utilities', slug: 'core/api/test-utils' },
                // Auto-generated from `packages/core/src/index.ts` via
                // TypeDoc + typedoc-plugin-markdown, called directly by
                // `scripts/generate-typedoc.mjs` (wired as predev/
                // prebuild in package.json — see that script's own
                // header comment for why this project doesn't use the
                // `starlight-typedoc` package for this). `autogenerate`
                // is Starlight's own native, first-party sidebar
                // feature — no plugin needed — listing every page
                // currently on disk under this directory automatically,
                // so it never goes stale as the generated content
                // itself changes between rebuilds.
                { label: 'References', autogenerate: { directory: 'core/api/reference' } },
              ],
            },
          ],
        },
      ],
    }),
  ],
});
