/**
 * Trendline text-label drawing, faithfully ported from `chartjs-plugin-
 * trendline` (v3.2.12, MIT, Marcus Alsterfjord) \u2014 real source dissected
 * directly from the installed package's own real, readable
 * `src/components/label.js`.
 */

export interface TrendlineLabelParams {
  ctx: CanvasRenderingContext2D;
  label: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** The trendline segment's own angle, in radians (`Math.atan2(y2 -
   * y1, x2 - x1)`) \u2014 the label is drawn rotated to align with it. */
  angle: number;
  labelColor: string;
  family: string;
  size: number;
  /** Perpendicular-ish offset (in the segment's own rotated coordinate
   * space) between the segment's own midpoint and the drawn text
   * baseline. */
  offset: number;
}

/** Draws `label` centered on the trendline segment's own midpoint,
 * rotated to align with the segment itself \u2014 the original's own real
 * approach (translate to the midpoint, rotate to the segment's own
 * angle, draw centered text with a small offset), not a horizontal
 * label placed near the line. */
export function addTrendlineLabel(params: TrendlineLabelParams): void {
  const { ctx, label, x1, y1, x2, y2, angle, labelColor, family, size, offset } = params;

  ctx.font = `${size}px ${family}`;
  ctx.fillStyle = labelColor;

  const labelWidth = ctx.measureText(label).width;
  const labelX = (x1 + x2) / 2;
  const labelY = (y1 + y2) / 2;

  ctx.save();
  ctx.translate(labelX, labelY);
  ctx.rotate(angle);
  ctx.fillText(label, -labelWidth / 2, offset);
  ctx.restore();
}
