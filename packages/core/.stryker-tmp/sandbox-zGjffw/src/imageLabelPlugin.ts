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
// @ts-nocheck
function stryNS_9fa48() {
  var g = typeof globalThis === 'object' && globalThis && globalThis.Math === Math && globalThis || new Function("return this")();
  var ns = g.__stryker__ || (g.__stryker__ = {});
  if (ns.activeMutant === undefined && g.process && g.process.env && g.process.env.__STRYKER_ACTIVE_MUTANT__) {
    ns.activeMutant = g.process.env.__STRYKER_ACTIVE_MUTANT__;
  }
  function retrieveNS() {
    return ns;
  }
  stryNS_9fa48 = retrieveNS;
  return retrieveNS();
}
stryNS_9fa48();
function stryCov_9fa48() {
  var ns = stryNS_9fa48();
  var cov = ns.mutantCoverage || (ns.mutantCoverage = {
    static: {},
    perTest: {}
  });
  function cover() {
    var c = cov.static;
    if (ns.currentTestId) {
      c = cov.perTest[ns.currentTestId] = cov.perTest[ns.currentTestId] || {};
    }
    var a = arguments;
    for (var i = 0; i < a.length; i++) {
      c[a[i]] = (c[a[i]] || 0) + 1;
    }
  }
  stryCov_9fa48 = cover;
  cover.apply(null, arguments);
}
function stryMutAct_9fa48(id) {
  var ns = stryNS_9fa48();
  function isActive(id) {
    if (ns.activeMutant === id) {
      if (ns.hitCount !== void 0 && ++ns.hitCount > ns.hitLimit) {
        throw new Error('Stryker: Hit count limit reached (' + ns.hitCount + ')');
      }
      return true;
    }
    return false;
  }
  stryMutAct_9fa48 = isActive;
  return isActive(id);
}
import { ArcElement, type Chart, type ChartType, type Plugin } from 'chart.js';
import type { ImageLabelPluginOptions } from './types.js';
const MAX_CACHED_IMAGES = 200;
const loadedImages = new Map<string, HTMLImageElement>();

/**
 * Looks up a previously loaded image by URL.
 *
 * @param imageUrl - The image URL to look up.
 * @returns The cached `HTMLImageElement`, or `undefined` if not yet loaded.
 */
function getCachedImage(imageUrl: string): HTMLImageElement | undefined {
  if (stryMutAct_9fa48("304")) {
    {}
  } else {
    stryCov_9fa48("304");
    return loadedImages.get(imageUrl);
  }
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
  if (stryMutAct_9fa48("305")) {
    {}
  } else {
    stryCov_9fa48("305");
    if (stryMutAct_9fa48("309") ? loadedImages.size < MAX_CACHED_IMAGES : stryMutAct_9fa48("308") ? loadedImages.size > MAX_CACHED_IMAGES : stryMutAct_9fa48("307") ? false : stryMutAct_9fa48("306") ? true : (stryCov_9fa48("306", "307", "308", "309"), loadedImages.size >= MAX_CACHED_IMAGES)) {
      if (stryMutAct_9fa48("310")) {
        {}
      } else {
        stryCov_9fa48("310");
        const oldestKey = loadedImages.keys().next().value;
        if (stryMutAct_9fa48("313") ? oldestKey === undefined : stryMutAct_9fa48("312") ? false : stryMutAct_9fa48("311") ? true : (stryCov_9fa48("311", "312", "313"), oldestKey !== undefined)) loadedImages.delete(oldestKey);
      }
    }
    loadedImages.set(imageUrl, image);
  }
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
  if (stryMutAct_9fa48("314")) {
    {}
  } else {
    stryCov_9fa48("314");
    const cached = getCachedImage(imageUrl);
    if (stryMutAct_9fa48("316") ? false : stryMutAct_9fa48("315") ? true : (stryCov_9fa48("315", "316"), cached)) {
      if (stryMutAct_9fa48("317")) {
        {}
      } else {
        stryCov_9fa48("317");
        onReady(cached);
        return;
      }
    }
    const image = new Image();
    image.onload = () => {
      if (stryMutAct_9fa48("318")) {
        {}
      } else {
        stryCov_9fa48("318");
        cacheImage(imageUrl, image);
        onReady(image);
      }
    };
    image.onerror = () => {
      if (stryMutAct_9fa48("319")) {
        {}
      } else {
        stryCov_9fa48("319");
        console.warn(stryMutAct_9fa48("320") ? `` : (stryCov_9fa48("320"), `keystone-chartjs-core: imageLabel plugin failed to load image "${imageUrl}"`));
      }
    };
    image.src = imageUrl;
  }
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
  if (stryMutAct_9fa48("321")) {
    {}
  } else {
    stryCov_9fa48("321");
    return value instanceof ArcElement;
  }
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
function computeDistanceFromCenter(verticalAlign: NonNullable<ImageLabelPluginOptions['verticalAlign']>, innerRadius: number, outerRadius: number, imageRadius: number): number {
  if (stryMutAct_9fa48("322")) {
    {}
  } else {
    stryCov_9fa48("322");
    switch (verticalAlign) {
      case stryMutAct_9fa48("324") ? "" : (stryCov_9fa48("324"), 'top'):
        if (stryMutAct_9fa48("323")) {} else {
          stryCov_9fa48("323");
          return stryMutAct_9fa48("325") ? outerRadius + imageRadius : (stryCov_9fa48("325"), outerRadius - imageRadius);
        }
      case stryMutAct_9fa48("327") ? "" : (stryCov_9fa48("327"), 'bottom'):
        if (stryMutAct_9fa48("326")) {} else {
          stryCov_9fa48("326");
          return stryMutAct_9fa48("328") ? innerRadius - imageRadius : (stryCov_9fa48("328"), innerRadius + imageRadius);
        }
      case stryMutAct_9fa48("329") ? "" : (stryCov_9fa48("329"), 'middle'):
      default:
        if (stryMutAct_9fa48("330")) {} else {
          stryCov_9fa48("330");
          return stryMutAct_9fa48("331") ? innerRadius - (outerRadius - innerRadius) / 2 : (stryCov_9fa48("331"), innerRadius + (stryMutAct_9fa48("332") ? (outerRadius - innerRadius) * 2 : (stryCov_9fa48("332"), (stryMutAct_9fa48("333") ? outerRadius + innerRadius : (stryCov_9fa48("333"), outerRadius - innerRadius)) / 2)));
        }
    }
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
function computeAngleForImage(horizontalAlign: NonNullable<ImageLabelPluginOptions['horizontalAlign']>, startAngle: number, endAngle: number, imageRadius: number, outerRadius: number, offsetRadian: number): number {
  if (stryMutAct_9fa48("334")) {
    {}
  } else {
    stryCov_9fa48("334");
    switch (horizontalAlign) {
      case stryMutAct_9fa48("336") ? "" : (stryCov_9fa48("336"), 'start'):
        if (stryMutAct_9fa48("335")) {} else {
          stryCov_9fa48("335");
          return stryMutAct_9fa48("337") ? startAngle + imageRadius / outerRadius - offsetRadian : (stryCov_9fa48("337"), (stryMutAct_9fa48("338") ? startAngle - imageRadius / outerRadius : (stryCov_9fa48("338"), startAngle + (stryMutAct_9fa48("339") ? imageRadius * outerRadius : (stryCov_9fa48("339"), imageRadius / outerRadius)))) + offsetRadian);
        }
      case stryMutAct_9fa48("341") ? "" : (stryCov_9fa48("341"), 'end'):
        if (stryMutAct_9fa48("340")) {} else {
          stryCov_9fa48("340");
          return stryMutAct_9fa48("342") ? endAngle - imageRadius / outerRadius + offsetRadian : (stryCov_9fa48("342"), (stryMutAct_9fa48("343") ? endAngle + imageRadius / outerRadius : (stryCov_9fa48("343"), endAngle - (stryMutAct_9fa48("344") ? imageRadius * outerRadius : (stryCov_9fa48("344"), imageRadius / outerRadius)))) - offsetRadian);
        }
      case stryMutAct_9fa48("345") ? "" : (stryCov_9fa48("345"), 'middle'):
      default:
        if (stryMutAct_9fa48("346")) {} else {
          stryCov_9fa48("346");
          return stryMutAct_9fa48("347") ? (startAngle + endAngle) * 2 : (stryCov_9fa48("347"), (stryMutAct_9fa48("348") ? startAngle - endAngle : (stryCov_9fa48("348"), startAngle + endAngle)) / 2);
        }
    }
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
function computeImageLabelPosition(arc: ArcElement, imageWidth: number, imageHeight: number, verticalAlign: NonNullable<ImageLabelPluginOptions['verticalAlign']>, horizontalAlign: NonNullable<ImageLabelPluginOptions['horizontalAlign']>, offset: number | undefined): ImageLabelPosition {
  if (stryMutAct_9fa48("349")) {
    {}
  } else {
    stryCov_9fa48("349");
    const {
      startAngle,
      endAngle,
      innerRadius,
      outerRadius
    } = arc;
    const {
      x: centerX,
      y: centerY
    } = arc.getCenterPoint(stryMutAct_9fa48("350") ? true : (stryCov_9fa48("350"), false));
    const imageRadius = stryMutAct_9fa48("351") ? Math.min(imageWidth, imageHeight) * 2 : (stryCov_9fa48("351"), (stryMutAct_9fa48("352") ? Math.max(imageWidth, imageHeight) : (stryCov_9fa48("352"), Math.min(imageWidth, imageHeight))) / 2);
    const offsetRadian = offset ? stryMutAct_9fa48("353") ? offset * outerRadius : (stryCov_9fa48("353"), offset / outerRadius) : 0;
    const distanceFromCenter = computeDistanceFromCenter(verticalAlign, innerRadius, outerRadius, imageRadius);
    const angleForImage = computeAngleForImage(horizontalAlign, startAngle, endAngle, imageRadius, outerRadius, offsetRadian);
    const imageCenterX = stryMutAct_9fa48("354") ? centerX - distanceFromCenter * Math.cos(angleForImage) : (stryCov_9fa48("354"), centerX + (stryMutAct_9fa48("355") ? distanceFromCenter / Math.cos(angleForImage) : (stryCov_9fa48("355"), distanceFromCenter * Math.cos(angleForImage))));
    const imageCenterY = stryMutAct_9fa48("356") ? centerY - distanceFromCenter * Math.sin(angleForImage) : (stryCov_9fa48("356"), centerY + (stryMutAct_9fa48("357") ? distanceFromCenter / Math.sin(angleForImage) : (stryCov_9fa48("357"), distanceFromCenter * Math.sin(angleForImage))));
    return stryMutAct_9fa48("358") ? {} : (stryCov_9fa48("358"), {
      imageCenterX,
      imageCenterY,
      imageX: stryMutAct_9fa48("359") ? imageCenterX + imageWidth / 2 : (stryCov_9fa48("359"), imageCenterX - (stryMutAct_9fa48("360") ? imageWidth * 2 : (stryCov_9fa48("360"), imageWidth / 2))),
      imageY: stryMutAct_9fa48("361") ? imageCenterY + imageHeight / 2 : (stryCov_9fa48("361"), imageCenterY - (stryMutAct_9fa48("362") ? imageHeight * 2 : (stryCov_9fa48("362"), imageHeight / 2)))
    });
  }
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
function drawClippedImage(ctx: CanvasRenderingContext2D, image: HTMLImageElement, position: ImageLabelPosition, imageWidth: number, imageHeight: number): void {
  if (stryMutAct_9fa48("363")) {
    {}
  } else {
    stryCov_9fa48("363");
    const {
      imageCenterX,
      imageCenterY,
      imageX,
      imageY
    } = position;
    ctx.save();
    ctx.beginPath();
    ctx.arc(imageCenterX, imageCenterY, stryMutAct_9fa48("364") ? imageWidth * 2 : (stryCov_9fa48("364"), imageWidth / 2), 0, stryMutAct_9fa48("365") ? Math.PI / 2 : (stryCov_9fa48("365"), Math.PI * 2), stryMutAct_9fa48("366") ? true : (stryCov_9fa48("366"), false));
    ctx.clip();
    ctx.drawImage(image, imageX, imageY, imageWidth, imageHeight);
    ctx.closePath();
    ctx.restore();
  }
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
function drawArcImageLabel(ctx: CanvasRenderingContext2D, arc: ArcElement, imageInfo: ImageLabelPluginOptions['imagesList'][number], verticalAlign: NonNullable<ImageLabelPluginOptions['verticalAlign']>, horizontalAlign: NonNullable<ImageLabelPluginOptions['horizontalAlign']>, offset: number | undefined): void {
  if (stryMutAct_9fa48("367")) {
    {}
  } else {
    stryCov_9fa48("367");
    const {
      imageUrl,
      imageWidth,
      imageHeight
    } = imageInfo;
    const position = computeImageLabelPosition(arc, imageWidth, imageHeight, verticalAlign, horizontalAlign, offset);
    loadImage(imageUrl, image => {
      if (stryMutAct_9fa48("368")) {
        {}
      } else {
        stryCov_9fa48("368");
        drawClippedImage(ctx, image, position, imageWidth, imageHeight);
      }
    });
  }
}

/**
 * Chart.js plugin that draws an image label on each arc of a doughnut or
 * pie chart's dataset(s), positioned and sized per `ImageLabelPluginOptions`.
 *
 * Supplied to Chart.js via its inline `plugins` array rather than a global
 * `Chart.register(...)` call.
 */
export const imageLabelPlugin: Plugin<ChartType, ImageLabelPluginOptions> = stryMutAct_9fa48("369") ? {} : (stryCov_9fa48("369"), {
  id: stryMutAct_9fa48("370") ? "" : (stryCov_9fa48("370"), 'imageLabel'),
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
    if (stryMutAct_9fa48("371")) {
      {}
    } else {
      stryCov_9fa48("371");
      const ctx = chart.ctx;
      const {
        verticalAlign = stryMutAct_9fa48("372") ? "" : (stryCov_9fa48("372"), 'middle'),
        horizontalAlign = stryMutAct_9fa48("373") ? "" : (stryCov_9fa48("373"), 'middle'),
        imagesList,
        offset
      } = options;
      chart.data.datasets.forEach((_dataset, datasetIndex) => {
        if (stryMutAct_9fa48("374")) {
          {}
        } else {
          stryCov_9fa48("374");
          const meta = chart.getDatasetMeta(datasetIndex);
          if (stryMutAct_9fa48("377") ? meta.type !== 'doughnut' || meta.type !== 'pie' : stryMutAct_9fa48("376") ? false : stryMutAct_9fa48("375") ? true : (stryCov_9fa48("375", "376", "377"), (stryMutAct_9fa48("379") ? meta.type === 'doughnut' : stryMutAct_9fa48("378") ? true : (stryCov_9fa48("378", "379"), meta.type !== (stryMutAct_9fa48("380") ? "" : (stryCov_9fa48("380"), 'doughnut')))) && (stryMutAct_9fa48("382") ? meta.type === 'pie' : stryMutAct_9fa48("381") ? true : (stryCov_9fa48("381", "382"), meta.type !== (stryMutAct_9fa48("383") ? "" : (stryCov_9fa48("383"), 'pie')))))) return;
          meta.data.forEach((element, index) => {
            if (stryMutAct_9fa48("384")) {
              {}
            } else {
              stryCov_9fa48("384");
              if (stryMutAct_9fa48("387") ? false : stryMutAct_9fa48("386") ? true : stryMutAct_9fa48("385") ? isArcElement(element) : (stryCov_9fa48("385", "386", "387"), !isArcElement(element))) return;
              const imageInfo = imagesList[index];
              if (stryMutAct_9fa48("390") ? false : stryMutAct_9fa48("389") ? true : stryMutAct_9fa48("388") ? imageInfo?.imageUrl : (stryCov_9fa48("388", "389", "390"), !(stryMutAct_9fa48("391") ? imageInfo.imageUrl : (stryCov_9fa48("391"), imageInfo?.imageUrl)))) return;
              drawArcImageLabel(ctx, element, imageInfo, verticalAlign, horizontalAlign, offset);
            }
          });
        }
      });
    }
  }
});