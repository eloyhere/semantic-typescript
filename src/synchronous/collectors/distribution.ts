/**
 * Synchronous distribution collectors.
 *
 * The statistical kernels below are the reference implementation: they own binning,
 * quantiles, moments, robust summaries, entropy and density estimation. The
 * asynchronous factories reuse these kernels so both paths cannot drift apart.
 */
import { isFunction, isNumber } from "#semantic/guard";
import { Optional } from "#semantic/optional";
import { SynchronousCollector } from "#semantic/synchronous/collector";
import { isKurtosisEstimator, isQuantileMethod, isSkewnessEstimator, quantileOfSorted } from "#semantic/mathematics/quantile";
import type { KurtosisEstimator, KurtosisOptions, QuantileMethod, QuantileOptions, SkewnessEstimator, SkewnessOptions } from "#semantic/mathematics/quantile";
import type { BandwidthRule, BoundaryCorrection, DensityData, DensityOptions, DistributionEntropyOptions, EntropyOptions, HistogramBinning, HistogramBinData, HistogramClosure, HistogramData, HistogramOptions, HistogramRule, KernelName, MomentData, RobustData, RobustOptions, TrimPolicy } from "#semantic/synchronous/distribution";

/* ------------------------------------------------------------------------- */
/* Distribution analysis                                                     */
/* ------------------------------------------------------------------------- */

/**
 * Accumulates finite numeric observations for the distribution collectors.
 *
 * The buffer keeps encounter order and materialises an ascending view lazily;
 * the sorted array is cached, so a materialised distribution can apply several
 * collector finishers without paying for a second sort, while a streaming
 * collector sorts once when it finishes. Values that are not finite are rejected
 * at entry, because every quantile, moment and density is undefined for them.
 *
 * Instances are progressive accumulators, not value objects: `accept` mutates
 * the buffer, while the exposed ascending view is read-only.
 */
export class DistributionAccumulator {
    /**
     * The observations in encounter order.
     */
    private readonly buffer: Array<number> = [];
    /**
     * The cached ascending view, invalidated by every accepted value.
     */
    private ascending: ReadonlyArray<number> | null = null;
    /**
     * Appends a finite observation.
     *
     * Complexity: O(1) amortised; the ascending view is rebuilt lazily.
     *
     * @param value - The observation to append.
     * @throws {TypeError} If the value is not a finite number.
     */
    public accept(value: number): void {
        if (!isNumber(value)) {
            throw new TypeError("Distribution value must be a finite number.");
        }
        this.buffer.push(value);
        this.ascending = null;
    }
    /**
     * Returns the number of accepted observations.
     *
     * @returns The count as a bigint.
     */
    public getCount(): bigint {
        return BigInt(this.buffer.length);
    }
    /**
     * Returns the observations in ascending order.
     *
     * The first call copies and sorts the buffer; later calls return the cached
     * array until another value is accepted. Complexity: O(n log n) once, then
     * O(1).
     *
     * @returns The ascending observations.
     */
    public ascendingValues(): ReadonlyArray<number> {
        if (this.ascending === null) {
            let ascending: Array<number> = this.buffer.slice();
            ascending.sort((left: number, right: number): number => left - right);
            this.ascending = ascending;
        }
        return this.ascending;
    }
}

/**
 * Wraps a nullable number in an optional so that an undefined value is never
 * reported as zero.
 *
 * @param value - The nullable value.
 * @returns A present optional for a finite number, otherwise an empty optional.
 */
const optionalDistributionValue: (value: number | null) => Optional<number> = (value: number | null): Optional<number> => {
    return value === null ? Optional.empty<number>() : Optional.of(value);
};

/**
 * Computes the sample standard deviation with denominator `n - 1`.
 *
 * The two-pass form subtracts the mean first, which avoids the catastrophic
 * cancellation of the `sum(x^2) - sum(x)^2 / n` shortcut.
 *
 * @param values - The ascending observations.
 * @returns The sample standard deviation; zero below two observations.
 */
const sampleStandardDeviationOf: (values: ReadonlyArray<number>) => number = (values: ReadonlyArray<number>): number => {
    let count: number = values.length;
    if (count < 2) {
        return 0;
    }
    let summate: number = 0;
    for (let value of values) {
        summate += value;
    }
    let mean: number = summate / count;
    let squared: number = 0;
    for (let value of values) {
        let deviation: number = value - mean;
        squared += deviation * deviation;
    }
    return Math.sqrt(squared / (count - 1));
};

/**
 * Computes the biased central moments with denominator `n`.
 *
 * @param values - The ascending observations.
 * @returns The count, mean, `m2`, `m3` and `m4`.
 */
const momentDataOf: (values: ReadonlyArray<number>) => MomentData = (values: ReadonlyArray<number>): MomentData => {
    let count: number = values.length;
    if (count === 0) {
        return { count: 0n, mean: 0, m2: 0, m3: 0, m4: 0 };
    }
    let summate: number = 0;
    for (let value of values) {
        summate += value;
    }
    let mean: number = summate / count;
    let m2: number = 0;
    let m3: number = 0;
    let m4: number = 0;
    for (let value of values) {
        let deviation: number = value - mean;
        let square: number = deviation * deviation;
        m2 += square;
        m3 += square * deviation;
        m4 += square * square;
    }
    return {
        count: BigInt(count),
        mean: mean,
        m2: m2 / count,
        m3: m3 / count,
        m4: m4 / count
    };
};

/**
 * Computes the median of ascending values.
 *
 * @param values - The ascending observations.
 * @returns The median, or `null` for an empty sample.
 */
const medianOf: (values: ReadonlyArray<number>) => number | null = (values: ReadonlyArray<number>): number | null => {
    let count: number = values.length;
    if (count === 0) {
        return null;
    }
    let middle: number = Math.floor(count / 2);
    return count % 2 === 0 ? (values[middle - 1] + values[middle]) / 2 : values[middle];
};

/**
 * Selects a quantile from ascending values, reporting an empty optional for an
 * empty sample.
 *
 * @param values - The ascending observations.
 * @param probability - The probability in `[0, 1]`; validated by the caller.
 * @param method - One of the nine Hyndman–Fan types.
 * @returns The quantile, or an empty optional.
 */
const quantileOfValues: (values: ReadonlyArray<number>, probability: number, method: QuantileMethod) => Optional<number> =
    (values: ReadonlyArray<number>, probability: number, method: QuantileMethod): Optional<number> => {
        return values.length === 0
            ? Optional.empty<number>()
            : Optional.of(quantileOfSorted(values, probability, method));
    };

/**
 * Computes the interquartile range under an explicit quantile type.
 *
 * The type matters: the type-1 implementation inherited by the historical
 * statistics view returns a different range, and with it a different Tukey
 * fence.
 *
 * @param values - The ascending observations.
 * @param method - One of the nine Hyndman–Fan types.
 * @returns The range, or `null` for an empty sample.
 */
export const interquartileRangeOf: (values: ReadonlyArray<number>, method: QuantileMethod) => number | null =
    (values: ReadonlyArray<number>, method: QuantileMethod): number | null => {
        if (values.length === 0) {
            return null;
        }
        return quantileOfSorted(values, 0.75, method) - quantileOfSorted(values, 0.25, method);
    };

/**
 * Computes the median absolute deviation, optionally scaled.
 *
 * The unscaled value is the median of `|x - median(x)|`; scaling by `1.4826`
 * makes it comparable with a standard deviation under normality. The scale is
 * an asymptotic constant, not a small-sample identity.
 *
 * @param values - The ascending observations.
 * @param constant - The consistency constant to multiply by.
 * @returns The scaled deviation, or `null` for an empty sample.
 */
const medianAbsoluteDeviationOf: (values: ReadonlyArray<number>, constant: number) => number | null =
    (values: ReadonlyArray<number>, constant: number): number | null => {
        let count: number = values.length;
        if (count === 0) {
            return null;
        }
        let center: number = medianOf(values) as number;
        let deviations: Array<number> = new Array<number>(count);
        for (let index: number = 0; index < count; index++) {
            deviations[index] = Math.abs(values[index] - center);
        }
        deviations.sort((left: number, right: number): number => left - right);
        return (medianOf(deviations) as number) * constant;
    };

/**
 * Computes the mean after removing a number of observations from each end.
 *
 * A removal that reaches the centre degenerates to the median, which is the
 * `trim -> 0.5` limit of the trimmed mean.
 *
 * @param values - The ascending observations.
 * @param removed - The observations removed from each end.
 * @returns The trimmed mean.
 */
const trimmedMeanAt: (values: ReadonlyArray<number>, removed: number) => number =
    (values: ReadonlyArray<number>, removed: number): number => {
        let count: number = values.length;
        let start: number = Math.min(removed, Math.floor(count / 2));
        let end: number = count - start;
        if (start >= end) {
            return medianOf(values) as number;
        }
        let summate: number = 0;
        for (let index: number = start; index < end; index++) {
            summate += values[index];
        }
        return summate / (end - start);
    };

/**
 * Computes the trimmed mean with an explicit rounding policy.
 *
 * `"truncate"` removes `floor(trim n)` observations from each end, matching
 * R's `mean(trim = )`. `"interpolate"` blends the two neighbouring integer
 * trimming levels so the result is continuous in `trim`.
 *
 * @param values - The ascending observations.
 * @param trim - The trimmed fraction in `[0, 0.5)`.
 * @param policy - The rounding policy.
 * @returns The trimmed mean, or `null` for an empty sample.
 */
export const trimmedMeanOf: (values: ReadonlyArray<number>, trim: number, policy: TrimPolicy) => number | null =
    (values: ReadonlyArray<number>, trim: number, policy: TrimPolicy): number | null => {
        let count: number = values.length;
        if (count === 0) {
            return null;
        }
        let scaled: number = trim * count;
        let lower: number = Math.floor(scaled);
        if (policy === "truncate") {
            return trimmedMeanAt(values, lower);
        }
        let fraction: number = scaled - lower;
        let low: number = trimmedMeanAt(values, lower);
        if (fraction === 0) {
            return low;
        }
        let high: number = trimmedMeanAt(values, lower + 1);
        return low * (1 - fraction) + high * fraction;
    };

/**
 * Computes one Tukey fence.
 *
 * The fence is `Q1 - factor IQR` or `Q3 + factor IQR`, using the type-7
 * quartiles; the whisker of a box plot is the furthest observation inside the
 * fence, not the fence itself.
 *
 * @param values - The ascending observations.
 * @param factor - The fence multiplier.
 * @param lower - Whether to return the lower fence.
 * @returns The fence, or `null` for an empty sample.
 */
export const fenceOf: (values: ReadonlyArray<number>, factor: number, lower: boolean) => number | null =
    (values: ReadonlyArray<number>, factor: number, lower: boolean): number | null => {
        if (values.length === 0) {
            return null;
        }
        let first: number = quantileOfSorted(values, 0.25, "type-7");
        let third: number = quantileOfSorted(values, 0.75, "type-7");
        let range: number = third - first;
        return lower ? first - factor * range : third + factor * range;
    };

/**
 * Computes the sample skewness from central moments.
 *
 * @param moment - The central moments.
 * @param estimator - `"g1"` or `"G1"`.
 * @returns The skewness, or an empty optional when undefined.
 */
export const skewnessOfMoment: (moment: MomentData, estimator: SkewnessEstimator) => Optional<number> =
    (moment: MomentData, estimator: SkewnessEstimator): Optional<number> => {
        let count: number = Number(moment.count);
        if (count < 2 || !(moment.m2 > 0)) {
            return Optional.empty<number>();
        }
        let biased: number = moment.m3 / Math.pow(moment.m2, 1.5);
        if (estimator === "g1") {
            return Optional.of(biased);
        }
        if (count < 3) {
            return Optional.empty<number>();
        }
        return Optional.of(Math.sqrt(count * (count - 1)) / (count - 2) * biased);
    };

/**
 * Computes the sample kurtosis from central moments.
 *
 * @param moment - The central moments.
 * @param estimator - `"g2"` or `"G2"`.
 * @param excess - Whether to subtract three.
 * @returns The kurtosis, or an empty optional when undefined.
 */
export const kurtosisOfMoment: (moment: MomentData, estimator: KurtosisEstimator, excess: boolean) => Optional<number> =
    (moment: MomentData, estimator: KurtosisEstimator, excess: boolean): Optional<number> => {
        let count: number = Number(moment.count);
        if (count < 2 || !(moment.m2 > 0)) {
            return Optional.empty<number>();
        }
        let biased: number = moment.m4 / (moment.m2 * moment.m2) - 3;
        if (estimator === "g2") {
            return Optional.of(excess ? biased : biased + 3);
        }
        if (count < 4) {
            return Optional.empty<number>();
        }
        let corrected: number = (count - 1) / ((count - 2) * (count - 3)) * ((count + 1) * biased + 6);
        return Optional.of(excess ? corrected : corrected + 3);
    };

/**
 * Computes the normal-reference standard error of the skewness.
 *
 * @param moment - The central moments.
 * @returns `sqrt(6 n (n - 1) / ((n - 2)(n + 1)(n + 3)))`, or an empty
 *          optional below three observations.
 */
export const skewnessStandardErrorOf: (moment: MomentData) => Optional<number> =
    (moment: MomentData): Optional<number> => {
        let count: number = Number(moment.count);
        if (count < 3) {
            return Optional.empty<number>();
        }
        return Optional.of(Math.sqrt(6 * count * (count - 1) / ((count - 2) * (count + 1) * (count + 3))));
    };

/**
 * Computes the normal-reference standard error of the kurtosis.
 *
 * @param moment - The central moments.
 * @returns `sqrt(24 n (n - 1)^2 / ((n - 3)(n - 2)(n + 3)(n + 5)))`, or an
 *          empty optional below four observations.
 */
export const kurtosisStandardErrorOf: (moment: MomentData) => Optional<number> =
    (moment: MomentData): Optional<number> => {
        let count: number = Number(moment.count);
        if (count < 4) {
            return Optional.empty<number>();
        }
        return Optional.of(Math.sqrt(24 * count * Math.pow(count - 1, 2) / ((count - 3) * (count - 2) * (count + 3) * (count + 5))));
    };

/**
 * The supported binning rules as a frozen runtime list.
 */
const DISTRIBUTION_HISTOGRAM_RULES: ReadonlyArray<string> = Object.freeze([
    "sturges", "scott", "freedman-diaconis", "sqrt", "rice", "doane", "terrell-scott"
] as const);

/**
 * The supported kernel names as a frozen runtime list.
 */
const DISTRIBUTION_KERNELS: ReadonlyArray<string> = Object.freeze([
    "gaussian", "epanechnikov", "uniform", "triangular", "biweight", "triweight"
] as const);

/**
 * The supported bandwidth rules as a frozen runtime list.
 */
const DISTRIBUTION_BANDWIDTH_RULES: ReadonlyArray<string> = Object.freeze(["silverman", "scott"] as const);

/**
 * The supported boundary corrections as a frozen runtime list.
 */
const DISTRIBUTION_BOUNDARIES: ReadonlyArray<string> = Object.freeze(["none", "reflection", "renormalize"] as const);

/**
 * The supported trim policies as a frozen runtime list.
 */
const DISTRIBUTION_TRIM_POLICIES: ReadonlyArray<string> = Object.freeze(["truncate", "interpolate"] as const);

/**
 * The resolved histogram options used by the histogram factories.
 */
interface ResolvedHistogramOptions {
    /** The rule name or the validated edge array. */
    readonly binning: HistogramRule | ReadonlyArray<number>;
    /** The closure convention. */
    readonly closed: HistogramClosure;
    /** The maximum number of derived bins. */
    readonly maximumBins: bigint;
}

/**
 * Validates and resolves histogram options.
 *
 * @param options - The caller-supplied options.
 * @returns The validated options.
 * @throws {TypeError} If a rule, closure or edge has the wrong type.
 * @throws {RangeError} If the edges are not strictly increasing, contain fewer
 *         than two values, or exceed the bin cap.
 */
const resolveHistogramOptions: (options: HistogramOptions) => ResolvedHistogramOptions =
    (options: HistogramOptions): ResolvedHistogramOptions => {
        let closed: HistogramClosure = options.closed ?? "left";
        if (closed !== "left" && closed !== "right") {
            throw new TypeError("Histogram closure must be left or right.");
        }
        let maximumBins: bigint = options.maximumBins ?? 1000n;
        if (typeof maximumBins !== "bigint" || maximumBins <= 0n) {
            throw new RangeError("Histogram maximum bin count must be a positive bigint.");
        }
        let binning: HistogramBinning = options.binning ?? "freedman-diaconis";
        if (typeof binning === "string") {
            if (!DISTRIBUTION_HISTOGRAM_RULES.includes(binning)) {
                throw new TypeError("Histogram rule must be a supported rule name.");
            }
            return { binning: binning as HistogramRule, closed: closed, maximumBins: maximumBins };
        }
        if (!Array.isArray(binning)) {
            throw new TypeError("Histogram binning must be a rule name or an edge array.");
        }
        if (binning.length < 2) {
            throw new RangeError("Histogram edges must be strictly increasing and contain at least two values.");
        }
        let edges: Array<number> = [];
        for (let index: number = 0; index < binning.length; index++) {
            let edge: number = binning[index];
            if (!isNumber(edge)) {
                throw new TypeError("Histogram edge must be a finite number.");
            }
            if (index > 0 && !(edge > edges[index - 1])) {
                throw new RangeError("Histogram edges must be strictly increasing and contain at least two values.");
            }
            edges.push(edge);
        }
        if (BigInt(edges.length - 1) > maximumBins) {
            throw new RangeError("Histogram bin count exceeds the configured maximum.");
        }
        return { binning: Object.freeze(edges), closed: closed, maximumBins: maximumBins };
    };

/**
 * Converts a configured bin cap into a number for comparison.
 *
 * @param maximumBins - The positive bigint cap.
 * @returns The cap as a number, saturated at the largest safe integer.
 */
const binLimitOf: (maximumBins: bigint) => number = (maximumBins: bigint): number => {
    return maximumBins > BigInt(Number.MAX_SAFE_INTEGER) ? Number.MAX_SAFE_INTEGER : Number(maximumBins);
};

/**
 * Derives a bin count from a rule.
 *
 * @param values - The non-empty ascending observations with positive range.
 * @param rule - The binning rule.
 * @param maximumBins - The cap the derived count must not exceed.
 * @returns The derived bin count, at least one.
 * @throws {RangeError} If the rule's width is undefined or the count exceeds
 *         the cap.
 */
const binCountOf: (values: ReadonlyArray<number>, rule: HistogramRule, maximumBins: bigint) => number =
    (values: ReadonlyArray<number>, rule: HistogramRule, maximumBins: bigint): number => {
        let count: number = values.length;
        let range: number = values[count - 1] - values[0];
        let bins: number;
        switch (rule) {
            case "sturges":
                bins = Math.ceil(Math.log2(count)) + 1;
                break;
            case "sqrt":
                bins = Math.ceil(Math.sqrt(count));
                break;
            case "rice":
                bins = Math.ceil(2 * Math.cbrt(count));
                break;
            case "terrell-scott":
                bins = Math.ceil(Math.cbrt(2 * count));
                break;
            case "scott": {
                let deviation: number = sampleStandardDeviationOf(values);
                let bandwidth: number = 3.49 * deviation * Math.pow(count, -1 / 3);
                if (!(bandwidth > 0)) {
                    throw new RangeError("Scott bin width is not defined for a sample without dispersion.");
                }
                bins = Math.ceil(range / bandwidth);
                break;
            }
            case "freedman-diaconis": {
                let rangeInterquartile: number | null = interquartileRangeOf(values, "type-7");
                if (rangeInterquartile === null || !(rangeInterquartile > 0)) {
                    throw new RangeError("Freedman-Diaconis bin width is not defined for a zero interquartile range.");
                }
                let bandwidth: number = 2 * rangeInterquartile * Math.pow(count, -1 / 3);
                bins = Math.ceil(range / bandwidth);
                break;
            }
            default: {
                let moment: MomentData = momentDataOf(values);
                if (count < 3 || !(moment.m2 > 0)) {
                    bins = Math.ceil(Math.log2(count)) + 1;
                    break;
                }
                let biased: number = moment.m3 / Math.pow(moment.m2, 1.5);
                let sigma: number = Math.sqrt(6 * (count - 2) / ((count + 1) * (count + 3)));
                bins = Math.ceil(1 + Math.log2(count) + Math.log2(1 + Math.abs(biased) / sigma));
                break;
            }
        }
        if (!Number.isFinite(bins) || bins < 1) {
            bins = 1;
        }
        if (bins > binLimitOf(maximumBins)) {
            throw new RangeError("Histogram bin count exceeds the configured maximum.");
        }
        return bins;
    };

/**
 * Counts ascending observations into bins under one closure convention.
 *
 * The sweep is linear in the sample size because the observations and the edges
 * are both ascending; values outside the edge range are left uncounted.
 *
 * @param values - The ascending observations.
 * @param edges - The ascending bin edges.
 * @param closed - The closure convention.
 * @returns The counts in bin order.
 */
const countBins: (values: ReadonlyArray<number>, edges: ReadonlyArray<number>, closed: HistogramClosure) => Array<bigint> =
    (values: ReadonlyArray<number>, edges: ReadonlyArray<number>, closed: HistogramClosure): Array<bigint> => {
        let bins: number = edges.length - 1;
        let counts: Array<bigint> = new Array<bigint>(bins).fill(0n);
        let count: number = values.length;
        let index: number = 0;
        while (index < count && values[index] < edges[0]) {
            index++;
        }
        for (let bin: number = 0; bin < bins; bin++) {
            let upper: number = edges[bin + 1];
            if (closed === "left" && bin < bins - 1) {
                while (index < count && values[index] < upper) {
                    counts[bin] += 1n;
                    index++;
                }
            }
            else {
                while (index < count && values[index] <= upper) {
                    counts[bin] += 1n;
                    index++;
                }
            }
        }
        return counts;
    };

/**
 * Returns the shared width of an edge array.
 *
 * @param edges - The ascending edges.
 * @returns The common width, or `null` when the edges are not equidistant.
 */
const uniformWidthOf: (edges: ReadonlyArray<number>) => number | null = (edges: ReadonlyArray<number>): number | null => {
    if (edges.length < 2) {
        return null;
    }
    let width: number = edges[1] - edges[0];
    for (let index: number = 1; index < edges.length - 1; index++) {
        if (edges[index + 1] - edges[index] !== width) {
            return null;
        }
    }
    return width;
};

/**
 * Builds histogram data from ascending observations.
 *
 * Rule-derived edges always span the full range, so no observation is omitted
 * and the counts sum to the sample size. A constant sample expands to a single
 * unit-width bin, mirroring the convention used by NumPy, because a zero-width
 * bin has no density. Explicit edges are used as given and observations outside
 * them are reported as omitted.
 *
 * @param values - The ascending observations.
 * @param options - The resolved histogram options.
 * @returns The histogram data.
 * @throws {RangeError} If a derived bin count exceeds the cap.
 */
const histogramOf: (values: ReadonlyArray<number>, options: ResolvedHistogramOptions) => HistogramData =
    (values: ReadonlyArray<number>, options: ResolvedHistogramOptions): HistogramData => {
        let sampleCount: bigint = BigInt(values.length);
        let rule: HistogramRule | "manual" = typeof options.binning === "string" ? options.binning : "manual";
        let edges: Array<number>;
        let width: number | null;
        if (typeof options.binning === "string") {
            if (values.length === 0) {
                return {
                    rule: rule,
                    closed: options.closed,
                    bins: [],
                    width: null,
                    total: 0n,
                    omitted: 0n,
                    sampleCount: sampleCount
                };
            }
            let minimum: number = values[0];
            let maximum: number = values[values.length - 1];
            let range: number = maximum - minimum;
            if (range === 0) {
                let lower: number = minimum - 0.5;
                let upper: number = maximum + 0.5;
                if (!(lower < upper)) {
                    let padding: number = Math.abs(minimum) * Number.EPSILON * 4;
                    lower = minimum - padding;
                    upper = maximum + padding;
                }
                edges = [lower, upper];
                width = upper - lower;
                if (!(width > 0)) {
                    throw new RangeError("Histogram bin width is not representable for this sample.");
                }
            }
            else {
                let bins: number = binCountOf(values, options.binning, options.maximumBins);
                width = range / bins;
                edges = new Array<number>(bins + 1);
                for (let index: number = 0; index <= bins; index++) {
                    edges[index] = index === bins ? maximum : minimum + index * width;
                }
                let ascending: boolean = true;
                for (let index: number = 1; index < edges.length; index++) {
                    if (!(edges[index] > edges[index - 1])) {
                        ascending = false;
                        break;
                    }
                }
                if (!ascending) {
                    // A bin width below the representable resolution of the sample
                    // cannot split it; one bin still covers every observation.
                    edges = [minimum, maximum];
                    width = range;
                }
            }
        }
        else {
            edges = options.binning.slice();
            width = uniformWidthOf(edges);
        }
        let counts: Array<bigint> = countBins(values, edges, options.closed);
        let bins: Array<HistogramBinData> = [];
        let total: bigint = 0n;
        for (let index: number = 0; index < counts.length; index++) {
            let lower: number = edges[index];
            let upper: number = edges[index + 1];
            let binWidth: number = upper - lower;
            let binCount: bigint = counts[index];
            total += binCount;
            bins.push({
                lower: lower,
                upper: upper,
                count: binCount,
                density: sampleCount === 0n ? 0 : Number(binCount) / (Number(sampleCount) * binWidth)
            });
        }
        return {
            rule: rule,
            closed: options.closed,
            bins: bins,
            width: width,
            total: total,
            omitted: sampleCount - total,
            sampleCount: sampleCount
        };
    };

/**
 * Computes the entropy of already binned data.
 *
 * The plug-in estimate `-sum p_i log p_i` is reported for the discrete
 * distribution. With `differential` the per-bin width term is added, which is
 * the binned continuous entropy; because the two differ by `sum p_i log(width_i)`
 * they must never be compared without declaring which one is in use. A zero
 * probability contributes nothing, following `0 log 0 := 0`.
 *
 * @param data - The histogram data.
 * @param options - The base and the differential flag.
 * @returns The entropy; zero for an empty histogram.
 * @throws {RangeError} If the base is not positive and different from one.
 */
export const entropyOfHistogram: (data: HistogramData, options?: EntropyOptions) => number =
    (data: HistogramData, options: EntropyOptions = {}): number => {
        let base: number = options.base ?? Math.E;
        if (!isNumber(base) || base <= 0 || base === 1) {
            throw new RangeError("Entropy base must be positive and different from one.");
        }
        if (data.total === 0n) {
            return 0;
        }
        let scale: number = 1 / Math.log(base);
        let total: number = Number(data.total);
        let entropy: number = 0;
        for (let bin of data.bins) {
            if (bin.count === 0n) {
                continue;
            }
            let probability: number = Number(bin.count) / total;
            entropy -= probability * Math.log(probability) * scale;
            if (options.differential === true) {
                let width: number = bin.upper - bin.lower;
                if (width > 0) {
                    entropy += probability * Math.log(width) * scale;
                }
            }
        }
        return entropy;
    };

/**
 * Evaluates one kernel.
 *
 * @param kernel - The kernel name.
 * @param u - The standardised distance.
 * @returns The kernel value at `u`.
 */
const kernelAt: (kernel: KernelName, u: number) => number = (kernel: KernelName, u: number): number => {
    let absolute: number = Math.abs(u);
    let square: number = 1 - u * u;
    switch (kernel) {
        case "gaussian":
            return Math.exp(-0.5 * u * u) / Math.sqrt(2 * Math.PI);
        case "epanechnikov":
            return absolute <= 1 ? 0.75 * square : 0;
        case "uniform":
            return absolute <= 1 ? 0.5 : 0;
        case "triangular":
            return absolute <= 1 ? 1 - absolute : 0;
        case "biweight":
            return absolute <= 1 ? 0.9375 * square * square : 0;
        default:
            return absolute <= 1 ? 1.09375 * square * square * square : 0;
    }
};

/**
 * Clamps a standardised distance to the unit interval.
 *
 * @param value - The value to clamp.
 * @returns The value limited to `[-1, 1]`.
 */
const clampUnit: (value: number) => number = (value: number): number => {
    return Math.max(-1, Math.min(1, value));
};

/**
 * Approximates the error function with the Abramowitz–Stegun 7.1.26 formula.
 *
 * @param value - The argument; `+-Infinity` is supported.
 * @returns The error function, with an absolute error below `1.5e-7`.
 */
const erfOf: (value: number) => number = (value: number): number => {
    if (value === 0) {
        return 0;
    }
    let sign: number = value < 0 ? -1 : 1;
    let absolute: number = Math.abs(value);
    if (!Number.isFinite(absolute)) {
        return sign;
    }
    let step: number = 1 / (1 + 0.3275911 * absolute);
    let polynomial: number = ((((1.061405429 * step - 1.453152027) * step + 1.421413741) * step - 0.284496736) * step + 0.254829592) * step;
    return sign * (1 - polynomial * Math.exp(-absolute * absolute));
};

/**
 * Evaluates the standard normal cumulative distribution function.
 *
 * @param value - The standardised value.
 * @returns The probability of a standard normal variable being at most `value`.
 */
const normalCumulativeOf: (value: number) => number = (value: number): number => {
    return 0.5 * (1 + erfOf(value / Math.SQRT2));
};

/**
 * Evaluates the cumulative integral of a kernel.
 *
 * @param kernel - The kernel name.
 * @param u - The upper integration limit.
 * @returns The kernel mass from negative infinity to `u`.
 */
const kernelCumulativeOf: (kernel: KernelName, u: number) => number = (kernel: KernelName, u: number): number => {
    switch (kernel) {
        case "gaussian":
            return normalCumulativeOf(u);
        case "uniform":
            return (clampUnit(u) + 1) / 2;
        case "triangular":
            if (u <= -1) {
                return 0;
            }
            if (u >= 1) {
                return 1;
            }
            return u < 0 ? (u + 1) * (u + 1) / 2 : 1 - (1 - u) * (1 - u) / 2;
        case "epanechnikov":
            if (u <= -1) {
                return 0;
            }
            if (u >= 1) {
                return 1;
            }
            return 0.75 * (u - u * u * u / 3) + 0.5;
        case "biweight":
            if (u <= -1) {
                return 0;
            }
            if (u >= 1) {
                return 1;
            }
            return 0.9375 * (u - 2 * u * u * u / 3 + Math.pow(u, 5) / 5) + 0.5;
        default:
            if (u <= -1) {
                return 0;
            }
            if (u >= 1) {
                return 1;
            }
            return 1.09375 * (u - u * u * u + 3 * Math.pow(u, 5) / 5 - Math.pow(u, 7) / 7) + 0.5;
    }
};

/**
 * Computes the kernel mass inside an interval.
 *
 * @param kernel - The kernel name.
 * @param lower - The lower standardised limit; infinities are supported.
 * @param upper - The upper standardised limit; infinities are supported.
 * @returns The mass between the limits.
 */
const kernelMassOf: (kernel: KernelName, lower: number, upper: number) => number =
    (kernel: KernelName, lower: number, upper: number): number => {
        return Math.max(0, kernelCumulativeOf(kernel, upper) - kernelCumulativeOf(kernel, lower));
    };

/**
 * The resolved density options used by the density factories.
 */
interface ResolvedDensityOptions {
    /** The kernel name. */
    readonly kernel: KernelName;
    /** The bandwidth rule or explicit bandwidth. */
    readonly bandwidth: BandwidthRule | number;
    /** The bandwidth multiplier. */
    readonly adjust: number;
    /** The grid extension in bandwidths. */
    readonly cut: number;
    /** The boundary correction. */
    readonly boundary: BoundaryCorrection;
    /** The declared support, or `null`. */
    readonly support: readonly [number, number] | null;
    /** The automatic grid size. */
    readonly gridSize: bigint;
    /** The explicit grid, or `null` for an automatic grid. */
    readonly points: ReadonlyArray<number> | null;
}

/**
 * Validates and resolves density options.
 *
 * @param options - The caller-supplied options.
 * @returns The validated options.
 * @throws {TypeError} If a kernel, rule, boundary or point has the wrong type.
 * @throws {RangeError} If the bandwidth, adjustment, cut, grid or support is
 *         invalid, or a boundary correction has no support.
 */
const resolveDensityOptions: (options: DensityOptions) => ResolvedDensityOptions =
    (options: DensityOptions): ResolvedDensityOptions => {
        let kernel: KernelName = options.kernel ?? "gaussian";
        if (!DISTRIBUTION_KERNELS.includes(kernel)) {
            throw new TypeError("Density kernel must be a supported kernel name.");
        }
        let bandwidth: BandwidthRule | number = options.bandwidth ?? "silverman";
        if (typeof bandwidth === "number") {
            if (!isNumber(bandwidth) || bandwidth <= 0) {
                throw new RangeError("Bandwidth must be positive.");
            }
        }
        else if (!DISTRIBUTION_BANDWIDTH_RULES.includes(bandwidth)) {
            throw new TypeError("Bandwidth must be a supported rule name or a positive number.");
        }
        let adjust: number = options.adjust ?? 1;
        if (!isNumber(adjust) || adjust <= 0) {
            throw new RangeError("Bandwidth adjustment must be positive.");
        }
        let cut: number = options.cut ?? 3;
        if (!isNumber(cut) || cut < 0) {
            throw new RangeError("Density cut must not be negative.");
        }
        let boundary: BoundaryCorrection = options.boundary ?? "none";
        if (!DISTRIBUTION_BOUNDARIES.includes(boundary)) {
            throw new TypeError("Density boundary must be none, reflection or renormalize.");
        }
        let support: readonly [number, number] | null = null;
        if (options.support !== undefined) {
            let candidate: readonly [number, number] = options.support;
            if (candidate.length !== 2
                || typeof candidate[0] !== "number" || Number.isNaN(candidate[0])
                || typeof candidate[1] !== "number" || Number.isNaN(candidate[1])) {
                throw new TypeError("Density support must contain two numeric bounds.");
            }
            if (!(candidate[0] < candidate[1])) {
                throw new RangeError("Density support bounds must be ascending.");
            }
            support = [candidate[0], candidate[1]];
        }
        if (boundary !== "none" && support === null) {
            throw new RangeError("A boundary correction requires an explicit support.");
        }
        let gridSize: bigint = options.gridSize ?? 512n;
        if (typeof gridSize !== "bigint" || gridSize < 2n) {
            throw new RangeError("Density grid size must be a bigint of at least two.");
        }
        let points: ReadonlyArray<number> | null = null;
        if (options.points !== undefined) {
            let explicit: Array<number> = [];
            for (let point of options.points) {
                if (!isNumber(point)) {
                    throw new TypeError("Density point must be a finite number.");
                }
                explicit.push(point);
            }
            if (explicit.length === 0) {
                throw new RangeError("Density points must not be empty.");
            }
            points = Object.freeze(explicit);
        }
        return {
            kernel: kernel,
            bandwidth: bandwidth,
            adjust: adjust,
            cut: cut,
            boundary: boundary,
            support: support,
            gridSize: gridSize,
            points: points
        };
    };

/**
 * Evaluates a kernel density estimate at one point.
 *
 * `"reflection"` adds a mirrored copy of every observation for each finite
 * support bound; `"renormalize"` divides by the kernel mass inside the declared
 * support. Both corrections change the estimate deliberately, which is why they
 * are opt-in.
 *
 * @param sample - The ascending observations.
 * @param bandwidth - The positive bandwidth.
 * @param kernel - The kernel name.
 * @param boundary - The boundary correction.
 * @param support - The declared support, or `null`.
 * @param value - The point at which to evaluate.
 * @returns The estimated density.
 */
export const evaluateDensityOf: (sample: ReadonlyArray<number>, bandwidth: number, kernel: KernelName, boundary: BoundaryCorrection, support: readonly [number, number] | null, value: number) => number =
    (sample: ReadonlyArray<number>, bandwidth: number, kernel: KernelName, boundary: BoundaryCorrection, support: readonly [number, number] | null, value: number): number => {
        if (sample.length === 0) {
            return 0;
        }
        let total: number = 0;
        for (let observation of sample) {
            total += kernelAt(kernel, (value - observation) / bandwidth);
        }
        if (boundary === "reflection" && support !== null) {
            for (let observation of sample) {
                if (Number.isFinite(support[0])) {
                    total += kernelAt(kernel, (value - (2 * support[0] - observation)) / bandwidth);
                }
                if (Number.isFinite(support[1])) {
                    total += kernelAt(kernel, (value - (2 * support[1] - observation)) / bandwidth);
                }
            }
        }
        let density: number = total / (sample.length * bandwidth);
        if (boundary === "renormalize" && support !== null) {
            let mass: number = kernelMassOf(kernel, (support[0] - value) / bandwidth, (support[1] - value) / bandwidth);
            density = mass > 0 ? density / mass : 0;
        }
        return density;
    };

/**
 * Builds density data from ascending observations.
 *
 * @param values - The ascending observations.
 * @param options - The resolved density options.
 * @returns The density data.
 * @throws {RangeError} If the sample is empty or the bandwidth is not positive.
 */
const densityDataOf: (values: ReadonlyArray<number>, options: ResolvedDensityOptions) => DensityData =
    (values: ReadonlyArray<number>, options: ResolvedDensityOptions): DensityData => {
        if (values.length === 0) {
            throw new RangeError("Density estimation requires at least one observation.");
        }
        let bandwidth: number;
        if (typeof options.bandwidth === "number") {
            bandwidth = options.bandwidth;
        }
        else if (options.bandwidth === "silverman") {
            let deviation: number = sampleStandardDeviationOf(values);
            let rangeInterquartile: number | null = interquartileRangeOf(values, "type-7");
            let robust: number = rangeInterquartile === null ? 0 : rangeInterquartile / 1.34;
            bandwidth = 0.9 * Math.min(deviation, robust) * Math.pow(values.length, -0.2);
        }
        else {
            bandwidth = 1.06 * sampleStandardDeviationOf(values) * Math.pow(values.length, -0.2);
        }
        bandwidth *= options.adjust;
        if (!isNumber(bandwidth) || !(bandwidth > 0)) {
            throw new RangeError("Bandwidth must be positive.");
        }
        let points: ReadonlyArray<number>;
        if (options.points !== null) {
            points = options.points;
        }
        else {
            let size: number = Number(options.gridSize);
            let minimum: number = values[0] - options.cut * bandwidth;
            let maximum: number = values[values.length - 1] + options.cut * bandwidth;
            let grid: Array<number> = new Array<number>(size);
            for (let index: number = 0; index < size; index++) {
                grid[index] = index === size - 1
                    ? maximum
                    : minimum + (maximum - minimum) * index / (size - 1);
            }
            points = Object.freeze(grid);
        }
        let densities: Array<number> = new Array<number>(points.length);
        for (let index: number = 0; index < points.length; index++) {
            densities[index] = evaluateDensityOf(values, bandwidth, options.kernel, options.boundary, options.support, points[index]);
        }
        let domain: readonly [number, number] = [0, 0];
        if (points.length > 0) {
            let smallest: number = points[0];
            let largest: number = points[0];
            for (let point of points) {
                if (point < smallest) {
                    smallest = point;
                }
                if (point > largest) {
                    largest = point;
                }
            }
            domain = [smallest, largest];
        }
        return {
            kernel: options.kernel,
            bandwidth: bandwidth,
            boundary: options.boundary,
            support: options.support,
            points: points,
            densities: Object.freeze(densities),
            sample: values,
            domain: domain
        };
    };

/**
 * Creates a collector that finishes with histogram data.
 *
 * The collector buffers until the finisher, because bin edges may depend on the
 * whole sample (an interquartile range for Freedman–Diaconis, a skewness for
 * Doane). The finisher applies the same kernel used by the materialised
 * distribution, so the streaming and buffered paths cannot disagree.
 *
 * Complexity: O(n log n) to sort and O(n + k) to count.
 *
 * @param options - The binning rule, closure and bin cap.
 * @returns A collector that finishes with the histogram data.
 * @throws {TypeError} If a rule, closure or edge is invalid.
 * @throws {RangeError} If the edges or the bin cap are invalid.
 */
export let useSynchronousHistogram: (options?: HistogramOptions) => SynchronousCollector<number, DistributionAccumulator, HistogramData> =
    (options: HistogramOptions = {}): SynchronousCollector<number, DistributionAccumulator, HistogramData> => {
        let resolved: ResolvedHistogramOptions = resolveHistogramOptions(options);
        return SynchronousCollector.full<number, DistributionAccumulator, HistogramData>(
            (): DistributionAccumulator => new DistributionAccumulator(),
            (accumulator: DistributionAccumulator, element: number): DistributionAccumulator => {
                accumulator.accept(element);
                return accumulator;
            },
            (accumulator: DistributionAccumulator): HistogramData => {
                return histogramOf(accumulator.ascendingValues(), resolved);
            }
        );
    };

/**
 * Creates a collector that finishes with one quantile.
 *
 * The probability is validated when the collector is created instead of when the
 * source finishes, so an impossible request fails before any work is done.
 * Types 1–3 are step functions and types 4–9 interpolate linearly.
 *
 * Complexity: O(n log n) to sort plus O(1) to select.
 *
 * @param probability - The probability in `[0, 1]`.
 * @param options - The interpolation type; defaults to `"type-7"`.
 * @returns A collector that finishes with the quantile.
 * @throws {RangeError} If the probability is outside `[0, 1]`.
 * @throws {TypeError} If the probability or method has the wrong type.
 */
export let useSynchronousQuantile: (probability: number, options?: QuantileOptions) => SynchronousCollector<number, DistributionAccumulator, Optional<number>> =
    (probability: number, options: QuantileOptions = {}): SynchronousCollector<number, DistributionAccumulator, Optional<number>> => {
        if (!isNumber(probability)) {
            throw new TypeError("Quantile probability must be a finite number.");
        }
        if (probability < 0 || probability > 1) {
            throw new RangeError("Quantile probability must be within [0, 1].");
        }
        let method: QuantileMethod = options.method ?? "type-7";
        if (!isQuantileMethod(method)) {
            throw new TypeError("Invalid quantile method.");
        }
        return SynchronousCollector.full<number, DistributionAccumulator, Optional<number>>(
            (): DistributionAccumulator => new DistributionAccumulator(),
            (accumulator: DistributionAccumulator, element: number): DistributionAccumulator => {
                accumulator.accept(element);
                return accumulator;
            },
            (accumulator: DistributionAccumulator): Optional<number> => {
                return quantileOfValues(accumulator.ascendingValues(), probability, method);
            }
        );
    };

/**
 * Creates a collector that finishes with ascending order statistics.
 *
 * The returned array is the accumulator's cached ascending view; it is shared
 * with the empirical distribution built from it and must not be mutated.
 *
 * @returns A collector that finishes with the ascending observations.
 */
export let useSynchronousEmpiricalDistribution: () => SynchronousCollector<number, DistributionAccumulator, ReadonlyArray<number>> =
    (): SynchronousCollector<number, DistributionAccumulator, ReadonlyArray<number>> => {
        return SynchronousCollector.full<number, DistributionAccumulator, ReadonlyArray<number>>(
            (): DistributionAccumulator => new DistributionAccumulator(),
            (accumulator: DistributionAccumulator, element: number): DistributionAccumulator => {
                accumulator.accept(element);
                return accumulator;
            },
            (accumulator: DistributionAccumulator): ReadonlyArray<number> => {
                return accumulator.ascendingValues();
            }
        );
    };

/**
 * Creates a collector that finishes with the scaled median absolute deviation.
 *
 * The default constant `1.4826` is the asymptotic normal consistency factor, so
 * the value is comparable with a standard deviation only in large samples.
 *
 * @param constant - The consistency constant; defaults to `1.4826`.
 * @returns A collector that finishes with the deviation.
 * @throws {RangeError} If the constant is not positive and finite.
 */
export let useSynchronousMedianAbsoluteDeviation: (constant?: number) => SynchronousCollector<number, DistributionAccumulator, Optional<number>> =
    (constant: number = 1.4826): SynchronousCollector<number, DistributionAccumulator, Optional<number>> => {
        if (!isNumber(constant) || constant <= 0) {
            throw new RangeError("Median absolute deviation constant must be positive.");
        }
        return SynchronousCollector.full<number, DistributionAccumulator, Optional<number>>(
            (): DistributionAccumulator => new DistributionAccumulator(),
            (accumulator: DistributionAccumulator, element: number): DistributionAccumulator => {
                accumulator.accept(element);
                return accumulator;
            },
            (accumulator: DistributionAccumulator): Optional<number> => {
                return optionalDistributionValue(medianAbsoluteDeviationOf(accumulator.ascendingValues(), constant));
            }
        );
    };

/**
 * Creates a collector that finishes with robust-summary data.
 *
 * The summary keeps the unscaled deviation so that a caller can apply a
 * different consistency constant later, and it keeps the resolved trim and fence
 * options so that the derived queries do not silently fall back to other
 * defaults.
 *
 * @param options - The trim fraction, trim rounding policy and fence factor.
 * @returns A collector that finishes with the robust data.
 * @throws {RangeError} If the trim fraction is outside `[0, 0.5)` or the fence
 *         factor is not positive.
 * @throws {TypeError} If the trim policy is not a supported name.
 */
export let useSynchronousRobust: (options?: RobustOptions) => SynchronousCollector<number, DistributionAccumulator, RobustData> =
    (options: RobustOptions = {}): SynchronousCollector<number, DistributionAccumulator, RobustData> => {
        let trim: number = options.trim ?? 0.1;
        if (!isNumber(trim) || trim < 0 || trim >= 0.5) {
            throw new RangeError("Trim ratio must be within [0, 0.5).");
        }
        let trimPolicy: TrimPolicy = options.trimPolicy ?? "truncate";
        if (!DISTRIBUTION_TRIM_POLICIES.includes(trimPolicy)) {
            throw new TypeError("Trim policy must be truncate or interpolate.");
        }
        let fence: number = options.fence ?? 1.5;
        if (!isNumber(fence) || fence <= 0) {
            throw new RangeError("Fence multiplier must be positive.");
        }
        return SynchronousCollector.full<number, DistributionAccumulator, RobustData>(
            (): DistributionAccumulator => new DistributionAccumulator(),
            (accumulator: DistributionAccumulator, element: number): DistributionAccumulator => {
                accumulator.accept(element);
                return accumulator;
            },
            (accumulator: DistributionAccumulator): RobustData => {
                let values: ReadonlyArray<number> = accumulator.ascendingValues();
                return {
                    values: values,
                    median: values.length === 0 ? null : medianOf(values),
                    medianAbsoluteDeviation: medianAbsoluteDeviationOf(values, 1),
                    trim: trim,
                    trimPolicy: trimPolicy,
                    fence: fence
                };
            }
        );
    };

/**
 * Creates a collector that finishes with the sample skewness.
 *
 * @param options - The estimator; defaults to the normal-unbiased `G1`.
 * @returns A collector that finishes with the skewness.
 * @throws {TypeError} If the estimator is not a supported name.
 */
export let useSynchronousSkewness: (options?: SkewnessOptions) => SynchronousCollector<number, DistributionAccumulator, Optional<number>> =
    (options: SkewnessOptions = {}): SynchronousCollector<number, DistributionAccumulator, Optional<number>> => {
        let estimator: SkewnessEstimator = options.estimator ?? "G1";
        if (!isSkewnessEstimator(estimator)) {
            throw new TypeError("Invalid skewness estimator.");
        }
        return SynchronousCollector.full<number, DistributionAccumulator, Optional<number>>(
            (): DistributionAccumulator => new DistributionAccumulator(),
            (accumulator: DistributionAccumulator, element: number): DistributionAccumulator => {
                accumulator.accept(element);
                return accumulator;
            },
            (accumulator: DistributionAccumulator): Optional<number> => {
                return skewnessOfMoment(momentDataOf(accumulator.ascendingValues()), estimator);
            }
        );
    };

/**
 * Creates a collector that finishes with the sample kurtosis.
 *
 * @param options - The estimator and whether to report the excess form.
 * @returns A collector that finishes with the kurtosis.
 * @throws {TypeError} If the estimator is not a supported name.
 */
export let useSynchronousKurtosis: (options?: KurtosisOptions) => SynchronousCollector<number, DistributionAccumulator, Optional<number>> =
    (options: KurtosisOptions = {}): SynchronousCollector<number, DistributionAccumulator, Optional<number>> => {
        let estimator: KurtosisEstimator = options.estimator ?? "G2";
        if (!isKurtosisEstimator(estimator)) {
            throw new TypeError("Invalid kurtosis estimator.");
        }
        let excess: boolean = options.excess !== false;
        return SynchronousCollector.full<number, DistributionAccumulator, Optional<number>>(
            (): DistributionAccumulator => new DistributionAccumulator(),
            (accumulator: DistributionAccumulator, element: number): DistributionAccumulator => {
                accumulator.accept(element);
                return accumulator;
            },
            (accumulator: DistributionAccumulator): Optional<number> => {
                return kurtosisOfMoment(momentDataOf(accumulator.ascendingValues()), estimator, excess);
            }
        );
    };

/**
 * Creates a collector that finishes with central-moment data.
 *
 * @returns A collector that finishes with the moment data.
 */
export let useSynchronousMoments: () => SynchronousCollector<number, DistributionAccumulator, MomentData> =
    (): SynchronousCollector<number, DistributionAccumulator, MomentData> => {
        return SynchronousCollector.full<number, DistributionAccumulator, MomentData>(
            (): DistributionAccumulator => new DistributionAccumulator(),
            (accumulator: DistributionAccumulator, element: number): DistributionAccumulator => {
                accumulator.accept(element);
                return accumulator;
            },
            (accumulator: DistributionAccumulator): MomentData => {
                return momentDataOf(accumulator.ascendingValues());
            }
        );
    };

/**
 * Creates a collector that finishes with the histogram entropy.
 *
 * When a histogram is supplied it defines the binning; otherwise the binning
 * options build one with the same defaults as the histogram factory. Reporting
 * the entropy of a different binning than the one displayed is the mistake this
 * option prevents.
 *
 * @param options - The base, the differential flag and the binning.
 * @returns A collector that finishes with the entropy in the requested unit.
 * @throws {RangeError} If the base is not positive and different from one.
 * @throws {TypeError} If the supplied histogram is not a histogram object.
 */
export let useSynchronousEntropy: (options?: DistributionEntropyOptions) => SynchronousCollector<number, DistributionAccumulator, number> =
    (options: DistributionEntropyOptions = {}): SynchronousCollector<number, DistributionAccumulator, number> => {
        let base: number = options.base ?? Math.E;
        if (!isNumber(base) || base <= 0 || base === 1) {
            throw new RangeError("Entropy base must be positive and different from one.");
        }
        let differential: boolean = options.differential === true;
        let histogram = options.histogram ?? null;
        if (histogram !== null && !isFunction(histogram.getEntropy)) {
            throw new TypeError("Entropy histogram must be a Histogram.");
        }
        let resolved: ResolvedHistogramOptions | null = histogram === null
            ? resolveHistogramOptions({
                binning: options.binning,
                closed: options.closed,
                maximumBins: options.maximumBins
            })
            : null;
        return SynchronousCollector.full<number, DistributionAccumulator, number>(
            (): DistributionAccumulator => new DistributionAccumulator(),
            (accumulator: DistributionAccumulator, element: number): DistributionAccumulator => {
                accumulator.accept(element);
                return accumulator;
            },
            (accumulator: DistributionAccumulator): number => {
                if (histogram !== null) {
                    return histogram.getEntropy({ base: base, differential: differential });
                }
                return entropyOfHistogram(
                    histogramOf(accumulator.ascendingValues(), resolved as ResolvedHistogramOptions),
                    { base: base, differential: differential }
                );
            }
        );
    };

/**
 * Creates a collector that finishes with kernel density data.
 *
 * The bandwidth is resolved when the source finishes, because the Silverman and
 * Scott rules depend on the whole sample. A boundary correction requires an
 * explicit support: inferring the support from the minimum would silently
 * change the estimate and hide the very bias the correction is meant to remove.
 *
 * @param options - The kernel, bandwidth, boundary, support and grid.
 * @returns A collector that finishes with the density data.
 * @throws {RangeError} If the bandwidth, grid, support or cut is invalid.
 * @throws {TypeError} If a kernel, rule or point has the wrong type.
 */
export let useSynchronousDensity: (options?: DensityOptions) => SynchronousCollector<number, DistributionAccumulator, DensityData> =
    (options: DensityOptions = {}): SynchronousCollector<number, DistributionAccumulator, DensityData> => {
        let resolved: ResolvedDensityOptions = resolveDensityOptions(options);
        return SynchronousCollector.full<number, DistributionAccumulator, DensityData>(
            (): DistributionAccumulator => new DistributionAccumulator(),
            (accumulator: DistributionAccumulator, element: number): DistributionAccumulator => {
                accumulator.accept(element);
                return accumulator;
            },
            (accumulator: DistributionAccumulator): DensityData => {
                return densityDataOf(accumulator.ascendingValues(), resolved);
            }
        );
    };
