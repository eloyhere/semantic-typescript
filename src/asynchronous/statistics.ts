/**
 * The asynchronous statistics views: buffered, aggregate-oriented views over an
 * ordered collectable.
 *
 * This module is the transitional home of the asynchronous statistics API and
 * intentionally duplicates `AsynchronousStatistics`,
 * `AsynchronousBigIntStatistics` and `AsynchronousNumericStatistics` from
 * `#semantic/asynchronous/semantic`. Every preserved method body is copied from
 * that implementation with the class names, the module boundary and the
 * documentation adapted. Nothing imports this module yet, so the package entry
 * point keeps exporting the original classes until the redundant copies are
 * removed.
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
 * - the normal-theory standard errors exist only on {@link NumericStatistics},
 *   because rounding a real-valued standard error to a bigint would report zero
 *   for most samples.
 *
 * Ordering semantics: arithmetic aggregates are order-independent. `median`,
 * `quantile` and `interquartileRange` sort a mapped copy of the buffer, so the
 * traversal order of the source cannot change their result. `mode` keeps the
 * first value encountered on ties, and `frequency` reports first occurrences in
 * buffered traversal order, so those two observe the order established by
 * {@link OrderedCollectable}. `group`, `groupBy`, `partition` and
 * `partitionBy` are inherited from the collectable family unchanged.
 *
 * Complexity: the ordered buffer costs O(n) memory and O(n log n) construction
 * time. Each statistic then costs O(n), except the sort-based `median`,
 * `quantile` and `interquartileRange`, which pay O(n log n), and the standard
 * errors, which are O(1) once the buffer is settled. Every member returns a promise, because the ordered buffer settles asynchronously at construction.
 *
 * @module
 */

import { useAsynchronousBigIntAverage, useAsynchronousBigIntMedian, useAsynchronousBigIntMode, useAsynchronousBigIntSummate, useAsynchronousFrequency, useAsynchronousNumericAverage, useAsynchronousNumericMedian, useAsynchronousNumericMode, useAsynchronousNumericSummate } from "#semantic/asynchronous/collectors";
import { isFunction } from "#semantic/guard";
import { useCompare, useToBigInt, useToNumber } from "#semantic/hook";
import { AsynchronousBigIntStatisticsSymbol, AsynchronousNumericStatisticsSymbol, AsynchronousStatisticsSymbol } from "#semantic/symbol";
import { validate, type AsynchronousGenerator, type Comparator, type Functional } from "#semantic/utility";
import { Optional } from "#semantic/optional";
import { isKurtosisEstimator, isQuantileMethod, isSkewnessEstimator, isVarianceDdof, quantileOfSorted, type KurtosisOptions, type QuantileOptions, type SkewnessOptions, type VarianceOptions } from "#semantic/mathematics/quantile";
import { OrderedCollectable } from "#semantic/asynchronous/collectable";

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
 * built once by {@link OrderedCollectable}, so repeated calls replay the same
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
export abstract class Statistics<E, D extends number | bigint> extends OrderedCollectable<E> {
    protected readonly AsynchronousStatistics: symbol = AsynchronousStatisticsSymbol;
    /**
     * The built-in object tag identifying this API implementation.
     */
    [Symbol.toStringTag]: string = "AsynchronousStatistics";
    /**
     * Starts buffering the generator for this collectable.
     *
     * @param generator - The callback-based source to consume.
     */
    public constructor(generator: AsynchronousGenerator<E>);
    /**
     * Starts buffering the generator for this collectable.
     *
     * @param generator - The callback-based source to consume.
     * @param comparator - The comparison function; defaults to the library comparator.
     */
    public constructor(generator: AsynchronousGenerator<E>, comparator: Comparator<E>);
    /**
     * Starts buffering the generator for this collectable.
     *
     * @param parameter - The callback-based source to buffer.
     * @param comparator - The comparison function; defaults to the library comparator.
     */
    public constructor(parameter: AsynchronousGenerator<E>, comparator?: Comparator<E>) {
        super(parameter, validate(comparator) ? comparator : useCompare);
        Object.defineProperties(this, {
            "AsynchronousStatistics": {
                value: AsynchronousStatisticsSymbol,
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
    public async *[Symbol.asyncIterator](): globalThis.AsyncGenerator<E, void, undefined> {
        for await (let element of await this.toArray()) {
            yield element;
        }
    }
    /**
     * Calculates the arithmetic average, returning zero for an empty source.
     *
     * Complexity: O(n) — one pass over the buffered elements.
     * Ordering: order-independent; the buffered traversal order does not affect the result.
     *
     * @returns A promise resolving to the average; bigint division truncates towards zero.
     */
    public abstract average(): Promise<D>;
    /**
     * Calculates the arithmetic average, returning zero for an empty source.
     *
     * Complexity: O(n) — one pass over the buffered elements.
     * Ordering: order-independent; the buffered traversal order does not affect the result.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns A promise resolving to the average; bigint division truncates towards zero.
     */
    public abstract average(mapper: Functional<E, D>): Promise<D>;
    /**
     * Subtracts the minimum mapped value from the maximum, returning zero when empty.
     *
     * Complexity: O(n) — scans the mapped values once for the minimum and the maximum.
     * Ordering: order-independent; only the value set matters.
     *
     * @returns A promise resolving to the spread of the mapped values.
     */
    public abstract range(): Promise<D>;
    /**
     * Subtracts the minimum mapped value from the maximum, returning zero when empty.
     *
     * Complexity: O(n) — scans the mapped values once for the minimum and the maximum.
     * Ordering: order-independent; only the value set matters.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns A promise resolving to the spread of the mapped values.
     */
    public abstract range(mapper: Functional<E, D>): Promise<D>;
    /**
     * Calculates the sample variance, dividing the squared deviations by
     * `n - 1` (Bessel's correction), the default of R `var`, pandas `var` and
     * NumPy `var(ddof=1)`.
     *
     * Pass `{ ddof: 0 }` to restore the previous population variance. An empty
     * view, or fewer than two observations when `ddof` is one, resolves to an
     * empty optional because the sample variance is undefined there; `ddof: 0`
     * remains defined for a single observation and resolves to zero.
     *
     * Complexity: O(n) — one mean pass followed by one squared-deviation pass.
     * Ordering: order-independent; only the value set matters.
     *
     * @returns A promise resolving to the variance, rounded to an integer for
     *          bigint results, or an empty optional when it is undefined.
     */
    public abstract variance(): Promise<Optional<D>>;
    /**
     * Calculates the sample variance with an explicit `ddof`; see the first
     * overload for the definition and the small-sample rule.
     *
     * Complexity: O(n) — one mean pass followed by one squared-deviation pass.
     * Ordering: order-independent; only the value set matters.
     *
     * @param options - `ddof` selects the `n - 1` denominator (default) or `n`.
     * @returns A promise resolving to the variance, or an empty optional when it is undefined.
     */
    public abstract variance(options: VarianceOptions): Promise<Optional<D>>;
    /**
     * Calculates the sample variance of mapped values; see the first overload
     * for the definition and the small-sample rule.
     *
     * Complexity: O(n) — one mean pass followed by one squared-deviation pass.
     * Ordering: order-independent; only the value set matters.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @param options - `ddof` selects the `n - 1` denominator (default) or `n`.
     * @returns A promise resolving to the variance, or an empty optional when it is undefined.
     */
    public abstract variance(mapper: Functional<E, D>, options?: VarianceOptions): Promise<Optional<D>>;
    /**
     * Calculates the sample standard deviation, the square root of the
     * `n - 1` variance.
     *
     * Pass `{ ddof: 0 }` to restore the previous population standard
     * deviation. An empty view, or fewer than two observations when `ddof` is
     * one, resolves to an empty optional; `ddof: 0` remains defined for a
     * single observation and resolves to zero.
     *
     * Complexity: O(n) — computes the variance and then one square root.
     * Ordering: order-independent; only the value set matters.
     *
     * @returns A promise resolving to the standard deviation, rounded for
     *          bigint results, or an empty optional when it is undefined.
     */
    public abstract standardDeviation(): Promise<Optional<D>>;
    /**
     * Calculates the sample standard deviation with an explicit `ddof`; see
     * the first overload for the definition and the small-sample rule.
     *
     * Complexity: O(n) — computes the variance and then one square root.
     * Ordering: order-independent; only the value set matters.
     *
     * @param options - `ddof` selects the `n - 1` denominator (default) or `n`.
     * @returns A promise resolving to the standard deviation, or an empty optional when it is undefined.
     */
    public abstract standardDeviation(options: VarianceOptions): Promise<Optional<D>>;
    /**
     * Calculates the sample standard deviation of mapped values; see the first
     * overload for the definition and the small-sample rule.
     *
     * Complexity: O(n) — computes the variance and then one square root.
     * Ordering: order-independent; only the value set matters.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @param options - `ddof` selects the `n - 1` denominator (default) or `n`.
     * @returns A promise resolving to the standard deviation, or an empty optional when it is undefined.
     */
    public abstract standardDeviation(mapper: Functional<E, D>, options?: VarianceOptions): Promise<Optional<D>>;
    /**
     * Calculates the arithmetic mean using the same calculation as average.
     *
     * Complexity: O(n) — one pass over the buffered elements.
     * Ordering: order-independent; the buffered traversal order does not affect the result.
     *
     * @returns A promise resolving to the mean, or zero when empty; bigint division truncates towards zero.
     */
    public abstract mean(): Promise<D>;
    /**
     * Calculates the arithmetic mean using the same calculation as average.
     *
     * Complexity: O(n) — one pass over the buffered elements.
     * Ordering: order-independent; the buffered traversal order does not affect the result.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns A promise resolving to the mean, or zero when empty; bigint division truncates towards zero.
     */
    public abstract mean(mapper: Functional<E, D>): Promise<D>;
    /**
     * Sorts mapped values and selects the middle value or averages the two middle values.
     *
     * Complexity: O(n log n) — the mapped values are sorted before selecting the middle.
     * Ordering: computed from the ascending order statistics, so the source traversal order is irrelevant.
     *
     * @returns A promise resolving to the median, or zero for an empty statistics view; bigint averaging truncates towards zero.
     */
    public abstract median(): Promise<D>;
    /**
     * Sorts mapped values and selects the middle value or averages the two middle values.
     *
     * Complexity: O(n log n) — the mapped values are sorted before selecting the middle.
     * Ordering: computed from the ascending order statistics, so the source traversal order is irrelevant.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns A promise resolving to the median, or zero for an empty statistics view; bigint averaging truncates towards zero.
     */
    public abstract median(mapper: Functional<E, D>): Promise<D>;
    /**
     * Selects the most frequent mapped value, keeping the first encountered value on ties.
     *
     * Complexity: O(n) expected — one frequency map over the mapped values.
     * Ordering: ties keep the first mapped value encountered in buffered traversal order.
     *
     * @returns A promise resolving to the mode, or zero when empty.
     */
    public abstract mode(): Promise<D>;
    /**
     * Selects the most frequent mapped value, keeping the first encountered value on ties.
     *
     * Complexity: O(n) expected — one frequency map over the mapped values.
     * Ordering: ties keep the first mapped value encountered in buffered traversal order.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns A promise resolving to the mode, or zero when empty.
     */
    public abstract mode(mapper: Functional<E, D>): Promise<D>;
    /**
     * Counts occurrences using Map key equality.
     *
     * Complexity: O(n) — one pass while inserting into a Map.
     * Ordering: the returned Map follows the buffered traversal order of first occurrences.
     *
     * @returns A promise resolving to a map of elements to bigint occurrence counts.
     */
    public async frequency(): Promise<Map<E, bigint>> {
        return await useAsynchronousFrequency<E>().collect(this.source());
    }
    /**
     * Adds mapped values using the library conversion when no mapper is supplied.
     *
     * Complexity: O(n) — one pass over the buffered elements.
     * Ordering: order-independent; the buffered traversal order does not affect the result.
     *
     * @returns A promise resolving to the sum, or zero when empty.
     */
    public abstract summate(): Promise<D>;
    /**
     * Adds mapped values using the library conversion when no mapper is supplied.
     *
     * Complexity: O(n) — one pass over the buffered elements.
     * Ordering: order-independent; the buffered traversal order does not affect the result.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns A promise resolving to the sum, or zero when empty.
     */
    public abstract summate(mapper: Functional<E, D>): Promise<D>;
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
     * @returns A promise resolving to the quantile, or an empty optional for an
     *          empty statistics view.
     * @throws {RangeError} If probability is not finite or lies outside [0, 1].
     * @throws {TypeError} If the method is not one of the nine supported names.
     */
    public abstract quantile(probability: number): Promise<Optional<D>>;
    /**
     * Selects a sample quantile with an explicit Hyndman–Fan type; see the
     * first overload for the default and the empty-view rule.
     *
     * Complexity: O(n log n) — sorting the mapped values dominates; interpolation is O(1).
     * Ordering: computed from the ascending order statistics, so the source traversal order is irrelevant.
     *
     * @param probability - The finite probability from zero to one, inclusive.
     * @param options - The quantile method; defaults to `{ method: "type-7" }`.
     * @returns A promise resolving to the quantile, or an empty optional for an empty statistics view.
     */
    public abstract quantile(probability: number, options: QuantileOptions): Promise<Optional<D>>;
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
     * @returns A promise resolving to the quantile, or an empty optional for an empty statistics view.
     */
    public abstract quantile(probability: number, mapper: Functional<E, D>, options?: QuantileOptions): Promise<Optional<D>>;
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
     * @returns A promise resolving to the interquartile range, or an empty
     *          optional for an empty statistics view.
     */
    public abstract interquartileRange(): Promise<Optional<D>>;
    /**
     * Subtracts the first quartile from the third quartile with an explicit
     * Hyndman–Fan type; see the first overload for the default.
     *
     * Complexity: O(n log n) — two sort-based quantile selections over the mapped values.
     * Ordering: computed from the ascending order statistics, so the source traversal order is irrelevant.
     *
     * @param options - The quantile method; defaults to `{ method: "type-7" }`.
     * @returns A promise resolving to the interquartile range, or an empty optional for an empty statistics view.
     */
    public abstract interquartileRange(options: QuantileOptions): Promise<Optional<D>>;
    /**
     * Subtracts the first quartile from the third quartile of mapped values;
     * see the first overload for the default.
     *
     * Complexity: O(n log n) — two sort-based quantile selections over the mapped values.
     * Ordering: computed from the ascending order statistics, so the source traversal order is irrelevant.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @param options - The quantile method; defaults to `{ method: "type-7" }`.
     * @returns A promise resolving to the interquartile range, or an empty optional for an empty statistics view.
     */
    public abstract interquartileRange(mapper: Functional<E, D>, options?: QuantileOptions): Promise<Optional<D>>;
    /**
     * Calculates the sample skewness.
     *
     * The default `"G1"` is the bias-corrected Fisher–Pearson coefficient used
     * by Excel `SKEW`, pandas `skew` and SPSS; pass `{ estimator: "g1" }` to
     * restore the previous biased moment ratio `m3 / m2^(3 / 2)`. `G1` is
     * undefined below three observations and `g1` below two; a constant sample
     * is undefined for both. Those cases resolve to an empty optional.
     *
     * Complexity: O(n) — three moment passes over the mapped values.
     * Ordering: order-independent; only the value set matters.
     *
     * @returns A promise resolving to the skewness, rounded for bigint
     *          results, or an empty optional when it is undefined.
     */
    public abstract skewness(): Promise<Optional<D>>;
    /**
     * Calculates the sample skewness with an explicit estimator; see the first
     * overload for the default and the small-sample rule.
     *
     * Complexity: O(n) — three moment passes over the mapped values.
     * Ordering: order-independent; only the value set matters.
     *
     * @param options - The estimator; defaults to `{ estimator: "G1" }`.
     * @returns A promise resolving to the skewness, or an empty optional when it is undefined.
     */
    public abstract skewness(options: SkewnessOptions): Promise<Optional<D>>;
    /**
     * Calculates the sample skewness of mapped values; see the first overload
     * for the default and the small-sample rule.
     *
     * Complexity: O(n) — three moment passes over the mapped values.
     * Ordering: order-independent; only the value set matters.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @param options - The estimator; defaults to `{ estimator: "G1" }`.
     * @returns A promise resolving to the skewness, or an empty optional when it is undefined.
     */
    public abstract skewness(mapper: Functional<E, D>, options?: SkewnessOptions): Promise<Optional<D>>;
    /**
     * Calculates the sample excess kurtosis.
     *
     * The default `"G2"` is the bias-corrected excess estimator used by Excel
     * `KURT` and pandas `kurt`; pass `{ estimator: "g2" }` to restore the
     * previous biased `m4 / m2^2 - 3`. `G2` is undefined below four
     * observations and `g2` below two; a constant sample is undefined for both.
     * `{ excess: false }` adds three back, reporting the non-excess fourth
     * standardised moment. Undefined cases resolve to an empty optional.
     *
     * Complexity: O(n) — three moment passes over the mapped values.
     * Ordering: order-independent; only the value set matters.
     *
     * @returns A promise resolving to the kurtosis, rounded for bigint
     *          results, or an empty optional when it is undefined.
     */
    public abstract kurtosis(): Promise<Optional<D>>;
    /**
     * Calculates the sample kurtosis with an explicit estimator and excess
     * flag; see the first overload for the defaults and the small-sample rule.
     *
     * Complexity: O(n) — three moment passes over the mapped values.
     * Ordering: order-independent; only the value set matters.
     *
     * @param options - `estimator` defaults to `"G2"`; `excess` defaults to `true`.
     * @returns A promise resolving to the kurtosis, or an empty optional when it is undefined.
     */
    public abstract kurtosis(options: KurtosisOptions): Promise<Optional<D>>;
    /**
     * Calculates the sample kurtosis of mapped values; see the first overload
     * for the defaults and the small-sample rule.
     *
     * Complexity: O(n) — three moment passes over the mapped values.
     * Ordering: order-independent; only the value set matters.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @param options - `estimator` defaults to `"G2"`; `excess` defaults to `true`.
     * @returns A promise resolving to the kurtosis, or an empty optional when it is undefined.
     */
    public abstract kurtosis(mapper: Functional<E, D>, options?: KurtosisOptions): Promise<Optional<D>>;
};

/**
 * A buffered bigint statistics view.
 *
 * Responsibility: implements {@link Statistics} for `bigint` results. Where an
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
 * Complexity: the buffer is built by {@link OrderedCollectable} in O(n log n);
 * each statistic is O(n), except `median`, `quantile` and
 * `interquartileRange`, which are O(n log n).
 *
 * @template E - The source element type.
 */
export class BigIntStatistics<E> extends Statistics<E, bigint> {
    protected readonly BigIntStatistics: symbol = AsynchronousBigIntStatisticsSymbol;
    /**
     * The built-in object tag identifying this API implementation.
     */
    [Symbol.toStringTag]: string = "AsynchronousBigIntStatistics";
    /**
     * Starts buffering the generator for this collectable.
     *
     * @param generator - The callback-based source to consume.
     */
    public constructor(generator: AsynchronousGenerator<E>);
    /**
     * Starts buffering the generator for this collectable.
     *
     * @param generator - The callback-based source to consume.
     * @param comparator - The comparison function; defaults to the library comparator.
     */
    public constructor(generator: AsynchronousGenerator<E>, comparator: Comparator<E>);
    /**
     * Starts buffering the generator for this collectable.
     *
     * @param parameter - The callback-based source to buffer.
     * @param comparator - The comparison function; defaults to the library comparator.
     */
    public constructor(parameter: AsynchronousGenerator<E>, comparator?: Comparator<E>) {
        super(parameter, comparator || useCompare);
        Object.defineProperties(this, {
            "AsynchronousBigIntStatistics": {
                value: AsynchronousBigIntStatisticsSymbol,
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
    public async *[Symbol.asyncIterator](): globalThis.AsyncGenerator<E, void, undefined> {
        for await (let element of await this.toArray()) {
            yield element;
        }
    }
    /**
     * Calculates the arithmetic average, returning zero for an empty source.
     *
     * Complexity: O(n) — one pass over the buffered elements.
     * Ordering: order-independent; the buffered traversal order does not affect the result.
     *
     * @returns A promise resolving to the average; bigint division truncates towards zero.
     */
    public async average(): Promise<bigint>;
    /**
     * Calculates the arithmetic average, returning zero for an empty source.
     *
     * Complexity: O(n) — one pass over the buffered elements.
     * Ordering: order-independent; the buffered traversal order does not affect the result.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns A promise resolving to the average; bigint division truncates towards zero.
     */
    public async average(mapper: Functional<E, bigint>): Promise<bigint>;
    /**
     * Calculates the arithmetic average, returning zero for an empty source.
     *
     * Complexity: O(n) — one pass over the buffered elements.
     * Ordering: order-independent; the buffered traversal order does not affect the result.
     *
     * @param argument1 - The first argument selected by the overload.
     * @returns A promise resolving to the average; bigint division truncates towards zero.
     */
    public async average(argument1?: Functional<E, bigint>): Promise<bigint> {
        if (await this.isEmpty()) {
            return 0n;
        }
        try {
            let mapper: Functional<E, bigint> = isFunction(argument1) ? argument1 : useToBigInt;
            return await useAsynchronousBigIntAverage(mapper).collect(this.source());
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
     * @returns A promise resolving to the spread of the mapped values.
     */
    public async range(): Promise<bigint>;
    /**
     * Subtracts the minimum mapped value from the maximum, returning zero when empty.
     *
     * Complexity: O(n) — scans the mapped values once for the minimum and the maximum.
     * Ordering: order-independent; only the value set matters.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns A promise resolving to the spread of the mapped values.
     */
    public async range(mapper: Functional<E, bigint>): Promise<bigint>;
    /**
     * Subtracts the minimum mapped value from the maximum, returning zero when empty.
     *
     * Complexity: O(n) — scans the mapped values once for the minimum and the maximum.
     * Ordering: order-independent; only the value set matters.
     *
     * @param argument1 - The first argument selected by the overload.
     * @returns A promise resolving to the spread of the mapped values.
     */
    public async range(argument1?: Functional<E, bigint>): Promise<bigint> {
        if (await this.isEmpty()) {
            return 0n;
        }
        try {
            let mapper: Functional<E, bigint> = isFunction(argument1) ? argument1 : useToBigInt;
            let data: Array<bigint> = (await this.toArray()).map(mapper);
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
     * view, or fewer than two observations when `ddof` is one, resolves to an
     * empty optional; with `ddof: 0` a single observation still has a defined
     * variance of zero.
     *
     * Complexity: O(n) — one mean pass followed by one squared-deviation pass.
     * Ordering: order-independent; only the value set matters.
     *
     * @returns A promise resolving to the variance rounded to a bigint, or an
     *          empty optional when it is undefined.
     */
    public async variance(): Promise<Optional<bigint>>;
    /**
     * Calculates the sample variance with an explicit `ddof`; see the first
     * overload for the definition and the small-sample rule.
     *
     * Complexity: O(n) — one mean pass followed by one squared-deviation pass.
     * Ordering: order-independent; only the value set matters.
     *
     * @param options - `ddof` selects the `n - 1` denominator (default) or `n`.
     * @returns A promise resolving to the variance, or an empty optional when it is undefined.
     */
    public async variance(options: VarianceOptions): Promise<Optional<bigint>>;
    /**
     * Calculates the sample variance of mapped values; see the first overload
     * for the definition and the small-sample rule.
     *
     * Complexity: O(n) — one mean pass followed by one squared-deviation pass.
     * Ordering: order-independent; only the value set matters.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @param options - `ddof` selects the `n - 1` denominator (default) or `n`.
     * @returns A promise resolving to the variance, or an empty optional when it is undefined.
     */
    public async variance(mapper: Functional<E, bigint>, options?: VarianceOptions): Promise<Optional<bigint>>;
    /**
     * Calculates the sample variance with the selected denominator.
     *
     * Complexity: O(n) — one mean pass followed by one squared-deviation pass.
     * Ordering: order-independent; only the value set matters.
     *
     * @param argument1 - The mapper or the options selected by the overload.
     * @param argument2 - The options when the first argument is a mapper.
     * @returns A promise resolving to the variance, or an empty optional when it is undefined.
     */
    public async variance(argument1?: Functional<E, bigint> | VarianceOptions, argument2?: VarianceOptions): Promise<Optional<bigint>> {
        let options: VarianceOptions = isFunction(argument1) ? (argument2 ?? {}) : (argument1 ?? {});
        let ddof: number = options.ddof ?? 1;
        if (!isVarianceDdof(ddof)) {
            throw new TypeError("Invalid ddof.");
        }
        if (await this.isEmpty()) {
            return Optional.empty();
        }
        try {
            let mapper: Functional<E, bigint> = isFunction(argument1) ? argument1 : useToBigInt;
            let data: Array<bigint> = (await this.toArray()).map((element: E): bigint => mapper(element));
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
     * one, resolves to an empty optional; `ddof: 0` remains defined for a
     * single observation and resolves to zero.
     *
     * Complexity: O(n) — computes the variance and then one square root.
     * Ordering: order-independent; only the value set matters.
     *
     * @returns A promise resolving to the standard deviation rounded to a
     *          bigint, or an empty optional when it is undefined.
     */
    public async standardDeviation(): Promise<Optional<bigint>>;
    /**
     * Calculates the sample standard deviation with an explicit `ddof`; see
     * the first overload for the definition and the small-sample rule.
     *
     * Complexity: O(n) — computes the variance and then one square root.
     * Ordering: order-independent; only the value set matters.
     *
     * @param options - `ddof` selects the `n - 1` denominator (default) or `n`.
     * @returns A promise resolving to the standard deviation, or an empty optional when it is undefined.
     */
    public async standardDeviation(options: VarianceOptions): Promise<Optional<bigint>>;
    /**
     * Calculates the sample standard deviation of mapped values; see the first
     * overload for the definition and the small-sample rule.
     *
     * Complexity: O(n) — computes the variance and then one square root.
     * Ordering: order-independent; only the value set matters.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @param options - `ddof` selects the `n - 1` denominator (default) or `n`.
     * @returns A promise resolving to the standard deviation, or an empty optional when it is undefined.
     */
    public async standardDeviation(mapper: Functional<E, bigint>, options?: VarianceOptions): Promise<Optional<bigint>>;
    /**
     * Calculates the sample standard deviation with the selected denominator.
     *
     * Complexity: O(n) — computes the variance and then one square root.
     * Ordering: order-independent; only the value set matters.
     *
     * @param argument1 - The mapper or the options selected by the overload.
     * @param argument2 - The options when the first argument is a mapper.
     * @returns A promise resolving to the standard deviation, or an empty optional when it is undefined.
     */
    public async standardDeviation(argument1?: Functional<E, bigint> | VarianceOptions, argument2?: VarianceOptions): Promise<Optional<bigint>> {
        let options: VarianceOptions = isFunction(argument1) ? (argument2 ?? {}) : (argument1 ?? {});
        let ddof: number = options.ddof ?? 1;
        if (!isVarianceDdof(ddof)) {
            throw new TypeError("Invalid ddof.");
        }
        if (await this.isEmpty()) {
            return Optional.empty();
        }
        try {
            let mapper: Functional<E, bigint> = isFunction(argument1) ? argument1 : useToBigInt;
            let data: Array<bigint> = (await this.toArray()).map((element: E): bigint => mapper(element));
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
     * @returns A promise resolving to the mean, or zero when empty; bigint division truncates towards zero.
     */
    public async mean(): Promise<bigint>;
    /**
     * Calculates the arithmetic mean using the same calculation as average.
     *
     * Complexity: O(n) — one pass over the buffered elements.
     * Ordering: order-independent; the buffered traversal order does not affect the result.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns A promise resolving to the mean, or zero when empty; bigint division truncates towards zero.
     */
    public async mean(mapper: Functional<E, bigint>): Promise<bigint>;
    /**
     * Calculates the arithmetic mean using the same calculation as average.
     *
     * Complexity: O(n) — one pass over the buffered elements.
     * Ordering: order-independent; the buffered traversal order does not affect the result.
     *
     * @param argument1 - The first argument selected by the overload.
     * @returns A promise resolving to the mean, or zero when empty; bigint division truncates towards zero.
     */
    public async mean(argument1?: Functional<E, bigint>): Promise<bigint> {
        if (await this.isEmpty()) {
            return 0n;
        }
        try {
            let mapper: Functional<E, bigint> = isFunction(argument1) ? argument1 : useToBigInt;
            return await useAsynchronousBigIntAverage(mapper).collect(this.source());
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
     * @returns A promise resolving to the median, or zero for an empty statistics view; bigint averaging truncates towards zero.
     */
    public async median(): Promise<bigint>;
    /**
     * Sorts mapped values and selects the middle value or averages the two middle values.
     *
     * Complexity: O(n log n) — the mapped values are sorted before selecting the middle.
     * Ordering: computed from the ascending order statistics, so the source traversal order is irrelevant.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns A promise resolving to the median, or zero for an empty statistics view; bigint averaging truncates towards zero.
     */
    public async median(mapper: Functional<E, bigint>): Promise<bigint>;
    /**
     * Sorts mapped values and selects the middle value or averages the two middle values.
     *
     * Complexity: O(n log n) — the mapped values are sorted before selecting the middle.
     * Ordering: computed from the ascending order statistics, so the source traversal order is irrelevant.
     *
     * @param argument1 - The first argument selected by the overload.
     * @returns A promise resolving to the median, or zero for an empty statistics view; bigint averaging truncates towards zero.
     */
    public async median(argument1?: Functional<E, bigint>): Promise<bigint> {
        if (await this.isEmpty()) {
            return 0n;
        }
        try {
            let mapper: Functional<E, bigint> = isFunction(argument1) ? argument1 : useToBigInt;
            return useAsynchronousBigIntMedian(mapper).collect(this.source());
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
     * @returns A promise resolving to the mode, or zero when empty.
     */
    public async mode(): Promise<bigint>;
    /**
     * Selects the most frequent mapped value, keeping the first encountered value on ties.
     *
     * Complexity: O(n) expected — one frequency map over the mapped values.
     * Ordering: ties keep the first mapped value encountered in buffered traversal order.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns A promise resolving to the mode, or zero when empty.
     */
    public async mode(mapper: Functional<E, bigint>): Promise<bigint>;
    /**
     * Selects the most frequent mapped value, keeping the first encountered value on ties.
     *
     * Complexity: O(n) expected — one frequency map over the mapped values.
     * Ordering: ties keep the first mapped value encountered in buffered traversal order.
     *
     * @param argument1 - The first argument selected by the overload.
     * @returns A promise resolving to the mode, or zero when empty.
     */
    public async mode(argument1?: Functional<E, bigint>): Promise<bigint> {
        if (await this.isEmpty()) {
            return 0n;
        }
        try {
            let mapper: Functional<E, bigint> = isFunction(argument1) ? argument1 : useToBigInt;
            return useAsynchronousBigIntMode(mapper).collect(this.source());
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
     * @returns A promise resolving to the sum, or zero when empty.
     */
    public async summate(): Promise<bigint>;
    /**
     * Adds mapped values using the library conversion when no mapper is supplied.
     *
     * Complexity: O(n) — one pass over the buffered elements.
     * Ordering: order-independent; the buffered traversal order does not affect the result.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns A promise resolving to the sum, or zero when empty.
     */
    public async summate(mapper: Functional<E, bigint>): Promise<bigint>;
    /**
     * Adds mapped values using the library conversion when no mapper is supplied.
     *
     * Complexity: O(n) — one pass over the buffered elements.
     * Ordering: order-independent; the buffered traversal order does not affect the result.
     *
     * @param argument1 - The first argument selected by the overload.
     * @returns A promise resolving to the sum, or zero when empty.
     */
    public async summate(argument1?: Functional<E, bigint>): Promise<bigint> {
        if (await this.isEmpty()) {
            return 0n;
        }
        try {
            let mapper: Functional<E, bigint> = isFunction(argument1) ? argument1 : useToBigInt;
            return await useAsynchronousBigIntSummate(mapper).collect(this.source() as AsynchronousGenerator<bigint>);
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
     * @returns A promise resolving to the quantile, or an empty optional for an
     *          empty statistics view.
     * @throws {RangeError} If probability is not finite or lies outside [0, 1].
     * @throws {TypeError} If the method is not one of the nine supported names.
     */
    public async quantile(probability: number): Promise<Optional<bigint>>;
    /**
     * Selects a sample quantile with an explicit Hyndman–Fan type; see the
     * first overload for the default and the empty-view rule.
     *
     * Complexity: O(n log n) — sorting the mapped values dominates; interpolation is O(1).
     * Ordering: computed from the ascending order statistics, so the source traversal order is irrelevant.
     *
     * @param probability - The finite probability from zero to one, inclusive.
     * @param options - The quantile method; defaults to `{ method: "type-7" }`.
     * @returns A promise resolving to the quantile, or an empty optional for an empty statistics view.
     */
    public async quantile(probability: number, options: QuantileOptions): Promise<Optional<bigint>>;
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
     * @returns A promise resolving to the quantile, or an empty optional for an empty statistics view.
     */
    public async quantile(probability: number, mapper: Functional<E, bigint>, options?: QuantileOptions): Promise<Optional<bigint>>;
    /**
     * Selects a sample quantile with the selected Hyndman–Fan type.
     *
     * Complexity: O(n log n) — sorting the mapped values dominates; interpolation is O(1).
     * Ordering: computed from the ascending order statistics, so the source traversal order is irrelevant.
     *
     * @param probability - The finite probability from zero to one, inclusive.
     * @param argument1 - The mapper or the options selected by the overload.
     * @param argument2 - The options when the first argument is a mapper.
     * @returns A promise resolving to the quantile, or an empty optional for an empty statistics view.
     */
    public async quantile(probability: number, argument1?: Functional<E, bigint> | QuantileOptions, argument2?: QuantileOptions): Promise<Optional<bigint>> {
        if (!Number.isFinite(probability) || probability < 0 || probability > 1) {
            throw new RangeError("Invalid quantile.");
        }
        let options: QuantileOptions = isFunction(argument1) ? (argument2 ?? {}) : (argument1 ?? {});
        let method = options.method ?? "type-7";
        if (!isQuantileMethod(method)) {
            throw new TypeError("Invalid quantile method.");
        }
        if (await this.isEmpty()) {
            return Optional.empty();
        }
        try {
            let mapper: Functional<E, bigint> = isFunction(argument1) ? argument1 : useToBigInt;
            let data: Array<bigint> = (await this.toArray()).map(mapper).sort(useCompare);
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
     * @returns A promise resolving to the interquartile range, or an empty
     *          optional for an empty statistics view.
     */
    public async interquartileRange(): Promise<Optional<bigint>>;
    /**
     * Subtracts the first quartile from the third quartile with an explicit
     * Hyndman–Fan type; see the first overload for the default.
     *
     * Complexity: O(n log n) — two sort-based quantile selections over the mapped values.
     * Ordering: computed from the ascending order statistics, so the source traversal order is irrelevant.
     *
     * @param options - The quantile method; defaults to `{ method: "type-7" }`.
     * @returns A promise resolving to the interquartile range, or an empty optional for an empty statistics view.
     */
    public async interquartileRange(options: QuantileOptions): Promise<Optional<bigint>>;
    /**
     * Subtracts the first quartile from the third quartile of mapped values;
     * see the first overload for the default.
     *
     * Complexity: O(n log n) — two sort-based quantile selections over the mapped values.
     * Ordering: computed from the ascending order statistics, so the source traversal order is irrelevant.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @param options - The quantile method; defaults to `{ method: "type-7" }`.
     * @returns A promise resolving to the interquartile range, or an empty optional for an empty statistics view.
     */
    public async interquartileRange(mapper: Functional<E, bigint>, options?: QuantileOptions): Promise<Optional<bigint>>;
    /**
     * Subtracts the first quartile from the third quartile.
     *
     * Complexity: O(n log n) — two sort-based quantile selections over the mapped values.
     * Ordering: computed from the ascending order statistics, so the source traversal order is irrelevant.
     *
     * @param argument1 - The mapper or the options selected by the overload.
     * @param argument2 - The options when the first argument is a mapper.
     * @returns A promise resolving to the interquartile range, or an empty optional for an empty statistics view.
     */
    public async interquartileRange(argument1?: Functional<E, bigint> | QuantileOptions, argument2?: QuantileOptions): Promise<Optional<bigint>> {
        let options: QuantileOptions = isFunction(argument1) ? (argument2 ?? {}) : (argument1 ?? {});
        let method = options.method ?? "type-7";
        if (!isQuantileMethod(method)) {
            throw new TypeError("Invalid quantile method.");
        }
        try {
            let mapper: Functional<E, bigint> = isFunction(argument1) ? argument1 : useToBigInt;
            let lower: Optional<bigint> = await this.quantile(0.25, mapper, options);
            let upper: Optional<bigint> = await this.quantile(0.75, mapper, options);
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
     * is undefined for both. Those cases resolve to an empty optional.
     *
     * Complexity: O(n) — three moment passes over the mapped values.
     * Ordering: order-independent; only the value set matters.
     *
     * @returns A promise resolving to the skewness rounded to a bigint, or an
     *          empty optional when it is undefined.
     */
    public async skewness(): Promise<Optional<bigint>>;
    /**
     * Calculates the sample skewness with an explicit estimator; see the first
     * overload for the default and the small-sample rule.
     *
     * Complexity: O(n) — three moment passes over the mapped values.
     * Ordering: order-independent; only the value set matters.
     *
     * @param options - The estimator; defaults to `{ estimator: "G1" }`.
     * @returns A promise resolving to the skewness, or an empty optional when it is undefined.
     */
    public async skewness(options: SkewnessOptions): Promise<Optional<bigint>>;
    /**
     * Calculates the sample skewness of mapped values; see the first overload
     * for the default and the small-sample rule.
     *
     * Complexity: O(n) — three moment passes over the mapped values.
     * Ordering: order-independent; only the value set matters.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @param options - The estimator; defaults to `{ estimator: "G1" }`.
     * @returns A promise resolving to the skewness, or an empty optional when it is undefined.
     */
    public async skewness(mapper: Functional<E, bigint>, options?: SkewnessOptions): Promise<Optional<bigint>>;
    /**
     * Calculates the sample skewness with the selected estimator.
     *
     * Complexity: O(n) — three moment passes over the mapped values.
     * Ordering: order-independent; only the value set matters.
     *
     * @param argument1 - The mapper or the options selected by the overload.
     * @param argument2 - The options when the first argument is a mapper.
     * @returns A promise resolving to the skewness, or an empty optional when it is undefined.
     */
    public async skewness(argument1?: Functional<E, bigint> | SkewnessOptions, argument2?: SkewnessOptions): Promise<Optional<bigint>> {
        let options: SkewnessOptions = isFunction(argument1) ? (argument2 ?? {}) : (argument1 ?? {});
        let estimator = options.estimator ?? "G1";
        if (!isSkewnessEstimator(estimator)) {
            throw new TypeError("Invalid skewness estimator.");
        }
        if (await this.isEmpty()) {
            return Optional.empty();
        }
        try {
            let mapper: Functional<E, bigint> = isFunction(argument1) ? argument1 : useToBigInt;
            let data: Array<bigint> = (await this.toArray()).map((element: E): bigint => mapper(element));
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
     * standardised moment. Undefined cases resolve to an empty optional.
     *
     * Complexity: O(n) — three moment passes over the mapped values.
     * Ordering: order-independent; only the value set matters.
     *
     * @returns A promise resolving to the kurtosis rounded to a bigint, or an
     *          empty optional when it is undefined.
     */
    public async kurtosis(): Promise<Optional<bigint>>;
    /**
     * Calculates the sample kurtosis with an explicit estimator and excess
     * flag; see the first overload for the defaults and the small-sample rule.
     *
     * Complexity: O(n) — three moment passes over the mapped values.
     * Ordering: order-independent; only the value set matters.
     *
     * @param options - `estimator` defaults to `"G2"`; `excess` defaults to `true`.
     * @returns A promise resolving to the kurtosis, or an empty optional when it is undefined.
     */
    public async kurtosis(options: KurtosisOptions): Promise<Optional<bigint>>;
    /**
     * Calculates the sample kurtosis of mapped values; see the first overload
     * for the defaults and the small-sample rule.
     *
     * Complexity: O(n) — three moment passes over the mapped values.
     * Ordering: order-independent; only the value set matters.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @param options - `estimator` defaults to `"G2"`; `excess` defaults to `true`.
     * @returns A promise resolving to the kurtosis, or an empty optional when it is undefined.
     */
    public async kurtosis(mapper: Functional<E, bigint>, options?: KurtosisOptions): Promise<Optional<bigint>>;
    /**
     * Calculates the sample kurtosis with the selected estimator and excess
     * flag.
     *
     * Complexity: O(n) — three moment passes over the mapped values.
     * Ordering: order-independent; only the value set matters.
     *
     * @param argument1 - The mapper or the options selected by the overload.
     * @param argument2 - The options when the first argument is a mapper.
     * @returns A promise resolving to the kurtosis, or an empty optional when it is undefined.
     */
    public async kurtosis(argument1?: Functional<E, bigint> | KurtosisOptions, argument2?: KurtosisOptions): Promise<Optional<bigint>> {
        let options: KurtosisOptions = isFunction(argument1) ? (argument2 ?? {}) : (argument1 ?? {});
        let estimator = options.estimator ?? "G2";
        let excess: boolean = options.excess ?? true;
        if (!isKurtosisEstimator(estimator)) {
            throw new TypeError("Invalid kurtosis estimator.");
        }
        if (await this.isEmpty()) {
            return Optional.empty();
        }
        try {
            let mapper: Functional<E, bigint> = isFunction(argument1) ? argument1 : useToBigInt;
            let data: Array<bigint> = (await this.toArray()).map((element: E): bigint => mapper(element));
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
 * Responsibility: implements {@link Statistics} for `number` results without
 * rounding, and adds the normal-theory standard errors of the reported
 * skewness and kurtosis. The two-pass variance keeps the computation clear of
 * the catastrophic cancellation of the `sum(x^2) - sum(x)^2 / n` form.
 *
 * Ordering semantics: identical to the base contract. `median`, `quantile` and
 * `interquartileRange` sort mapped values, `mode` breaks ties by first
 * encounter, and every other statistic is order-independent.
 *
 * Complexity: the buffer is built by {@link OrderedCollectable} in O(n log n);
 * each statistic is O(n), except `median`, `quantile` and
 * `interquartileRange`, which are O(n log n), and the two standard errors,
 * which are O(1).
 *
 * @template E - The source element type.
 */
export class NumericStatistics<E> extends Statistics<E, number> {
    protected readonly AsynchronousNumericStatistics: symbol = AsynchronousNumericStatisticsSymbol;
    /**
     * The built-in object tag identifying this API implementation.
     */
    [Symbol.toStringTag]: string = "AsynchronousNumericStatistics";
    /**
     * Starts buffering the generator for this collectable.
     *
     * @param generator - The callback-based source to consume.
     */
    public constructor(generator: AsynchronousGenerator<E>);
    /**
     * Starts buffering the generator for this collectable.
     *
     * @param generator - The callback-based source to consume.
     * @param comparator - The comparison function; defaults to the library comparator.
     */
    public constructor(generator: AsynchronousGenerator<E>, comparator: Comparator<E>);
    /**
     * Starts buffering the generator for this collectable.
     *
     * @param parameter - The callback-based source to buffer.
     * @param comparator - The comparison function; defaults to the library comparator.
     */
    public constructor(parameter: AsynchronousGenerator<E>, comparator?: Comparator<E>) {
        super(parameter, comparator || useCompare);
        Object.defineProperties(this, {
            "AsynchronousNumericStatistics": {
                value: AsynchronousNumericStatisticsSymbol,
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
    public async *[Symbol.asyncIterator](): globalThis.AsyncGenerator<E, void, undefined> {
        for await (let element of await this.toArray()) {
            yield element;
        }
    }
    /**
     * Calculates the arithmetic average, returning zero for an empty source.
     *
     * Complexity: O(n) — one pass over the buffered elements.
     * Ordering: order-independent; the buffered traversal order does not affect the result.
     *
     * @returns A promise resolving to the arithmetic average, or zero when empty.
     */
    public async average(): Promise<number>;
    /**
     * Calculates the arithmetic average, returning zero for an empty source.
     *
     * Complexity: O(n) — one pass over the buffered elements.
     * Ordering: order-independent; the buffered traversal order does not affect the result.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns A promise resolving to the arithmetic average, or zero when empty.
     */
    public async average(mapper: Functional<E, number>): Promise<number>;
    /**
     * Calculates the arithmetic average, returning zero for an empty source.
     *
     * Complexity: O(n) — one pass over the buffered elements.
     * Ordering: order-independent; the buffered traversal order does not affect the result.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns A promise resolving to the arithmetic average, or zero when empty.
     */
    public async average(mapper?: Functional<E, number>): Promise<number> {
        if (await this.isEmpty()) {
            return 0;
        }
        try {
            if (isFunction(mapper)) {
                return useAsynchronousNumericAverage(mapper).collect(this.source() as AsynchronousGenerator<number>);
            }
            return useAsynchronousNumericAverage().collect(this.source());
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
     * @returns A promise resolving to the spread of the mapped values.
     */
    public async range(): Promise<number>;
    /**
     * Subtracts the minimum mapped value from the maximum, returning zero when empty.
     *
     * Complexity: O(n) — scans the mapped values once for the minimum and the maximum.
     * Ordering: order-independent; only the value set matters.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns A promise resolving to the spread of the mapped values.
     */
    public async range(mapper: Functional<E, number>): Promise<number>;
    /**
     * Subtracts the minimum mapped value from the maximum, returning zero when empty.
     *
     * Complexity: O(n) — scans the mapped values once for the minimum and the maximum.
     * Ordering: order-independent; only the value set matters.
     *
     * @param argument1 - The first argument selected by the overload.
     * @returns A promise resolving to the spread of the mapped values.
     */
    public async range(argument1?: Functional<E, number>): Promise<number> {
        if (await this.isEmpty()) {
            return 0;
        }
        try {
            if (await this.count() === 1n) {
                return 0;
            }
            let mapper: Functional<E, number> = isFunction(argument1) ? argument1 : useToNumber;
            let data: Array<number> = (await this.toArray()).map(mapper);
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
     * view, or fewer than two observations when `ddof` is one, resolves to an
     * empty optional; with `ddof: 0` a single observation still has a defined
     * variance of zero. The two-pass computation avoids the catastrophic
     * cancellation of the `sum(x^2) - sum(x)^2 / n` form.
     *
     * Complexity: O(n) — one mean pass followed by one squared-deviation pass.
     * Ordering: order-independent; only the value set matters.
     *
     * @returns A promise resolving to the variance, or an empty optional when
     *          it is undefined.
     */
    public async variance(): Promise<Optional<number>>;
    /**
     * Calculates the sample variance with an explicit `ddof`; see the first
     * overload for the definition and the small-sample rule.
     *
     * Complexity: O(n) — one mean pass followed by one squared-deviation pass.
     * Ordering: order-independent; only the value set matters.
     *
     * @param options - `ddof` selects the `n - 1` denominator (default) or `n`.
     * @returns A promise resolving to the variance, or an empty optional when it is undefined.
     */
    public async variance(options: VarianceOptions): Promise<Optional<number>>;
    /**
     * Calculates the sample variance of mapped values; see the first overload
     * for the definition and the small-sample rule.
     *
     * Complexity: O(n) — one mean pass followed by one squared-deviation pass.
     * Ordering: order-independent; only the value set matters.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @param options - `ddof` selects the `n - 1` denominator (default) or `n`.
     * @returns A promise resolving to the variance, or an empty optional when it is undefined.
     */
    public async variance(mapper: Functional<E, number>, options?: VarianceOptions): Promise<Optional<number>>;
    /**
     * Calculates the sample variance with the selected denominator.
     *
     * Complexity: O(n) — one mean pass followed by one squared-deviation pass.
     * Ordering: order-independent; only the value set matters.
     *
     * @param argument1 - The mapper or the options selected by the overload.
     * @param argument2 - The options when the first argument is a mapper.
     * @returns A promise resolving to the variance, or an empty optional when it is undefined.
     */
    public async variance(argument1?: Functional<E, number> | VarianceOptions, argument2?: VarianceOptions): Promise<Optional<number>> {
        let options: VarianceOptions = isFunction(argument1) ? (argument2 ?? {}) : (argument1 ?? {});
        let ddof: number = options.ddof ?? 1;
        if (!isVarianceDdof(ddof)) {
            throw new TypeError("Invalid ddof.");
        }
        if (await this.isEmpty()) {
            return Optional.empty();
        }
        try {
            let mapper: Functional<E, number> = isFunction(argument1) ? argument1 : useToNumber;
            let data: Array<number> = (await this.toArray()).map(mapper);
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
     * one, resolves to an empty optional; `ddof: 0` remains defined for a
     * single observation and resolves to zero.
     *
     * Complexity: O(n) — computes the variance and then one square root.
     * Ordering: order-independent; only the value set matters.
     *
     * @returns A promise resolving to the standard deviation, or an empty
     *          optional when it is undefined.
     */
    public async standardDeviation(): Promise<Optional<number>>;
    /**
     * Calculates the sample standard deviation with an explicit `ddof`; see
     * the first overload for the definition and the small-sample rule.
     *
     * Complexity: O(n) — computes the variance and then one square root.
     * Ordering: order-independent; only the value set matters.
     *
     * @param options - `ddof` selects the `n - 1` denominator (default) or `n`.
     * @returns A promise resolving to the standard deviation, or an empty optional when it is undefined.
     */
    public async standardDeviation(options: VarianceOptions): Promise<Optional<number>>;
    /**
     * Calculates the sample standard deviation of mapped values; see the first
     * overload for the definition and the small-sample rule.
     *
     * Complexity: O(n) — computes the variance and then one square root.
     * Ordering: order-independent; only the value set matters.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @param options - `ddof` selects the `n - 1` denominator (default) or `n`.
     * @returns A promise resolving to the standard deviation, or an empty optional when it is undefined.
     */
    public async standardDeviation(mapper: Functional<E, number>, options?: VarianceOptions): Promise<Optional<number>>;
    /**
     * Calculates the sample standard deviation with the selected denominator.
     *
     * Complexity: O(n) — computes the variance and then one square root.
     * Ordering: order-independent; only the value set matters.
     *
     * @param argument1 - The mapper or the options selected by the overload.
     * @param argument2 - The options when the first argument is a mapper.
     * @returns A promise resolving to the standard deviation, or an empty optional when it is undefined.
     */
    public async standardDeviation(argument1?: Functional<E, number> | VarianceOptions, argument2?: VarianceOptions): Promise<Optional<number>> {
        let options: VarianceOptions = isFunction(argument1) ? (argument2 ?? {}) : (argument1 ?? {});
        let ddof: number = options.ddof ?? 1;
        if (!isVarianceDdof(ddof)) {
            throw new TypeError("Invalid ddof.");
        }
        if (await this.isEmpty()) {
            return Optional.empty();
        }
        try {
            let mapper: Functional<E, number> = isFunction(argument1) ? argument1 : useToNumber;
            let data: Array<number> = (await this.toArray()).map(mapper);
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
     * @returns A promise resolving to the mean, or zero when empty.
     */
    public async mean(): Promise<number>;
    /**
     * Calculates the arithmetic mean using the same calculation as average.
     *
     * Complexity: O(n) — one pass over the buffered elements.
     * Ordering: order-independent; the buffered traversal order does not affect the result.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns A promise resolving to the mean, or zero when empty.
     */
    public async mean(mapper: Functional<E, number>): Promise<number>;
    /**
     * Calculates the arithmetic mean using the same calculation as average.
     *
     * Complexity: O(n) — one pass over the buffered elements.
     * Ordering: order-independent; the buffered traversal order does not affect the result.
     *
     * @param argument1 - The first argument selected by the overload.
     * @returns A promise resolving to the mean, or zero when empty.
     */
    public async mean(argument1?: Functional<E, number>): Promise<number> {
        if (await this.isEmpty()) {
            return 0;
        }
        try {
            let mapper: Functional<E, number> = isFunction(argument1) ? argument1 : useToNumber;
            return useAsynchronousNumericAverage(mapper).collect(this.source() as AsynchronousGenerator<number>);
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
     * @returns A promise resolving to the median, or zero for an empty statistics view.
     */
    public async median(): Promise<number>;
    /**
     * Sorts mapped values and selects the middle value or averages the two middle values.
     *
     * Complexity: O(n log n) — the mapped values are sorted before selecting the middle.
     * Ordering: computed from the ascending order statistics, so the source traversal order is irrelevant.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns A promise resolving to the median, or zero for an empty statistics view.
     */
    public async median(mapper: Functional<E, number>): Promise<number>;
    /**
     * Sorts mapped values and selects the middle value or averages the two middle values.
     *
     * Complexity: O(n log n) — the mapped values are sorted before selecting the middle.
     * Ordering: computed from the ascending order statistics, so the source traversal order is irrelevant.
     *
     * @param argument1 - The first argument selected by the overload.
     * @returns A promise resolving to the median, or zero for an empty statistics view.
     */
    public async median(argument1?: Functional<E, number>): Promise<number> {
        if (await this.isEmpty()) {
            return 0;
        }
        try {
            let mapper: Functional<E, number> = isFunction(argument1) ? argument1 : useToNumber;
            return await useAsynchronousNumericMedian(mapper).collect(this.source());
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
     * @returns A promise resolving to the mode, or zero when empty.
     */
    public async mode(): Promise<number>;
    /**
     * Selects the most frequent mapped value, keeping the first encountered value on ties.
     *
     * Complexity: O(n) expected — one frequency map over the mapped values.
     * Ordering: ties keep the first mapped value encountered in buffered traversal order.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns A promise resolving to the mode, or zero when empty.
     */
    public async mode(mapper: Functional<E, number>): Promise<number>;
    /**
     * Selects the most frequent mapped value, keeping the first encountered value on ties.
     *
     * Complexity: O(n) expected — one frequency map over the mapped values.
     * Ordering: ties keep the first mapped value encountered in buffered traversal order.
     *
     * @param argument1 - The first argument selected by the overload.
     * @returns A promise resolving to the mode, or zero when empty.
     */
    public async mode(argument1?: Functional<E, number>): Promise<number> {
        if (await this.isEmpty()) {
            return 0;
        }
        try {
            let mapper: Functional<E, number> = isFunction(argument1) ? argument1 : useToNumber;
            return await useAsynchronousNumericMode(mapper).collect(this.source());
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
     * @returns A promise resolving to the sum, or zero when empty.
     */
    public async summate(): Promise<number>;
    /**
     * Adds mapped values using the library conversion when no mapper is supplied.
     *
     * Complexity: O(n) — one pass over the buffered elements.
     * Ordering: order-independent; the buffered traversal order does not affect the result.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @returns A promise resolving to the sum, or zero when empty.
     */
    public async summate(mapper: Functional<E, number>): Promise<number>;
    /**
     * Adds mapped values using the library conversion when no mapper is supplied.
     *
     * Complexity: O(n) — one pass over the buffered elements.
     * Ordering: order-independent; the buffered traversal order does not affect the result.
     *
     * @param argument1 - The first argument selected by the overload.
     * @returns A promise resolving to the sum, or zero when empty.
     */
    public async summate(argument1?: Functional<E, number>): Promise<number> {
        if (await this.isEmpty()) {
            return 0;
        }
        try {
            let mapper: Functional<E, number> = isFunction(argument1) ? argument1 : useToNumber;
            return useAsynchronousNumericSummate(mapper).collect(this.source() as AsynchronousGenerator<number>);
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
     * @returns A promise resolving to the quantile, or an empty optional for an
     *          empty statistics view.
     * @throws {RangeError} If probability is not finite or lies outside [0, 1].
     * @throws {TypeError} If the method is not one of the nine supported names.
     */
    public async quantile(probability: number): Promise<Optional<number>>;
    /**
     * Selects a sample quantile with an explicit Hyndman–Fan type; see the
     * first overload for the default and the empty-view rule.
     *
     * Complexity: O(n log n) — sorting the mapped values dominates; interpolation is O(1).
     * Ordering: computed from the ascending order statistics, so the source traversal order is irrelevant.
     *
     * @param probability - The finite probability from zero to one, inclusive.
     * @param options - The quantile method; defaults to `{ method: "type-7" }`.
     * @returns A promise resolving to the quantile, or an empty optional for an empty statistics view.
     */
    public async quantile(probability: number, options: QuantileOptions): Promise<Optional<number>>;
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
     * @returns A promise resolving to the quantile, or an empty optional for an empty statistics view.
     */
    public async quantile(probability: number, mapper: Functional<E, number>, options?: QuantileOptions): Promise<Optional<number>>;
    /**
     * Selects a sample quantile with the selected Hyndman–Fan type.
     *
     * Complexity: O(n log n) — sorting the mapped values dominates; interpolation is O(1).
     * Ordering: computed from the ascending order statistics, so the source traversal order is irrelevant.
     *
     * @param probability - The finite probability from zero to one, inclusive.
     * @param argument1 - The mapper or the options selected by the overload.
     * @param argument2 - The options when the first argument is a mapper.
     * @returns A promise resolving to the quantile, or an empty optional for an empty statistics view.
     */
    public async quantile(probability: number, argument1?: Functional<E, number> | QuantileOptions, argument2?: QuantileOptions): Promise<Optional<number>> {
        if (!Number.isFinite(probability) || probability < 0 || probability > 1) {
            throw new RangeError("Invalid quantile.");
        }
        let options: QuantileOptions = isFunction(argument1) ? (argument2 ?? {}) : (argument1 ?? {});
        let method = options.method ?? "type-7";
        if (!isQuantileMethod(method)) {
            throw new TypeError("Invalid quantile method.");
        }
        if (await this.isEmpty()) {
            return Optional.empty();
        }
        try {
            let mapper: Functional<E, number> = isFunction(argument1) ? argument1 : useToNumber;
            let data: Array<number> = (await this.toArray()).map(mapper).sort(useCompare);
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
     * @returns A promise resolving to the interquartile range, or an empty
     *          optional for an empty statistics view.
     */
    public async interquartileRange(): Promise<Optional<number>>;
    /**
     * Subtracts the first quartile from the third quartile with an explicit
     * Hyndman–Fan type; see the first overload for the default.
     *
     * Complexity: O(n log n) — two sort-based quantile selections over the mapped values.
     * Ordering: computed from the ascending order statistics, so the source traversal order is irrelevant.
     *
     * @param options - The quantile method; defaults to `{ method: "type-7" }`.
     * @returns A promise resolving to the interquartile range, or an empty optional for an empty statistics view.
     */
    public async interquartileRange(options: QuantileOptions): Promise<Optional<number>>;
    /**
     * Subtracts the first quartile from the third quartile of mapped values;
     * see the first overload for the default.
     *
     * Complexity: O(n log n) — two sort-based quantile selections over the mapped values.
     * Ordering: computed from the ascending order statistics, so the source traversal order is irrelevant.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @param options - The quantile method; defaults to `{ method: "type-7" }`.
     * @returns A promise resolving to the interquartile range, or an empty optional for an empty statistics view.
     */
    public async interquartileRange(mapper: Functional<E, number>, options?: QuantileOptions): Promise<Optional<number>>;
    /**
     * Subtracts the first quartile from the third quartile.
     *
     * Complexity: O(n log n) — two sort-based quantile selections over the mapped values.
     * Ordering: computed from the ascending order statistics, so the source traversal order is irrelevant.
     *
     * @param argument1 - The mapper or the options selected by the overload.
     * @param argument2 - The options when the first argument is a mapper.
     * @returns A promise resolving to the interquartile range, or an empty optional for an empty statistics view.
     */
    public async interquartileRange(argument1?: Functional<E, number> | QuantileOptions, argument2?: QuantileOptions): Promise<Optional<number>> {
        let options: QuantileOptions = isFunction(argument1) ? (argument2 ?? {}) : (argument1 ?? {});
        let method = options.method ?? "type-7";
        if (!isQuantileMethod(method)) {
            throw new TypeError("Invalid quantile method.");
        }
        try {
            let mapper: Functional<E, number> = isFunction(argument1) ? argument1 : useToNumber;
            let lower: Optional<number> = await this.quantile(0.25, mapper, options);
            let upper: Optional<number> = await this.quantile(0.75, mapper, options);
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
     * is undefined for both. Those cases resolve to an empty optional.
     *
     * Complexity: O(n) — three moment passes over the mapped values.
     * Ordering: order-independent; only the value set matters.
     *
     * @returns A promise resolving to the skewness, or an empty optional when
     *          it is undefined.
     */
    public async skewness(): Promise<Optional<number>>;
    /**
     * Calculates the sample skewness with an explicit estimator; see the first
     * overload for the default and the small-sample rule.
     *
     * Complexity: O(n) — three moment passes over the mapped values.
     * Ordering: order-independent; only the value set matters.
     *
     * @param options - The estimator; defaults to `{ estimator: "G1" }`.
     * @returns A promise resolving to the skewness, or an empty optional when it is undefined.
     */
    public async skewness(options: SkewnessOptions): Promise<Optional<number>>;
    /**
     * Calculates the sample skewness of mapped values; see the first overload
     * for the default and the small-sample rule.
     *
     * Complexity: O(n) — three moment passes over the mapped values.
     * Ordering: order-independent; only the value set matters.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @param options - The estimator; defaults to `{ estimator: "G1" }`.
     * @returns A promise resolving to the skewness, or an empty optional when it is undefined.
     */
    public async skewness(mapper: Functional<E, number>, options?: SkewnessOptions): Promise<Optional<number>>;
    /**
     * Calculates the sample skewness with the selected estimator.
     *
     * Complexity: O(n) — three moment passes over the mapped values.
     * Ordering: order-independent; only the value set matters.
     *
     * @param argument1 - The mapper or the options selected by the overload.
     * @param argument2 - The options when the first argument is a mapper.
     * @returns A promise resolving to the skewness, or an empty optional when it is undefined.
     */
    public async skewness(argument1?: Functional<E, number> | SkewnessOptions, argument2?: SkewnessOptions): Promise<Optional<number>> {
        let options: SkewnessOptions = isFunction(argument1) ? (argument2 ?? {}) : (argument1 ?? {});
        let estimator = options.estimator ?? "G1";
        if (!isSkewnessEstimator(estimator)) {
            throw new TypeError("Invalid skewness estimator.");
        }
        if (await this.isEmpty()) {
            return Optional.empty();
        }
        try {
            let mapper: Functional<E, number> = isFunction(argument1) ? argument1 : useToNumber;
            let data: Array<number> = (await this.toArray()).map((element: E): number => mapper(element));
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
     * standardised moment. Undefined cases resolve to an empty optional.
     *
     * Complexity: O(n) — three moment passes over the mapped values.
     * Ordering: order-independent; only the value set matters.
     *
     * @returns A promise resolving to the kurtosis, or an empty optional when
     *          it is undefined.
     */
    public async kurtosis(): Promise<Optional<number>>;
    /**
     * Calculates the sample kurtosis with an explicit estimator and excess
     * flag; see the first overload for the defaults and the small-sample rule.
     *
     * Complexity: O(n) — three moment passes over the mapped values.
     * Ordering: order-independent; only the value set matters.
     *
     * @param options - `estimator` defaults to `"G2"`; `excess` defaults to `true`.
     * @returns A promise resolving to the kurtosis, or an empty optional when it is undefined.
     */
    public async kurtosis(options: KurtosisOptions): Promise<Optional<number>>;
    /**
     * Calculates the sample kurtosis of mapped values; see the first overload
     * for the defaults and the small-sample rule.
     *
     * Complexity: O(n) — three moment passes over the mapped values.
     * Ordering: order-independent; only the value set matters.
     *
     * @param mapper - Maps each element to the required value; pipeline transformations also provide its bigint index.
     * @param options - `estimator` defaults to `"G2"`; `excess` defaults to `true`.
     * @returns A promise resolving to the kurtosis, or an empty optional when it is undefined.
     */
    public async kurtosis(mapper: Functional<E, number>, options?: KurtosisOptions): Promise<Optional<number>>;
    /**
     * Calculates the sample kurtosis with the selected estimator and excess
     * flag.
     *
     * Complexity: O(n) — three moment passes over the mapped values.
     * Ordering: order-independent; only the value set matters.
     *
     * @param argument1 - The mapper or the options selected by the overload.
     * @param argument2 - The options when the first argument is a mapper.
     * @returns A promise resolving to the kurtosis, or an empty optional when it is undefined.
     */
    public async kurtosis(argument1?: Functional<E, number> | KurtosisOptions, argument2?: KurtosisOptions): Promise<Optional<number>> {
        let options: KurtosisOptions = isFunction(argument1) ? (argument2 ?? {}) : (argument1 ?? {});
        let estimator = options.estimator ?? "G2";
        let excess: boolean = options.excess ?? true;
        if (!isKurtosisEstimator(estimator)) {
            throw new TypeError("Invalid kurtosis estimator.");
        }
        if (await this.isEmpty()) {
            return Optional.empty();
        }
        try {
            let mapper: Functional<E, number> = isFunction(argument1) ? argument1 : useToNumber;
            let data: Array<number> = (await this.toArray()).map((element: E): number => mapper(element));
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
     * @returns A promise resolving to the standard error, or an empty optional
     *          when it is undefined.
     */
    public async skewnessStandardError(): Promise<Optional<number>> {
        if (await this.isEmpty()) {
            return Optional.empty();
        }
        let count: number = Number(await this.count());
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
     * @returns A promise resolving to the standard error, or an empty optional
     *          when it is undefined.
     */
    public async kurtosisStandardError(): Promise<Optional<number>> {
        if (await this.isEmpty()) {
            return Optional.empty();
        }
        let count: number = Number(await this.count());
        if (count < 4) {
            return Optional.empty();
        }
        return Optional.of(Math.sqrt(24 * count * Math.pow(count - 1, 2) / ((count - 3) * (count - 2) * (count + 3) * (count + 5))));
    }
};
