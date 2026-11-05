/**
 * Asynchronous distribution collectors.
 *
 * The statistical kernels are shared with the synchronous factories, so both paths
 * agree on rules, defaults, closures and bin conventions; only how the sample is
 * accumulated differs.
 */
import type { Optional } from "#semantic/optional";
import { AsynchronousCollector } from "#semantic/asynchronous/collector";
import { DistributionAccumulator, useSynchronousDensity, useSynchronousEmpiricalDistribution, useSynchronousEntropy, useSynchronousHistogram, useSynchronousKurtosis, useSynchronousMedianAbsoluteDeviation, useSynchronousMoments, useSynchronousQuantile, useSynchronousRobust, useSynchronousSkewness } from "#semantic/synchronous/collectors/index";
import type { DensityData, DensityOptions, DistributionEntropyOptions, HistogramData, HistogramOptions, KurtosisOptions, MomentData, QuantileOptions, RobustData, RobustOptions, SkewnessOptions } from "#semantic/synchronous/distribution";

/* ------------------------------------------------------------------------- */
/* Distribution analysis                                                     */
/* ------------------------------------------------------------------------- */

/**
 * Creates an asynchronous collector that finishes with histogram data.
 *
 * The accumulation is asynchronous, while the binning kernel is shared with the
 * synchronous factory so the two paths cannot drift apart in their rules,
 * defaults or closure conventions. Bin edges are chosen when the source
 * finishes, because Freedman–Diaconis needs an interquartile range and Doane
 * needs a skewness, both of which depend on the whole sample.
 *
 * Complexity: O(n log n) to sort and O(n + k) to count.
 *
 * @param options - The binning rule, closure and bin cap.
 * @returns A collector that finishes with the histogram data.
 * @throws {TypeError} If a rule, closure or edge is invalid.
 * @throws {RangeError} If the edges or the bin cap are invalid.
 */
export let useAsynchronousHistogram: (options?: HistogramOptions) => AsynchronousCollector<number, DistributionAccumulator, HistogramData> =
    (options: HistogramOptions = {}): AsynchronousCollector<number, DistributionAccumulator, HistogramData> => {
        let strategy = useSynchronousHistogram(options);
        return AsynchronousCollector.full<number, DistributionAccumulator, HistogramData>(
            (): DistributionAccumulator => new DistributionAccumulator(),
            (accumulator: DistributionAccumulator, element: number): DistributionAccumulator => {
                accumulator.accept(element);
                return accumulator;
            },
            strategy.getFinisher()
        );
    };

/**
 * Creates an asynchronous collector that finishes with one quantile.
 *
 * The probability and interpolation type are validated when the collector is
 * created, and the quantile definition itself is the shared Hyndman–Fan
 * selector, so types 1–3 stay step functions and types 4–9 interpolate.
 *
 * @param probability - The probability in `[0, 1]`.
 * @param options - The interpolation type; defaults to `"type-7"`.
 * @returns A collector that finishes with the quantile.
 * @throws {RangeError} If the probability is outside `[0, 1]`.
 * @throws {TypeError} If the probability or method has the wrong type.
 */
export let useAsynchronousQuantile: (probability: number, options?: QuantileOptions) => AsynchronousCollector<number, DistributionAccumulator, Optional<number>> =
    (probability: number, options: QuantileOptions = {}): AsynchronousCollector<number, DistributionAccumulator, Optional<number>> => {
        let strategy = useSynchronousQuantile(probability, options);
        return AsynchronousCollector.full<number, DistributionAccumulator, Optional<number>>(
            (): DistributionAccumulator => new DistributionAccumulator(),
            (accumulator: DistributionAccumulator, element: number): DistributionAccumulator => {
                accumulator.accept(element);
                return accumulator;
            },
            strategy.getFinisher()
        );
    };

/**
 * Creates an asynchronous collector that finishes with ascending order
 * statistics.
 *
 * @returns A collector that finishes with the ascending observations.
 */
export let useAsynchronousEmpiricalDistribution: () => AsynchronousCollector<number, DistributionAccumulator, ReadonlyArray<number>> =
    (): AsynchronousCollector<number, DistributionAccumulator, ReadonlyArray<number>> => {
        let strategy = useSynchronousEmpiricalDistribution();
        return AsynchronousCollector.full<number, DistributionAccumulator, ReadonlyArray<number>>(
            (): DistributionAccumulator => new DistributionAccumulator(),
            (accumulator: DistributionAccumulator, element: number): DistributionAccumulator => {
                accumulator.accept(element);
                return accumulator;
            },
            strategy.getFinisher()
        );
    };

/**
 * Creates an asynchronous collector that finishes with the scaled median
 * absolute deviation.
 *
 * @param constant - The consistency constant; defaults to `1.4826`.
 * @returns A collector that finishes with the deviation.
 * @throws {RangeError} If the constant is not positive and finite.
 */
export let useAsynchronousMedianAbsoluteDeviation: (constant?: number) => AsynchronousCollector<number, DistributionAccumulator, Optional<number>> =
    (constant: number = 1.4826): AsynchronousCollector<number, DistributionAccumulator, Optional<number>> => {
        let strategy = useSynchronousMedianAbsoluteDeviation(constant);
        return AsynchronousCollector.full<number, DistributionAccumulator, Optional<number>>(
            (): DistributionAccumulator => new DistributionAccumulator(),
            (accumulator: DistributionAccumulator, element: number): DistributionAccumulator => {
                accumulator.accept(element);
                return accumulator;
            },
            strategy.getFinisher()
        );
    };

/**
 * Creates an asynchronous collector that finishes with robust-summary data.
 *
 * @param options - The trim fraction, trim rounding policy and fence factor.
 * @returns A collector that finishes with the robust data.
 * @throws {RangeError} If the trim fraction is outside `[0, 0.5)` or the fence
 *         factor is not positive.
 * @throws {TypeError} If the trim policy is not a supported name.
 */
export let useAsynchronousRobust: (options?: RobustOptions) => AsynchronousCollector<number, DistributionAccumulator, RobustData> =
    (options: RobustOptions = {}): AsynchronousCollector<number, DistributionAccumulator, RobustData> => {
        let strategy = useSynchronousRobust(options);
        return AsynchronousCollector.full<number, DistributionAccumulator, RobustData>(
            (): DistributionAccumulator => new DistributionAccumulator(),
            (accumulator: DistributionAccumulator, element: number): DistributionAccumulator => {
                accumulator.accept(element);
                return accumulator;
            },
            strategy.getFinisher()
        );
    };

/**
 * Creates an asynchronous collector that finishes with the sample skewness.
 *
 * @param options - The estimator; defaults to the normal-unbiased `G1`.
 * @returns A collector that finishes with the skewness.
 * @throws {TypeError} If the estimator is not a supported name.
 */
export let useAsynchronousSkewness: (options?: SkewnessOptions) => AsynchronousCollector<number, DistributionAccumulator, Optional<number>> =
    (options: SkewnessOptions = {}): AsynchronousCollector<number, DistributionAccumulator, Optional<number>> => {
        let strategy = useSynchronousSkewness(options);
        return AsynchronousCollector.full<number, DistributionAccumulator, Optional<number>>(
            (): DistributionAccumulator => new DistributionAccumulator(),
            (accumulator: DistributionAccumulator, element: number): DistributionAccumulator => {
                accumulator.accept(element);
                return accumulator;
            },
            strategy.getFinisher()
        );
    };

/**
 * Creates an asynchronous collector that finishes with the sample kurtosis.
 *
 * @param options - The estimator and whether to report the excess form.
 * @returns A collector that finishes with the kurtosis.
 * @throws {TypeError} If the estimator is not a supported name.
 */
export let useAsynchronousKurtosis: (options?: KurtosisOptions) => AsynchronousCollector<number, DistributionAccumulator, Optional<number>> =
    (options: KurtosisOptions = {}): AsynchronousCollector<number, DistributionAccumulator, Optional<number>> => {
        let strategy = useSynchronousKurtosis(options);
        return AsynchronousCollector.full<number, DistributionAccumulator, Optional<number>>(
            (): DistributionAccumulator => new DistributionAccumulator(),
            (accumulator: DistributionAccumulator, element: number): DistributionAccumulator => {
                accumulator.accept(element);
                return accumulator;
            },
            strategy.getFinisher()
        );
    };

/**
 * Creates an asynchronous collector that finishes with central-moment data.
 *
 * @returns A collector that finishes with the moment data.
 */
export let useAsynchronousMoments: () => AsynchronousCollector<number, DistributionAccumulator, MomentData> =
    (): AsynchronousCollector<number, DistributionAccumulator, MomentData> => {
        let strategy = useSynchronousMoments();
        return AsynchronousCollector.full<number, DistributionAccumulator, MomentData>(
            (): DistributionAccumulator => new DistributionAccumulator(),
            (accumulator: DistributionAccumulator, element: number): DistributionAccumulator => {
                accumulator.accept(element);
                return accumulator;
            },
            strategy.getFinisher()
        );
    };

/**
 * Creates an asynchronous collector that finishes with the histogram entropy.
 *
 * @param options - The base, the differential flag and the binning.
 * @returns A collector that finishes with the entropy in the requested unit.
 * @throws {RangeError} If the base is not positive and different from one.
 * @throws {TypeError} If the supplied histogram is not a histogram object.
 */
export let useAsynchronousEntropy: (options?: DistributionEntropyOptions) => AsynchronousCollector<number, DistributionAccumulator, number> =
    (options: DistributionEntropyOptions = {}): AsynchronousCollector<number, DistributionAccumulator, number> => {
        let strategy = useSynchronousEntropy(options);
        return AsynchronousCollector.full<number, DistributionAccumulator, number>(
            (): DistributionAccumulator => new DistributionAccumulator(),
            (accumulator: DistributionAccumulator, element: number): DistributionAccumulator => {
                accumulator.accept(element);
                return accumulator;
            },
            strategy.getFinisher()
        );
    };

/**
 * Creates an asynchronous collector that finishes with kernel density data.
 *
 * @param options - The kernel, bandwidth, boundary, support and grid.
 * @returns A collector that finishes with the density data.
 * @throws {RangeError} If the bandwidth, grid, support or cut is invalid.
 * @throws {TypeError} If a kernel, rule or point has the wrong type.
 */
export let useAsynchronousDensity: (options?: DensityOptions) => AsynchronousCollector<number, DistributionAccumulator, DensityData> =
    (options: DensityOptions = {}): AsynchronousCollector<number, DistributionAccumulator, DensityData> => {
        let strategy = useSynchronousDensity(options);
        return AsynchronousCollector.full<number, DistributionAccumulator, DensityData>(
            (): DistributionAccumulator => new DistributionAccumulator(),
            (accumulator: DistributionAccumulator, element: number): DistributionAccumulator => {
                accumulator.accept(element);
                return accumulator;
            },
            strategy.getFinisher()
        );
    };
