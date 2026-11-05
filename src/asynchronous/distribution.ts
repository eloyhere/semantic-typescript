/**
 * The asynchronous distribution collectable.
 *
 * Distribution *estimation* is arithmetic over a finite sample, so this module
 * deliberately does not define a second set of value objects or a second set of
 * numeric kernels: the immutable `Histogram`, `HistogramBin`,
 * `EmpiricalDistribution`, `MomentSummary`, `RobustSummary` and
 * `DensityEstimate` types and every quantile, moment, entropy and density
 * definition are shared with `#semantic/synchronous/distribution` and
 * `#semantic/synchronous/collectors`. Only how the sample is obtained differs —
 * asynchronously here, eagerly there.
 *
 * Sharing the definitions is not a shortcut: the research this module follows
 * documents that re-deriving `g1`/`G2`, the variance denominator or a quantile
 * type in a second place is how two code paths start disagreeing about the same
 * data. The asynchronous collector factories in
 * `#semantic/asynchronous/collectors` therefore accumulate asynchronously and
 * apply the shared finishers.
 *
 * The value objects and option types are re-exported here so that a consumer of
 * the asynchronous module does not have to reach into the synchronous one.
 *
 * @module
 */

import { isIterable } from "#semantic/guard";
import {
    useAsynchronousDensity,
    useAsynchronousEmpiricalDistribution,
    useAsynchronousEntropy,
    useAsynchronousHistogram,
    useAsynchronousKurtosis,
    useAsynchronousMedianAbsoluteDeviation,
    useAsynchronousMoments,
    useAsynchronousQuantile,
    useAsynchronousRobust,
    useAsynchronousSkewness
} from "#semantic/asynchronous/collectors";
import { OrderedCollectable } from "#semantic/asynchronous/collectable";
import { Optional } from "#semantic/optional";
import { DistributionAccumulator } from "#semantic/synchronous/collectors";
import {
    DensityEstimate,
    EmpiricalDistribution,
    Histogram,
    MomentSummary,
    RobustSummary
} from "#semantic/synchronous/distribution";
import type {
    DensityOptions,
    DistributionEntropyOptions,
    HistogramOptions,
    KurtosisOptions,
    QuantileOptions,
    RobustOptions,
    SkewnessOptions
} from "#semantic/synchronous/distribution";
import type { AsynchronousGenerator, BiConsumer, BiPredicate, Consumer, Predicate } from "#semantic/utility";

export {
    DensityEstimate,
    EmpiricalDistribution,
    Histogram,
    HistogramBin,
    MomentSummary,
    RobustSummary
} from "#semantic/synchronous/distribution";
export type {
    BandwidthRule,
    BoundaryCorrection,
    DensityData,
    DensityOptions,
    DistributionEntropyOptions,
    EntropyOptions,
    HistogramBinning,
    HistogramBinData,
    HistogramClosure,
    HistogramData,
    HistogramOptions,
    HistogramRule,
    KernelName,
    KurtosisEstimator,
    KurtosisOptions,
    MomentData,
    QuantileMethod,
    QuantileOptions,
    RobustData,
    RobustOptions,
    SkewnessEstimator,
    SkewnessOptions,
    TrimPolicy,
    VarianceOptions
} from "#semantic/synchronous/distribution";

/**
 * A materialised distribution view over a finite numeric sample whose source is
 * consumed asynchronously.
 *
 * Construction starts draining the source into the inherited ordered buffer.
 * Once that buffer settles, the class builds the ascending sample that every
 * query shares, so repeated quantile, histogram, ECDF and density queries do not
 * re-consume the source. `quantile` is O(1) after the sample is ready and the
 * ECDF queries are O(log n); only methods that document otherwise cost a pass.
 *
 * The class extends the asynchronous `OrderedCollectable`, so every inherited
 * terminal operation traverses the same ascending buffer and reports the sorted
 * position as the bigint index. Unlike the synchronous collectable the instance
 * is not frozen: the base class assigns its buffer when the source settles.
 *
 * Each capability delegates to its own `useAsynchronousXxx` collector factory.
 * The accumulator is filled once from the settled buffer and the factory's
 * finisher is applied to it, which keeps the materialised and streaming paths on
 * one definition.
 *
 * @template E - The numeric source element type.
 */
export class DistributionCollectable<E extends number> extends OrderedCollectable<E> {
    /**
     * The ascending sample, resolved once the inherited buffer settles.
     */
    private readonly sample: Promise<DistributionAccumulator>;
    /**
     * The built-in object tag identifying this API implementation.
     */
    [Symbol.toStringTag]: string = "AsynchronousDistributionCollectable";
    /**
     * Starts draining the source and prepares the ascending sample.
     *
     * Non-finite values are rejected while the sample is prepared, so a query
     * that awaits the sample rejects with a `TypeError`; the source itself is
     * consumed unchanged. An empty source is legal and every scalar query then
     * reports an empty optional.
     *
     * Complexity: O(n log n) time and O(n) memory, started at construction.
     *
     * @param generator - The asynchronous callback-based source to consume.
     * @throws {TypeError} If the argument is not a generator function.
     */
    public constructor(generator: AsynchronousGenerator<E>) {
        super(generator, (left: E, right: E): number => (left as number) - (right as number));
        this.sample = this.settled().then((): DistributionAccumulator => {
            let accumulator: DistributionAccumulator = new DistributionAccumulator();
            for (let { element } of this.buffer) {
                accumulator.accept(element);
            }
            accumulator.ascendingValues();
            return accumulator;
        });
        // Observe failures immediately while preserving rejection for every query.
        void this.sample.catch((): void => {});
    }
    /**
     * Drains an async iterable and returns its distribution.
     *
     * This is the convenient constructor for an `AsyncIterable`, which is not the
     * callback-based generator the constructor accepts. The iterable is drained
     * exactly once.
     *
     * @param values - The asynchronous numeric observations.
     * @returns A promise resolving to the materialised distribution.
     * @throws {TypeError} If an element is not a finite number.
     */
    public static async use<E extends number>(values: AsyncIterable<E>): Promise<DistributionCollectable<E>> {
        let collected: Array<E> = [];
        for await (let value of values) {
            collected.push(value);
        }
        let source: AsynchronousGenerator<E> = async (accept: Consumer<E> | BiConsumer<E, bigint>, interrupt: Predicate<E> | BiPredicate<E, bigint>): Promise<void> => {
            for (let index: number = 0; index < collected.length; index++) {
                let element: E = collected[index];
                if (interrupt(element, BigInt(index))) {
                    break;
                }
                accept(element, BigInt(index));
            }
        };
        return new DistributionCollectable<E>(source);
    }
    /**
     * Returns the sample size.
     *
     * @returns A promise resolving to the buffered observation count.
     */
    public async getCount(): Promise<bigint> {
        return this.count();
    }
    /**
     * Returns the smallest observation.
     *
     * @returns A promise resolving to the minimum, or an empty optional.
     */
    public async getMinimum(): Promise<Optional<E>> {
        let accumulator: DistributionAccumulator = await this.sample;
        let ascending: ReadonlyArray<number> = accumulator.ascendingValues();
        return ascending.length === 0 ? Optional.empty<E>() : Optional.of(ascending[0] as E);
    }
    /**
     * Returns the largest observation.
     *
     * @returns A promise resolving to the maximum, or an empty optional.
     */
    public async getMaximum(): Promise<Optional<E>> {
        let accumulator: DistributionAccumulator = await this.sample;
        let ascending: ReadonlyArray<number> = accumulator.ascendingValues();
        return ascending.length === 0 ? Optional.empty<E>() : Optional.of(ascending[ascending.length - 1] as E);
    }
    /**
     * Builds a histogram.
     *
     * Defaults to the Freedman–Diaconis rule, left-closed bins and a `1000n` bin
     * cap; explicit edges take full control and values outside them are reported
     * by `Histogram.getOmitted()`.
     *
     * @param options - The binning rule, closure and bin cap.
     * @returns A promise resolving to the immutable histogram.
     * @throws {RangeError} If the edges are invalid or a derived bin count
     *         exceeds the cap.
     * @throws {TypeError} If an edge is not a finite number.
     */
    public async histogram(options: HistogramOptions = {}): Promise<Histogram> {
        return Histogram.use(useAsynchronousHistogram(options).getFinisher()(await this.sample));
    }
    /**
     * Selects a quantile.
     *
     * Defaults to the Hyndman–Fan type 7; the probability is validated rather
     * than clipped.
     *
     * @param probability - The probability in `[0, 1]`.
     * @param options - The interpolation type.
     * @returns A promise resolving to the quantile, or an empty optional.
     * @throws {RangeError} If the probability is outside `[0, 1]`.
     * @throws {TypeError} If the probability or method has the wrong type.
     */
    public async quantile(probability: number, options: QuantileOptions = {}): Promise<Optional<number>> {
        return useAsynchronousQuantile(probability, options).getFinisher()(await this.sample);
    }
    /**
     * Builds the empirical distribution function.
     *
     * The staircase exposes both `evaluate` and `leftLimit`, which is what makes
     * a Kolmogorov–Smirnov statistic complete rather than systematically small.
     *
     * @returns A promise resolving to the empirical distribution.
     */
    public async empiricalDistribution(): Promise<EmpiricalDistribution> {
        return new EmpiricalDistribution(useAsynchronousEmpiricalDistribution().getFinisher()(await this.sample));
    }
    /**
     * Returns the median absolute deviation.
     *
     * @param constant - The consistency constant; defaults to `1.4826`.
     * @returns A promise resolving to the deviation, or an empty optional.
     * @throws {RangeError} If the constant is not positive and finite.
     */
    public async medianAbsoluteDeviation(constant: number = 1.4826): Promise<Optional<number>> {
        return useAsynchronousMedianAbsoluteDeviation(constant).getFinisher()(await this.sample);
    }
    /**
     * Builds the robust-statistics summary.
     *
     * @param options - The trim fraction, trim rounding policy and fence factor.
     * @returns A promise resolving to the immutable robust summary.
     * @throws {RangeError} If the trim fraction is outside `[0, 0.5)` or the
     *         fence factor is not positive.
     */
    public async robust(options: RobustOptions = {}): Promise<RobustSummary> {
        return RobustSummary.use(useAsynchronousRobust(options).getFinisher()(await this.sample));
    }
    /**
     * Returns the sample skewness.
     *
     * @param options - The estimator; defaults to the normal-unbiased `G1`.
     * @returns A promise resolving to the skewness, or an empty optional.
     * @throws {TypeError} If the estimator is not a supported name.
     */
    public async skewness(options: SkewnessOptions = {}): Promise<Optional<number>> {
        return useAsynchronousSkewness(options).getFinisher()(await this.sample);
    }
    /**
     * Returns the sample kurtosis.
     *
     * @param options - The estimator and whether to report the excess form.
     * @returns A promise resolving to the kurtosis, or an empty optional.
     * @throws {TypeError} If the estimator is not a supported name.
     */
    public async kurtosis(options: KurtosisOptions = {}): Promise<Optional<number>> {
        return useAsynchronousKurtosis(options).getFinisher()(await this.sample);
    }
    /**
     * Returns the central moments and the shape statistics derived from them.
     *
     * @returns A promise resolving to the immutable moment summary.
     */
    public async moments(): Promise<MomentSummary> {
        return MomentSummary.use(useAsynchronousMoments().getFinisher()(await this.sample));
    }
    /**
     * Returns the Shannon entropy of a histogram of the sample.
     *
     * The plug-in estimate is negatively biased, so the binning is never inferred
     * separately from the one that is reported.
     *
     * @param options - The base, the differential flag and the binning.
     * @returns A promise resolving to the entropy in the requested unit.
     * @throws {RangeError} If the base is not positive and different from one.
     */
    public async entropy(options: DistributionEntropyOptions = {}): Promise<number> {
        return useAsynchronousEntropy(options).getFinisher()(await this.sample);
    }
    /**
     * Builds a kernel density estimate.
     *
     * Defaults to a Gaussian kernel with the Silverman bandwidth; a bounded
     * support is not inferred, because guessing it would silently change the
     * estimate.
     *
     * @param options - The kernel, bandwidth, boundary, support and grid.
     * @returns A promise resolving to the immutable density estimate.
     * @throws {RangeError} If the bandwidth, grid, support or cut is invalid.
     */
    public density(options?: DensityOptions): Promise<DensityEstimate>;
    /**
     * Builds a kernel density estimate evaluated at explicit points.
     *
     * @param points - The evaluation points that replace the automatic grid.
     * @param options - The kernel, bandwidth, boundary and support.
     * @returns A promise resolving to the immutable density estimate.
     * @throws {RangeError} If the bandwidth is invalid or a point is not finite.
     */
    public density(points: Iterable<number>, options?: DensityOptions): Promise<DensityEstimate>;
    /**
     * Builds a kernel density estimate from the overload arguments.
     *
     * @param argument1 - The options, or the explicit evaluation points.
     * @param argument2 - The options when the first argument is a point iterable.
     * @returns A promise resolving to the immutable density estimate.
     */
    public async density(argument1?: DensityOptions | Iterable<number>, argument2?: DensityOptions): Promise<DensityEstimate> {
        let options: DensityOptions;
        if (argument1 !== undefined && isIterable(argument1)) {
            options = Object.freeze({ ...(argument2 ?? {}), points: argument1 as Iterable<number> });
        }
        else {
            options = argument1 ?? argument2 ?? {};
        }
        return DensityEstimate.use(useAsynchronousDensity(options).getFinisher()(await this.sample));
    }
    /**
     * Compares the sample size and every order statistic with another
     * distribution.
     *
     * @param other - The distribution to compare with.
     * @returns A promise resolving to whether the order statistics match.
     * @throws {TypeError} If the operand is not a `DistributionCollectable`.
     */
    public async equals(other: DistributionCollectable<E>): Promise<boolean> {
        if (!(other instanceof DistributionCollectable)) {
            throw new TypeError("Distribution operand must be a DistributionCollectable.");
        }
        let left: ReadonlyArray<number> = (await this.sample).ascendingValues();
        let right: ReadonlyArray<number> = (await other.sample).ascendingValues();
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
}
