/**
 * Local port of `chartjs-plugin-image-label` (v1.0.10, MIT, Yunus Emre
 * Kara), supplied via Chart.js's inline `plugins` array instead of a
 * dependency, so it avoids the docs-site dynamic-import hydration gap
 * the other plugins in this project hit.
 *
 * Changes from the original:
 * - Draws labels for every dataset (the original only handled dataset 0).
 * - Positions using each arc's own computed geometry instead of
 *   recomputing slice angles from raw values (now correct under a
 *   custom `rotation`/`circumference`).
 * - Failed image loads are logged via `console.warn` instead of
 *   silently doing nothing.
 * - The image cache is capped at {@link MAX_CACHED_IMAGES} entries with
 *   FIFO eviction, instead of growing unboundedly.
 * - Uses a real `instanceof ArcElement` check instead of an unchecked cast.
 * - The plugin object is typed against Chart.js's own `Plugin` interface.
 * - Position/draw logic is split into small, named, independently
 *   testable functions instead of one large nested closure.
 */
import { ArcElement, type Chart, type ChartType, type Plugin } from 'chart.js';
import type { ImageLabelPluginOptions } from '../../types.js';

const MAX_CACHED_IMAGES = 200;

const loadedImages = new Map<string, HTMLImageElement>();

/**
 * Looks up a previously loaded image by URL.
 *
 * @param imageUrl - The image URL to look up.
 * @returns The cached `HTMLImageElement`, or `undefined` if not yet loaded.
 */
function getCachedImage(imageUrl: string): HTMLImageElement | undefined {
  return loadedImages.get(imageUrl);
}

/**
 * Stores a loaded image in the module-level cache, keyed by URL.
 *
 * Evicts the oldest cached entry (insertion order) once the cache
 * reaches `MAX_CACHED_IMAGES`, so long-running pages cycling through
 * many distinct image URLs don't grow this cache unboundedly.
 *
 * @param imageUrl - The URL the image was loaded from.
 * @param image - The loaded `HTMLImageElement` to cache.
 */
function cacheImage(imageUrl: string, image: HTMLImageElement): void {
  if (loadedImages.size >= MAX_CACHED_IMAGES) {
    const oldestKey = loadedImages.keys().next().value;
    if (oldestKey !== undefined) loadedImages.delete(oldestKey);
  }
  loadedImages.set(imageUrl, image);
}

/**
 * Loads the image at `imageUrl`, then invokes `onReady` with the loaded
 * element. If already cached, `onReady` runs immediately; otherwise it
 * runs once the image finishes loading, and the result is cached for
 * subsequent calls.
 *
 * Failed loads are logged via `console.warn` and otherwise ignored —
 * this plugin has no error-reporting channel of its own, and a missing
 * label image shouldn't break the rest of the chart's rendering.
 *
 * @param imageUrl - The image URL to load.
 * @param onReady - Called with the loaded image once available.
 */
function loadImage(imageUrl: string, onReady: (image: HTMLImageElement) => void): void {
  const cached = getCachedImage(imageUrl);
  if (cached) {
    onReady(cached);
    return;
  }

  const image = new Image();
  image.onload = () => {
    cacheImage(imageUrl, image);
    onReady(image);
  };
  image.onerror = () => {
    console.warn(`keystone-chartjs-core: imageLabel plugin failed to load image "${imageUrl}"`);
  };
  image.src = imageUrl;
}

/**
 * Type guard confirming `value` is a real Chart.js `ArcElement` instance
 * (as opposed to some other `Element` subclass), so its arc-specific
 * geometry (`startAngle`, `outerRadius`, etc.) can be read safely.
 *
 * @param value - The value to check.
 * @returns `true` if `value` is an `ArcElement`.
 */
function isArcElement(value: unknown): value is ArcElement {
  return value instanceof ArcElement;
}

/**
 * Computes how far from the arc's center an image should be placed,
 * based on `verticalAlign`.
 *
 * @param verticalAlign - Where the image sits between the arc's inner and outer radius.
 * @param innerRadius - The arc's inner radius (0 for a pie chart).
 * @param outerRadius - The arc's outer radius.
 * @param imageRadius - Half of the smaller of the image's width/height.
 * @returns The distance from the arc's center point, in pixels.
 */
function computeDistanceFromCenter(
  verticalAlign: NonNullable<ImageLabelPluginOptions['verticalAlign']>,
  innerRadius: number,
  outerRadius: number,
  imageRadius: number,
): number {
  switch (verticalAlign) {
    case 'top':
      return outerRadius - imageRadius;
    case 'bottom':
      return innerRadius + imageRadius;
    case 'middle':
    default:
      return innerRadius + (outerRadius - innerRadius) / 2;
  }
}

/**
 * Computes the angle (in radians) at which an image should be placed
 * within the arc's own angular span, based on `horizontalAlign`.
 *
 * @param horizontalAlign - Where the image sits between the arc's start and end angle.
 * @param startAngle - The arc's start angle, in radians.
 * @param endAngle - The arc's end angle, in radians.
 * @param imageRadius - Half of the smaller of the image's width/height.
 * @param outerRadius - The arc's outer radius.
 * @param offsetRadian - Additional angular offset, in radians (from `options.offset`).
 * @returns The angle, in radians, to place the image at.
 */
function computeAngleForImage(
  horizontalAlign: NonNullable<ImageLabelPluginOptions['horizontalAlign']>,
  startAngle: number,
  endAngle: number,
  imageRadius: number,
  outerRadius: number,
  offsetRadian: number,
): number {
  switch (horizontalAlign) {
    case 'start':
      return startAngle + imageRadius / outerRadius + offsetRadian;
    case 'end':
      return endAngle - imageRadius / outerRadius - offsetRadian;
    case 'middle':
    default:
      return (startAngle + endAngle) / 2;
  }
}

interface ImageLabelPosition {
  imageCenterX: number;
  imageCenterY: number;
  imageX: number;
  imageY: number;
}

/**
 * Computes where a single image label should be drawn for a given arc.
 *
 * @param arc - The arc element the image label is being placed on.
 * @param imageWidth - The image's width, in pixels.
 * @param imageHeight - The image's height, in pixels.
 * @param verticalAlign - Where the image sits between the arc's inner and outer radius.
 * @param horizontalAlign - Where the image sits between the arc's start and end angle.
 * @param offset - Additional angular offset, in pixels at the arc's outer radius.
 * @returns The image's center point and top-left drawing position.
 */
function computeImageLabelPosition(
  arc: ArcElement,
  imageWidth: number,
  imageHeight: number,
  verticalAlign: NonNullable<ImageLabelPluginOptions['verticalAlign']>,
  horizontalAlign: NonNullable<ImageLabelPluginOptions['horizontalAlign']>,
  offset: number | undefined,
): ImageLabelPosition {
  const { startAngle, endAngle, innerRadius, outerRadius } = arc;
  const { x: centerX, y: centerY } = arc.getCenterPoint(false);
  const imageRadius = Math.min(imageWidth, imageHeight) / 2;
  const offsetRadian = offset ? offset / outerRadius : 0;

  const distanceFromCenter = computeDistanceFromCenter(verticalAlign, innerRadius, outerRadius, imageRadius);
  const angleForImage = computeAngleForImage(horizontalAlign, startAngle, endAngle, imageRadius, outerRadius, offsetRadian);

  const imageCenterX = centerX + distanceFromCenter * Math.cos(angleForImage);
  const imageCenterY = centerY + distanceFromCenter * Math.sin(angleForImage);

  return {
    imageCenterX,
    imageCenterY,
    imageX: imageCenterX - imageWidth / 2,
    imageY: imageCenterY - imageHeight / 2,
  };
}

/**
 * Draws `image`, clipped to a circle, at the given position.
 *
 * @param ctx - The canvas context to draw into.
 * @param image - The image to draw.
 * @param position - Where to draw it (see {@link computeImageLabelPosition}).
 * @param imageWidth - The image's width, in pixels.
 * @param imageHeight - The image's height, in pixels.
 */
function drawClippedImage(
  ctx: CanvasRenderingContext2D,
  image: HTMLImageElement,
  position: ImageLabelPosition,
  imageWidth: number,
  imageHeight: number,
): void {
  const { imageCenterX, imageCenterY, imageX, imageY } = position;
  ctx.save();
  ctx.beginPath();
  ctx.arc(imageCenterX, imageCenterY, imageWidth / 2, 0, Math.PI * 2, false);
  ctx.clip();
  ctx.drawImage(image, imageX, imageY, imageWidth, imageHeight);
  ctx.closePath();
  ctx.restore();
}

/**
 * Computes an arc's image label position, loads its image (from cache
 * or over the network), and draws it once ready.
 *
 * @param ctx - The canvas context to draw into.
 * @param arc - The arc to draw an image label on.
 * @param imageInfo - The image to draw and its dimensions.
 * @param verticalAlign - Where the image sits between the arc's inner and outer radius.
 * @param horizontalAlign - Where the image sits between the arc's start and end angle.
 * @param offset - Additional angular offset, in pixels at the arc's outer radius.
 */
function drawArcImageLabel(
  ctx: CanvasRenderingContext2D,
  arc: ArcElement,
  imageInfo: ImageLabelPluginOptions['imagesList'][number],
  verticalAlign: NonNullable<ImageLabelPluginOptions['verticalAlign']>,
  horizontalAlign: NonNullable<ImageLabelPluginOptions['horizontalAlign']>,
  offset: number | undefined,
): void {
  const { imageUrl, imageWidth, imageHeight } = imageInfo;
  const position = computeImageLabelPosition(arc, imageWidth, imageHeight, verticalAlign, horizontalAlign, offset);

  loadImage(imageUrl, (image) => {
    drawClippedImage(ctx, image, position, imageWidth, imageHeight);
  });
}

/**
 * Chart.js plugin that draws an image label on each arc of a doughnut or
 * pie chart's dataset(s), positioned and sized per `ImageLabelPluginOptions`.
 *
 * Supplied to Chart.js via its inline `plugins` array rather than a global
 * `Chart.register(...)` call.
 */
export const imageLabelPlugin: Plugin<ChartType, ImageLabelPluginOptions> = {
  id: 'imageLabel',

  /**
   * Draws each dataset's image labels after Chart.js finishes its own draw pass.
   *
   * For every doughnut/pie dataset, iterates its arcs and draws the
   * corresponding entry from `options.imagesList` (matched by index),
   * clipped to a circle and positioned according to `verticalAlign`,
   * `horizontalAlign`, and `offset`. Images are loaded once per URL and
   * cached for reuse across draws and chart instances.
   *
   * @param chart - The Chart.js instance being drawn.
   * @param _args - Unused; part of Chart.js's plugin hook signature.
   * @param options - This plugin's own configuration for the current chart.
   */
  afterDraw(chart: Chart, _args, options: ImageLabelPluginOptions): void {
    const ctx = chart.ctx;
    const { verticalAlign = 'middle', horizontalAlign = 'middle', imagesList, offset } = options;

    chart.data.datasets.forEach((_dataset, datasetIndex) => {
      const meta = chart.getDatasetMeta(datasetIndex);
      if (meta.type !== 'doughnut' && meta.type !== 'pie') return;

      meta.data.forEach((element, index) => {
        if (!isArcElement(element)) return;

        const imageInfo = imagesList[index];
        if (!imageInfo?.imageUrl) return;

        drawArcImageLabel(ctx, element, imageInfo, verticalAlign, horizontalAlign, offset);
      });
    });
  },
};
