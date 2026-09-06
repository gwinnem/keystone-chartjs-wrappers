/**
 * Label callout-line drawing, faithfully ported from
 * `chartjs-plugin-annotation` (v3.1.0, MIT) \u2014 real source dissected
 * directly from the installed package's own real, unminified ESM
 * build. See `geometry.ts`'s own header comment for the full
 * dissection rationale.
 */
import { distanceBetweenPoints } from 'chart.js/helpers';
import { rotated, toRadians, getSize } from './geometry.js';
import { setBorderStyle } from './drawing.js';

const positions = ['left', 'bottom', 'top', 'right'] as const;
type CalloutPosition = (typeof positions)[number];

export interface CalloutOptions {
  display?: boolean;
  margin: number;
  position?: CalloutPosition | 'auto';
  side: number;
  start: number | string;
  borderWidth?: number;
  borderCapStyle?: CanvasLineCap;
  borderDash?: number[];
  borderDashOffset?: number;
  borderJoinStyle?: CanvasLineJoin;
  borderColor?: string;
}

export interface CalloutElement {
  pointX: number;
  pointY: number;
  x: number;
  y: number;
  x2: number;
  y2: number;
  width: number;
  height: number;
  centerX: number;
  centerY: number;
  rotation: number;
  options: { callout?: CalloutOptions; borderWidth: number };
  getCenterPoint(): { x: number; y: number };
}

/** Draws the real dashed/solid line connecting a label back to its own
 * real anchor point (`pointX`/`pointY`) \u2014 a no-op when the callout
 * isn't configured to display, or the anchor point already falls
 * inside the label's own box (nothing meaningful to point at). */
export function drawCallout(ctx: CanvasRenderingContext2D, element: CalloutElement): void {
  const { pointX, pointY, options } = element;
  const callout = options.callout;
  const calloutPosition = callout && callout.display ? resolveCalloutPosition(element, callout) : undefined;
  if (!calloutPosition || isPointInRange(element, callout!, calloutPosition)) return;

  ctx.save();
  ctx.beginPath();
  const stroke = setBorderStyle(ctx, callout);
  if (!stroke) {
    ctx.restore();
    return;
  }
  const { separatorStart, separatorEnd } = getCalloutSeparatorCoord(element, calloutPosition);
  const { sideStart, sideEnd } = getCalloutSideCoord(element, calloutPosition, separatorStart);
  if (callout!.margin > 0 || options.borderWidth === 0) {
    ctx.moveTo(separatorStart.x, separatorStart.y);
    ctx.lineTo(separatorEnd.x, separatorEnd.y);
  }
  ctx.moveTo(sideStart.x, sideStart.y);
  ctx.lineTo(sideEnd.x, sideEnd.y);
  const rotatedPoint = rotated({ x: pointX, y: pointY }, element.getCenterPoint(), toRadians(-element.rotation));
  ctx.lineTo(rotatedPoint.x, rotatedPoint.y);
  ctx.stroke();
  ctx.restore();
}

function getCalloutSeparatorCoord(element: CalloutElement, position: CalloutPosition) {
  const { x, y, x2, y2 } = element;
  const adjust = getCalloutSeparatorAdjust(element, position);
  let separatorStart: { x: number; y: number };
  let separatorEnd: { x: number; y: number };
  if (position === 'left' || position === 'right') {
    separatorStart = { x: x + adjust, y };
    separatorEnd = { x: separatorStart.x, y: y2 };
  } else {
    separatorStart = { x, y: y + adjust };
    separatorEnd = { x: x2, y: separatorStart.y };
  }
  return { separatorStart, separatorEnd };
}

function getCalloutSeparatorAdjust(element: CalloutElement, position: CalloutPosition): number {
  const { width, height, options } = element;
  const adjust = options.callout!.margin + options.borderWidth / 2;
  if (position === 'right') return width + adjust;
  if (position === 'bottom') return height + adjust;
  return -adjust;
}

function getCalloutSideCoord(element: CalloutElement, position: CalloutPosition, separatorStart: { x: number; y: number }) {
  const { y, width, height, options } = element;
  const start = options.callout!.start;
  const side = getCalloutSideAdjust(position, options.callout!);
  let sideStart: { x: number; y: number };
  let sideEnd: { x: number; y: number };
  if (position === 'left' || position === 'right') {
    sideStart = { x: separatorStart.x, y: y + getSize(height, start) };
    sideEnd = { x: sideStart.x + side, y: sideStart.y };
  } else {
    sideStart = { x: separatorStart.x + getSize(width, start), y: separatorStart.y };
    sideEnd = { x: sideStart.x, y: sideStart.y + side };
  }
  return { sideStart, sideEnd };
}

function getCalloutSideAdjust(position: CalloutPosition, options: CalloutOptions): number {
  const side = options.side;
  if (position === 'left' || position === 'top') return -side;
  return side;
}

function resolveCalloutPosition(element: CalloutElement, options: CalloutOptions): CalloutPosition {
  const position = options.position;
  if (position && (positions as readonly string[]).includes(position)) return position as CalloutPosition;
  return resolveCalloutAutoPosition(element, options);
}

/** With `position: 'auto'` (the real default), picks whichever of the
 * four real sides puts the callout's own connecting line closest to
 * the label's own anchor point \u2014 confirmed real logic: computes all
 * four candidate rotated corner-adjacent points and picks the nearest. */
function resolveCalloutAutoPosition(element: CalloutElement, options: CalloutOptions): CalloutPosition {
  const { x, y, x2, y2, width, height, pointX, pointY, centerX, centerY, rotation } = element;
  const center = { x: centerX, y: centerY };
  const start = options.start;
  const xAdjust = getSize(width, start);
  const yAdjust = getSize(height, start);
  const xPoints = [x, x + xAdjust, x + xAdjust, x2];
  const yPoints = [y + yAdjust, y2, y, y2];
  const result: { position: CalloutPosition; distance: number }[] = [];
  for (let index = 0; index < 4; index++) {
    const rotatedPoint = rotated({ x: xPoints[index], y: yPoints[index] }, center, toRadians(rotation));
    result.push({
      position: positions[index],
      distance: distanceBetweenPoints(rotatedPoint, { x: pointX, y: pointY }),
    });
  }
  return result.sort((a, b) => a.distance - b.distance)[0].position;
}

function isPointInRange(element: CalloutElement, callout: CalloutOptions, position: CalloutPosition): boolean {
  const { pointX, pointY } = element;
  const margin = callout.margin;
  let x = pointX;
  let y = pointY;
  if (position === 'left') x += margin;
  else if (position === 'right') x -= margin;
  else if (position === 'top') y += margin;
  else if (position === 'bottom') y -= margin;
  return (element as unknown as { inRange(x: number, y: number): boolean }).inRange(x, y);
}
