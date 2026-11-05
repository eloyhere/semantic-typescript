/**
 * Distribution value objects and the materialised distribution collectable for
 * synchronous numeric sources.
 *
 * The definitions follow `docs/research/distribution-analysis.md`: every
 * ambiguity that makes two statistics tools disagree on the same numbers is an
 * explicit option here rather than a hidden default.
 *
 * - Histograms are left-closed and right-open, and only the final bin is
 *   right-closed. A strictly half-open last bin would drop the maximum and
 *   break `sum(counts) = n`.
 * - Quantiles default to the Hyndman–Fan type 7 (R `quantile`, NumPy `linear`,
 *   Excel `PERCENTILE.INC`); the other eight types stay selectable.
 * - Skewness defaults to `G1` and kurtosis to the excess `G2`, the definitions
 *   used by Excel, pandas and SPSS; the biased `g1`/`g2` moment ratios remain
 *   available through the estimator options.
 * - Variance exposes its denominator through an explicit `ddof`.
 * - Data insufficiency (a constant sample, or fewer observations than an
 *   estimator needs) is reported as an empty `Optional`, never as zero.
 *
 * The numeric kernels live in `#semantic/synchronous/collectors` so that the
 * streaming collector factories and these value objects share one definition.
 * This module imports them at run time while the collectors module imports only
 * types back, which keeps the dependency one-way.
 *
 * @module
 */

import { isIterable, isNumber } from "#semantic/guard";
import {
    isKurtosisEstimator,
    isQuantileMethod,
    isSkewnessEstimator,
    isVarianceDdof,
    quantileOfSorted
} from "#semantic/mathematics/quantile";
import type {
    KurtosisEstimator,
    KurtosisOptions,
    QuantileMethod,
    QuantileOptions,
    SkewnessEstimator,
    SkewnessOptions,
    VarianceOptions
} from "#semantic/mathematics/quantile";
import { Optional } from "#semantic/optional";
import { OrderedCollectable } from "#semantic/synchronous/collectable";
import {
    DistributionAccumulator,
    entropyOfHistogram,
    evaluateDensityOf,
    fenceOf,
    interquartileRangeOf,
    kurtosisOfMoment,
    kurtosisStandardErrorOf,
    skewnessOfMoment,
    skewnessStandardErrorOf,
    trimmedMeanOf,
    useSynchronousDensity,
    useSynchronousEmpiricalDistribution,
    useSynchronousEntropy,
    useSynchronousHistogram,
    useSynchronousKurtosis,
    useSynchronousMedianAbsoluteDeviation,
    useSynchronousMoments,
    useSynchronousQuantile,
    useSynchronousRobust,
    useSynchronousSkewness
} from "#semantic/synchronous/collectors";
import type { BiConsumer, BiPredicate, Consumer, Predicate } from "#semantic/utility";

export type {
    KurtosisEstimator,
    KurtosisOptions,
    QuantileMethod,
    QuantileOptions,
    SkewnessEstimator,
    SkewnessOptions,
    VarianceOptions
};

/**
 * The supported histogram binning rules.
 *
 * The formulas use the sorted sample `x_(1) … x_(n)`, its range `R`, its sample
 * standard deviation `s` (denominator `n - 1`) and its interquartile range
 * `IQR` from the type-7 quantiles:
 *
 * - `"sturges"` — `k = ceil(log2 n) + 1`; assumes an approximately normal
 *   sample and under-bins heavy tails and small samples.
 * - `"scott"` — `h = 3.49 s n^(-1/3)`, then `k = ceil(R / h)`; a normal
 *   reference rule that a single outlier can defeat because `s` is not robust.
 * - `"freedman-diaconis"` — `h = 2 IQR n^(-1/3)`, then `k = ceil(R / h)`; robust
 *   width combined with a non-robust range, hence the default `maximumBins`.
 * - `"sqrt"` — `k = ceil(sqrt n)`; ignores dispersion.
 * - `"rice"` — `k = ceil(2 n^(1/3))`; ignores dispersion.
 * - `"doane"` — `k = 1 + log2 n + log2(1 + |g1| / sigma_g1)` with
 *   `sigma_g1 = sqrt(6 (n - 2) / ((n + 1)(n + 3)))`; a skewness correction of
 *   Sturges that falls back to Sturges when `g1` is undefined.
 * - `"terrell-scott"` — `k = ceil((2 n)^(1/3))`; an asymptotic lower bound
 *   ("oversmoothed") rather than a general-purpose choice.
 */
export type HistogramRule =
    | "sturges"
    | "scott"
    | "freedman-diaconis"
    | "sqrt"
    | "rice"
    | "doane"
    | "terrell-scott";

/**
 * A binning rule, or an explicit ascending edge array that takes full control.
 *
 * With explicit edges the last edge is the right boundary of the last bin. The
 * array is used as given, so heterogeneous widths are allowed; values outside
 * `[firstEdge, lastEdge]` are reported through `Histogram.getOmitted()` instead
 * of extending the bins.
 */
export type HistogramBinning = HistogramRule | ReadonlyArray<number>;

/**
 * Which end of each bin is closed.
 *
 * `"left"` (the default) means `[lower, upper)` for every bin except the last,
 * which is `[lower, upper]`. `"right"` means `(lower, upper]` for every bin
 * except the first, which is `[lower, upper]`. In both conventions the closed
 * end of the terminal bin is what keeps `sum(counts) = n`.
 */
export type HistogramClosure = "left" | "right";

/**
 * Options for histogram construction.
 */
export interface HistogramOptions {
    /** The binning rule or explicit edges; defaults to `"freedman-diaconis"`. */
    readonly binning?: HistogramBinning;
    /** The closed end of each bin; defaults to `"left"`. */
    readonly closed?: HistogramClosure;
    /**
     * The largest number of bins a rule may derive before the request fails;
     * defaults to `1000n`. The guard exists because Freedman–Diaconis keeps a
     * robust width while the bin count still divides the full range, so one
     * extreme outlier can otherwise produce tens of thousands of bins.
     */
    readonly maximumBins?: bigint;
}

/**
 * The supported kernel shapes.
 *
 * All kernels integrate to one; the compact kernels (`|u| <= 1`) are
 * Epanechnikov `(3/4)(1 - u^2)`, biweight `(15/16)(1 - u^2)^2`, triweight
 * `(35/32)(1 - u^2)^3`, uniform `1/2` and triangular `1 - |u|`; the Gaussian
 * kernel is `phi(u) = (2 pi)^(-1/2) exp(-u^2 / 2)`.
 */
export type KernelName =
    | "gaussian"
    | "epanechnikov"
    | "uniform"
    | "triangular"
    | "biweight"
    | "triweight";

/**
 * The closed-form bandwidth rules.
 *
 * - `"silverman"` — `h = 0.9 min(s, IQR / 1.34) n^(-1/5)`; R `bw.nrd0` and the
 *   historical R `density` default.
 * - `"scott"` — `h = 1.06 s n^(-1/5)`; the normal-reference AMISE optimum.
 *
 * `s` is the sample standard deviation with denominator `n - 1` and the IQR
 * uses the type-7 quantiles.
 */
export type BandwidthRule = "silverman" | "scott";

/**
 * How a kernel density estimate treats a bounded support.
 *
 * `"none"` (the default) is the plain estimator and is biased upward at a
 * boundary because probability mass leaks outside the support. `"reflection"`
 * mirrors every observation across the declared finite support bounds.
 * `"renormalize"` divides by the kernel mass that falls inside the declared
 * support. Both corrections require an explicit `support`; a silent correction
 * would change the meaning of the estimate without the caller noticing.
 */
export type BoundaryCorrection = "none" | "reflection" | "renormalize";

/**
 * Options for a kernel density estimate.
 */
export interface DensityOptions {
    /** The kernel shape; defaults to `"gaussian"`. */
    readonly kernel?: KernelName;
    /** A bandwidth rule or a positive bandwidth; defaults to `"silverman"`. */
    readonly bandwidth?: BandwidthRule | number;
    /** Multiplies the bandwidth; equivalent to R `density`'s `adjust`; defaults to `1`. */
    readonly adjust?: number;
    /** How far the grid extends past the data in bandwidths; defaults to `3`. */
    readonly cut?: number;
    /** The boundary correction; defaults to `"none"`. */
    readonly boundary?: BoundaryCorrection;
    /** The support bounds required by a non-`"none"` boundary correction. */
    readonly support?: readonly [number, number];
    /** The number of grid points; defaults to `512n` and must be at least two. */
    readonly gridSize?: bigint;
    /**
     * Explicit evaluation points that replace the automatic grid; the order is
     * preserved, and `DensityEstimate.integrate` sorts its own copy.
     */
    readonly points?: Iterable<number>;
}

/**
 * Options for the Shannon entropy of a histogram.
 */
export interface EntropyOptions {
    /** The logarithm base; defaults to `Math.E` (nats). */
    readonly base?: number;
    /**
     * Whether to report the differential entropy of the binned density instead
     * of the discrete entropy of the bin probabilities; defaults to `false`.
     * The differential form adds `sum(p_i log(width_i))`, which is what makes
     * `-sum(p_i log p_i) + log(width)` comparable with a continuous entropy.
     */
    readonly differential?: boolean;
}

/**
 * Options for the distribution entropy.
 *
 * When `histogram` is supplied it defines the binning and the collected values
 * are ignored; otherwise the remaining options build a histogram with the same
 * defaults as the distribution histogram method.
 */
export interface DistributionEntropyOptions extends EntropyOptions {
    /** A pre-built histogram that defines the binning. */
    readonly histogram?: Histogram;
    /** The binning rule or explicit edges used when no histogram is supplied. */
    readonly binning?: HistogramBinning;
    /** The closed end used when no histogram is supplied; defaults to `"left"`. */
    readonly closed?: HistogramClosure;
    /** The bin cap used when no histogram is supplied; defaults to `1000n`. */
    readonly maximumBins?: bigint;
}

/**
 * How a non-integer `trim * n` is resolved for a trimmed mean.
 *
 * `"truncate"` removes `floor(trim * n)` observations from each end, which is
 * what R's `mean(trim = )` does. `"interpolate"` linearly blends the two
 * neighbouring integer trimming levels, which is continuous in `trim`.
 */
export type TrimPolicy = "truncate" | "interpolate";

/**
 * Options for the robust summary and the trimmed mean.
 */
export interface RobustOptions {
    /** The trimmed fraction in `[0, 0.5)`; defaults to `0.1`. */
    readonly trim?: number;
    /** The rounding policy for `trim * n`; defaults to `"truncate"`. */
    readonly trimPolicy?: TrimPolicy;
    /** The Tukey fence multiplier; defaults to `1.5`, with `3` for far-out points. */
    readonly fence?: number;
}

/**
 * One histogram bin as plain data.
 */
export interface HistogramBinData {
    /** The closed or open lower boundary, depending on the closure convention. */
    readonly lower: number;
    /** The upper boundary; the last bin is the one that closes on the right. */
    readonly upper: number;
    /** The number of observations in the bin. */
    readonly count: bigint;
    /** The density `count / (n * width)` of the bin. */
    readonly density: number;
}

/**
 * The plain data behind a {@link Histogram}.
 */
export interface HistogramData {
    /** The rule that produced the edges, or `"manual"` for explicit edges. */
    readonly rule: HistogramRule | "manual";
    /** The closure convention used to assign values to bins. */
    readonly closed: HistogramClosure;
    /** The bins in ascending order. */
    readonly bins: ReadonlyArray<HistogramBinData>;
    /** The common width, or `null` when the edges are not equidistant. */
    readonly width: number | null;
    /** The number of observations that fell inside the edges. */
    readonly total: bigint;
    /** The number of observations that fell outside explicit edges. */
    readonly omitted: bigint;
    /** The number of observations the histogram was built from. */
    readonly sampleCount: bigint;
}

/**
 * The plain central-moment data behind a {@link MomentSummary}.
 *
 * `m2`, `m3` and `m4` are the biased central moments with denominator `n`; all
 * derived shape statistics are expressed in terms of them.
 */
export interface MomentData {
    /** The sample size. */
    readonly count: bigint;
    /** The arithmetic mean. */
    readonly mean: number;
    /** The second central moment `(1/n) sum (x - mean)^2`. */
    readonly m2: number;
    /** The third central moment. */
    readonly m3: number;
    /** The fourth central moment. */
    readonly m4: number;
}

/**
 * The plain data behind a {@link RobustSummary}.
 */
export interface RobustData {
    /** The ascending observations. */
    readonly values: ReadonlyArray<number>;
    /** The median, or `null` for an empty sample. */
    readonly median: number | null;
    /** The unscaled median absolute deviation, or `null` for an empty sample. */
    readonly medianAbsoluteDeviation: number | null;
    /** The trim fraction this summary was built with. */
    readonly trim: number;
    /** The trim rounding policy this summary was built with. */
    readonly trimPolicy: TrimPolicy;
    /** The fence multiplier this summary was built with. */
    readonly fence: number;
}

/**
 * The plain data behind a {@link DensityEstimate}.
 */
export interface DensityData {
    /** The kernel shape. */
    readonly kernel: KernelName;
    /** The bandwidth after `adjust` was applied. */
    readonly bandwidth: number;
    /** The boundary correction. */
    readonly boundary: BoundaryCorrection;
    /** The declared support for a boundary correction, or `null`. */
    readonly support: readonly [number, number] | null;
    /** The evaluation grid in the order the caller supplied or the rule built. */
    readonly points: ReadonlyArray<number>;
    /** The density at each grid point. */
    readonly densities: ReadonlyArray<number>;
    /** The ascending observations the estimate was built from. */
    readonly sample: ReadonlyArray<number>;
    /** The grid extent `[smallestPoint, largestPoint]`; `[0, 0]` for an empty grid. */
    readonly domain: readonly [number, number];
}

/**
 * The supported binning rules as a frozen runtime list for validation.
 */
const HISTOGRAM_RULES: ReadonlyArray<string> = Object.freeze([
    "sturges", "scott", "freedman-diaconis", "sqrt", "rice", "doane", "terrell-scott"
] as const);

/**
 * The supported trim policies as a frozen runtime list for validation.
 */
const TRIM_POLICIES: ReadonlyArray<string> = Object.freeze(["truncate", "interpolate"] as const);

/**
 * Reports whether a value is a finite number, raising a type error otherwise.
 *
 * @param value - The value to require.
 * @param message - The message used when the value is not finite.
 * @returns The same value, typed as a finite number.
 * @throws {TypeError} If the value is not a finite number.
 */
const requireFinite: (value: unknown, message: string) => number = (value: unknown, message: string): number => {
    if (!isNumber(value)) {
        throw new TypeError(message);
    }
    return value;
};

/**
 * Reports whether a value is a probability in the closed unit interval.
 *
 * @param probability - The value to require.
 * @returns The same value, typed as a number.
 * @throws {TypeError} If the value is not a finite number.
 * @throws {RangeError} If the value is outside `[0, 1]`.
 */
const requireProbability: (probability: number) => number = (probability: number): number => {
    requireFinite(probability, "Quantile probability must be a finite number.");
    if (probability < 0 || probability > 1) {
        throw new RangeError("Quantile probability must be within [0, 1].");
    }
    return probability;
};

/**
 * Returns the first index whose value is not less than the target.
 *
 * @param values - The ascending values to search.
 * @param target - The value to locate.
 * @returns The lower-bound index.
 */
const lowerBoundOf: (values: ReadonlyArray<number>, target: number) => number =
    (values: ReadonlyArray<number>, target: number): number => {
        let low: number = 0;
        let high: number = values.length;
        while (low < high) {
            let middle: number = (low + high) >>> 1;
            if (values[middle] < target) {
                low = middle + 1;
            }
            else {
                high = middle;
            }
        }
        return low;
    };

/**
 * Returns the first index whose value is greater than the target.
 *
 * @param values - The ascending values to search.
 * @param target - The value to locate.
 * @returns The upper-bound index.
 */
const upperBoundOf: (values: ReadonlyArray<number>, target: number) => number =
    (values: ReadonlyArray<number>, target: number): number => {
        let low: number = 0;
        let high: number = values.length;
        while (low < high) {
            let middle: number = (low + high) >>> 1;
            if (values[middle] <= target) {
                low = middle + 1;
            }
            else {
                high = middle;
            }
        }
        return low;
    };

/**
 * Wraps a nullable number in an optional so that "undefined" is never reported
 * as zero.
 *
 * @param value - The nullable value.
 * @returns A present optional for a finite number, otherwise an empty optional.
 */
const optionalOf: (value: number | null) => Optional<number> = (value: number | null): Optional<number> => {
    return value === null ? Optional.empty<number>() : Optional.of(value);
};

/**
 * One histogram bin.
 *
 * The bin knows the closure convention it belongs to and whether it is the
 * terminal bin of that convention, so `contains` agrees with the histogram that
 * produced it. Instances are frozen at construction.
 */
export class HistogramBin {
    /**
     * The lower boundary.
     */
    private readonly lower: number;
    /**
     * The upper boundary.
     */
    private readonly upper: number;
    /**
     * The number of observations in the bin.
     */
    private readonly count: bigint;
    /**
     * The density `count / (n * width)`.
     */
    private readonly density: number;
    /**
     * The closure convention of the owning histogram.
     */
    private readonly closed: HistogramClosure;
    /**
     * Whether this bin is the one whose closed end covers the data extreme.
     */
    private readonly terminal: boolean;
    /**
     * Creates a frozen bin.
     *
     * @param lower - The lower boundary; must be finite and below `upper`.
     * @param upper - The upper boundary; must be finite and above `lower`.
     * @param count - The observation count; must not be negative.
     * @param density - The density; must be finite and not negative.
     * @param closed - The closure convention; defaults to `"left"`.
     * @param terminal - Whether this is the terminal bin; defaults to `false`.
     * @throws {TypeError} If a boundary, count or density has the wrong type.
     * @throws {RangeError} If `lower >= upper`, the count is negative, or the
     *         density is negative.
     */
    public constructor(
        lower: number,
        upper: number,
        count: bigint,
        density: number,
        closed: HistogramClosure = "left",
        terminal: boolean = false
    ) {
        requireFinite(lower, "Histogram bin lower boundary must be a finite number.");
        requireFinite(upper, "Histogram bin upper boundary must be a finite number.");
        if (!(lower < upper)) {
            throw new RangeError("Histogram bin boundaries must be strictly increasing.");
        }
        if (typeof count !== "bigint" || count < 0n) {
            throw new RangeError("Histogram bin count must not be negative.");
        }
        if (!isNumber(density) || density < 0) {
            throw new RangeError("Histogram bin density must be a non-negative finite number.");
        }
        if (closed !== "left" && closed !== "right") {
            throw new TypeError("Histogram closure must be left or right.");
        }
        this.lower = lower;
        this.upper = upper;
        this.count = count;
        this.density = density;
        this.closed = closed;
        this.terminal = terminal === true;
        Object.freeze(this);
    }
    /**
     * Returns the lower boundary.
     *
     * @returns The lower boundary.
     */
    public getLower(): number {
        return this.lower;
    }
    /**
     * Returns the upper boundary.
     *
     * @returns The upper boundary.
     */
    public getUpper(): number {
        return this.upper;
    }
    /**
     * Returns the bin midpoint.
     *
     * @returns The midpoint `(lower + upper) / 2`.
     */
    public getMidpoint(): number {
        return (this.lower + this.upper) / 2;
    }
    /**
     * Returns the observation count.
     *
     * @returns The count as a bigint.
     */
    public getCount(): bigint {
        return this.count;
    }
    /**
     * Returns the density.
     *
     * @returns The density `count / (n * width)`.
     */
    public getDensity(): number {
        return this.density;
    }
    /**
     * Returns the closure convention.
     *
     * @returns The closure convention of the owning histogram.
     */
    public getClosure(): HistogramClosure {
        return this.closed;
    }
    /**
     * Reports whether this bin is the terminal bin of its histogram.
     *
     * @returns Whether the bin closes on the data extreme.
     */
    public isTerminal(): boolean {
        return this.terminal;
    }
    /**
     * Reports whether a value falls in this bin under the closure convention.
     *
     * Non-finite values are always rejected: they cannot be part of a finite
     * sample and silently returning false keeps the predicate total.
     *
     * @param value - The value to test.
     * @returns Whether the value belongs to this bin.
     */
    public contains(value: number): boolean {
        if (!isNumber(value)) {
            return false;
        }
        if (this.closed === "left") {
            return value >= this.lower && (value < this.upper || (this.terminal && value === this.upper));
        }
        return value <= this.upper && (value > this.lower || (this.terminal && value === this.lower));
    }
    /**
     * Compares every field with another bin.
     *
     * @param other - The bin to compare with.
     * @returns Whether the boundaries, count, density and closure fields match.
     */
    public equals(other: HistogramBin): boolean {
        return other instanceof HistogramBin
            && this.lower === other.lower
            && this.upper === other.upper
            && this.count === other.count
            && this.density === other.density
            && this.closed === other.closed
            && this.terminal === other.terminal;
    }
    /**
     * Renders the boundaries, count and density.
     *
     * @returns A description such as `HistogramBin([0.5, 0.7) n=12 rho=0.86)`.
     */
    public toString(): string {
        let opening: string = this.closed === "left" ? "[" : "(";
        let closing: string = this.closed === "left" ? ")" : "]";
        if (this.terminal) {
            opening = "[";
            closing = "]";
        }
        return `HistogramBin(${opening}${this.lower}, ${this.upper}${closing} n=${this.count.toString()} rho=${this.density})`;
    }
}

/**
 * An immutable histogram over a finite sample.
 *
 * Counts satisfy `sum(counts) + omitted = sampleCount`, and rule-derived
 * binning always leaves `omitted` at zero because the edges cover the full
 * range. Empty bins are preserved: dropping them would create artificial gaps
 * in the density and would make entropy depend on the sample in a hidden way.
 */
export class Histogram {
    /**
     * The plain data this histogram was built from.
     */
    private readonly data: HistogramData;
    /**
     * The materialised bins.
     */
    private readonly bins: ReadonlyArray<HistogramBin>;
    /**
     * The observation counts in bin order.
     */
    private readonly counts: ReadonlyArray<bigint>;
    /**
     * The densities in bin order.
     */
    private readonly densities: ReadonlyArray<number>;
    /**
     * Creates a frozen histogram and materialises its bins.
     *
     * @param data - The plain histogram data.
     * @throws {RangeError} If the bin total disagrees with the individual counts.
     */
    private constructor(data: HistogramData) {
        let bins: Array<HistogramBin> = data.bins.map((bin: HistogramBinData, index: number): HistogramBin => {
            let terminal: boolean = data.closed === "left" ? index === data.bins.length - 1 : index === 0;
            return new HistogramBin(bin.lower, bin.upper, bin.count, bin.density, data.closed, terminal);
        });
        let total: bigint = 0n;
        for (let bin of bins) {
            total += bin.getCount();
        }
        if (total !== data.total) {
            throw new RangeError("Histogram total must equal the sum of the bin counts.");
        }
        this.data = Object.freeze({
            rule: data.rule,
            closed: data.closed,
            bins: Object.freeze(data.bins.map((bin: HistogramBinData): HistogramBinData => Object.freeze(bin))),
            width: data.width,
            total: data.total,
            omitted: data.omitted,
            sampleCount: data.sampleCount
        });
        this.bins = Object.freeze(bins);
        this.counts = Object.freeze(bins.map((bin: HistogramBin): bigint => bin.getCount()));
        this.densities = Object.freeze(bins.map((bin: HistogramBin): number => bin.getDensity()));
        Object.freeze(this);
    }
    /**
     * Creates a histogram from plain data.
     *
     * The data is validated and copied; the resulting histogram keeps its own
     * frozen bin objects, so later mutation of the input cannot change it.
     *
     * @param data - The plain histogram data.
     * @returns A frozen histogram.
     * @throws {TypeError} If the rule or closure is not a supported name.
     * @throws {RangeError} If a bin is invalid or the total disagrees.
     */
    public static use(data: HistogramData): Histogram {
        if (data.rule !== "manual" && !HISTOGRAM_RULES.includes(data.rule)) {
            throw new TypeError("Histogram rule must be a supported rule or manual.");
        }
        if (data.closed !== "left" && data.closed !== "right") {
            throw new TypeError("Histogram closure must be left or right.");
        }
        if (!Array.isArray(data.bins)) {
            throw new TypeError("Histogram bins must be an array.");
        }
        return new Histogram(data);
    }
    /**
     * Returns the bins in ascending order.
     *
     * @returns The frozen bin array.
     */
    public getBins(): ReadonlyArray<HistogramBin> {
        return this.bins;
    }
    /**
     * Returns the observation counts in bin order.
     *
     * @returns The frozen bigint counts.
     */
    public getCounts(): ReadonlyArray<bigint> {
        return this.counts;
    }
    /**
     * Returns the densities in bin order.
     *
     * @returns The frozen densities.
     */
    public getDensities(): ReadonlyArray<number> {
        return this.densities;
    }
    /**
     * Returns the common bin width.
     *
     * @returns The width shared by every bin.
     * @throws {RangeError} If the bins do not share one width.
     */
    public getBinWidth(): number {
        if (this.data.width === null) {
            throw new RangeError("Histogram bins do not share a single width.");
        }
        return this.data.width;
    }
    /**
     * Returns the number of observations that fell inside the edges.
     *
     * @returns The total of the bin counts.
     */
    public getTotal(): bigint {
        return this.data.total;
    }
    /**
     * Returns the number of observations that fell outside explicit edges.
     *
     * Rule-derived edges always cover the range, so this is zero unless the
     * caller supplied edges of their own.
     *
     * @returns The omitted observation count.
     */
    public getOmitted(): bigint {
        return this.data.omitted;
    }
    /**
     * Returns the number of observations the histogram was built from.
     *
     * @returns The sample size as a bigint.
     */
    public getSampleCount(): bigint {
        return this.data.sampleCount;
    }
    /**
     * Returns the rule that produced the edges.
     *
     * @returns The rule name, or `"manual"` for explicit edges.
     */
    public getRule(): HistogramRule | "manual" {
        return this.data.rule;
    }
    /**
     * Returns the closure convention.
     *
     * @returns `"left"` or `"right"`.
     */
    public getClosure(): HistogramClosure {
        return this.data.closed;
    }
    /**
     * Returns the Shannon entropy of the binned distribution.
     *
     * The plug-in estimate `-sum p_i log p_i` is used; it is negatively biased
     * because empty bins and finite samples lose information, and the bias grows
     * with the bin count. Pass `differential` to add the width term and obtain
     * the binned differential entropy instead. The base is `Math.E`, so the
     * result is in nats unless another base is supplied.
     *
     * @param options - The logarithm base and whether to report the
     *        differential form.
     * @returns The entropy in the requested unit; zero for an empty sample.
     * @throws {RangeError} If the base is not positive and different from one.
     */
    public getEntropy(options: EntropyOptions = {}): number {
        return entropyOfHistogram(this.data, options);
    }
    /**
     * Renders the rule, bin count and covered observations.
     *
     * @returns A description such as `Histogram(freedman-diaconis, 14 bins, total=200)`.
     */
    public toString(): string {
        return `Histogram(${this.data.rule}, ${this.bins.length} bins, total=${this.data.total.toString()})`;
    }
}

/**
 * The empirical distribution function of a finite sample.
 *
 * `evaluate` is the right-continuous step `F_n(t) = #{x_i <= t} / n`, while
 * `leftLimit` is `F_n(t^-) = #{x_i < t} / n`. Both are needed: the
 * Kolmogorov–Smirnov statistic is
 * `max_i max(i / n - F_n(x_(i)), F_n(x_(i)) - (i - 1) / n)`, and an
 * implementation that only has `evaluate` silently understates it by the jump
 * height at every tie.
 */
export class EmpiricalDistribution {
    /**
     * The ascending order statistics.
     */
    private readonly orderStatistics: ReadonlyArray<number>;
    /**
     * The step height `1 / n`, or zero for an empty sample.
     */
    private readonly step: number;
    /**
     * Copies and freezes ascending order statistics.
     *
     * @param orderStatistics - The ascending finite observations.
     * @throws {TypeError} If a value is not a finite number.
     * @throws {RangeError} If the sequence is not ascending.
     */
    public constructor(orderStatistics: Iterable<number>) {
        let ordered: Array<number> = [];
        for (let value of orderStatistics) {
            if (!isNumber(value)) {
                throw new TypeError("Empirical distribution value must be a finite number.");
            }
            if (ordered.length > 0 && value < ordered[ordered.length - 1]) {
                throw new RangeError("Order statistics must be ascending.");
            }
            ordered.push(value);
        }
        this.orderStatistics = Object.freeze(ordered);
        this.step = ordered.length === 0 ? 0 : 1 / ordered.length;
        Object.freeze(this);
    }
    /**
     * Returns the order statistics.
     *
     * @returns The frozen ascending observations.
     */
    public getOrderStatistics(): ReadonlyArray<number> {
        return this.orderStatistics;
    }
    /**
     * Returns the step height of the staircase.
     *
     * @returns `1 / n`, or zero for an empty sample.
     */
    public getStep(): number {
        return this.step;
    }
    /**
     * Returns the sample size.
     *
     * @returns The number of observations as a bigint.
     */
    public getCount(): bigint {
        return BigInt(this.orderStatistics.length);
    }
    /**
     * Evaluates the right-continuous empirical distribution function.
     *
     * At an observation `x_(k)` this includes the jump, so the value is
     * `#{x_i <= t} / n`. Complexity: O(log n) with a binary search.
     *
     * @param value - The point at which to evaluate `F_n`.
     * @returns The proportion of observations not greater than the point.
     * @throws {TypeError} If the point is not a finite number.
     */
    public evaluate(value: number): number {
        if (!isNumber(value)) {
            throw new TypeError("Empirical distribution evaluation point must be a finite number.");
        }
        if (this.orderStatistics.length === 0) {
            return 0;
        }
        return upperBoundOf(this.orderStatistics, value) / this.orderStatistics.length;
    }
    /**
     * Evaluates the left limit of the empirical distribution function.
     *
     * This is `#{x_i < t} / n`, the value approached from below; it differs from
     * `evaluate` by the jump height at every observation. Complexity: O(log n).
     *
     * @param value - The point at which to evaluate `F_n(t^-)`.
     * @returns The proportion of observations strictly below the point.
     * @throws {TypeError} If the point is not a finite number.
     */
    public leftLimit(value: number): number {
        if (!isNumber(value)) {
            throw new TypeError("Empirical distribution evaluation point must be a finite number.");
        }
        if (this.orderStatistics.length === 0) {
            return 0;
        }
        return lowerBoundOf(this.orderStatistics, value) / this.orderStatistics.length;
    }
    /**
     * Returns the empirical quantile for a probability.
     *
     * The same Hyndman–Fan types as the distribution quantile are available, so
     * the ECDF and the quantile cannot disagree about the interpolation
     * convention when the same type is chosen.
     *
     * @param probability - The probability in `[0, 1]`.
     * @param options - The interpolation type; defaults to `"type-7"`.
     * @returns The quantile, or an empty optional for an empty sample.
     * @throws {RangeError} If the probability is outside `[0, 1]`.
     */
    public quantile(probability: number, options: QuantileOptions = {}): Optional<number> {
        requireProbability(probability);
        let method: QuantileMethod = options.method ?? "type-7";
        if (!isQuantileMethod(method)) {
            throw new TypeError("Invalid quantile method.");
        }
        if (this.orderStatistics.length === 0) {
            return Optional.empty<number>();
        }
        return Optional.of(quantileOfSorted(this.orderStatistics, probability, method));
    }
    /**
     * Returns the smallest observation.
     *
     * @returns The minimum, or an empty optional for an empty sample.
     */
    public getMinimum(): Optional<number> {
        return this.orderStatistics.length === 0
            ? Optional.empty<number>()
            : Optional.of(this.orderStatistics[0]);
    }
    /**
     * Returns the largest observation.
     *
     * @returns The maximum, or an empty optional for an empty sample.
     */
    public getMaximum(): Optional<number> {
        return this.orderStatistics.length === 0
            ? Optional.empty<number>()
            : Optional.of(this.orderStatistics[this.orderStatistics.length - 1]);
    }
    /**
     * Returns a copy of the order statistics.
     *
     * @returns A mutable copy that cannot affect this distribution.
     */
    public toArray(): ReadonlyArray<number> {
        return this.orderStatistics.slice();
    }
    /**
     * Renders the sample size and the step height.
     *
     * @returns A description such as `EmpiricalDistribution(n=4, step=0.25)`.
     */
    public toString(): string {
        return `EmpiricalDistribution(n=${this.orderStatistics.length}, step=${this.step})`;
    }
}

/**
 * An immutable summary of the central moments and the shape statistics derived
 * from them.
 *
 * The summary stores `m2`, `m3` and `m4` with denominator `n`, so every
 * estimator is a closed-form function of one shared computation instead of a
 * second pass with a different denominator.
 */
export class MomentSummary {
    /**
     * The central-moment data.
     */
    private readonly data: MomentData;
    /**
     * Freezes validated central-moment data.
     *
     * @param data - The plain moment data.
     */
    private constructor(data: MomentData) {
        this.data = Object.freeze({
            count: data.count,
            mean: data.mean,
            m2: data.m2,
            m3: data.m3,
            m4: data.m4
        });
        Object.freeze(this);
    }
    /**
     * Creates a moment summary from plain data.
     *
     * @param data - The plain moment data.
     * @returns A frozen summary.
     * @throws {TypeError} If a field has the wrong type.
     * @throws {RangeError} If the count or a central moment is negative.
     */
    public static use(data: MomentData): MomentSummary {
        if (typeof data.count !== "bigint" || data.count < 0n) {
            throw new RangeError("Moment count must be a non-negative bigint.");
        }
        requireFinite(data.mean, "Moment mean must be a finite number.");
        if (!isNumber(data.m2) || data.m2 < 0) {
            throw new RangeError("Second central moment must be a non-negative finite number.");
        }
        requireFinite(data.m3, "Third central moment must be a finite number.");
        requireFinite(data.m4, "Fourth central moment must be a finite number.");
        return new MomentSummary(data);
    }
    /**
     * Returns the sample size.
     *
     * @returns The count as a bigint.
     */
    public getCount(): bigint {
        return this.data.count;
    }
    /**
     * Returns the arithmetic mean.
     *
     * @returns The mean, or zero for an empty sample.
     */
    public getMean(): number {
        return this.data.mean;
    }
    /**
     * Returns the variance under an explicit denominator.
     *
     * `ddof = 0` is the population variance `m2`; `ddof = 1` is the unbiased
     * sample variance `m2 n / (n - 1)`. The two differ by `n / (n - 1)` — 25%
     * for five observations — so the choice is never implicit.
     *
     * @param ddof - The degrees of freedom; defaults to `1`.
     * @returns The variance, or zero when `n <= ddof`.
     * @throws {TypeError} If `ddof` is not zero or one.
     */
    public getVariance(ddof: 0 | 1 = 1): number {
        if (!isVarianceDdof(ddof)) {
            throw new TypeError("Variance ddof must be zero or one.");
        }
        if (ddof === 0) {
            return this.data.m2;
        }
        let count: number = Number(this.data.count);
        return count < 2 ? 0 : this.data.m2 * count / (count - 1);
    }
    /**
     * Returns the standard deviation under an explicit denominator.
     *
     * The square root of an unbiased variance is still biased, by Jensen's
     * inequality; the value is documented as the root of the variance, not as an
     * unbiased standard deviation.
     *
     * @param ddof - The degrees of freedom; defaults to `1`.
     * @returns The square root of the variance, or zero when undefined.
     * @throws {TypeError} If `ddof` is not zero or one.
     */
    public getStandardDeviation(ddof: 0 | 1 = 1): number {
        return Math.sqrt(this.getVariance(ddof));
    }
    /**
     * Returns the sample skewness.
     *
     * `"g1"` is the biased moment ratio `m3 / m2^(3/2)` and `"G1"` applies the
     * `sqrt(n (n - 1)) / (n - 2)` correction that is unbiased for a normal
     * sample — the Excel `SKEW`, pandas and SPSS definition. A constant sample
     * and a sample smaller than the estimator needs report an empty optional.
     *
     * @param estimator - The estimator; defaults to `"G1"`.
     * @returns The skewness, or an empty optional when undefined.
     * @throws {TypeError} If the estimator is not a supported name.
     */
    public getSkewness(estimator: SkewnessEstimator = "G1"): Optional<number> {
        if (!isSkewnessEstimator(estimator)) {
            throw new TypeError("Invalid skewness estimator.");
        }
        return skewnessOfMoment(this.data, estimator);
    }
    /**
     * Returns the sample kurtosis.
     *
     * `"g2"` is the biased excess moment ratio `m4 / m2^2 - 3` and `"G2"` is the
     * bias-corrected excess estimator used by Excel `KURT` and pandas. `G2`
     * needs at least four observations and both estimators need a positive
     * variance.
     *
     * @param estimator - The estimator; defaults to `"G2"`.
     * @param excess - Whether to subtract three; defaults to `true`.
     * @returns The kurtosis, or an empty optional when undefined.
     * @throws {TypeError} If the estimator is not a supported name.
     */
    public getKurtosis(estimator: KurtosisEstimator = "G2", excess: boolean = true): Optional<number> {
        if (!isKurtosisEstimator(estimator)) {
            throw new TypeError("Invalid kurtosis estimator.");
        }
        return kurtosisOfMoment(this.data, estimator, excess !== false);
    }
    /**
     * Returns the normal-reference standard error of the skewness.
     *
     * `SE(g1) = sqrt(6 n (n - 1) / ((n - 2)(n + 1)(n + 3)))`, the large-sample
     * standard deviation of `g1` under normality.
     *
     * @returns The standard error, or an empty optional below three observations.
     */
    public getSkewnessStandardError(): Optional<number> {
        return skewnessStandardErrorOf(this.data);
    }
    /**
     * Returns the normal-reference standard error of the kurtosis.
     *
     * `SE(g2) = sqrt(24 n (n - 1)^2 / ((n - 3)(n - 2)(n + 3)(n + 5)))`.
     *
     * @returns The standard error, or an empty optional below four observations.
     */
    public getKurtosisStandardError(): Optional<number> {
        return kurtosisStandardErrorOf(this.data);
    }
    /**
     * Renders the sample size and mean.
     *
     * @returns A description such as `MomentSummary(n=20, mean=51.95)`.
     */
    public toString(): string {
        return `MomentSummary(n=${this.data.count.toString()}, mean=${this.data.mean})`;
    }
}

/**
 * An immutable robust-statistics summary.
 *
 * Every value is derived from the ascending observations and the resolved
 * options stored in the summary, so asking for a different quantile type or a
 * different trim fraction does not silently reuse the previous one.
 */
export class RobustSummary {
    /**
     * The robust data.
     */
    private readonly data: RobustData;
    /**
     * Freezes validated robust data.
     *
     * @param data - The plain robust data.
     */
    private constructor(data: RobustData) {
        this.data = Object.freeze({
            values: data.values,
            median: data.median,
            medianAbsoluteDeviation: data.medianAbsoluteDeviation,
            trim: data.trim,
            trimPolicy: data.trimPolicy,
            fence: data.fence
        });
        Object.freeze(this);
    }
    /**
     * Creates a robust summary from plain data.
     *
     * @param data - The plain robust data.
     * @returns A frozen summary.
     * @throws {RangeError} If the trim fraction is outside `[0, 0.5)` or the
     *         fence multiplier is not positive.
     * @throws {TypeError} If the trim policy is not a supported name.
     */
    public static use(data: RobustData): RobustSummary {
        if (!isNumber(data.trim) || data.trim < 0 || data.trim >= 0.5) {
            throw new RangeError("Trim ratio must be within [0, 0.5).");
        }
        if (!isNumber(data.fence) || data.fence <= 0) {
            throw new RangeError("Fence multiplier must be positive.");
        }
        if (!TRIM_POLICIES.includes(data.trimPolicy)) {
            throw new TypeError("Trim policy must be truncate or interpolate.");
        }
        return new RobustSummary(data);
    }
    /**
     * Returns the sample size.
     *
     * @returns The number of observations as a bigint.
     */
    public getCount(): bigint {
        return BigInt(this.data.values.length);
    }
    /**
     * Returns the median.
     *
     * @returns The median, or an empty optional for an empty sample.
     */
    public getMedian(): Optional<number> {
        return optionalOf(this.data.median);
    }
    /**
     * Returns the median absolute deviation.
     *
     * The default constant is `1.4826 = 1 / Phi^-1(3/4)`, which makes the value
     * comparable with a standard deviation under normality. It is an asymptotic
     * constant: for nine observations `1.4826 MAD = 2.965` while the sample
     * standard deviation is `2.739`, and the difference is not an error.
     *
     * @param constant - The consistency constant; defaults to `1.4826`.
     * @returns The scaled deviation, or an empty optional for an empty sample.
     * @throws {RangeError} If the constant is not positive and finite.
     */
    public getMedianAbsoluteDeviation(constant: number = 1.4826): Optional<number> {
        if (!isNumber(constant) || constant <= 0) {
            throw new RangeError("Median absolute deviation constant must be positive.");
        }
        if (this.data.medianAbsoluteDeviation === null) {
            return Optional.empty<number>();
        }
        return Optional.of(this.data.medianAbsoluteDeviation * constant);
    }
    /**
     * Returns the interquartile range under an explicit quantile type.
     *
     * @param options - The quantile type; defaults to `"type-7"`.
     * @returns The range, or an empty optional for an empty sample.
     * @throws {TypeError} If the quantile method is not a supported name.
     */
    public getInterquartileRange(options: QuantileOptions = {}): Optional<number> {
        let method: QuantileMethod = options.method ?? "type-7";
        if (!isQuantileMethod(method)) {
            throw new TypeError("Invalid quantile method.");
        }
        return optionalOf(interquartileRangeOf(this.data.values, method));
    }
    /**
     * Returns the trimmed mean.
     *
     * Options override the values this summary was built with, so a single
     * summary can answer several trimming questions without re-collecting the
     * sample.
     *
     * @param options - The trim fraction and rounding policy.
     * @returns The trimmed mean, or an empty optional for an empty sample.
     * @throws {RangeError} If the trim fraction is outside `[0, 0.5)`.
     */
    public getTrimmedMean(options: RobustOptions = {}): Optional<number> {
        let trim: number = options.trim ?? this.data.trim;
        let policy: TrimPolicy = options.trimPolicy ?? this.data.trimPolicy;
        if (!isNumber(trim) || trim < 0 || trim >= 0.5) {
            throw new RangeError("Trim ratio must be within [0, 0.5).");
        }
        if (!TRIM_POLICIES.includes(policy)) {
            throw new TypeError("Trim policy must be truncate or interpolate.");
        }
        return optionalOf(trimmedMeanOf(this.data.values, trim, policy));
    }
    /**
     * Returns the lower Tukey fence `Q1 - fence IQR`.
     *
     * @param factor - The fence multiplier; defaults to the value this summary
     *        was built with.
     * @returns The lower fence, or an empty optional for an empty sample.
     * @throws {RangeError} If the multiplier is not positive and finite.
     */
    public getLowerFence(factor: number = this.data.fence): Optional<number> {
        if (!isNumber(factor) || factor <= 0) {
            throw new RangeError("Fence multiplier must be positive.");
        }
        return optionalOf(fenceOf(this.data.values, factor, true));
    }
    /**
     * Returns the upper Tukey fence `Q3 + fence IQR`.
     *
     * @param factor - The fence multiplier; defaults to the value this summary
     *        was built with.
     * @returns The upper fence, or an empty optional for an empty sample.
     * @throws {RangeError} If the multiplier is not positive and finite.
     */
    public getUpperFence(factor: number = this.data.fence): Optional<number> {
        if (!isNumber(factor) || factor <= 0) {
            throw new RangeError("Fence multiplier must be positive.");
        }
        return optionalOf(fenceOf(this.data.values, factor, false));
    }
    /**
     * Returns the observations outside the Tukey fences.
     *
     * The fences are `Q1 - factor IQR` and `Q3 + factor IQR` with the type-7
     * quartiles. The default factor of `1.5` marks the usual box-plot outliers;
     * `3` selects the far-out observations. The returned array lists the values
     * themselves, in ascending order, because the materialised distribution does
     * not retain the original insertion order.
     *
     * @param factor - The fence multiplier; defaults to the value this summary
     *        was built with.
     * @returns The outlier values in ascending order.
     * @throws {RangeError} If the multiplier is not positive and finite.
     */
    public getOutliers(factor: number = this.data.fence): ReadonlyArray<number> {
        if (!isNumber(factor) || factor <= 0) {
            throw new RangeError("Fence multiplier must be positive.");
        }
        if (this.data.values.length === 0) {
            return [];
        }
        let lower: number = fenceOf(this.data.values, factor, true) as number;
        let upper: number = fenceOf(this.data.values, factor, false) as number;
        return this.data.values.filter((value: number): boolean => value < lower || value > upper);
    }
    /**
     * Returns the number of observations outside the Tukey fences.
     *
     * @param factor - The fence multiplier; defaults to the value this summary
     *        was built with.
     * @returns The outlier count.
     * @throws {RangeError} If the multiplier is not positive and finite.
     */
    public getOutlierCount(factor: number = this.data.fence): bigint {
        return BigInt(this.getOutliers(factor).length);
    }
    /**
     * Renders the count, median and raw deviation.
     *
     * @returns A description such as `RobustSummary(n=9, median=5, mad=2)`.
     */
    public toString(): string {
        return `RobustSummary(n=${this.data.values.length}, median=${this.data.median}, mad=${this.data.medianAbsoluteDeviation})`;
    }
}

/**
 * An immutable kernel density estimate.
 *
 * The object keeps both the evaluation grid and the ascending observations, so
 * `evaluate` is exact rather than interpolated from the grid. The bandwidth,
 * kernel, boundary correction and support are retained as metadata so the
 * estimate can be reproduced and compared.
 */
export class DensityEstimate {
    /**
     * The plain density data.
     */
    private readonly data: DensityData;
    /**
     * Freezes validated density data.
     *
     * @param data - The plain density data.
     */
    private constructor(data: DensityData) {
        this.data = Object.freeze({
            kernel: data.kernel,
            bandwidth: data.bandwidth,
            boundary: data.boundary,
            support: data.support,
            points: data.points,
            densities: data.densities,
            sample: data.sample,
            domain: data.domain
        });
        Object.freeze(this);
    }
    /**
     * Creates a density estimate from plain data.
     *
     * @param data - The plain density data.
     * @returns A frozen estimate.
     * @throws {RangeError} If the bandwidth is not positive.
     */
    public static use(data: DensityData): DensityEstimate {
        if (!isNumber(data.bandwidth) || data.bandwidth <= 0) {
            throw new RangeError("Bandwidth must be positive.");
        }
        return new DensityEstimate(data);
    }
    /**
     * Returns the kernel shape.
     *
     * @returns The kernel name.
     */
    public getKernel(): KernelName {
        return this.data.kernel;
    }
    /**
     * Returns the bandwidth after adjustment.
     *
     * @returns The effective bandwidth.
     */
    public getBandwidth(): number {
        return this.data.bandwidth;
    }
    /**
     * Returns the boundary correction.
     *
     * @returns The boundary correction name.
     */
    public getBoundary(): BoundaryCorrection {
        return this.data.boundary;
    }
    /**
     * Returns the declared support when a boundary correction was requested.
     *
     * @returns The support bounds, or an empty optional.
     */
    public getBoundarySupport(): Optional<readonly [number, number]> {
        return this.data.support === null ? Optional.empty<readonly [number, number]>() : Optional.of(this.data.support);
    }
    /**
     * Returns the evaluation grid.
     *
     * @returns The frozen grid points.
     */
    public getPoints(): ReadonlyArray<number> {
        return this.data.points;
    }
    /**
     * Returns the density at each grid point.
     *
     * @returns The frozen densities.
     */
    public getDensities(): ReadonlyArray<number> {
        return this.data.densities;
    }
    /**
     * Returns the grid extent.
     *
     * @returns The smallest and largest grid point; `[0, 0]` for an empty grid.
     */
    public getSupport(): readonly [number, number] {
        return this.data.domain;
    }
    /**
     * Evaluates the kernel density estimate at an arbitrary point.
     *
     * Complexity: O(n) per point, because the estimate is evaluated exactly
     * rather than interpolated from the grid.
     *
     * @param value - The point at which to evaluate the density.
     * @returns The estimated density.
     * @throws {TypeError} If the point is not a finite number.
     */
    public evaluate(value: number): number {
        if (!isNumber(value)) {
            throw new TypeError("Density evaluation point must be a finite number.");
        }
        return evaluateDensityOf(
            this.data.sample,
            this.data.bandwidth,
            this.data.kernel,
            this.data.boundary,
            this.data.support,
            value
        );
    }
    /**
     * Evaluates the density at several points.
     *
     * @param values - The points at which to evaluate the density.
     * @returns The densities in input order.
     * @throws {TypeError} If a point is not a finite number.
     */
    public evaluateAll(values: Iterable<number>): ReadonlyArray<number> {
        let result: Array<number> = [];
        for (let value of values) {
            result.push(this.evaluate(value));
        }
        return result;
    }
    /**
     * Integrates the estimate with the trapezoid rule.
     *
     * The interval boundaries are evaluated exactly, and every grid point inside
     * the interval contributes. Segments longer than the grid resolution are
     * subdivided first, because a single trapezoid spanning a wide empty tail
     * would overestimate the integral badly.
     *
     * @param lower - The lower integration bound, finite.
     * @param upper - The upper integration bound, finite.
     * @returns The integral of the estimated density over the interval.
     * @throws {TypeError} If a bound is not a finite number.
     * @throws {RangeError} If `lower` exceeds `upper`.
     */
    public integrate(lower: number, upper: number): number {
        requireFinite(lower, "Density integration bound must be a finite number.");
        requireFinite(upper, "Density integration bound must be a finite number.");
        if (lower > upper) {
            throw new RangeError("Density integration bounds must be ascending.");
        }
        if (lower === upper) {
            return 0;
        }
        let points: Array<number> = [lower];
        for (let point of this.data.points) {
            if (point > lower && point < upper) {
                points.push(point);
            }
        }
        points.push(upper);
        points.sort((left: number, right: number): number => left - right);
        let resolution: number = this.data.points.length > 1 && this.data.domain[1] > this.data.domain[0]
            ? (this.data.domain[1] - this.data.domain[0]) / (this.data.points.length - 1)
            : (upper - lower);
        if (!(resolution > 0)) {
            resolution = upper - lower;
        }
        let refined: Array<number> = [points[0]];
        for (let index: number = 1; index < points.length; index++) {
            let gap: number = points[index] - points[index - 1];
            let steps: number = Math.min(4096, Math.max(1, Math.ceil(gap / resolution)));
            for (let step: number = 1; step <= steps; step++) {
                refined.push(points[index - 1] + gap * step / steps);
            }
        }
        let integral: number = 0;
        let previous: number = this.evaluate(refined[0]);
        for (let index: number = 1; index < refined.length; index++) {
            let current: number = this.evaluate(refined[index]);
            integral += (refined[index] - refined[index - 1]) * (previous + current) / 2;
            previous = current;
        }
        return integral;
    }
    /**
     * Renders the kernel, bandwidth and grid size.
     *
     * @returns A description such as `DensityEstimate(gaussian, h=0.54, 512 points)`.
     */
    public toString(): string {
        return `DensityEstimate(${this.data.kernel}, h=${this.data.bandwidth}, ${this.data.points.length} points)`;
    }
}

/**
 * A materialised distribution view over a finite numeric sample.
 *
 * The constructor drains and sorts the input once and keeps the ascending order
 * statistics, so repeated quantile, histogram, ECDF and density queries do not
 * re-consume the source. `quantile` is therefore O(1) after construction and the
 * ECDF queries are O(log n); only methods that document otherwise cost a pass.
 *
 * The class extends {@link OrderedCollectable}, so every inherited terminal
 * operation traverses the same ascending buffer and reports the sorted position
 * as the bigint index. The instance is frozen.
 *
 * Each capability delegates to its own collector factory in
 * `#semantic/synchronous/collectors`; the materialised path applies the
 * factory's finisher to the already-accumulated sample, while the streaming path
 * feeds the same accumulator from a source. This keeps one definition for both
 * paths and makes the factory list a one-to-one map of the capabilities.
 *
 * @template E - The numeric source element type.
 */
export class DistributionCollectable<E extends number> extends OrderedCollectable<E> {
    /**
     * The ascending sample shared with the collector finishers.
     */
    private readonly sample: DistributionAccumulator;
    /**
     * The built-in object tag identifying this API implementation.
     */
    [Symbol.toStringTag]: string = "DistributionCollectable";
    /**
     * Validates, drains and sorts the input.
     *
     * Non-finite values are rejected before any buffer is built; an empty input
     * is legal and every scalar query then reports an empty optional. The
     * comparison is numeric ascending, so the inherited buffer and the sample
     * kept here agree element by element.
     *
     * Complexity: O(n log n) time for the sort and O(n) memory for the ascending
     * sample plus the inherited indexed buffer.
     *
     * @param values - The finite numeric observations.
     * @throws {TypeError} If an element is not a finite number.
     */
    public constructor(values: Iterable<E>) {
        let sample: DistributionAccumulator = new DistributionAccumulator();
        for (let value of values) {
            sample.accept(value);
        }
        let ascending: ReadonlyArray<number> = sample.ascendingValues();
        super((accept: Consumer<E> | BiConsumer<E, bigint>, interrupt: Predicate<E> | BiPredicate<E, bigint>): void => {
            for (let index: number = 0; index < ascending.length; index++) {
                let element: E = ascending[index] as E;
                if (interrupt(element, BigInt(index))) {
                    break;
                }
                accept(element, BigInt(index));
            }
        }, (left: E, right: E): number => (left as number) - (right as number));
        this.sample = sample;
        Object.freeze(this);
    }
    /**
     * Returns the sample size.
     *
     * @returns The number of buffered observations as a bigint.
     */
    public getCount(): bigint {
        return this.count();
    }
    /**
     * Returns the smallest observation.
     *
     * @returns The minimum, or an empty optional for an empty sample.
     */
    public getMinimum(): Optional<E> {
        let ascending: ReadonlyArray<number> = this.sample.ascendingValues();
        return ascending.length === 0 ? Optional.empty<E>() : Optional.of(ascending[0] as E);
    }
    /**
     * Returns the largest observation.
     *
     * @returns The maximum, or an empty optional for an empty sample.
     */
    public getMaximum(): Optional<E> {
        let ascending: ReadonlyArray<number> = this.sample.ascendingValues();
        return ascending.length === 0 ? Optional.empty<E>() : Optional.of(ascending[ascending.length - 1] as E);
    }
    /**
     * Builds a histogram.
     *
     * Defaults to the Freedman–Diaconis rule (`h = 2 IQR n^(-1/3)`), left-closed
     * bins and a `1000n` bin cap. The last bin is right-closed so the counts sum
     * to the sample size. Explicit edges take full control and values outside
     * them are reported by `Histogram.getOmitted()`.
     *
     * Complexity: O(n + k) after the ascending sample is available.
     *
     * @param options - The binning rule, closure and bin cap.
     * @returns The immutable histogram.
     * @throws {RangeError} If explicit edges are not strictly increasing or a
     *         derived bin count exceeds the cap.
     * @throws {TypeError} If an edge is not a finite number.
     */
    public histogram(options: HistogramOptions = {}): Histogram {
        return Histogram.use(useSynchronousHistogram(options).getFinisher()(this.sample));
    }
    /**
     * Selects a quantile.
     *
     * Defaults to the Hyndman–Fan type 7; types 1–3 are step functions and 4–9
     * interpolate linearly. The probability is validated rather than clipped.
     *
     * Complexity: O(1) after construction, because the order statistics are
     * indexed directly.
     *
     * @param probability - The probability in `[0, 1]`.
     * @param options - The interpolation type.
     * @returns The quantile, or an empty optional for an empty sample.
     * @throws {RangeError} If the probability is outside `[0, 1]`.
     * @throws {TypeError} If the probability or method has the wrong type.
     */
    public quantile(probability: number, options: QuantileOptions = {}): Optional<number> {
        return useSynchronousQuantile(probability, options).getFinisher()(this.sample);
    }
    /**
     * Builds the empirical distribution function.
     *
     * The returned staircase is right-continuous with step `1/n` and also
     * exposes `leftLimit`, which is required to compute a Kolmogorov–Smirnov
     * statistic without understating it.
     *
     * Complexity: O(n) to copy and freeze the order statistics.
     *
     * @returns The empirical distribution.
     */
    public empiricalDistribution(): EmpiricalDistribution {
        return new EmpiricalDistribution(useSynchronousEmpiricalDistribution().getFinisher()(this.sample));
    }
    /**
     * Returns the median absolute deviation.
     *
     * @param constant - The consistency constant; defaults to `1.4826`.
     * @returns The scaled deviation, or an empty optional for an empty sample.
     * @throws {RangeError} If the constant is not positive and finite.
     */
    public medianAbsoluteDeviation(constant: number = 1.4826): Optional<number> {
        return useSynchronousMedianAbsoluteDeviation(constant).getFinisher()(this.sample);
    }
    /**
     * Builds the robust-statistics summary.
     *
     * @param options - The trim fraction, trim rounding policy and fence factor.
     * @returns The immutable robust summary.
     * @throws {RangeError} If the trim fraction is outside `[0, 0.5)` or the
     *         fence factor is not positive.
     */
    public robust(options: RobustOptions = {}): RobustSummary {
        return RobustSummary.use(useSynchronousRobust(options).getFinisher()(this.sample));
    }
    /**
     * Returns the sample skewness.
     *
     * @param options - The estimator; defaults to the normal-unbiased `G1`.
     * @returns The skewness, or an empty optional when undefined.
     * @throws {TypeError} If the estimator is not a supported name.
     */
    public skewness(options: SkewnessOptions = {}): Optional<number> {
        return useSynchronousSkewness(options).getFinisher()(this.sample);
    }
    /**
     * Returns the sample kurtosis.
     *
     * @param options - The estimator and whether to report the excess form;
     *        defaults to the bias-corrected excess `G2`.
     * @returns The kurtosis, or an empty optional when undefined.
     * @throws {TypeError} If the estimator is not a supported name.
     */
    public kurtosis(options: KurtosisOptions = {}): Optional<number> {
        return useSynchronousKurtosis(options).getFinisher()(this.sample);
    }
    /**
     * Returns the central moments and the shape statistics derived from them.
     *
     * @returns The immutable moment summary.
     */
    public moments(): MomentSummary {
        return MomentSummary.use(useSynchronousMoments().getFinisher()(this.sample));
    }
    /**
     * Returns the Shannon entropy of a histogram of the sample.
     *
     * The estimate is the plug-in `-sum p_i log p_i`, which is negatively biased;
     * the bias grows with the bin count, so a binning is never inferred
     * separately from the one being reported. Pass `differential` for the
     * continuous form that adds the log-width term.
     *
     * Complexity: O(n + k).
     *
     * @param options - The base, the differential flag and the binning.
     * @returns The entropy in the requested unit; zero for an empty sample.
     * @throws {RangeError} If the base is not positive and different from one.
     */
    public entropy(options: DistributionEntropyOptions = {}): number {
        return useSynchronousEntropy(options).getFinisher()(this.sample);
    }
    /**
     * Builds a kernel density estimate.
     *
     * Defaults to a Gaussian kernel with the Silverman bandwidth
     * `0.9 min(s, IQR / 1.34) n^(-1/5)`; a bounded support is **not** inferred,
     * because guessing it would silently change the estimate. Pass `support`
     * together with a boundary correction when the domain is known.
     *
     * Complexity: O(n m) for `m` grid points.
     *
     * @param options - The kernel, bandwidth, boundary, support and grid.
     * @returns The immutable density estimate.
     * @throws {RangeError} If the bandwidth is not positive, the grid is too
     *         small, the cut is negative, or a boundary correction has no support.
     */
    public density(options?: DensityOptions): DensityEstimate;
    /**
     * Builds a kernel density estimate evaluated at explicit points.
     *
     * @param points - The evaluation points that replace the automatic grid.
     * @param options - The kernel, bandwidth, boundary and support.
     * @returns The immutable density estimate.
     * @throws {RangeError} If the bandwidth is not positive, a point is not
     *         finite, or a boundary correction has no support.
     */
    public density(points: Iterable<number>, options?: DensityOptions): DensityEstimate;
    /**
     * Builds a kernel density estimate from the overload arguments.
     *
     * @param argument1 - The options, or the explicit evaluation points.
     * @param argument2 - The options when the first argument is a point iterable.
     * @returns The immutable density estimate.
     */
    public density(argument1?: DensityOptions | Iterable<number>, argument2?: DensityOptions): DensityEstimate {
        let options: DensityOptions;
        if (argument1 !== undefined && isIterable(argument1)) {
            options = Object.freeze({ ...(argument2 ?? {}), points: argument1 as Iterable<number> });
        }
        else {
            options = argument1 ?? argument2 ?? {};
        }
        return DensityEstimate.use(useSynchronousDensity(options).getFinisher()(this.sample));
    }
    /**
     * Compares the sample size and every order statistic with another
     * distribution.
     *
     * @param other - The distribution to compare with.
     * @returns Whether the order statistics match element by element.
     * @throws {TypeError} If the operand is not a `DistributionCollectable`.
     */
    public equals(other: DistributionCollectable<E>): boolean {
        if (!(other instanceof DistributionCollectable)) {
            throw new TypeError("Distribution operand must be a DistributionCollectable.");
        }
        let left: ReadonlyArray<number> = this.sample.ascendingValues();
        let right: ReadonlyArray<number> = other.sample.ascendingValues();
        if (left.length !== right.length) {
            return false;
        }
        for (let index: number = 0; index < left.length; index++) {
            if (left[index] !== right[index]) {
                return false;
            }
        }
        return true;
    }
    /**
     * Renders the sample size and the observed range.
     *
     * @returns A description such as `DistributionCollectable(n=200, [-3.1, 25])`.
     */
    public toString(): string {
        let ascending: ReadonlyArray<number> = this.sample.ascendingValues();
        if (ascending.length === 0) {
            return "DistributionCollectable(n=0)";
        }
        return `DistributionCollectable(n=${ascending.length}, [${ascending[0]}, ${ascending[ascending.length - 1]}])`;
    }
}
