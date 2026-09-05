/**
 * Canvas drawing helpers, faithfully ported from `chartjs-plugin-
 * trendline` (v3.2.12, MIT, Marcus Alsterfjord) \u2014 real source dissected
 * directly from the installed package's own real, readable
 * `src/utils/drawing.js`.
 */
import type { Chart, Scale } from 'chart.js';

/** Finds the chart's own real horizontal/vertical scale pair \u2014 used to
 * resolve trendline geometry regardless of which axis IDs a chart
 * actually uses. */
export function getScales(chart: Chart): { xScale?: Scale; yScale?: Scale } {
  let xScale: Scale | undefined;
  let yScale: Scale | undefined;
  for (const scale of Object.values(chart.scales)) {
    if (scale.isHorizontal()) xScale = scale;
    else yScale = scale;
    if (xScale && yScale) break;
  }
  return { xScale, yScale };
}

/** Sets the real canvas line-dash pattern for a given `lineStyle` \u2014 the
 * original's own real, fixed dash arrays, not guessed at here
 * (`'dotted'`: `[2, 2]`; `'dashed'`: `[8, 3]`; `'dashdot'`: `[8, 3, 2,
 * 3]`; anything else, including `'solid'`, clears the dash entirely). */
export function setLineStyle(ctx: CanvasRenderingContext2D, lineStyle: string): void {
  switch (lineStyle) {
    case 'dotted':
      ctx.setLineDash([2, 2]);
      break;
    case 'dashed':
      ctx.setLineDash([8, 3]);
      break;
    case 'dashdot':
      ctx.setLineDash([8, 3, 2, 3]);
      break;
    case 'solid':
    default:
      ctx.setLineDash([]);
      break;
  }
}

function validateFiniteCoords(coords: Record<string, number>, label: string): boolean {
  for (const value of Object.values(coords)) {
    if (!isFinite(value)) {
      console.warn(`keystone-chartjs-core: cannot ${label} \u2014 coordinates contain non-finite values`, coords);
      return false;
    }
  }
  return true;
}

/** Draws the real trendline segment itself, as a linear gradient from
 * `colorMin` to `colorMax` along its own length \u2014 falling back to a
 * solid `colorMin` stroke if the segment is degenerate (near-zero
 * length, where `createLinearGradient` can itself throw) or if
 * gradient creation otherwise fails for any reason, both real,
 * confirmed defensive paths from the original, not added by this
 * port. */
export function drawTrendline(params: {
  ctx: CanvasRenderingContext2D;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  colorMin: string;
  colorMax: string;
}): void {
  const { ctx, x1, y1, x2, y2, colorMin, colorMax } = params;
  if (!validateFiniteCoords({ x1, y1, x2, y2 }, 'draw trendline')) return;

  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);

  try {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const gradientLength = Math.sqrt(dx * dx + dy * dy);
    if (gradientLength < 0.01) {
      ctx.strokeStyle = colorMin;
    } else {
      const gradient = ctx.createLinearGradient(x1, y1, x2, y2);
      gradient.addColorStop(0, colorMin);
      gradient.addColorStop(1, colorMax);
      ctx.strokeStyle = gradient;
    }
  } catch {
    ctx.strokeStyle = colorMin;
  }

  ctx.stroke();
  ctx.closePath();
}

/** Fills the area below the trendline segment down to the chart
 * area's own bottom edge \u2014 a real, working feature of the original
 * package (`fillColor` on the trendline config) that its own README
 * never actually documents. */
export function fillBelowTrendline(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  drawBottom: number,
  fillColor: string,
): void {
  if (!validateFiniteCoords({ x1, y1, x2, y2, drawBottom }, 'fill below trendline')) return;

  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.lineTo(x2, drawBottom);
  ctx.lineTo(x1, drawBottom);
  ctx.lineTo(x1, y1);
  ctx.closePath();

  ctx.fillStyle = fillColor;
  ctx.fill();
}
