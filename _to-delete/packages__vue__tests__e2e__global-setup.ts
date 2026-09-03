// Neutralized — no longer referenced by playwright.config.ts.
//
// This file's own approach (sequentially visiting each extension-kind/
// plugin fixture once, before any parallel test worker starts, to
// avoid a suspected first-discovery race in Vite's own dependency
// optimizer) was tried and confirmed NOT to fix the real issue: a real
// run with this globalSetup wired up still showed the identical 6
// fixtures (candlestick/ohlc/boxplot/violin/matrix/treemap) failing
// with "Failed to resolve module specifier", ruling out a parallel-
// worker race entirely. The real, confirmed fix was `--force` on the
// dev-server's own startup command — see playwright.config.ts's own
// `webServer.command` comment for the full story.
//
// Left in place, inert, rather than deleted — this connector has no
// delete capability.
export {};
