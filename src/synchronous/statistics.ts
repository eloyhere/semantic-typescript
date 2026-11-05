/**
 * The synchronous statistics views: buffered, aggregate-oriented views over an
 * ordered collectable.
 *
 * This module is the home of the synchronous statistics API. The classes were
 * copied from `#semantic/synchronous/semantic` with the class names, the module
 * boundary and the documentation adapted, and `semantic` now re-exports them
 * from here so that its historical import path keeps exposing them.
 *
 * The statistical definitions are the current, settled semantics:
 *
 * - `quantile` defaults to the Hyndman–Fan type 7 (R `quantile`, NumPy
 *   `linear`, Excel `PERCENTILE.INC`); `method` selects any of the nine types.
 * - `skewness` defaults to the bias-corrected `G1` (Excel `SKEW`, pandas
 *   `skew`); `{ estimator: "g1" }` restores the biased moment ratio.
 * - `kurtosis` defaults to the bias-corrected excess `G2` (Excel `KURT`, pandas
 *   `kurt`); `{ estimator: "g2" }` restores the biased ratio and
 *   `{ excess: false }` adds three back.
 * - `variance` and `standardDeviation` divide by `n - 1`; `{ ddof: 0 }`
 *   restores the population form.
 * - every statistic returns `Optional`; undefined small-sample cases produce an
 *   empty optional: `G2` needs four observations, `G1` needs three, and the
 *   sample variance needs two.
 * - the normal-theory standard errors exist only on
 *   {@link SynchronousNumericStatistics},
 *   because rounding a real-valued standard error to a bigint would report zero
 *   for most samples.
 *
 * Ordering semantics: arithmetic aggregates are order-independent. `median`,
 * `quantile` and `interquartileRange` sort a mapped copy of the buffer, so the
 * traversal order of the source cannot change their result. `mode` keeps the
 * first value encountered on ties, and `frequency` reports first occurrences in
 * buffered traversal order, so those two observe the order established by
 * {@link SynchronousOrderedCollectable}. `group`, `groupBy`, `partition` and
 * `partitionBy` are inherited from the collectable family unchanged.
 *
 * Complexity: the ordered buffer costs O(n) memory and O(n log n) construction
 * time. Each statistic then costs O(n), except the sort-based `median`,
 * `quantile` and `interquartileRange`, which pay O(n log n), and the standard
 * errors, which are O(1) once the buffer is settled.
 *
 * @module
 */

import { useSynchronousBigIntAverage, useSynchronousBigIntMedian, useSynchronousBigIntMode, useSynchronousBigIntSummate, useSynchronousFrequency, useSynchronousNumericAverage, useSynchronousNumericMedian, useSynchronousNumericMode, useSynchronousNumericSummate } from "#semantic/synchronous/collectors";
import { isFunction } from "#semantic/guard";
import { useCompare, useToBigInt, useToNumber } from "#semantic/hook";
import { SynchronousBigIntStatisticsSymbol, SynchronousNumericStatisticsSymbol, SynchronousStatisticsSymbol } from "#semantic/symbol";
import { validate, type Comparator, type Functional, type SynchronousGenerator } from "#semantic/utility";
import { Optional } from "#semantic/optional";
import { isKurtosisEstimator, isQuantileMethod, isSkewnessEstimator, isVarianceDdof, quantileOfSorted, type KurtosisOptions, type QuantileOptions, type SkewnessOptions, type VarianceOptions } from "#semantic/mathematics/quantile";
import { SynchronousOrderedCollectable } from "#semantic/synchronous/collectable";

/**
 * Converts bigint samples to number offsets relative to the first value.
 *
 * The moment computations of the bigint views run in floating point so that
 * rounding happens exactly once, in the finisher. Anchoring every sample at
 * `data[0]` keeps the intermediate offsets as small as possible, which limits
 * the precision loss of the `Number` conversion for large bigints.
 *
 * Ordering: order-independent; the arithmetic result does not depend on the
 * position of the samples.
 * Complexity: O(n) time and O(n) extra memory for the offset array.
 *
 * @param data - The bigint samples, in any order.
 * @returns The offsets from the first sample as numbers.
 */
function bigintOffsets(data: Array<bigint>): Array<number> {
    if (data.length === 0) {
        return [];
    }
    let origin: bigint = data[0];
    return data.map((value: bigint): number => {
        let offset: bigint = value - origin;
        return Number(offset);
    });
}

/**
 * The abstract root of the buffered statistics views.
 *
 * Responsibility: defines the aggregate and distribution operations shared by
 * the bigint and number subclasses. Every statistic reads the ordered buffer
 * built once by {@link SynchronousOrderedCollectable}, so repeated calls replay the same
 * elements instead of re-running the generator. The class leaves the result
 * type open through `D`, but fixes the definition of every statistic at the
 * modern defaults: Hyndman–Fan type 7 quantiles, bias-corrected `G1` skewness,
 * bias-corrected excess `G2` kurtosis and the `n - 1` variance denominator.
 *
 * Ordering semantics: the statistics are defined on the multiset of buffered
 * values, so the traversal order is irrelevant except where a tie or a first
 * occurrence is observable: `mode` keeps the first encountered value on ties,
 * `frequency` reports keys in first-occurrence order, and `median`,
 * `quantile` and `interquartileRange` sort a mapped copy before selecting.
 *
 * Complexity: construction of the underlying buffer is O(n log n) and O(n)
 * memory; each concrete statistic is O(n), except the sort-based selections
 * (O(n log n)) and the number-only standard errors (O(1)).
 *
 * @template E - The source element type.
 * @template D - The numeric result type: `number` or `bigint`.
 */
export abstract class SynchronousStatistics<E, D extends number | bigint> extends SynchronousOrderedCollectable<E> {
    protected readonly SynchronousStatistics: symbol = SynchronousStatisticsSymbol;
    /**
     * The built-in object tag identifying this API implementation.
     */
    [Symbol.toStringTag]: string = "SynchronousStatistics";
    /**
     * Starts buffering the generator for this collectable.
     *
     * @param generator - The callback-based source to consume.
     */
    public constructor(generator: SynchronousGenerator<E>);
    /**
     * Starts buffering the generator for this collectable.
     *
     * @param generator - The callback-based source to consume.
     * @param comparator - The comparison function; defaults to the library comparator.
     */
    public constructor(generator: SynchronousGenerator<E>, comparator: Comparator<E>);
    /**
     * Starts buffering the generator for this collectable.
     *
     * @param parameter - The callback-based source to buffer.
     * @param comparator - The comparison function; defaults to the library comparator.
     */
    public constructor(parameter: SynchronousGenerator<E>, comparator?: Comparator<E>) {
        super(parameter, validate(comparator) ? comparator : useCompare);
        Object.defineProperties(this, {
            "SynchronousStatistics": {
                value: SynchronousStatisticsSymbol,
                enumerable: false,
                writable: false,
                configurable: false
            }
        });
    }
    /**
     * Iterates over the elements in this collectable traversal order.
     *
     * @returns An iterator over the collected elements.
     */
    public *[Symbol.iterator](): globalThis.Generator<E, void, undefined> {
        for (let { element } of this.buffer) {
            yield element;
        }
    }
    /**
     * Calculates the arithmetic average, returning zero for an empty source.
     *
     * Complexity: O(n) — one pass over the buffered elements.
     * Ordering: order-independent; the buffered traversal order does not affect the result.
     *
     * @returns The average; bigint division truncates towards zero.
     */
    public abstract average(): D;
    /**
     * Calculates the arithmetic average, returning zero for an empty source.
     *
     * Complexity: O(n) — one pass over the buffered elements.
     * Ordering: order-independent; the buffered traversal order does not affect the result.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns The average; bigint division truncates towards zero.
     */
    public abstract average(mapper: Functional<E, D>): D;
    /**
     * Subtracts the minimum mapped value from the maximum, returning zero when empty.
     *
     * Complexity: O(n) — scans the mapped values once for the minimum and the maximum.
     * Ordering: order-independent; only the value set matters.
     *
     * @returns The spread of the mapped values.
     */
    public abstract range(): D;
    /**
     * Subtracts the minimum mapped value from the maximum, returning zero when empty.
     *
     * Complexity: O(n) — scans the mapped values once for the minimum and the maximum.
     * Ordering: order-independent; only the value set matters.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns The spread of the mapped values.
     */
    public abstract range(mapper: Functional<E, D>): D;
    /**
     * Calculates the sample variance, dividing the squared deviations by
     * `n - 1` (Bessel's correction).
     *
     * This matches R `var`, pandas `var` and NumPy `var(ddof=1)`. Pass
     * `{ ddof: 0 }` to restore the previous population variance. An empty view,
     * or fewer than two observations when `ddof` is one, returns an empty
     * optional because the sample variance is undefined there; `ddof: 0`
     * remains defined for a single observation and returns zero.
     *
     * Complexity: O(n) — one mean pass followed by one squared-deviation pass.
     * Ordering: order-independent; only the value set matters.
     *
     * @returns The variance, rounded to an integer for bigint results, or an
     *          empty optional when it is undefined.
     */
    public abstract variance(): Optional<D>;
    /**
     * Calculates the sample variance with an explicit `ddof`; see the first
     * overload for the definition and the small-sample rule.
     *
     * Complexity: O(n) — one mean pass followed by one squared-deviation pass.
     * Ordering: order-independent; only the value set matters.
     *
     * @param options - `ddof` selects the `n - 1` denominator (default) or `n`.
     * @returns The variance, or an empty optional when it is undefined.
     */
    public abstract variance(options: VarianceOptions): Optional<D>;
    /**
     * Calculates the sample variance of mapped values; see the first overload
     * for the definition and the small-sample rule.
     *
     * Complexity: O(n) — one mean pass followed by one squared-deviation pass.
     * Ordering: order-independent; only the value set matters.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @param options - `ddof` selects the `n - 1` denominator (default) or `n`.
     * @returns The variance, or an empty optional when it is undefined.
     */
    public abstract variance(mapper: Functional<E, D>, options?: VarianceOptions): Optional<D>;
    /**
     * Calculates the sample standard deviation, the square root of the
     * `n - 1` variance.
     *
     * Pass `{ ddof: 0 }` to restore the previous population standard
     * deviation. An empty view, or fewer than two observations when `ddof` is
     * one, returns an empty optional; `ddof: 0` remains defined for a single
     * observation and returns zero. The result is slightly biased even under
     * normality because the square root is concave.
     *
     * Complexity: O(n) — computes the variance and then one square root.
     * Ordering: order-independent; only the value set matters.
     *
     * @returns The standard deviation, rounded for bigint results, or an empty
     *          optional when it is undefined.
     */
    public abstract standardDeviation(): Optional<D>;
    /**
     * Calculates the sample standard deviation with an explicit `ddof`; see the
     * first overload for the definition and the small-sample rule.
     *
     * Complexity: O(n) — computes the variance and then one square root.
     * Ordering: order-independent; only the value set matters.
     *
     * @param options - `ddof` selects the `n - 1` denominator (default) or `n`.
     * @returns The standard deviation, or an empty optional when it is undefined.
     */
    public abstract standardDeviation(options: VarianceOptions): Optional<D>;
    /**
     * Calculates the sample standard deviation of mapped values; see the first
     * overload for the definition and the small-sample rule.
     *
     * Complexity: O(n) — computes the variance and then one square root.
     * Ordering: order-independent; only the value set matters.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @param options - `ddof` selects the `n - 1` denominator (default) or `n`.
     * @returns The standard deviation, or an empty optional when it is undefined.
     */
    public abstract standardDeviation(mapper: Functional<E, D>, options?: VarianceOptions): Optional<D>;
    /**
     * Calculates the arithmetic mean using the same calculation as average.
     *
     * Complexity: O(n) — one pass over the buffered elements.
     * Ordering: order-independent; the buffered traversal order does not affect the result.
     *
     * @returns The mean, or zero when empty; bigint division truncates towards zero.
     */
    public abstract mean(): D;
    /**
     * Calculates the arithmetic mean using the same calculation as average.
     *
     * Complexity: O(n) — one pass over the buffered elements.
     * Ordering: order-independent; the buffered traversal order does not affect the result.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns The mean, or zero when empty; bigint division truncates towards zero.
     */
    public abstract mean(mapper: Functional<E, D>): D;
    /**
     * Sorts mapped values and selects the middle value or averages the two middle values.
     *
     * Complexity: O(n log n) — the mapped values are sorted before selecting the middle.
     * Ordering: computed from the ascending order statistics, so the source traversal order is irrelevant.
     *
     * @returns The median, or zero for an empty statistics view; bigint averaging truncates towards zero.
     */
    public abstract median(): D;
    /**
     * Sorts mapped values and selects the middle value or averages the two middle values.
     *
     * Complexity: O(n log n) — the mapped values are sorted before selecting the middle.
     * Ordering: computed from the ascending order statistics, so the source traversal order is irrelevant.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns The median, or zero for an empty statistics view; bigint averaging truncates towards zero.
     */
    public abstract median(mapper: Functional<E, D>): D;
    /**
     * Selects the most frequent mapped value, keeping the first encountered value on ties.
     *
     * Complexity: O(n) expected — one frequency map over the mapped values.
     * Ordering: ties keep the first mapped value encountered in buffered traversal order.
     *
     * @returns The mode, or zero when empty.
     */
    public abstract mode(): D;
    /**
     * Selects the most frequent mapped value, keeping the first encountered value on ties.
     *
     * Complexity: O(n) expected — one frequency map over the mapped values.
     * Ordering: ties keep the first mapped value encountered in buffered traversal order.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns The mode, or zero when empty.
     */
    public abstract mode(mapper: Functional<E, D>): D;
    /**
     * Counts occurrences using Map key equality.
     *
     * Complexity: O(n) — one pass while inserting into a Map.
     * Ordering: the returned Map follows the buffered traversal order of first occurrences.
     *
     * @returns A map of elements to bigint occurrence counts.
     */
    public frequency(): Map<E, bigint> {
        return useSynchronousFrequency<E>().collect(this.source());
    }
    /**
     * Adds mapped values using the library conversion when no mapper is supplied.
     *
     * Complexity: O(n) — one pass over the buffered elements.
     * Ordering: order-independent; the buffered traversal order does not affect the result.
     *
     * @returns The sum, or zero when empty.
     */
    public abstract summate(): D;
    /**
     * Adds mapped values using the library conversion when no mapper is supplied.
     *
     * Complexity: O(n) — one pass over the buffered elements.
     * Ordering: order-independent; the buffered traversal order does not affect the result.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns The sum, or zero when empty.
     */
    public abstract summate(mapper: Functional<E, D>): D;
    /**
     * Selects a sample quantile with a Hyndman–Fan type.
     *
     * The default `"type-7"` matches R `quantile`, NumPy `linear` (the
     * `np.quantile` default) and Excel `PERCENTILE.INC`. Pass
     * `{ method: "type-1" }` to restore the previous nearest-rank behaviour;
     * the remaining types are available through the same option.
     *
     * Complexity: O(n log n) — sorting the mapped values dominates; interpolation is O(1).
     * Ordering: computed from the ascending order statistics, so the source traversal order is irrelevant.
     *
     * @param probability - The finite probability from zero to one, inclusive.
     * @returns The quantile, or an empty optional for an empty statistics view.
     * @throws {RangeError} If probability is not finite or lies outside [0, 1].
     * @throws {TypeError} If the method is not one of the nine supported names.
     */
    public abstract quantile(probability: number): Optional<D>;
    /**
     * Selects a sample quantile with an explicit Hyndman–Fan type; see the
     * first overload for the default and the empty-view rule.
     *
     * Complexity: O(n log n) — sorting the mapped values dominates; interpolation is O(1).
     * Ordering: computed from the ascending order statistics, so the source traversal order is irrelevant.
     *
     * @param probability - The finite probability from zero to one, inclusive.
     * @param options - The quantile method; defaults to `{ method: "type-7" }`.
     * @returns The quantile, or an empty optional for an empty statistics view.
     */
    public abstract quantile(probability: number, options: QuantileOptions): Optional<D>;
    /**
     * Selects a sample quantile of mapped values; see the first overload for
     * the default and the empty-view rule.
     *
     * Complexity: O(n log n) — sorting the mapped values dominates; interpolation is O(1).
     * Ordering: computed from the ascending order statistics, so the source traversal order is irrelevant.
     *
     * @param probability - The finite probability from zero to one, inclusive.
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @param options - The quantile method; defaults to `{ method: "type-7" }`.
     * @returns The quantile, or an empty optional for an empty statistics view.
     */
    public abstract quantile(probability: number, mapper: Functional<E, D>, options?: QuantileOptions): Optional<D>;
    /**
     * Subtracts the first quartile from the third quartile using the same
     * Hyndman–Fan method as `quantile`.
     *
     * The default type 7 matches R and NumPy, so the fences derived from this
     * range line up with those tools. Pass `{ method }` to change the type.
     *
     * Complexity: O(n log n) — two sort-based quantile selections over the mapped values.
     * Ordering: computed from the ascending order statistics, so the source traversal order is irrelevant.
     *
     * @returns The interquartile range, or an empty optional for an empty
     *          statistics view.
     */
    public abstract interquartileRange(): Optional<D>;
    /**
     * Subtracts the first quartile from the third quartile with an explicit
     * Hyndman–Fan type; see the first overload for the default.
     *
     * Complexity: O(n log n) — two sort-based quantile selections over the mapped values.
     * Ordering: computed from the ascending order statistics, so the source traversal order is irrelevant.
     *
     * @param options - The quantile method; defaults to `{ method: "type-7" }`.
     * @returns The interquartile range, or an empty optional for an empty statistics view.
     */
    public abstract interquartileRange(options: QuantileOptions): Optional<D>;
    /**
     * Subtracts the first quartile from the third quartile of mapped values;
     * see the first overload for the default.
     *
     * Complexity: O(n log n) — two sort-based quantile selections over the mapped values.
     * Ordering: computed from the ascending order statistics, so the source traversal order is irrelevant.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @param options - The quantile method; defaults to `{ method: "type-7" }`.
     * @returns The interquartile range, or an empty optional for an empty statistics view.
     */
    public abstract interquartileRange(mapper: Functional<E, D>, options?: QuantileOptions): Optional<D>;
    /**
     * Calculates the sample skewness.
     *
     * The default `"G1"` is the bias-corrected Fisher–Pearson coefficient used
     * by Excel `SKEW`, pandas `skew` and SPSS; pass `{ estimator: "g1" }` to
     * restore the previous biased moment ratio `m3 / m2^(3 / 2)`. `G1` is
     * undefined below three observations and `g1` below two; a constant sample
     * is undefined for both. Those cases return an empty optional.
     *
     * Complexity: O(n) — three moment passes over the mapped values.
     * Ordering: order-independent; only the value set matters.
     *
     * @returns The skewness, rounded for bigint results, or an empty optional
     *          when it is undefined.
     */
    public abstract skewness(): Optional<D>;
    /**
     * Calculates the sample skewness with an explicit estimator; see the first
     * overload for the default and the small-sample rule.
     *
     * Complexity: O(n) — three moment passes over the mapped values.
     * Ordering: order-independent; only the value set matters.
     *
     * @param options - The estimator; defaults to `{ estimator: "G1" }`.
     * @returns The skewness, or an empty optional when it is undefined.
     */
    public abstract skewness(options: SkewnessOptions): Optional<D>;
    /**
     * Calculates the sample skewness of mapped values; see the first overload
     * for the default and the small-sample rule.
     *
     * Complexity: O(n) — three moment passes over the mapped values.
     * Ordering: order-independent; only the value set matters.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @param options - The estimator; defaults to `{ estimator: "G1" }`.
     * @returns The skewness, or an empty optional when it is undefined.
     */
    public abstract skewness(mapper: Functional<E, D>, options?: SkewnessOptions): Optional<D>;
    /**
     * Calculates the sample excess kurtosis.
     *
     * The default `"G2"` is the bias-corrected excess estimator used by Excel
     * `KURT` and pandas `kurt`; pass `{ estimator: "g2" }` to restore the
     * previous biased `m4 / m2^2 - 3`. `G2` is undefined below four
     * observations and `g2` below two; a constant sample is undefined for both.
     * `{ excess: false }` adds three back, reporting the non-excess fourth
     * standardised moment. Undefined cases return an empty optional.
     *
     * Complexity: O(n) — three moment passes over the mapped values.
     * Ordering: order-independent; only the value set matters.
     *
     * @returns The kurtosis, rounded for bigint results, or an empty optional
     *          when it is undefined.
     */
    public abstract kurtosis(): Optional<D>;
    /**
     * Calculates the sample kurtosis with an explicit estimator and excess
     * flag; see the first overload for the defaults and the small-sample rule.
     *
     * Complexity: O(n) — three moment passes over the mapped values.
     * Ordering: order-independent; only the value set matters.
     *
     * @param options - `estimator` defaults to `"G2"`; `excess` defaults to `true`.
     * @returns The kurtosis, or an empty optional when it is undefined.
     */
    public abstract kurtosis(options: KurtosisOptions): Optional<D>;
    /**
     * Calculates the sample kurtosis of mapped values; see the first overload
     * for the defaults and the small-sample rule.
     *
     * Complexity: O(n) — three moment passes over the mapped values.
     * Ordering: order-independent; only the value set matters.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @param options - `estimator` defaults to `"G2"`; `excess` defaults to `true`.
     * @returns The kurtosis, or an empty optional when it is undefined.
     */
    public abstract kurtosis(mapper: Functional<E, D>, options?: KurtosisOptions): Optional<D>;
};

/**
 * A buffered bigint statistics view.
 *
 * Responsibility: implements {@link SynchronousStatistics} for `bigint` results. Where an
 * integer cannot represent a statistic exactly, the result is quantised once:
 * averages truncate towards zero, and variance, standard deviation, skewness,
 * kurtosis and interpolated quantiles round to the nearest integer. The
 * normal-theory standard errors are deliberately absent because they are
 * real-valued and would round to zero for most samples.
 *
 * Ordering semantics: identical to the base contract. `median`, `quantile` and
 * `interquartileRange` sort mapped values, `mode` breaks ties by first
 * encounter, and every other statistic is order-independent.
 *
 * Complexity: the buffer is built by {@link SynchronousOrderedCollectable} in O(n log n);
 * each statistic is O(n), except `median`, `quantile` and
 * `interquartileRange`, which are O(n log n).
 *
 * @template E - The source element type.
 */
export class SynchronousBigIntStatistics<E> extends SynchronousStatistics<E, bigint> {
    protected readonly BigIntStatistics: symbol = SynchronousBigIntStatisticsSymbol;
    /**
     * The built-in object tag identifying this API implementation.
     */
    [Symbol.toStringTag]: string = "SynchronousBigIntStatistics";
    /**
     * Starts buffering the generator for this collectable.
     *
     * @param generator - The callback-based source to consume.
     */
    public constructor(generator: SynchronousGenerator<E>);
    /**
     * Starts buffering the generator for this collectable.
     *
     * @param generator - The callback-based source to consume.
     * @param comparator - The comparison function; defaults to the library comparator.
     */
    public constructor(generator: SynchronousGenerator<E>, comparator: Comparator<E>);
    /**
     * Starts buffering the generator for this collectable.
     *
     * @param parameter - The callback-based source to buffer.
     * @param comparator - The comparison function; defaults to the library comparator.
     */
    public constructor(parameter: SynchronousGenerator<E>, comparator?: Comparator<E>) {
        super(parameter, comparator || useCompare);
        Object.defineProperties(this, {
            "SynchronousBigIntStatistics": {
                value: SynchronousBigIntStatisticsSymbol,
                enumerable: false,
                writable: false,
                configurable: false
            }
        });
    }
    /**
     * Iterates over the elements in this collectable traversal order.
     *
     * @returns An iterator over the collected elements.
     */
    public *[Symbol.iterator](): globalThis.Generator<E, void, undefined> {
        for (let { element } of this.buffer) {
            yield element;
        }
    }
    /**
     * Calculates the arithmetic average, returning zero for an empty source.
     *
     * Complexity: O(n) — one pass over the buffered elements.
     * Ordering: order-independent; the buffered traversal order does not affect the result.
     *
     * @returns The average; bigint division truncates towards zero.
     */
    public average(): bigint;
    /**
     * Calculates the arithmetic average, returning zero for an empty source.
     *
     * Complexity: O(n) — one pass over the buffered elements.
     * Ordering: order-independent; the buffered traversal order does not affect the result.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns The average; bigint division truncates towards zero.
     */
    public average(mapper: Functional<E, bigint>): bigint;
    /**
     * Calculates the arithmetic average, returning zero for an empty source.
     *
     * Complexity: O(n) — one pass over the buffered elements.
     * Ordering: order-independent; the buffered traversal order does not affect the result.
     *
     * @param argument1 - The first argument selected by the overload.
     * @returns The average; bigint division truncates towards zero.
     */
    public average(argument1?: Functional<E, bigint>): bigint {
        if (this.isEmpty()) {
            return 0n;
        }
        try {
            let mapper: Functional<E, bigint> = isFunction(argument1) ? argument1 : useToBigInt;
            return useSynchronousBigIntAverage(mapper).collect(this.source());
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * Subtracts the minimum mapped value from the maximum, returning zero when empty.
     *
     * Complexity: O(n) — scans the mapped values once for the minimum and the maximum.
     * Ordering: order-independent; only the value set matters.
     *
     * @returns The spread of the mapped values.
     */
    public range(): bigint;
    /**
     * Subtracts the minimum mapped value from the maximum, returning zero when empty.
     *
     * Complexity: O(n) — scans the mapped values once for the minimum and the maximum.
     * Ordering: order-independent; only the value set matters.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns The spread of the mapped values.
     */
    public range(mapper: Functional<E, bigint>): bigint;
    /**
     * Subtracts the minimum mapped value from the maximum, returning zero when empty.
     *
     * Complexity: O(n) — scans the mapped values once for the minimum and the maximum.
     * Ordering: order-independent; only the value set matters.
     *
     * @param argument1 - The first argument selected by the overload.
     * @returns The spread of the mapped values.
     */
    public range(argument1?: Functional<E, bigint>): bigint {
        if (this.isEmpty()) {
            return 0n;
        }
        try {
            let mapper: Functional<E, bigint> = isFunction(argument1) ? argument1 : useToBigInt;
            let data: Array<bigint> = this.toArray().map(mapper);
            let minimum: bigint = data[0];
            let maximum: bigint = data[0];
            for (let value of data) {
                minimum = value < minimum ? value : minimum;
                maximum = value > maximum ? value : maximum;
            }
            return maximum - minimum;
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * Calculates the sample variance, dividing the squared deviations by
     * `n - 1` (Bessel's correction), the default of R `var`, pandas `var` and
     * NumPy `var(ddof=1)`.
     *
     * Pass `{ ddof: 0 }` to restore the previous population variance. An empty
     * view, or fewer than two observations when `ddof` is one, returns an
     * empty optional; with `ddof: 0` a single observation still has a defined
     * variance of zero.
     *
     * Complexity: O(n) — one mean pass followed by one squared-deviation pass.
     * Ordering: order-independent; only the value set matters.
     *
     * @returns The variance rounded to a bigint, or an empty optional when it
     *          is undefined.
     */
    public variance(): Optional<bigint>;
    /**
     * Calculates the sample variance with an explicit `ddof`; see the first
     * overload for the definition and the small-sample rule.
     *
     * Complexity: O(n) — one mean pass followed by one squared-deviation pass.
     * Ordering: order-independent; only the value set matters.
     *
     * @param options - `ddof` selects the `n - 1` denominator (default) or `n`.
     * @returns The variance rounded to a bigint, or an empty optional when it is undefined.
     */
    public variance(options: VarianceOptions): Optional<bigint>;
    /**
     * Calculates the sample variance of mapped values; see the first overload
     * for the definition and the small-sample rule.
     *
     * Complexity: O(n) — one mean pass followed by one squared-deviation pass.
     * Ordering: order-independent; only the value set matters.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @param options - `ddof` selects the `n - 1` denominator (default) or `n`.
     * @returns The variance rounded to a bigint, or an empty optional when it is undefined.
     */
    public variance(mapper: Functional<E, bigint>, options?: VarianceOptions): Optional<bigint>;
    /**
     * Calculates the sample variance with the selected denominator.
     *
     * Complexity: O(n) — one mean pass followed by one squared-deviation pass.
     * Ordering: order-independent; only the value set matters.
     *
     * @param argument1 - The mapper or the options selected by the overload.
     * @param argument2 - The options when the first argument is a mapper.
     * @returns The variance rounded to a bigint, or an empty optional when it is undefined.
     */
    public variance(argument1?: Functional<E, bigint> | VarianceOptions, argument2?: VarianceOptions): Optional<bigint> {
        let options: VarianceOptions = isFunction(argument1) ? (argument2 ?? {}) : (argument1 ?? {});
        let ddof: number = options.ddof ?? 1;
        if (!isVarianceDdof(ddof)) {
            throw new TypeError("Invalid ddof.");
        }
        if (this.isEmpty()) {
            return Optional.empty();
        }
        try {
            let mapper: Functional<E, bigint> = isFunction(argument1) ? argument1 : useToBigInt;
            let data: Array<bigint> = this.toArray().map((element: E): bigint => mapper(element));
            let count: number = data.length;
            if (count - ddof < 1) {
                return Optional.empty();
            }
            let offsets: Array<number> = bigintOffsets(data);
            let mean: number = offsets.reduce((total: number, value: number): number => total + value, 0) / count;
            let variance: number = offsets.reduce((total: number, value: number): number => total + Math.pow(value - mean, 2), 0) / (count - ddof);
            return Optional.of(BigInt(Math.round(variance)));
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * Calculates the sample standard deviation, the square root of the
     * `n - 1` variance.
     *
     * Pass `{ ddof: 0 }` to restore the previous population standard
     * deviation. An empty view, or fewer than two observations when `ddof` is
     * one, returns an empty optional; `ddof: 0` remains defined for a single
     * observation and returns zero.
     *
     * Complexity: O(n) — computes the variance and then one square root.
     * Ordering: order-independent; only the value set matters.
     *
     * @returns The standard deviation rounded to a bigint, or an empty
     *          optional when it is undefined.
     */
    public standardDeviation(): Optional<bigint>;
    /**
     * Calculates the sample standard deviation with an explicit `ddof`; see
     * the first overload for the definition and the small-sample rule.
     *
     * Complexity: O(n) — computes the variance and then one square root.
     * Ordering: order-independent; only the value set matters.
     *
     * @param options - `ddof` selects the `n - 1` denominator (default) or `n`.
     * @returns The standard deviation rounded to a bigint, or an empty optional when it is undefined.
     */
    public standardDeviation(options: VarianceOptions): Optional<bigint>;
    /**
     * Calculates the sample standard deviation of mapped values; see the first
     * overload for the definition and the small-sample rule.
     *
     * Complexity: O(n) — computes the variance and then one square root.
     * Ordering: order-independent; only the value set matters.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @param options - `ddof` selects the `n - 1` denominator (default) or `n`.
     * @returns The standard deviation rounded to a bigint, or an empty optional when it is undefined.
     */
    public standardDeviation(mapper: Functional<E, bigint>, options?: VarianceOptions): Optional<bigint>;
    /**
     * Calculates the sample standard deviation with the selected denominator.
     *
     * Complexity: O(n) — computes the variance and then one square root.
     * Ordering: order-independent; only the value set matters.
     *
     * @param argument1 - The mapper or the options selected by the overload.
     * @param argument2 - The options when the first argument is a mapper.
     * @returns The standard deviation rounded to a bigint, or an empty optional when it is undefined.
     */
    public standardDeviation(argument1?: Functional<E, bigint> | VarianceOptions, argument2?: VarianceOptions): Optional<bigint> {
        let options: VarianceOptions = isFunction(argument1) ? (argument2 ?? {}) : (argument1 ?? {});
        let ddof: number = options.ddof ?? 1;
        if (!isVarianceDdof(ddof)) {
            throw new TypeError("Invalid ddof.");
        }
        if (this.isEmpty()) {
            return Optional.empty();
        }
        try {
            let mapper: Functional<E, bigint> = isFunction(argument1) ? argument1 : useToBigInt;
            let data: Array<bigint> = this.toArray().map((element: E): bigint => mapper(element));
            let count: number = data.length;
            if (count - ddof < 1) {
                return Optional.empty();
            }
            let offsets: Array<number> = bigintOffsets(data);
            let mean: number = offsets.reduce((total: number, value: number): number => total + value, 0) / count;
            let variance: number = offsets.reduce((total: number, value: number): number => total + Math.pow(value - mean, 2), 0) / (count - ddof);
            return Optional.of(BigInt(Math.round(Math.sqrt(variance))));
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * Calculates the arithmetic mean using the same calculation as average.
     *
     * Complexity: O(n) — one pass over the buffered elements.
     * Ordering: order-independent; the buffered traversal order does not affect the result.
     *
     * @returns The mean, or zero when empty; bigint division truncates towards zero.
     */
    public mean(): bigint;
    /**
     * Calculates the arithmetic mean using the same calculation as average.
     *
     * Complexity: O(n) — one pass over the buffered elements.
     * Ordering: order-independent; the buffered traversal order does not affect the result.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns The mean, or zero when empty; bigint division truncates towards zero.
     */
    public mean(mapper: Functional<E, bigint>): bigint;
    /**
     * Calculates the arithmetic mean using the same calculation as average.
     *
     * Complexity: O(n) — one pass over the buffered elements.
     * Ordering: order-independent; the buffered traversal order does not affect the result.
     *
     * @param argument1 - The first argument selected by the overload.
     * @returns The mean, or zero when empty; bigint division truncates towards zero.
     */
    public mean(argument1?: Functional<E, bigint>): bigint {
        if (this.isEmpty()) {
            return 0n;
        }
        try {
            let mapper: Functional<E, bigint> = isFunction(argument1) ? argument1 : useToBigInt;
            return useSynchronousBigIntAverage(mapper).collect(this.source());
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * Sorts mapped values and selects the middle value or averages the two middle values.
     *
     * Complexity: O(n log n) — the mapped values are sorted before selecting the middle.
     * Ordering: computed from the ascending order statistics, so the source traversal order is irrelevant.
     *
     * @returns The median, or zero for an empty statistics view; bigint averaging truncates towards zero.
     */
    public median(): bigint;
    /**
     * Sorts mapped values and selects the middle value or averages the two middle values.
     *
     * Complexity: O(n log n) — the mapped values are sorted before selecting the middle.
     * Ordering: computed from the ascending order statistics, so the source traversal order is irrelevant.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns The median, or zero for an empty statistics view; bigint averaging truncates towards zero.
     */
    public median(mapper: Functional<E, bigint>): bigint;
    /**
     * Sorts mapped values and selects the middle value or averages the two middle values.
     *
     * Complexity: O(n log n) — the mapped values are sorted before selecting the middle.
     * Ordering: computed from the ascending order statistics, so the source traversal order is irrelevant.
     *
     * @param argument1 - The first argument selected by the overload.
     * @returns The median, or zero for an empty statistics view; bigint averaging truncates towards zero.
     */
    public median(argument1?: Functional<E, bigint>): bigint {
        if (this.isEmpty()) {
            return 0n;
        }
        try {
            let mapper: Functional<E, bigint> = isFunction(argument1) ? argument1 : useToBigInt;
            return useSynchronousBigIntMedian(mapper).collect(this.source());
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * Selects the most frequent mapped value, keeping the first encountered value on ties.
     *
     * Complexity: O(n) expected — one frequency map over the mapped values.
     * Ordering: ties keep the first mapped value encountered in buffered traversal order.
     *
     * @returns The mode, or zero when empty.
     */
    public mode(): bigint;
    /**
     * Selects the most frequent mapped value, keeping the first encountered value on ties.
     *
     * Complexity: O(n) expected — one frequency map over the mapped values.
     * Ordering: ties keep the first mapped value encountered in buffered traversal order.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns The mode, or zero when empty.
     */
    public mode(mapper: Functional<E, bigint>): bigint;
    /**
     * Selects the most frequent mapped value, keeping the first encountered value on ties.
     *
     * Complexity: O(n) expected — one frequency map over the mapped values.
     * Ordering: ties keep the first mapped value encountered in buffered traversal order.
     *
     * @param argument1 - The first argument selected by the overload.
     * @returns The mode, or zero when empty.
     */
    public mode(argument1?: Functional<E, bigint>): bigint {
        if (this.isEmpty()) {
            return 0n;
        }
        try {
            let mapper: Functional<E, bigint> = isFunction(argument1) ? argument1 : useToBigInt;
            return useSynchronousBigIntMode(mapper).collect(this.source());
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * Adds mapped values using the library conversion when no mapper is supplied.
     *
     * Complexity: O(n) — one pass over the buffered elements.
     * Ordering: order-independent; the buffered traversal order does not affect the result.
     *
     * @returns The sum, or zero when empty.
     */
    public summate(): bigint;
    /**
     * Adds mapped values using the library conversion when no mapper is supplied.
     *
     * Complexity: O(n) — one pass over the buffered elements.
     * Ordering: order-independent; the buffered traversal order does not affect the result.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns The sum, or zero when empty.
     */
    public summate(mapper: Functional<E, bigint>): bigint;
    /**
     * Adds mapped values using the library conversion when no mapper is supplied.
     *
     * Complexity: O(n) — one pass over the buffered elements.
     * Ordering: order-independent; the buffered traversal order does not affect the result.
     *
     * @param argument1 - The first argument selected by the overload.
     * @returns The sum, or zero when empty.
     */
    public summate(argument1?: Functional<E, bigint>): bigint {
        if (this.isEmpty()) {
            return 0n;
        }
        try {
            let mapper: Functional<E, bigint> = isFunction(argument1) ? argument1 : useToBigInt;
            return useSynchronousBigIntSummate(mapper).collect(this.source() as SynchronousGenerator<bigint>);
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * Selects a sample quantile with a Hyndman–Fan type.
     *
     * The default `"type-7"` matches R `quantile`, NumPy `linear` and Excel
     * `PERCENTILE.INC`; pass `{ method: "type-1" }` to restore the previous
     * nearest-rank behaviour. Interpolated types round the interpolated offset
     * to the nearest bigint, while types 1–3 select an exact order statistic.
     *
     * Complexity: O(n log n) — sorting the mapped values dominates; interpolation is O(1).
     * Ordering: computed from the ascending order statistics, so the source traversal order is irrelevant.
     *
     * @param probability - The finite probability from zero to one, inclusive.
     * @returns The quantile, or an empty optional for an empty statistics view.
     * @throws {RangeError} If probability is not finite or lies outside [0, 1].
     * @throws {TypeError} If the method is not one of the nine supported names.
     */
    public quantile(probability: number): Optional<bigint>;
    /**
     * Selects a sample quantile with an explicit Hyndman–Fan type; see the
     * first overload for the default and the empty-view rule.
     *
     * Complexity: O(n log n) — sorting the mapped values dominates; interpolation is O(1).
     * Ordering: computed from the ascending order statistics, so the source traversal order is irrelevant.
     *
     * @param probability - The finite probability from zero to one, inclusive.
     * @param options - The quantile method; defaults to `{ method: "type-7" }`.
     * @returns The quantile, or an empty optional for an empty statistics view.
     */
    public quantile(probability: number, options: QuantileOptions): Optional<bigint>;
    /**
     * Selects a sample quantile of mapped values; see the first overload for
     * the default and the empty-view rule.
     *
     * Complexity: O(n log n) — sorting the mapped values dominates; interpolation is O(1).
     * Ordering: computed from the ascending order statistics, so the source traversal order is irrelevant.
     *
     * @param probability - The finite probability from zero to one, inclusive.
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @param options - The quantile method; defaults to `{ method: "type-7" }`.
     * @returns The quantile, or an empty optional for an empty statistics view.
     */
    public quantile(probability: number, mapper: Functional<E, bigint>, options?: QuantileOptions): Optional<bigint>;
    /**
     * Selects a sample quantile with the selected Hyndman–Fan type.
     *
     * Complexity: O(n log n) — sorting the mapped values dominates; interpolation is O(1).
     * Ordering: computed from the ascending order statistics, so the source traversal order is irrelevant.
     *
     * @param probability - The finite probability from zero to one, inclusive.
     * @param argument1 - The mapper or the options selected by the overload.
     * @param argument2 - The options when the first argument is a mapper.
     * @returns The quantile, or an empty optional for an empty statistics view.
     */
    public quantile(probability: number, argument1?: Functional<E, bigint> | QuantileOptions, argument2?: QuantileOptions): Optional<bigint> {
        if (!Number.isFinite(probability) || probability < 0 || probability > 1) {
            throw new RangeError("Invalid quantile.");
        }
        let options: QuantileOptions = isFunction(argument1) ? (argument2 ?? {}) : (argument1 ?? {});
        let method = options.method ?? "type-7";
        if (!isQuantileMethod(method)) {
            throw new TypeError("Invalid quantile method.");
        }
        if (this.isEmpty()) {
            return Optional.empty();
        }
        try {
            let mapper: Functional<E, bigint> = isFunction(argument1) ? argument1 : useToBigInt;
            let data: Array<bigint> = this.toArray().map(mapper).sort(useCompare);
            let offsets: Array<number> = bigintOffsets(data);
            let offset: number = quantileOfSorted(offsets, probability, method);
            return Optional.of(data[0] + BigInt(Math.round(offset)));
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * Subtracts the first quartile from the third quartile using the same
     * Hyndman–Fan method as `quantile`.
     *
     * The default type 7 matches R and NumPy. Because bigint quantiles are
     * rounded, the range is the difference of the two rounded quartiles.
     *
     * Complexity: O(n log n) — two sort-based quantile selections over the mapped values.
     * Ordering: computed from the ascending order statistics, so the source traversal order is irrelevant.
     *
     * @returns The interquartile range, or an empty optional for an empty
     *          statistics view.
     */
    public interquartileRange(): Optional<bigint>;
    /**
     * Subtracts the first quartile from the third quartile with an explicit
     * Hyndman–Fan type; see the first overload for the default.
     *
     * Complexity: O(n log n) — two sort-based quantile selections over the mapped values.
     * Ordering: computed from the ascending order statistics, so the source traversal order is irrelevant.
     *
     * @param options - The quantile method; defaults to `{ method: "type-7" }`.
     * @returns The interquartile range, or an empty optional for an empty statistics view.
     */
    public interquartileRange(options: QuantileOptions): Optional<bigint>;
    /**
     * Subtracts the first quartile from the third quartile of mapped values;
     * see the first overload for the default.
     *
     * Complexity: O(n log n) — two sort-based quantile selections over the mapped values.
     * Ordering: computed from the ascending order statistics, so the source traversal order is irrelevant.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @param options - The quantile method; defaults to `{ method: "type-7" }`.
     * @returns The interquartile range, or an empty optional for an empty statistics view.
     */
    public interquartileRange(mapper: Functional<E, bigint>, options?: QuantileOptions): Optional<bigint>;
    /**
     * Subtracts the first quartile from the third quartile.
     *
     * Complexity: O(n log n) — two sort-based quantile selections over the mapped values.
     * Ordering: computed from the ascending order statistics, so the source traversal order is irrelevant.
     *
     * @param argument1 - The mapper or the options selected by the overload.
     * @param argument2 - The options when the first argument is a mapper.
     * @returns The interquartile range, or an empty optional for an empty statistics view.
     */
    public interquartileRange(argument1?: Functional<E, bigint> | QuantileOptions, argument2?: QuantileOptions): Optional<bigint> {
        let options: QuantileOptions = isFunction(argument1) ? (argument2 ?? {}) : (argument1 ?? {});
        let method = options.method ?? "type-7";
        if (!isQuantileMethod(method)) {
            throw new TypeError("Invalid quantile method.");
        }
        try {
            let mapper: Functional<E, bigint> = isFunction(argument1) ? argument1 : useToBigInt;
            let lower: Optional<bigint> = this.quantile(0.25, mapper, options);
            let upper: Optional<bigint> = this.quantile(0.75, mapper, options);
            if (lower.isEmpty() || upper.isEmpty()) {
                return Optional.empty();
            }
            return Optional.of(upper.get() - lower.get());
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * Calculates the sample skewness.
     *
     * The default `"G1"` is the bias-corrected Fisher–Pearson coefficient used
     * by Excel `SKEW`, pandas `skew` and SPSS; pass `{ estimator: "g1" }` to
     * restore the previous biased moment ratio `m3 / m2^(3 / 2)`. `G1` is
     * undefined below three observations and `g1` below two; a constant sample
     * is undefined for both. Those cases return an empty optional.
     *
     * Complexity: O(n) — three moment passes over the mapped values.
     * Ordering: order-independent; only the value set matters.
     *
     * @returns The skewness rounded to a bigint, or an empty optional when it
     *          is undefined.
     */
    public skewness(): Optional<bigint>;
    /**
     * Calculates the sample skewness with an explicit estimator; see the first
     * overload for the default and the small-sample rule.
     *
     * Complexity: O(n) — three moment passes over the mapped values.
     * Ordering: order-independent; only the value set matters.
     *
     * @param options - The estimator; defaults to `{ estimator: "G1" }`.
     * @returns The skewness rounded to a bigint, or an empty optional when it is undefined.
     */
    public skewness(options: SkewnessOptions): Optional<bigint>;
    /**
     * Calculates the sample skewness of mapped values; see the first overload
     * for the default and the small-sample rule.
     *
     * Complexity: O(n) — three moment passes over the mapped values.
     * Ordering: order-independent; only the value set matters.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @param options - The estimator; defaults to `{ estimator: "G1" }`.
     * @returns The skewness rounded to a bigint, or an empty optional when it is undefined.
     */
    public skewness(mapper: Functional<E, bigint>, options?: SkewnessOptions): Optional<bigint>;
    /**
     * Calculates the sample skewness with the selected estimator.
     *
     * Complexity: O(n) — three moment passes over the mapped values.
     * Ordering: order-independent; only the value set matters.
     *
     * @param argument1 - The mapper or the options selected by the overload.
     * @param argument2 - The options when the first argument is a mapper.
     * @returns The skewness rounded to a bigint, or an empty optional when it is undefined.
     */
    public skewness(argument1?: Functional<E, bigint> | SkewnessOptions, argument2?: SkewnessOptions): Optional<bigint> {
        let options: SkewnessOptions = isFunction(argument1) ? (argument2 ?? {}) : (argument1 ?? {});
        let estimator = options.estimator ?? "G1";
        if (!isSkewnessEstimator(estimator)) {
            throw new TypeError("Invalid skewness estimator.");
        }
        if (this.isEmpty()) {
            return Optional.empty();
        }
        try {
            let mapper: Functional<E, bigint> = isFunction(argument1) ? argument1 : useToBigInt;
            let data: Array<bigint> = this.toArray().map((element: E): bigint => mapper(element));
            let count: number = data.length;
            if (estimator === "G1" ? count < 3 : count < 2) {
                return Optional.empty();
            }
            let offsets: Array<number> = bigintOffsets(data);
            let mean: number = offsets.reduce((total: number, value: number): number => total + value, 0) / count;
            let second: number = offsets.reduce((total: number, value: number): number => total + Math.pow(value - mean, 2), 0) / count;
            if (second === 0) {
                return Optional.empty();
            }
            let third: number = offsets.reduce((total: number, value: number): number => total + Math.pow(value - mean, 3), 0) / count;
            let g1: number = third / Math.pow(second, 1.5);
            let skewness: number = estimator === "G1" ? Math.sqrt(count * (count - 1)) / (count - 2) * g1 : g1;
            return Optional.of(BigInt(Math.round(skewness)));
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * Calculates the sample excess kurtosis.
     *
     * The default `"G2"` is the bias-corrected excess estimator used by Excel
     * `KURT` and pandas `kurt`; pass `{ estimator: "g2" }` to restore the
     * previous biased `m4 / m2^2 - 3`. `G2` is undefined below four
     * observations and `g2` below two; a constant sample is undefined for both.
     * `{ excess: false }` adds three back, reporting the non-excess fourth
     * standardised moment. Undefined cases return an empty optional.
     *
     * Complexity: O(n) — three moment passes over the mapped values.
     * Ordering: order-independent; only the value set matters.
     *
     * @returns The kurtosis rounded to a bigint, or an empty optional when it
     *          is undefined.
     */
    public kurtosis(): Optional<bigint>;
    /**
     * Calculates the sample kurtosis with an explicit estimator and excess
     * flag; see the first overload for the defaults and the small-sample rule.
     *
     * Complexity: O(n) — three moment passes over the mapped values.
     * Ordering: order-independent; only the value set matters.
     *
     * @param options - `estimator` defaults to `"G2"`; `excess` defaults to `true`.
     * @returns The kurtosis rounded to a bigint, or an empty optional when it is undefined.
     */
    public kurtosis(options: KurtosisOptions): Optional<bigint>;
    /**
     * Calculates the sample kurtosis of mapped values; see the first overload
     * for the defaults and the small-sample rule.
     *
     * Complexity: O(n) — three moment passes over the mapped values.
     * Ordering: order-independent; only the value set matters.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @param options - `estimator` defaults to `"G2"`; `excess` defaults to `true`.
     * @returns The kurtosis rounded to a bigint, or an empty optional when it is undefined.
     */
    public kurtosis(mapper: Functional<E, bigint>, options?: KurtosisOptions): Optional<bigint>;
    /**
     * Calculates the sample kurtosis with the selected estimator and excess
     * flag.
     *
     * Complexity: O(n) — three moment passes over the mapped values.
     * Ordering: order-independent; only the value set matters.
     *
     * @param argument1 - The mapper or the options selected by the overload.
     * @param argument2 - The options when the first argument is a mapper.
     * @returns The kurtosis rounded to a bigint, or an empty optional when it is undefined.
     */
    public kurtosis(argument1?: Functional<E, bigint> | KurtosisOptions, argument2?: KurtosisOptions): Optional<bigint> {
        let options: KurtosisOptions = isFunction(argument1) ? (argument2 ?? {}) : (argument1 ?? {});
        let estimator = options.estimator ?? "G2";
        let excess: boolean = options.excess ?? true;
        if (!isKurtosisEstimator(estimator)) {
            throw new TypeError("Invalid kurtosis estimator.");
        }
        if (this.isEmpty()) {
            return Optional.empty();
        }
        try {
            let mapper: Functional<E, bigint> = isFunction(argument1) ? argument1 : useToBigInt;
            let data: Array<bigint> = this.toArray().map((element: E): bigint => mapper(element));
            let count: number = data.length;
            if (estimator === "G2" ? count < 4 : count < 2) {
                return Optional.empty();
            }
            let offsets: Array<number> = bigintOffsets(data);
            let mean: number = offsets.reduce((total: number, value: number): number => total + value, 0) / count;
            let second: number = offsets.reduce((total: number, value: number): number => total + Math.pow(value - mean, 2), 0) / count;
            if (second === 0) {
                return Optional.empty();
            }
            let fourth: number = offsets.reduce((total: number, value: number): number => total + Math.pow(value - mean, 4), 0) / count;
            let g2: number = fourth / Math.pow(second, 2) - 3;
            let kurtosis: number = estimator === "G2" ? ((count - 1) / ((count - 2) * (count - 3))) * ((count + 1) * g2 + 6) : g2;
            return Optional.of(BigInt(Math.round(excess ? kurtosis : kurtosis + 3)));
        }
        catch (error) {
            throw error;
        }
    }
};

/**
 * A buffered number statistics view.
 *
 * Responsibility: implements {@link SynchronousStatistics} for `number` results without
 * rounding, and adds the normal-theory standard errors of the reported
 * skewness and kurtosis. The two-pass variance keeps the computation clear of
 * the catastrophic cancellation of the `sum(x^2) - sum(x)^2 / n` form.
 *
 * Ordering semantics: identical to the base contract. `median`, `quantile` and
 * `interquartileRange` sort mapped values, `mode` breaks ties by first
 * encounter, and every other statistic is order-independent.
 *
 * Complexity: the buffer is built by {@link SynchronousOrderedCollectable} in O(n log n);
 * each statistic is O(n), except `median`, `quantile` and
 * `interquartileRange`, which are O(n log n), and the two standard errors,
 * which are O(1).
 *
 * @template E - The source element type.
 */
export class SynchronousNumericStatistics<E> extends SynchronousStatistics<E, number> {
    protected readonly SynchronousNumericStatistics: symbol = SynchronousNumericStatisticsSymbol;
    /**
     * The built-in object tag identifying this API implementation.
     */
    [Symbol.toStringTag]: string = "SynchronousNumericStatistics";
    /**
     * Starts buffering the generator for this collectable.
     *
     * @param generator - The callback-based source to consume.
     */
    public constructor(generator: SynchronousGenerator<E>);
    /**
     * Starts buffering the generator for this collectable.
     *
     * @param generator - The callback-based source to consume.
     * @param comparator - The comparison function; defaults to the library comparator.
     */
    public constructor(generator: SynchronousGenerator<E>, comparator: Comparator<E>);
    /**
     * Starts buffering the generator for this collectable.
     *
     * @param parameter - The callback-based source to buffer.
     * @param comparator - The comparison function; defaults to the library comparator.
     */
    public constructor(parameter: SynchronousGenerator<E>, comparator?: Comparator<E>) {
        super(parameter, comparator || useCompare);
        Object.defineProperties(this, {
            "SynchronousNumericStatistics": {
                value: SynchronousNumericStatisticsSymbol,
                enumerable: false,
                writable: false,
                configurable: false
            }
        });
    }
    /**
     * Iterates over the elements in this collectable traversal order.
     *
     * @returns An iterator over the collected elements.
     */
    public *[Symbol.iterator](): globalThis.Generator<E, void, undefined> {
        for (let { element } of this.buffer) {
            yield element;
        }
    }
    /**
     * Calculates the arithmetic average, returning zero for an empty source.
     *
     * Complexity: O(n) — one pass over the buffered elements.
     * Ordering: order-independent; the buffered traversal order does not affect the result.
     *
     * @returns The arithmetic average, or zero when empty.
     */
    public average(): number;
    /**
     * Calculates the arithmetic average, returning zero for an empty source.
     *
     * Complexity: O(n) — one pass over the buffered elements.
     * Ordering: order-independent; the buffered traversal order does not affect the result.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns The arithmetic average, or zero when empty.
     */
    public average(mapper: Functional<E, number>): number;
    /**
     * Calculates the arithmetic average, returning zero for an empty source.
     *
     * Complexity: O(n) — one pass over the buffered elements.
     * Ordering: order-independent; the buffered traversal order does not affect the result.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns The arithmetic average, or zero when empty.
     */
    public average(mapper?: Functional<E, number>): number {
        if (this.isEmpty()) {
            return 0;
        }
        try {
            if (isFunction(mapper)) {
                return useSynchronousNumericAverage(mapper).collect(this.source() as SynchronousGenerator<number>);
            }
            return useSynchronousNumericAverage().collect(this.source());
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * Subtracts the minimum mapped value from the maximum, returning zero when empty.
     *
     * Complexity: O(n) — scans the mapped values once for the minimum and the maximum.
     * Ordering: order-independent; only the value set matters.
     *
     * @returns The spread of the mapped values.
     */
    public range(): number;
    /**
     * Subtracts the minimum mapped value from the maximum, returning zero when empty.
     *
     * Complexity: O(n) — scans the mapped values once for the minimum and the maximum.
     * Ordering: order-independent; only the value set matters.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns The spread of the mapped values.
     */
    public range(mapper: Functional<E, number>): number;
    /**
     * Subtracts the minimum mapped value from the maximum, returning zero when empty.
     *
     * Complexity: O(n) — scans the mapped values once for the minimum and the maximum.
     * Ordering: order-independent; only the value set matters.
     *
     * @param argument1 - The first argument selected by the overload.
     * @returns The spread of the mapped values.
     */
    public range(argument1?: Functional<E, number>): number {
        if (this.isEmpty()) {
            return 0;
        }
        try {
            if (this.count() === 1n) {
                return 0;
            }
            let mapper: Functional<E, number> = isFunction(argument1) ? argument1 : useToNumber;
            let data: Array<number> = this.toArray().map(mapper);
            let minimum: number = data[0];
            let maximum: number = data[0];
            for (let value of data) {
                minimum = Math.min(minimum, value);
                maximum = Math.max(maximum, value);
            }
            return maximum - minimum;
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * Calculates the sample variance, dividing the squared deviations by
     * `n - 1` (Bessel's correction), the default of R `var`, pandas `var` and
     * NumPy `var(ddof=1)`.
     *
     * Pass `{ ddof: 0 }` to restore the previous population variance. An empty
     * view, or fewer than two observations when `ddof` is one, returns an
     * empty optional; with `ddof: 0` a single observation still has a defined
     * variance of zero. The two-pass computation avoids the catastrophic
     * cancellation of the `sum(x^2) - sum(x)^2 / n` form.
     *
     * Complexity: O(n) — one mean pass followed by one squared-deviation pass.
     * Ordering: order-independent; only the value set matters.
     *
     * @returns The variance, or an empty optional when it is undefined.
     */
    public variance(): Optional<number>;
    /**
     * Calculates the sample variance with an explicit `ddof`; see the first
     * overload for the definition and the small-sample rule.
     *
     * Complexity: O(n) — one mean pass followed by one squared-deviation pass.
     * Ordering: order-independent; only the value set matters.
     *
     * @param options - `ddof` selects the `n - 1` denominator (default) or `n`.
     * @returns The variance, or an empty optional when it is undefined.
     */
    public variance(options: VarianceOptions): Optional<number>;
    /**
     * Calculates the sample variance of mapped values; see the first overload
     * for the definition and the small-sample rule.
     *
     * Complexity: O(n) — one mean pass followed by one squared-deviation pass.
     * Ordering: order-independent; only the value set matters.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @param options - `ddof` selects the `n - 1` denominator (default) or `n`.
     * @returns The variance, or an empty optional when it is undefined.
     */
    public variance(mapper: Functional<E, number>, options?: VarianceOptions): Optional<number>;
    /**
     * Calculates the sample variance with the selected denominator.
     *
     * Complexity: O(n) — one mean pass followed by one squared-deviation pass.
     * Ordering: order-independent; only the value set matters.
     *
     * @param argument1 - The mapper or the options selected by the overload.
     * @param argument2 - The options when the first argument is a mapper.
     * @returns The variance, or an empty optional when it is undefined.
     */
    public variance(argument1?: Functional<E, number> | VarianceOptions, argument2?: VarianceOptions): Optional<number> {
        let options: VarianceOptions = isFunction(argument1) ? (argument2 ?? {}) : (argument1 ?? {});
        let ddof: number = options.ddof ?? 1;
        if (!isVarianceDdof(ddof)) {
            throw new TypeError("Invalid ddof.");
        }
        if (this.isEmpty()) {
            return Optional.empty();
        }
        try {
            let mapper: Functional<E, number> = isFunction(argument1) ? argument1 : useToNumber;
            let data: Array<number> = this.toArray().map(mapper);
            let count: number = data.length;
            if (count - ddof < 1) {
                return Optional.empty();
            }
            let mean: number = data.reduce((total: number, value: number): number => total + value, 0) / count;
            let summate: number = data.reduce((total: number, value: number): number => total + Math.pow(value - mean, 2), 0);
            return Optional.of(summate / (count - ddof));
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * Calculates the sample standard deviation, the square root of the
     * `n - 1` variance.
     *
     * Pass `{ ddof: 0 }` to restore the previous population standard
     * deviation. An empty view, or fewer than two observations when `ddof` is
     * one, returns an empty optional; `ddof: 0` remains defined for a single
     * observation and returns zero. The result is slightly biased even under
     * normality because the square root is concave.
     *
     * Complexity: O(n) — computes the variance and then one square root.
     * Ordering: order-independent; only the value set matters.
     *
     * @returns The standard deviation, or an empty optional when it is undefined.
     */
    public standardDeviation(): Optional<number>;
    /**
     * Calculates the sample standard deviation with an explicit `ddof`; see
     * the first overload for the definition and the small-sample rule.
     *
     * Complexity: O(n) — computes the variance and then one square root.
     * Ordering: order-independent; only the value set matters.
     *
     * @param options - `ddof` selects the `n - 1` denominator (default) or `n`.
     * @returns The standard deviation, or an empty optional when it is undefined.
     */
    public standardDeviation(options: VarianceOptions): Optional<number>;
    /**
     * Calculates the sample standard deviation of mapped values; see the first
     * overload for the definition and the small-sample rule.
     *
     * Complexity: O(n) — computes the variance and then one square root.
     * Ordering: order-independent; only the value set matters.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @param options - `ddof` selects the `n - 1` denominator (default) or `n`.
     * @returns The standard deviation, or an empty optional when it is undefined.
     */
    public standardDeviation(mapper: Functional<E, number>, options?: VarianceOptions): Optional<number>;
    /**
     * Calculates the sample standard deviation with the selected denominator.
     *
     * Complexity: O(n) — computes the variance and then one square root.
     * Ordering: order-independent; only the value set matters.
     *
     * @param argument1 - The mapper or the options selected by the overload.
     * @param argument2 - The options when the first argument is a mapper.
     * @returns The standard deviation, or an empty optional when it is undefined.
     */
    public standardDeviation(argument1?: Functional<E, number> | VarianceOptions, argument2?: VarianceOptions): Optional<number> {
        let options: VarianceOptions = isFunction(argument1) ? (argument2 ?? {}) : (argument1 ?? {});
        let ddof: number = options.ddof ?? 1;
        if (!isVarianceDdof(ddof)) {
            throw new TypeError("Invalid ddof.");
        }
        if (this.isEmpty()) {
            return Optional.empty();
        }
        try {
            let mapper: Functional<E, number> = isFunction(argument1) ? argument1 : useToNumber;
            let data: Array<number> = this.toArray().map(mapper);
            let count: number = data.length;
            if (count - ddof < 1) {
                return Optional.empty();
            }
            let mean: number = data.reduce((total: number, value: number): number => total + value, 0) / count;
            let summate: number = data.reduce((total: number, value: number): number => total + Math.pow(value - mean, 2), 0);
            return Optional.of(Math.sqrt(summate / (count - ddof)));
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * Calculates the arithmetic mean using the same calculation as average.
     *
     * Complexity: O(n) — one pass over the buffered elements.
     * Ordering: order-independent; the buffered traversal order does not affect the result.
     *
     * @returns The mean, or zero when empty.
     */
    public mean(): number;
    /**
     * Calculates the arithmetic mean using the same calculation as average.
     *
     * Complexity: O(n) — one pass over the buffered elements.
     * Ordering: order-independent; the buffered traversal order does not affect the result.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns The mean, or zero when empty.
     */
    public mean(mapper: Functional<E, number>): number;
    /**
     * Calculates the arithmetic mean using the same calculation as average.
     *
     * Complexity: O(n) — one pass over the buffered elements.
     * Ordering: order-independent; the buffered traversal order does not affect the result.
     *
     * @param argument1 - The first argument selected by the overload.
     * @returns The mean, or zero when empty.
     */
    public mean(argument1?: Functional<E, number>): number {
        if (this.isEmpty()) {
            return 0;
        }
        try {
            let mapper: Functional<E, number> = isFunction(argument1) ? argument1 : useToNumber;
            return useSynchronousNumericAverage(mapper).collect(this.source() as SynchronousGenerator<number>);
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * Sorts mapped values and selects the middle value or averages the two middle values.
     *
     * Complexity: O(n log n) — the mapped values are sorted before selecting the middle.
     * Ordering: computed from the ascending order statistics, so the source traversal order is irrelevant.
     *
     * @returns The median, or zero for an empty statistics view.
     */
    public median(): number;
    /**
     * Sorts mapped values and selects the middle value or averages the two middle values.
     *
     * Complexity: O(n log n) — the mapped values are sorted before selecting the middle.
     * Ordering: computed from the ascending order statistics, so the source traversal order is irrelevant.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns The median, or zero for an empty statistics view.
     */
    public median(mapper: Functional<E, number>): number;
    /**
     * Sorts mapped values and selects the middle value or averages the two middle values.
     *
     * Complexity: O(n log n) — the mapped values are sorted before selecting the middle.
     * Ordering: computed from the ascending order statistics, so the source traversal order is irrelevant.
     *
     * @param argument1 - The first argument selected by the overload.
     * @returns The median, or zero for an empty statistics view.
     */
    public median(argument1?: Functional<E, number>): number {
        if (this.isEmpty()) {
            return 0;
        }
        try {
            let mapper: Functional<E, number> = isFunction(argument1) ? argument1 : useToNumber;
            return useSynchronousNumericMedian(mapper).collect(this.source());
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * Selects the most frequent mapped value, keeping the first encountered value on ties.
     *
     * Complexity: O(n) expected — one frequency map over the mapped values.
     * Ordering: ties keep the first mapped value encountered in buffered traversal order.
     *
     * @returns The mode, or zero when empty.
     */
    public mode(): number;
    /**
     * Selects the most frequent mapped value, keeping the first encountered value on ties.
     *
     * Complexity: O(n) expected — one frequency map over the mapped values.
     * Ordering: ties keep the first mapped value encountered in buffered traversal order.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns The mode, or zero when empty.
     */
    public mode(mapper: Functional<E, number>): number;
    /**
     * Selects the most frequent mapped value, keeping the first encountered value on ties.
     *
     * Complexity: O(n) expected — one frequency map over the mapped values.
     * Ordering: ties keep the first mapped value encountered in buffered traversal order.
     *
     * @param argument1 - The first argument selected by the overload.
     * @returns The mode, or zero when empty.
     */
    public mode(argument1?: Functional<E, number>): number {
        if (this.isEmpty()) {
            return 0;
        }
        try {
            let mapper: Functional<E, number> = isFunction(argument1) ? argument1 : useToNumber;
            return useSynchronousNumericMode(mapper).collect(this.source());
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * Adds mapped values using the library conversion when no mapper is supplied.
     *
     * Complexity: O(n) — one pass over the buffered elements.
     * Ordering: order-independent; the buffered traversal order does not affect the result.
     *
     * @returns The sum, or zero when empty.
     */
    public summate(): number;
    /**
     * Adds mapped values using the library conversion when no mapper is supplied.
     *
     * Complexity: O(n) — one pass over the buffered elements.
     * Ordering: order-independent; the buffered traversal order does not affect the result.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns The sum, or zero when empty.
     */
    public summate(mapper: Functional<E, number>): number;
    /**
     * Adds mapped values using the library conversion when no mapper is supplied.
     *
     * Complexity: O(n) — one pass over the buffered elements.
     * Ordering: order-independent; the buffered traversal order does not affect the result.
     *
     * @param argument1 - The first argument selected by the overload.
     * @returns The sum, or zero when empty.
     */
    public summate(argument1?: Functional<E, number>): number {
        if (this.isEmpty()) {
            return 0;
        }
        try {
            let mapper: Functional<E, number> = isFunction(argument1) ? argument1 : useToNumber;
            return useSynchronousNumericSummate(mapper).collect(this.source() as SynchronousGenerator<number>);
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * Selects a sample quantile with a Hyndman–Fan type.
     *
     * The default `"type-7"` matches R `quantile`, NumPy `linear` (the
     * `np.quantile` default) and Excel `PERCENTILE.INC`. Pass
     * `{ method: "type-1" }` to restore the previous nearest-rank behaviour;
     * the remaining types are available through the same option.
     *
     * Complexity: O(n log n) — sorting the mapped values dominates; interpolation is O(1).
     * Ordering: computed from the ascending order statistics, so the source traversal order is irrelevant.
     *
     * @param probability - The finite probability from zero to one, inclusive.
     * @returns The quantile, or an empty optional for an empty statistics view.
     * @throws {RangeError} If probability is not finite or lies outside [0, 1].
     * @throws {TypeError} If the method is not one of the nine supported names.
     */
    public quantile(probability: number): Optional<number>;
    /**
     * Selects a sample quantile with an explicit Hyndman–Fan type; see the
     * first overload for the default and the empty-view rule.
     *
     * Complexity: O(n log n) — sorting the mapped values dominates; interpolation is O(1).
     * Ordering: computed from the ascending order statistics, so the source traversal order is irrelevant.
     *
     * @param probability - The finite probability from zero to one, inclusive.
     * @param options - The quantile method; defaults to `{ method: "type-7" }`.
     * @returns The quantile, or an empty optional for an empty statistics view.
     */
    public quantile(probability: number, options: QuantileOptions): Optional<number>;
    /**
     * Selects a sample quantile of mapped values; see the first overload for
     * the default and the empty-view rule.
     *
     * Complexity: O(n log n) — sorting the mapped values dominates; interpolation is O(1).
     * Ordering: computed from the ascending order statistics, so the source traversal order is irrelevant.
     *
     * @param probability - The finite probability from zero to one, inclusive.
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @param options - The quantile method; defaults to `{ method: "type-7" }`.
     * @returns The quantile, or an empty optional for an empty statistics view.
     */
    public quantile(probability: number, mapper: Functional<E, number>, options?: QuantileOptions): Optional<number>;
    /**
     * Selects a sample quantile with the selected Hyndman–Fan type.
     *
     * Complexity: O(n log n) — sorting the mapped values dominates; interpolation is O(1).
     * Ordering: computed from the ascending order statistics, so the source traversal order is irrelevant.
     *
     * @param probability - The finite probability from zero to one, inclusive.
     * @param argument1 - The mapper or the options selected by the overload.
     * @param argument2 - The options when the first argument is a mapper.
     * @returns The quantile, or an empty optional for an empty statistics view.
     */
    public quantile(probability: number, argument1?: Functional<E, number> | QuantileOptions, argument2?: QuantileOptions): Optional<number> {
        if (!Number.isFinite(probability) || probability < 0 || probability > 1) {
            throw new RangeError("Invalid quantile.");
        }
        let options: QuantileOptions = isFunction(argument1) ? (argument2 ?? {}) : (argument1 ?? {});
        let method = options.method ?? "type-7";
        if (!isQuantileMethod(method)) {
            throw new TypeError("Invalid quantile method.");
        }
        if (this.isEmpty()) {
            return Optional.empty();
        }
        try {
            let mapper: Functional<E, number> = isFunction(argument1) ? argument1 : useToNumber;
            let data: Array<number> = this.toArray().map(mapper).sort(useCompare);
            return Optional.of(quantileOfSorted(data, probability, method));
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * Subtracts the first quartile from the third quartile using the same
     * Hyndman–Fan method as `quantile`.
     *
     * The default type 7 matches R and NumPy, so the fences derived from this
     * range line up with those tools. Pass `{ method }` to change the type.
     *
     * Complexity: O(n log n) — two sort-based quantile selections over the mapped values.
     * Ordering: computed from the ascending order statistics, so the source traversal order is irrelevant.
     *
     * @returns The interquartile range, or an empty optional for an empty
     *          statistics view.
     */
    public interquartileRange(): Optional<number>;
    /**
     * Subtracts the first quartile from the third quartile with an explicit
     * Hyndman–Fan type; see the first overload for the default.
     *
     * Complexity: O(n log n) — two sort-based quantile selections over the mapped values.
     * Ordering: computed from the ascending order statistics, so the source traversal order is irrelevant.
     *
     * @param options - The quantile method; defaults to `{ method: "type-7" }`.
     * @returns The interquartile range, or an empty optional for an empty statistics view.
     */
    public interquartileRange(options: QuantileOptions): Optional<number>;
    /**
     * Subtracts the first quartile from the third quartile of mapped values;
     * see the first overload for the default.
     *
     * Complexity: O(n log n) — two sort-based quantile selections over the mapped values.
     * Ordering: computed from the ascending order statistics, so the source traversal order is irrelevant.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @param options - The quantile method; defaults to `{ method: "type-7" }`.
     * @returns The interquartile range, or an empty optional for an empty statistics view.
     */
    public interquartileRange(mapper: Functional<E, number>, options?: QuantileOptions): Optional<number>;
    /**
     * Subtracts the first quartile from the third quartile.
     *
     * Complexity: O(n log n) — two sort-based quantile selections over the mapped values.
     * Ordering: computed from the ascending order statistics, so the source traversal order is irrelevant.
     *
     * @param argument1 - The mapper or the options selected by the overload.
     * @param argument2 - The options when the first argument is a mapper.
     * @returns The interquartile range, or an empty optional for an empty statistics view.
     */
    public interquartileRange(argument1?: Functional<E, number> | QuantileOptions, argument2?: QuantileOptions): Optional<number> {
        let options: QuantileOptions = isFunction(argument1) ? (argument2 ?? {}) : (argument1 ?? {});
        let method = options.method ?? "type-7";
        if (!isQuantileMethod(method)) {
            throw new TypeError("Invalid quantile method.");
        }
        try {
            let mapper: Functional<E, number> = isFunction(argument1) ? argument1 : useToNumber;
            let lower: Optional<number> = this.quantile(0.25, mapper, options);
            let upper: Optional<number> = this.quantile(0.75, mapper, options);
            if (lower.isEmpty() || upper.isEmpty()) {
                return Optional.empty();
            }
            return Optional.of(upper.get() - lower.get());
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * Calculates the sample skewness.
     *
     * The default `"G1"` is the bias-corrected Fisher–Pearson coefficient used
     * by Excel `SKEW`, pandas `skew` and SPSS; pass `{ estimator: "g1" }` to
     * restore the previous biased moment ratio `m3 / m2^(3 / 2)`. `G1` is
     * undefined below three observations and `g1` below two; a constant sample
     * is undefined for both. Those cases return an empty optional.
     *
     * Complexity: O(n) — three moment passes over the mapped values.
     * Ordering: order-independent; only the value set matters.
     *
     * @returns The skewness, or an empty optional when it is undefined.
     */
    public skewness(): Optional<number>;
    /**
     * Calculates the sample skewness with an explicit estimator; see the first
     * overload for the default and the small-sample rule.
     *
     * Complexity: O(n) — three moment passes over the mapped values.
     * Ordering: order-independent; only the value set matters.
     *
     * @param options - The estimator; defaults to `{ estimator: "G1" }`.
     * @returns The skewness, or an empty optional when it is undefined.
     */
    public skewness(options: SkewnessOptions): Optional<number>;
    /**
     * Calculates the sample skewness of mapped values; see the first overload
     * for the default and the small-sample rule.
     *
     * Complexity: O(n) — three moment passes over the mapped values.
     * Ordering: order-independent; only the value set matters.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @param options - The estimator; defaults to `{ estimator: "G1" }`.
     * @returns The skewness, or an empty optional when it is undefined.
     */
    public skewness(mapper: Functional<E, number>, options?: SkewnessOptions): Optional<number>;
    /**
     * Calculates the sample skewness with the selected estimator.
     *
     * Complexity: O(n) — three moment passes over the mapped values.
     * Ordering: order-independent; only the value set matters.
     *
     * @param argument1 - The mapper or the options selected by the overload.
     * @param argument2 - The options when the first argument is a mapper.
     * @returns The skewness, or an empty optional when it is undefined.
     */
    public skewness(argument1?: Functional<E, number> | SkewnessOptions, argument2?: SkewnessOptions): Optional<number> {
        let options: SkewnessOptions = isFunction(argument1) ? (argument2 ?? {}) : (argument1 ?? {});
        let estimator = options.estimator ?? "G1";
        if (!isSkewnessEstimator(estimator)) {
            throw new TypeError("Invalid skewness estimator.");
        }
        if (this.isEmpty()) {
            return Optional.empty();
        }
        try {
            let mapper: Functional<E, number> = isFunction(argument1) ? argument1 : useToNumber;
            let data: Array<number> = this.toArray().map((element: E): number => mapper(element));
            let count: number = data.length;
            if (estimator === "G1" ? count < 3 : count < 2) {
                return Optional.empty();
            }
            let mean: number = data.reduce((total: number, value: number): number => total + value, 0) / count;
            let second: number = data.reduce((total: number, value: number): number => total + Math.pow(value - mean, 2), 0) / count;
            if (second === 0) {
                return Optional.empty();
            }
            let third: number = data.reduce((total: number, value: number): number => total + Math.pow(value - mean, 3), 0) / count;
            let g1: number = third / Math.pow(second, 1.5);
            return Optional.of(estimator === "G1" ? Math.sqrt(count * (count - 1)) / (count - 2) * g1 : g1);
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * Calculates the sample excess kurtosis.
     *
     * The default `"G2"` is the bias-corrected excess estimator used by Excel
     * `KURT` and pandas `kurt`; pass `{ estimator: "g2" }` to restore the
     * previous biased `m4 / m2^2 - 3`. `G2` is undefined below four
     * observations and `g2` below two; a constant sample is undefined for both.
     * `{ excess: false }` adds three back, reporting the non-excess fourth
     * standardised moment. Undefined cases return an empty optional.
     *
     * Complexity: O(n) — three moment passes over the mapped values.
     * Ordering: order-independent; only the value set matters.
     *
     * @returns The kurtosis, or an empty optional when it is undefined.
     */
    public kurtosis(): Optional<number>;
    /**
     * Calculates the sample kurtosis with an explicit estimator and excess
     * flag; see the first overload for the defaults and the small-sample rule.
     *
     * Complexity: O(n) — three moment passes over the mapped values.
     * Ordering: order-independent; only the value set matters.
     *
     * @param options - `estimator` defaults to `"G2"`; `excess` defaults to `true`.
     * @returns The kurtosis, or an empty optional when it is undefined.
     */
    public kurtosis(options: KurtosisOptions): Optional<number>;
    /**
     * Calculates the sample kurtosis of mapped values; see the first overload
     * for the defaults and the small-sample rule.
     *
     * Complexity: O(n) — three moment passes over the mapped values.
     * Ordering: order-independent; only the value set matters.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @param options - `estimator` defaults to `"G2"`; `excess` defaults to `true`.
     * @returns The kurtosis, or an empty optional when it is undefined.
     */
    public kurtosis(mapper: Functional<E, number>, options?: KurtosisOptions): Optional<number>;
    /**
     * Calculates the sample kurtosis with the selected estimator and excess
     * flag.
     *
     * Complexity: O(n) — three moment passes over the mapped values.
     * Ordering: order-independent; only the value set matters.
     *
     * @param argument1 - The mapper or the options selected by the overload.
     * @param argument2 - The options when the first argument is a mapper.
     * @returns The kurtosis, or an empty optional when it is undefined.
     */
    public kurtosis(argument1?: Functional<E, number> | KurtosisOptions, argument2?: KurtosisOptions): Optional<number> {
        let options: KurtosisOptions = isFunction(argument1) ? (argument2 ?? {}) : (argument1 ?? {});
        let estimator = options.estimator ?? "G2";
        let excess: boolean = options.excess ?? true;
        if (!isKurtosisEstimator(estimator)) {
            throw new TypeError("Invalid kurtosis estimator.");
        }
        if (this.isEmpty()) {
            return Optional.empty();
        }
        try {
            let mapper: Functional<E, number> = isFunction(argument1) ? argument1 : useToNumber;
            let data: Array<number> = this.toArray().map((element: E): number => mapper(element));
            let count: number = data.length;
            if (estimator === "G2" ? count < 4 : count < 2) {
                return Optional.empty();
            }
            let mean: number = data.reduce((total: number, value: number): number => total + value, 0) / count;
            let second: number = data.reduce((total: number, value: number): number => total + Math.pow(value - mean, 2), 0) / count;
            if (second === 0) {
                return Optional.empty();
            }
            let fourth: number = data.reduce((total: number, value: number): number => total + Math.pow(value - mean, 4), 0) / count;
            let g2: number = fourth / Math.pow(second, 2) - 3;
            let kurtosis: number = estimator === "G2" ? ((count - 1) / ((count - 2) * (count - 3))) * ((count + 1) * g2 + 6) : g2;
            return Optional.of(excess ? kurtosis : kurtosis + 3);
        }
        catch (error) {
            throw error;
        }
    }
    /**
     * Calculates the normal-theory standard error of the reported skewness.
     *
     * The closed form is `sqrt(6n(n - 1) / ((n - 2)(n + 1)(n + 3)))`, the
     * standard error used by SAS, SPSS and `e1071::skewness` for `G1`; the
     * asymptotic counterpart for `g1` is `sqrt(6 / n)`. It requires at least
     * three observations, because the `n - 2` factor is in the denominator.
     * The bigint views omit this method: a standard error is real-valued, and
     * rounding it to an integer would report zero for most samples.
     *
     * Complexity: O(1) — reads the buffered element count; no second traversal.
     * Ordering: order-independent; only the sample size matters.
     *
     * @returns The standard error, or an empty optional when it is undefined.
     */
    public skewnessStandardError(): Optional<number> {
        if (this.isEmpty()) {
            return Optional.empty();
        }
        let count: number = Number(this.count());
        if (count < 3) {
            return Optional.empty();
        }
        return Optional.of(Math.sqrt(6 * count * (count - 1) / ((count - 2) * (count + 1) * (count + 3))));
    }
    /**
     * Calculates the normal-theory standard error of the reported kurtosis.
     *
     * The closed form is
     * `sqrt(24n(n - 1)^2 / ((n - 3)(n - 2)(n + 3)(n + 5)))`, the standard
     * error used by SAS, SPSS and `e1071::kurtosis` for `G2`; the asymptotic
     * counterpart for `g2` is `sqrt(24 / n)`. It requires at least four
     * observations, because the `n - 3` factor is in the denominator.
     *
     * Complexity: O(1) — reads the buffered element count; no second traversal.
     * Ordering: order-independent; only the sample size matters.
     *
     * @returns The standard error, or an empty optional when it is undefined.
     */
    public kurtosisStandardError(): Optional<number> {
        if (this.isEmpty()) {
            return Optional.empty();
        }
        let count: number = Number(this.count());
        if (count < 4) {
            return Optional.empty();
        }
        return Optional.of(Math.sqrt(24 * count * Math.pow(count - 1, 2) / ((count - 3) * (count - 2) * (count + 3) * (count + 5))));
    }
};
