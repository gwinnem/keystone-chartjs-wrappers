// This file previously held a type shim for `chartjs-plugin-image-label`
// (a third-party package's own broken package.json "exports" field).
// No longer needed — that package is no longer a dependency at all;
// its plugin logic was ported directly into plugins.ts's own
// `imageLabelPluginObject`, at the user's explicit request (see that
// object's own header comment for the full rationale). Left as an
// empty module rather than deleted (this Filesystem connector has no
// delete capability) — please remove this file yourself.
export {};
