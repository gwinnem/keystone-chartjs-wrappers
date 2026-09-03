// Neutralized — no longer used by any spec.
//
// This helper (reading Chart.vue's own exposed `chart` ref via
// window.__chartRef) was part of an investigation into 6 e2e specs
// consistently failing with "Failed to resolve module specifier" for
// their own backing extension packages. It correctly showed the chart
// instance was never constructed at all — but the investigation moved
// on to reading the actual swallowed error directly, which pinpointed
// the real cause (a Vite dev-server dynamic-import resolution gap, not
// anything this helper's own diagnostic approach could fix). See
// candlestick-chart.spec.ts's own header comment for the full,
// documented limitation this led to.
//
// Left in place, inert, rather than deleted — this connector has no
// delete capability.
export {};
