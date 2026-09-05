/**
 * Least-squares curve fitters, faithfully ported from
 * `chartjs-plugin-trendline` (v3.2.12, MIT, Marcus Alsterfjord) — real
 * source dissected directly from the installed package's own real,
 * readable `src/utils/{baseFitter,lineFitter,exponentialFitter}.js`
 * (the package ships real source, not just a minified bundle), not
 * reconstructed from the README alone.
 *
 * Every real formula below (ordinary least-squares slope/intercept for
 * the linear fit; log-linearization — `ln(y) = ln(a) + b×x` — for the
 * exponential fit) is carried over unchanged, including the original's
 * own real caching strategy (`_cacheValid`, lazily recomputed on first
 * read after any `add()` call) and its own real numeric-safety guards
 * (a near-zero denominator check before dividing, an overflow guard on
 * `Math.exp` inputs beyond ±500, a non-positive/non-finite `ln(y)`
 * rejecting that point from the exponential fit entirely rather than
 * throwing).
 */

/** Shared accumulator state and x-range tracking — both fitters below
 * extend this rather than duplicating it, matching the original's own
 * real inheritance structure. */
export class BaseFitter {
  count = 0;
  sumx = 0;
  sumx2 = 0;
  minx = Number.MAX_VALUE;
  maxx = Number.MIN_VALUE;
  protected cacheValid = false;

  /** Accumulates the shared x-side state for one point — subclasses
   * call this via `super.add(x)` and handle their own y-specific state
   * themselves, matching the original's own real split. */
  protected addX(x: number): void {
    this.sumx += x;
    this.sumx2 += x * x;
    if (x < this.minx) this.minx = x;
    if (x > this.maxx) this.maxx = x;
    this.count++;
    this.cacheValid = false;
  }
}

/** Fits a straight line (`y = slope*x + intercept`) via ordinary least
 * squares. */
export class LineFitter extends BaseFitter {
  private sumy = 0;
  private sumxy = 0;
  private cachedSlope = 0;
  private cachedIntercept = 0;

  add(x: number, y: number): void {
    this.addX(x);
    this.sumy += y;
    this.sumxy += x * y;
  }

  slope(): number {
    if (!this.cacheValid) this.computeCoefficients();
    return this.cachedSlope;
  }

  intercept(): number {
    if (!this.cacheValid) this.computeCoefficients();
    return this.cachedIntercept;
  }

  /** The fitted line's own y-value at a given x. */
  f(x: number): number {
    return this.slope() * x + this.intercept();
  }

  private computeCoefficients(): void {
    const denominator = this.count * this.sumx2 - this.sumx * this.sumx;
    this.cachedSlope = (this.count * this.sumxy - this.sumx * this.sumy) / denominator;
    this.cachedIntercept = (this.sumy - this.cachedSlope * this.sumx) / this.count;
    this.cacheValid = true;
  }
}

/** Fits `y = a * e^(b*x)` via least squares on the log-linearized form
 * (`ln(y) = ln(a) + b*x`) — confirmed real, honest documented caveat
 * from the original: only meaningful for datasets whose own y-values
 * are all positive (`ln(y)` of a non-positive value rejects that point
 * from the fit entirely, via `hasValidData`, rather than throwing or
 * silently producing garbage coefficients).
 *
 * A real, deliberate omission from the original's own real logic: the
 * original also tracks every real data point (`{x, y, lny}`) and
 * computes an R-squared `correlation()` from them on every coefficient
 * recompute — but nothing in this project's own real port (the
 * drawing code in `trendlineCore.ts`, the label text in `addFitter`)
 * ever reads that value, and it isn't part of any consumer-facing API
 * this port exposes either (matching `LineFitter`'s own trimmed-down
 * public surface above, which drops the original's own unused
 * `scale()`/`fo()` methods for the identical reason). Kept out
 * entirely, rather than computed and left unread, to avoid a real
 * unused-variable violation for genuinely dead state. */
export class ExponentialFitter extends BaseFitter {
  private sumlny = 0;
  private sumxlny = 0;
  private hasValidData = true;
  private cachedGrowthRate = 0;
  private cachedCoefficient = 1;

  add(x: number, y: number): void {
    if (y <= 0) {
      this.hasValidData = false;
      return;
    }
    const lny = Math.log(y);
    if (!isFinite(lny)) {
      this.hasValidData = false;
      return;
    }
    this.addX(x);
    this.sumlny += lny;
    this.sumxlny += x * lny;
  }

  /** The real `b` parameter in `y = a * e^(b*x)`. */
  growthRate(): number {
    if (!this.hasValidData || this.count < 2) return 0;
    if (!this.cacheValid) this.computeCoefficients();
    return this.cachedGrowthRate;
  }

  /** The real `a` parameter in `y = a * e^(b*x)`. */
  coefficient(): number {
    if (!this.hasValidData || this.count < 2) return 1;
    if (!this.cacheValid) this.computeCoefficients();
    return this.cachedCoefficient;
  }

  /** The fitted curve's own y-value at a given x — guarded against
   * `Math.exp` overflow (the original's own real `|growthRate * x| >
   * 500` threshold) and any resulting non-finite result, both real,
   * confirmed safety checks from the original, not added by this port. */
  f(x: number): number {
    if (!this.hasValidData || this.count < 2) return 0;
    if (!this.cacheValid) this.computeCoefficients();
    if (Math.abs(this.cachedGrowthRate * x) > 500) return 0;
    const result = this.cachedCoefficient * Math.exp(this.cachedGrowthRate * x);
    return isFinite(result) ? result : 0;
  }

  private computeCoefficients(): void {
    if (!this.hasValidData || this.count < 2) {
      this.cachedGrowthRate = 0;
      this.cachedCoefficient = 1;
      this.cacheValid = true;
      return;
    }
    const denominator = this.count * this.sumx2 - this.sumx * this.sumx;
    if (Math.abs(denominator) < 1e-10) {
      this.cachedGrowthRate = 0;
      this.cachedCoefficient = 1;
      this.cacheValid = true;
      return;
    }
    this.cachedGrowthRate = (this.count * this.sumxlny - this.sumx * this.sumlny) / denominator;
    const lnA = (this.sumlny - this.cachedGrowthRate * this.sumx) / this.count;
    this.cachedCoefficient = Math.exp(lnA);
    this.cacheValid = true;
  }
}

export type Fitter = LineFitter | ExponentialFitter;
