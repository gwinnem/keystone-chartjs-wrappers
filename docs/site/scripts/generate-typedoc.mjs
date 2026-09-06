// Generates the auto-generated API reference under
// src/content/docs/core/api/reference/ directly from TypeDoc +
// typedoc-plugin-markdown, called directly rather than through the
// `starlight-typedoc` package.
//
// Why not `starlight-typedoc`: the only released version compatible
// with this project's own pinned Starlight (0.30.x — `starlight-
// typedoc`'s later releases require Starlight >=0.32.0, and upgrading
// Starlight itself cascaded into a deeper, unrelated Astro-core
// incompatibility) is 0.18.0, which has two real, confirmed bugs
// against the newer typedoc/typedoc-plugin-markdown versions available
// today: its own custom Starlight theme emits files named `.html`
// despite genuinely Markdown content (silently ignored by Starlight's
// own content-collection loader, which only recognizes .md/.mdx), and
// its own sidebar-group auto-injection (`typeDocSidebarGroup`) silently
// drops every generated page from the sidebar tree entirely (traced to
// its own `getSidebarGroupFromReflections`' directory-prefix check
// never matching). Calling TypeDoc directly sidesteps both: no custom
// theme at all (typedoc-plugin-markdown's own default output, which
// writes real, correctly-named `.md` files), and no custom sidebar
// injection (Starlight's own native, first-party `autogenerate`
// sidebar option — see astro.config.mjs's own Core → API section —
// handles listing every generated page automatically instead).
//
// Run before `astro dev`/`astro build` (wired as `predev`/`prebuild` in
// package.json) — this project's own docs need real, current content on
// disk before Astro's content-collection loader ever scans it; Astro
// itself doesn't run arbitrary Node scripts as part of its own config
// loading (that's exactly the "browser APIs not available on the
// server" class of failure `starlight-typedoc`'s own in-config-file
// approach hit).
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import fs from 'node:fs';
import { Application, TSConfigReader, PageEvent } from 'typedoc';

const here = path.dirname(fileURLToPath(import.meta.url));
const toPosixPath = (p) => p.replaceAll('\\', '/');

const entryPoint = toPosixPath(path.resolve(here, '../../../packages/core/src/index.ts'));
const tsconfig = toPosixPath(path.resolve(here, '../../../packages/core/tsconfig.json'));
const outputPath = path.resolve(here, '../src/content/docs/core/api/reference');

const app = await Application.bootstrapWithPlugins({
  excludeInternal: true,
  excludePrivate: true,
  excludeProtected: true,
  githubPages: false,
  readme: 'none',
  plugin: ['typedoc-plugin-markdown'],
  // Loading the plugin alone isn't enough — confirmed directly: without
  // this, TypeDoc silently falls back to its own default HTML theme
  // (recognizable by the `assets/` folder it writes alongside the
  // pages) even with the markdown plugin loaded. `theme: 'markdown'` is
  // the plugin's own registered theme name that actually switches
  // rendering over to real Markdown output.
  theme: 'markdown',
  entryPoints: [entryPoint],
  tsconfig,
  // No "Defined in" source links at all, at your explicit request —
  // avoids the whole class of problem entirely (auto-detected local
  // git commit SHAs 404 on GitHub when unpushed; even a fixed branch
  // link can drift once code moves within a file).
  disableSources: true,
  // typedoc-plugin-markdown options — real Markdown output, Starlight
  // handles page chrome itself so this suppresses the plugin's own
  // duplicate header/breadcrumbs/title.
  fileExtension: '.md',
  entryFileName: 'index',
  hideBreadcrumbs: true,
  hidePageHeader: true,
  hidePageTitle: true,
});
app.options.addReader(new TSConfigReader());

// Real Starlight-compatible frontmatter per generated page — matching
// the same shape `starlight-typedoc`'s own (working) frontmatter
// injection used, just without its own broken custom theme alongside it.
app.renderer.on(PageEvent.END, (event) => {
  if (!event.contents) return;
  const title = event.model?.name ?? 'API';
  const frontmatter = `---\neditUrl: false\ntitle: "${title.replaceAll('"', '\\"')}"\n---\n\n`;
  if (!event.contents.startsWith('---')) {
    event.contents = frontmatter + event.contents;
  }
});

const project = await app.convert();
if (!project) {
  throw new Error('TypeDoc conversion failed — no project reflection produced.');
}

fs.rmSync(outputPath, { recursive: true, force: true });
await app.generateDocs(project, outputPath);

// Direct post-processing rather than relying on `fileExtension`/
// `entryFileName` plugin options: confirmed directly across several
// attempts that this installed typedoc-plugin-markdown version keeps
// emitting real Markdown content under literal `.html`-suffixed
// filenames (with matching `.html` internal cross-links) regardless of
// those options. Since the CONTENT itself is genuinely correct
// Markdown — only the filenames/links are wrong — renaming every file
// and rewriting every internal link afterwards is simpler and more
// robust than continuing to chase the exact right option name/version
// combination for this particular plugin release.
function walk(dir) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) results.push(...walk(full));
    else results.push(full);
  }
  return results;
}

const allFiles = walk(outputPath);

// Pass 1: rewrite every `.html` internal link (both directory-relative
// links like `interfaces/Foo.html` and the bare `Foo.html` form) to
// `.md`, before any renaming, so paths in file contents still resolve
// against the pre-rename directory structure.
for (const file of allFiles) {
  if (!file.endsWith('.html')) continue;
  const contents = fs.readFileSync(file, 'utf8');
  const rewritten = contents.replaceAll(/(\]\([^)]*?)\.html(#[^)]*)?\)/g, '$1.md$2)');
  if (rewritten !== contents) fs.writeFileSync(file, rewritten, 'utf8');
}

// Pass 2: rename every `.html` file to `.md`.
for (const file of allFiles) {
  if (!file.endsWith('.html')) continue;
  fs.renameSync(file, file.slice(0, -'.html'.length) + '.md');
}

console.log(`[generate-typedoc] wrote API reference to ${toPosixPath(path.relative(process.cwd(), outputPath))}`);
