/**
 * Synchronous collectors that fold the source into a numeric summary: totals,
 * averages, medians, modes, dispersion, frequency tables and grouping.
 */
import { isFunction, isNumber, isBigInt } from "#semantic/guard";
import { useToBigInt, useToNumber } from "#semantic/hook";
import { SynchronousCollector } from "#semantic/synchronous/collector";
import type { BiFunctional, Functional } from "#semantic/utility";

/**
 * Creates collectors that group elements into arrays under a computed key.
 *
 * The finished value is a Map from key to the elements that produced it, with
 * encounter order preserved inside each array. useSynchronousGroupBy also
 * transforms the values and useSynchronousPartitionBy uses bigint bucket numbers.
 *
 * @template E - The source element type.
 * @template K - The key type produced by the classifier.
 */
interface UseSynchronousGroup {
    /**
     * Classifies each element with a function that only receives the element.
     *
     * The key is computed once per element and the element is appended to the
     * matching array; a new array is created the first time a key appears.
     *
     * @template E - The source element type.
     * @template K - The key type produced by the classifier.
     * @param classifier - Computes the grouping key from the element.
     * @returns A collector that finishes with a Map of grouped elements.
     */
    <E, K>(classifier: Functional<E, K>): SynchronousCollector<E, Map<K, E[]>, Map<K, E[]>>;
    /**
     * Classifies each element with a function that also receives its index.
     *
     * The bigint index can take part in the key, for example to group by a
     * position-derived bucket while still using the element value.
     *
     * @template E - The source element type.
     * @template K - The key type produced by the classifier.
     * @param classifier - Computes the grouping key from the element and its index.
     * @returns A collector that finishes with a Map of grouped elements.
     */
    <E, K>(classifier: BiFunctional<E, bigint, K>): SynchronousCollector<E, Map<K, E[]>, Map<K, E[]>>;
}
;
/**
 * Creates a collector that groups elements into arrays by classifier key.
 *
 * @template E - The source element type.
 * @template K - The extracted key type.
 * @param classifier - Calculates the grouping key or bigint partition bucket.
 * @returns A reusable collector configured for this operation.
 */
export let useSynchronousGroup: UseSynchronousGroup = <E, K>(classifier: Functional<E, K> | BiFunctional<E, bigint, K>): SynchronousCollector<E, Map<K, E[]>, Map<K, E[]>> => {
    if (isFunction(classifier)) {
        return SynchronousCollector.full((): Map<K, E[]> => new Map<K, E[]>(), (accumulator: Map<K, E[]>, element: E, index: bigint): Map<K, E[]> => {
            let key: K = classifier(element, index);
            let group: E[] = accumulator.get(key) || [];
            group.push(element);
            accumulator.set(key, group);
            return accumulator;
        }, (accumulator: Map<K, E[]>): Map<K, E[]> => accumulator);
    }
    throw new TypeError("Classifier must be a function.");
};
/**
 * Creates collectors that group transformed values under a computed key.
 *
 * Unlike useSynchronousGroup, the stored value may differ from the source
 * element: the key extractor and the value extractor are independent functions.
 * Order inside each array still follows encounter order.
 *
 * @template E - The source element type.
 * @template K - The key type produced by the extractor.
 * @template V - The value type stored under each key.
 */
interface UseSynchronousGroupBy {
    /**
     * Extracts only the key and stores the source elements themselves.
     *
     * This is the degenerate form where the value extractor is the identity, so
     * it behaves like useSynchronousGroup but with the same extractor naming.
     *
     * @template E - The source element type.
     * @template K - The key type produced by the extractor.
     * @param keyExtractor - Computes the grouping key from the element.
     * @returns A collector that finishes with a Map of grouped source elements.
     */
    <E, K>(keyExtractor: Functional<E, K>): SynchronousCollector<E, Map<K, E[]>, Map<K, E[]>>;
    /**
     * Combines an element-only key extractor with an element-only value extractor.
     *
     * Each source element is mapped to one stored value before being appended to
     * the array for its key.
     *
     * @template E - The source element type.
     * @template K - The key type produced by the key extractor.
     * @template V - The value type produced by the value extractor.
     * @param keyExtractor - Computes the grouping key from the element.
     * @param valueExtractor - Computes the stored value from the element.
     * @returns A collector that finishes with a Map of grouped values.
     */
    <E, K, V>(keyExtractor: Functional<E, K>, valueExtractor: Functional<E, V>): SynchronousCollector<E, Map<K, V[]>, Map<K, V[]>>;
    /**
     * Uses index-aware extractors for both the key and the stored value.
     *
     * Both functions receive the same bigint encounter index, so the key and the
     * value can consistently depend on the element position.
     *
     * @template E - The source element type.
     * @template K - The key type produced by the key extractor.
     * @template V - The value type produced by the value extractor.
     * @param keyExtractor - Computes the grouping key from the element and its index.
     * @param valueExtractor - Computes the stored value from the element and its index.
     * @returns A collector that finishes with a Map of grouped values.
     */
    <E, K, V>(keyExtractor: BiFunctional<E, bigint, K>, valueExtractor: BiFunctional<E, bigint, V>): SynchronousCollector<E, Map<K, V[]>, Map<K, V[]>>;
}
/**
 * Creates a collector that groups extracted values into arrays by extracted key.
 *
 * @template E - The source element type.
 * @template K - The extracted key type.
 * @template V - The extracted value type.
 * @param keyExtractor - Extracts the grouping or map key.
 * @param valueExtractor - Extracts the value to store.
 * @returns A reusable collector configured for this operation.
 */
export let useSynchronousGroupBy: UseSynchronousGroupBy = <E, K, V = E>(keyExtractor: Functional<E, K> | BiFunctional<E, bigint, K>, valueExtractor: Functional<E, V> | BiFunctional<E, bigint, V> = (element: E) => element as unknown as V): SynchronousCollector<E, Map<K, V[]>, Map<K, V[]>> => {
    if (isFunction(keyExtractor) && isFunction(valueExtractor)) {
        return SynchronousCollector.full((): Map<K, V[]> => new Map<K, V[]>(), (accumulator: Map<K, V[]>, element: E, index: bigint): Map<K, V[]> => {
            let key: K = keyExtractor(element, index);
            let group: V[] = accumulator.get(key) || [];
            group.push(valueExtractor(element, index));
            accumulator.set(key, group);
            return accumulator;
        }, (accumulator: Map<K, V[]>): Map<K, V[]> => accumulator);
    }
    throw new TypeError("Key extractor and value extractor must be functions.");
};
/**
 * Creates a collector that distributes elements by index modulo the count, using at least one bucket.
 *
 * @template E - The source element type.
 * @param count - The bigint bucket count; values below one use one bucket.
 * @returns A reusable collector configured for this operation.
 */
export let useSynchronousPartition: <E>(count: bigint) => SynchronousCollector<E, Array<Array<E>>, Array<Array<E>>> = <E>(count: bigint): SynchronousCollector<E, Array<Array<E>>, Array<Array<E>>> => {
    if (isBigInt(count)) {
        let limited: bigint = count > 0n ? count : 1n;
        return SynchronousCollector.full((): Array<Array<E>> => {
            return [];
        }, (array: Array<Array<E>>, element: E, index: bigint): Array<Array<E>> => {
            let resolved: bigint = ((index % limited) + limited) % limited;
            let bucket: number = Number(resolved);
            while (array.length <= bucket) {
                array.push([]);
            }
            array[bucket].push(element);
            return array;
        }, (result: Array<Array<E>>): Array<Array<E>> => {
            return result;
        });
    }
    throw new TypeError("Count must be a BigInt.");
};
/**
 * Creates collectors that distribute elements into numbered buckets.
 *
 * The classifier returns a bigint bucket number; negative numbers are treated as
 * zero and buckets are created on demand, so the result is an array of arrays
 * whose length follows the highest bucket reached. useSynchronousPartition is the
 * related factory that buckets by index modulo a fixed count.
 *
 * @template E - The source element type.
 */
interface UseSynchronousPartitionBy {
    /**
     * Computes the bucket number from the element alone.
     *
     * A negative result is clamped to bucket zero, and the bucket array grows as
     * needed before the element is appended.
     *
     * @template E - The source element type.
     * @param classifier - Produces the bigint bucket number for an element.
     * @returns A collector that finishes with the bucket arrays.
     */
    <E>(classifier: Functional<E, bigint>): SynchronousCollector<E, Array<E[]>, Array<E[]>>;
    /**
     * Computes the bucket number from the element and its bigint index.
     *
     * The index lets the bucket depend on position as well as value; negative
     * results are still clamped to bucket zero.
     *
     * @template E - The source element type.
     * @param classifier - Produces the bigint bucket number from element and index.
     * @returns A collector that finishes with the bucket arrays.
     */
    <E>(classifier: BiFunctional<E, bigint, bigint>): SynchronousCollector<E, Array<E[]>, Array<E[]>>;
}
;
/**
 * Creates a collector that distributes elements into classifier-numbered buckets, treating negative bucket numbers as zero.
 *
 * @template E - The source element type.
 * @param classifier - Calculates the grouping key or bigint partition bucket.
 * @returns A reusable collector configured for this operation.
 */
export let useSynchronousPartitionBy: UseSynchronousPartitionBy = <E>(classifier: Functional<E, bigint> | BiFunctional<E, bigint, bigint>): SynchronousCollector<E, Array<E[]>, Array<E[]>> => {
    if (isFunction(classifier)) {
        return SynchronousCollector.full((): Array<Array<E>> => {
            return [];
        }, (array: Array<Array<E>>, element: E, index: bigint): Array<Array<E>> => {
            let resolved: bigint = classifier(element, index);
            let bucket: number = resolved < 0n ? 0 : Number(resolved);
            while (array.length <= bucket) {
                array.push([]);
            }
            array[bucket].push(element);
            return array;
        }, (result: Array<Array<E>>): Array<Array<E>> => {
            return result;
        });
    }
    throw new TypeError("Classifier must be a function.");
};
/**
 * Creates collectors that add numeric elements into one number.
 *
 * Every visited element increments the internal work, but only number results
 * contribute to the sum; non-number results count as zero. It is the number
 * counterpart of useSynchronousBigIntSummate and the basic form of the numeric
 * statistical factories that follow.
 *
 * @template E - The source element type.
 */
interface UseSynchronousNumericSummate {
    /**
     * Converts elements with the library useToNumber conversion.
     *
     * This is the convenient form for numeric sources: conversions that do not
     * produce a number contribute zero while still being visited.
     *
     * @template E - The source element type.
     * @returns A collector that finishes with the numeric sum.
     */
    <E>(): SynchronousCollector<E, number, number>;
    /**
     * Converts elements with a caller-supplied mapper before summing.
     *
     * The mapper decides how each element becomes a number; a non-number result
     * contributes zero and does not abort the collection.
     *
     * @template E - The source element type.
     * @param mapper - Converts an element to the number that is added.
     * @returns A collector that finishes with the numeric sum.
     */
    <E>(mapper: Functional<E, number>): SynchronousCollector<number, number, number>;
}
;
/**
 * Creates a collector that adds mapped numbers, treating non-number results as zero.
 *
 * @template E - The source element type.
 * @param mapper - Converts an element to the required numeric type; defaults to the library conversion.
 * @returns A reusable collector configured for this operation.
 */
export let useSynchronousNumericSummate: UseSynchronousNumericSummate = <E>(mapper: Functional<E, number> = useToNumber): SynchronousCollector<number, number, number> | SynchronousCollector<E, number, number> => {
    return SynchronousCollector.full((): number => 0, (accumulator: number, element: number | E): number => {
        let resolved: number = mapper(element as E);
        return accumulator + (isNumber(resolved) ? resolved : 0);
    }, (result: number): number => result) as SynchronousCollector<number, number, number> | SynchronousCollector<E, number, number>;
};
/**
 * Creates collectors that add bigint elements into one bigint.
 *
 * The structure matches useSynchronousNumericSummate but keeps the accumulator in
 * bigint arithmetic; mapper results that are not bigint contribute zero.
 *
 * @template E - The source element type.
 */
interface UseSynchronousBigIntSummate {
    /**
     * Converts elements with the library useToBigInt conversion.
     *
     * The default conversion covers bigint and values the library can widen;
     * anything else contributes zero without stopping the collection.
     *
     * @template E - The source element type.
     * @returns A collector that finishes with the bigint sum.
     */
    <E>(): SynchronousCollector<E, bigint, bigint>;
    /**
     * Converts elements with a caller-supplied mapper before summing.
     *
     * The mapper must produce a bigint for the value to count; other results are
     * treated as zero while the element is still visited.
     *
     * @template E - The source element type.
     * @param mapper - Converts an element to the bigint that is added.
     * @returns A collector that finishes with the bigint sum.
     */
    <E>(mapper: Functional<E, bigint>): SynchronousCollector<bigint, bigint, bigint>;
}
;
/**
 * Creates a collector that adds mapped bigints, treating non-bigint results as zero.
 *
 * @template E - The source element type.
 * @param mapper - Converts an element to the required numeric type; defaults to the library conversion.
 * @returns A reusable collector configured for this operation.
 */
export let useSynchronousBigIntSummate: UseSynchronousBigIntSummate = <E>(mapper: Functional<E, bigint> = useToBigInt): SynchronousCollector<bigint, bigint, bigint> | SynchronousCollector<E, bigint, bigint> => {
    return SynchronousCollector.full((): bigint => 0n, (accumulator: bigint, element: bigint | E): bigint => {
        let resolved: bigint = mapper(element as E);
        return accumulator + (isBigInt(resolved) ? resolved : 0n);
    }, (result: bigint): bigint => result) as SynchronousCollector<bigint, bigint, bigint> | SynchronousCollector<E, bigint, bigint>;
};
/**
 * Creates collectors that average numeric elements into one number.
 *
 * The accumulator keeps the running sum and the number of visited elements, so
 * the division happens once in the finisher. Every source element is counted,
 * even one whose mapper produced a non-number; an empty source yields zero.
 * useSynchronousNumericSummate only adds and does not count.
 *
 * @template E - The source element type.
 */
interface UseSynchronousNumericAverage {
    /**
     * Converts elements with the library useToNumber conversion.
     *
     * The denominator is the number of visited source elements, so a failed
     * conversion contributes zero to the sum but still counts towards the average.
     *
     * @template E - The source element type.
     * @returns A collector that finishes with the numeric average.
     */
    <E>(): SynchronousCollector<E, NumericAverageAccumulator, number>;
    /**
     * Converts elements with a caller-supplied mapper before averaging.
     *
     * The mapper result is added when it is a number; the denominator remains the
     * element count, and an empty source finishes with zero.
     *
     * @template E - The source element type.
     * @param mapper - Converts an element to the number that is averaged.
     * @returns A collector that finishes with the numeric average.
     */
    <E>(mapper: Functional<E, number>): SynchronousCollector<number, NumericAverageAccumulator, number>;
}
;
/**
 * Accumulator state for the numeric average collectors.
 *
 * It carries the running numeric sum and the number of visited elements; the
 * finisher divides the former by the latter. This type is internal to the
 * factory declarations and is not a collector factory itself.
 */
interface NumericAverageAccumulator {
    summate: number;
    count: number;
}
;
/**
 * Creates a collector that averages mapped numbers, counting every source element and returning zero when empty.
 *
 * @template E - The source element type.
 * @param mapper - Converts an element to the required numeric type; defaults to the library conversion.
 * @returns A reusable collector configured for this operation.
 */
export let useSynchronousNumericAverage: UseSynchronousNumericAverage = <E>(mapper: Functional<E, number> = useToNumber): SynchronousCollector<number, NumericAverageAccumulator, number> | SynchronousCollector<E, NumericAverageAccumulator, number> => {
    return SynchronousCollector.full((): NumericAverageAccumulator => {
        return {
            summate: 0,
            count: 0
        };
    }, (accumulator: NumericAverageAccumulator, element: number | E): NumericAverageAccumulator => {
        let resolved: number = mapper(element as E);
        return {
            summate: accumulator.summate + (isNumber(resolved) ? resolved : 0),
            count: accumulator.count + 1
        };
    }, (result: NumericAverageAccumulator): number => {
        if (result.count === 0) {
            return 0;
        }
        return result.summate / result.count;
    }) as SynchronousCollector<number, NumericAverageAccumulator, number> | SynchronousCollector<E, NumericAverageAccumulator, number>;
};
/**
 * Creates collectors that average bigint elements into one bigint.
 *
 * Sum and count are both bigint, and the finisher performs a truncating division
 * towards zero. Every visited element counts, mapper results that are not bigint
 * contribute zero, and an empty source yields 0n.
 *
 * @template E - The source element type.
 */
interface UseSynchronousBigIntAverage {
    /**
     * Converts elements with the library useToBigInt conversion.
     *
     * The conversion provides the bigint values for the sum, while the divisor is
     * the number of visited elements rather than the number of conversions.
     *
     * @template E - The source element type.
     * @returns A collector that finishes with the bigint average.
     */
    <E>(): SynchronousCollector<E, BigIntAverageAccumulator, bigint>;
    /**
     * Converts elements with a caller-supplied mapper before averaging.
     *
     * Only bigint mapper results are added; all visited elements still count in
     * the divisor, and the final division truncates towards zero.
     *
     * @template E - The source element type.
     * @param mapper - Converts an element to the bigint that is averaged.
     * @returns A collector that finishes with the bigint average.
     */
    <E>(mapper: Functional<E, bigint>): SynchronousCollector<E, BigIntAverageAccumulator, bigint>;
}
;
/**
 * Accumulator state for the bigint average collectors.
 *
 * Both the running sum and the element count are bigint so the averaging never
 * leaves exact integer arithmetic; the finisher divides and truncates.
 */
interface BigIntAverageAccumulator {
    summate: bigint;
    count: bigint;
}
;
/**
 * Creates a collector that averages mapped bigints with division truncated towards zero, returning zero when empty.
 *
 * @template E - The source element type.
 * @param mapper - Converts an element to the required numeric type; defaults to the library conversion.
 * @returns A reusable collector configured for this operation.
 */
export let useSynchronousBigIntAverage: UseSynchronousBigIntAverage = <E>(mapper: Functional<E, bigint> = useToBigInt): SynchronousCollector<bigint, BigIntAverageAccumulator, bigint> | SynchronousCollector<E, BigIntAverageAccumulator, bigint> => {
    return SynchronousCollector.full((): BigIntAverageAccumulator => {
        return {
            summate: 0n,
            count: 0n
        };
    }, (accumulator: BigIntAverageAccumulator, element: bigint | E): BigIntAverageAccumulator => {
        let resolved: bigint = mapper(element as E);
        return {
            summate: accumulator.summate + (isBigInt(resolved) ? resolved : 0n),
            count: accumulator.count + 1n
        };
    }, (result: BigIntAverageAccumulator): bigint => {
        if (result.count === 0n) {
            return 0n;
        }
        return result.summate / result.count;
    }) as SynchronousCollector<bigint, BigIntAverageAccumulator, bigint> | SynchronousCollector<E, BigIntAverageAccumulator, bigint>;
};
/**
 * Creates a collector that counts each distinct element with bigint frequencies.
 *
 * @template E - The source element type.
 * @returns A reusable collector configured for this operation.
 */
export let useSynchronousFrequency: <E>() => SynchronousCollector<E, Map<E, bigint>, Map<E, bigint>> = <E>(): SynchronousCollector<E, Map<E, bigint>, Map<E, bigint>> => {
    return SynchronousCollector.full((): Map<E, bigint> => new Map<E, bigint>(), (map: Map<E, bigint>, element: E): Map<E, bigint> => {
        let count: bigint = map.get(element) || 0n;
        map.set(element, count + 1n);
        return map;
    }, (map: Map<E, bigint>): Map<E, bigint> => map);
};
/**
 * Creates collectors that select the most frequent numeric value.
 *
 * The accumulator is a Map from number to occurrence count; a scan in the
 * finisher picks the highest count and keeps the first encountered value on
 * ties. An empty source yields zero. useSynchronousNumericMedian instead sorts
 * all values, so this factory uses memory proportional to distinct values.
 *
 * @template E - The source element type.
 */
interface UseSynchronousNumericMode {
    /**
     * Converts elements with the library useToNumber conversion.
     *
     * Each converted number increments its count in the frequency map; the
     * conversion itself never rejects an element from being visited.
     *
     * @template E - The source element type.
     * @returns A collector that finishes with the most frequent number.
     */
    <E>(): SynchronousCollector<E, Map<number, bigint>, number>;
    /**
     * Converts elements with a caller-supplied mapper before counting.
     *
     * The mapper output is the value whose frequency is measured; ties keep the
     * first value encountered, and an empty source finishes with zero.
     *
     * @template E - The source element type.
     * @param mapper - Converts an element to the number whose frequency is counted.
     * @returns A collector that finishes with the most frequent number.
     */
    <E>(mapper: Functional<E, number>): SynchronousCollector<E, Map<number, bigint>, number>;
}
;
/**
 * Creates a collector that selects the most frequent mapped number, keeping the first encountered value on ties and returning zero when empty.
 *
 * @template E - The source element type.
 * @param mapper - Converts an element to the required numeric type; defaults to the library conversion.
 * @returns A reusable collector configured for this operation.
 */
export let useSynchronousNumericMode: UseSynchronousNumericMode = <E>(mapper: Functional<E, number> = useToNumber): SynchronousCollector<number, Map<number, bigint>, number> | SynchronousCollector<E, Map<number, bigint>, number> => {
    return SynchronousCollector.full((): Map<number, bigint> => new Map<number, bigint>(), (map: Map<number, bigint>, element: number | E): Map<number, bigint> => {
        let resolved: number = mapper(element as E);
        let count: bigint = map.get(resolved) || 0n;
        map.set(resolved, count + 1n);
        return map;
    }, (map: Map<number, bigint>): number => {
        let maxCount: bigint = 0n;
        let mode: number = 0;
        for (let [key, value] of map) {
            if (value > maxCount) {
                maxCount = value;
                mode = key;
            }
        }
        return mode;
    }) as SynchronousCollector<number, Map<number, bigint>, number> | SynchronousCollector<E, Map<number, bigint>, number>;
};
/**
 * Creates collectors that select the most frequent bigint value.
 *
 * The accumulator is a Map from bigint to bigint count, and the finisher keeps
 * the first value on ties. An empty source yields 0n. It mirrors
 * useSynchronousNumericMode in bigint arithmetic.
 *
 * @template E - The source element type.
 */
interface UseSynchronousBigIntMode {
    /**
     * Converts elements with the library useToBigInt conversion.
     *
     * Every visited element advances the stream, while the map counts only the
     * bigint values the conversion produces.
     *
     * @template E - The source element type.
     * @returns A collector that finishes with the most frequent bigint.
     */
    <E>(): SynchronousCollector<E, Map<bigint, bigint>, bigint>;
    /**
     * Converts elements with a caller-supplied mapper before counting.
     *
     * The mapper output is the value whose frequency is measured; ties keep the
     * first value encountered and an empty source finishes with 0n.
     *
     * @template E - The source element type.
     * @param mapper - Converts an element to the bigint whose frequency is counted.
     * @returns A collector that finishes with the most frequent bigint.
     */
    <E>(mapper: Functional<E, bigint>): SynchronousCollector<E, Map<bigint, bigint>, bigint>;
}
;
/**
 * Creates a collector that selects the most frequent mapped bigint, keeping the first encountered value on ties and returning zero when empty.
 *
 * @template E - The source element type.
 * @param mapper - Converts an element to the required numeric type; defaults to the library conversion.
 * @returns A reusable collector configured for this operation.
 */
export let useSynchronousBigIntMode: UseSynchronousBigIntMode = <E>(mapper: Functional<E, bigint> = useToBigInt): SynchronousCollector<bigint, Map<bigint, bigint>, bigint> | SynchronousCollector<E, Map<bigint, bigint>, bigint> => {
    return SynchronousCollector.full((): Map<bigint, bigint> => new Map<bigint, bigint>(), (map: Map<bigint, bigint>, element: bigint | E): Map<bigint, bigint> => {
        let resolved: bigint = mapper(element as E);
        let count: bigint = map.get(resolved) || 0n;
        map.set(resolved, count + 1n);
        return map;
    }, (map: Map<bigint, bigint>): bigint => {
        let maxCount: bigint = 0n;
        let mode: bigint = 0n;
        for (let [key, value] of map) {
            if (value > maxCount) {
                maxCount = value;
                mode = key;
            }
        }
        return mode;
    }) as SynchronousCollector<bigint, Map<bigint, bigint>, bigint> | SynchronousCollector<E, Map<bigint, bigint>, bigint>;
};
/**
 * Creates collectors that calculate population variance of numeric elements.
 *
 * The accumulator keeps the sum, the sum of squares and the count, and the
 * finisher computes mean and variance from them. Fewer than two elements yield
 * zero. Standard deviation is the square root of this value and is exposed by a
 * separate factory.
 *
 * @template E - The source element type.
 */
interface UseSynchronousNumericVariance {
    /**
     * Converts elements with the library useToNumber conversion.
     *
     * Non-number conversions add zero to both sums but still increment the count,
     * which keeps the population denominator equal to the visited element count.
     *
     * @template E - The source element type.
     * @returns A collector that finishes with the population variance.
     */
    <E>(): SynchronousCollector<E, VarianceAccumulator, number>;
    /**
     * Converts elements with a caller-supplied mapper before measuring variance.
     *
     * Numeric mapper results feed both the sum and the sum of squares; the count
     * still advances for every element and drives the population denominator.
     *
     * @template E - The source element type.
     * @param mapper - Converts an element to the number whose variance is measured.
     * @returns A collector that finishes with the population variance.
     */
    <E>(mapper: Functional<E, number>): SynchronousCollector<E, VarianceAccumulator, number>;
}
;
/**
 * Accumulator state for the numeric variance and standard deviation collectors.
 *
 * It stores the running sum, the running sum of squares and the element count so
 * the finisher can derive mean and population variance in one pass.
 */
interface VarianceAccumulator {
    summate: number;
    summateOfSquares: number;
    count: number;
}
;
/**
 * Creates a collector that calculates population variance of mapped numbers, returning zero for fewer than two elements.
 *
 * @template E - The source element type.
 * @param mapper - Converts an element to the required numeric type; defaults to the library conversion.
 * @returns A reusable collector configured for this operation.
 */
export let useSynchronousNumericVariance: UseSynchronousNumericVariance = <E>(mapper: Functional<E, number> = useToNumber): SynchronousCollector<number, VarianceAccumulator, number> | SynchronousCollector<E, VarianceAccumulator, number> => {
    return SynchronousCollector.full((): VarianceAccumulator => {
        return {
            summate: 0,
            summateOfSquares: 0,
            count: 0
        };
    }, (accumulator: VarianceAccumulator, element: number | E): VarianceAccumulator => {
        let resolved: number = mapper(element as E);
        return {
            summate: accumulator.summate + (isNumber(resolved) ? resolved : 0),
            summateOfSquares: accumulator.summateOfSquares + (isNumber(resolved) ? Math.pow(resolved, 2) : 0),
            count: accumulator.count + 1
        };
    }, (result: VarianceAccumulator): number => {
        if (result.count < 2) {
            return 0;
        }
        let mean: number = result.summate / result.count;
        let variance: number = (result.summateOfSquares / result.count) - Math.pow(mean, 2);
        return variance;
    }) as SynchronousCollector<number, VarianceAccumulator, number> | SynchronousCollector<E, VarianceAccumulator, number>;
};
/**
 * Creates collectors that calculate integer-rounded population variance of bigint elements.
 *
 * The accumulator is centred on the first value so bigint differences stay in
 * number range while a running mean and squared-deviation sum are maintained.
 * Fewer than two elements yield 0n. The numeric counterpart uses plain sums.
 *
 * @template E - The source element type.
 */
interface UseSynchronousBigIntVariance {
    /**
     * Converts elements with the library useToBigInt conversion.
     *
     * The first converted value becomes the baseline; later values are measured
     * as offsets from it, which keeps the arithmetic exact for large bigints.
     *
     * @template E - The source element type.
     * @returns A collector that finishes with the rounded population variance.
     */
    <E>(): SynchronousCollector<E, BigIntVarianceAccumulator, bigint>;
    /**
     * Converts elements with a caller-supplied mapper before measuring variance.
     *
     * The mapper supplies the bigint values, and the same baseline-centred
     * accumulation keeps the rounded variance stable for large magnitudes.
     *
     * @template E - The source element type.
     * @param mapper - Converts an element to the bigint whose variance is measured.
     * @returns A collector that finishes with the rounded population variance.
     */
    <E>(mapper: Functional<E, bigint>): SynchronousCollector<E, BigIntVarianceAccumulator, bigint>;
}
;
/**
 * Accumulator state for the synchronous bigint variance collector.
 *
 * The first value is stored as the baseline, a running mean is kept relative to
 * that baseline, and squaredDeviations accumulates the offsets from the mean so
 * the finisher can round the population variance into a bigint.
 */
interface BigIntVarianceAccumulator {
    baseline: bigint;
    mean: number;
    squaredDeviations: number;
    count: number;
}
;
/**
 * Creates a collector that calculates integer-rounded population variance of mapped bigints, returning zero for fewer than two elements.
 *
 * @template E - The source element type.
 * @param mapper - Converts an element to the required numeric type; defaults to the library conversion.
 * @returns A reusable collector configured for this operation.
 */
export let useSynchronousBigIntVariance: UseSynchronousBigIntVariance = <E>(mapper: Functional<E, bigint> = useToBigInt): SynchronousCollector<bigint, BigIntVarianceAccumulator, bigint> | SynchronousCollector<E, BigIntVarianceAccumulator, bigint> => {
    return SynchronousCollector.full((): BigIntVarianceAccumulator => {
        return { baseline: 0n, mean: 0, squaredDeviations: 0, count: 0 };
    }, (accumulator: BigIntVarianceAccumulator, element: bigint | E): BigIntVarianceAccumulator => {
        let resolved: bigint = mapper(element as E);
        let value: bigint = isBigInt(resolved) ? resolved : 0n;
        let baseline: bigint = accumulator.count === 0 ? value : accumulator.baseline;
        let offset: number = Number(value - baseline);
        let count: number = accumulator.count + 1;
        let delta: number = offset - accumulator.mean;
        let mean: number = accumulator.mean + delta / count;
        return {
            baseline,
            mean,
            squaredDeviations: accumulator.squaredDeviations + delta * (offset - mean),
            count
        };
    }, (result: BigIntVarianceAccumulator): bigint => {
        return result.count < 2 ? 0n : BigInt(Math.round(result.squaredDeviations / result.count));
    }) as SynchronousCollector<bigint, BigIntVarianceAccumulator, bigint> | SynchronousCollector<E, BigIntVarianceAccumulator, bigint>;
};
/**
 * Creates collectors that calculate population standard deviation of numeric elements.
 *
 * It shares the sum, sum of squares and count accumulator with
 * useSynchronousNumericVariance but finishes with the square root of the
 * variance. Fewer than two elements yield zero.
 *
 * @template E - The source element type.
 */
interface UseSynchronousNumericStandardDeviation {
    /**
     * Converts elements with the library useToNumber conversion.
     *
     * Non-number conversions contribute zero to both sums yet still count towards
     * the population size used by the finisher.
     *
     * @template E - The source element type.
     * @returns A collector that finishes with the population standard deviation.
     */
    <E>(): SynchronousCollector<E, StandardDeviationAccumulator, number>;
    /**
     * Converts elements with a caller-supplied mapper before measuring dispersion.
     *
     * Numeric mapper results feed the sums, the count stays element-based, and
     * the finisher takes the square root of the resulting variance.
     *
     * @template E - The source element type.
     * @param mapper - Converts an element to the number whose deviation is measured.
     * @returns A collector that finishes with the population standard deviation.
     */
    <E>(mapper: Functional<E, number>): SynchronousCollector<E, StandardDeviationAccumulator, number>;
}
;
/**
 * Accumulator state shared by the numeric deviations and their standard deviation.
 *
 * It holds the running sum, the running sum of squares and the element count;
 * variance is derived from them and standard deviation takes its square root.
 */
interface StandardDeviationAccumulator {
    summate: number;
    summateOfSquares: number;
    count: number;
}
;
/**
 * Creates a collector that calculates population standard deviation of mapped numbers, returning zero for fewer than two elements.
 *
 * @template E - The source element type.
 * @param mapper - Converts an element to the required numeric type; defaults to the library conversion.
 * @returns A reusable collector configured for this operation.
 */
export let useSynchronousNumericStandardDeviation: UseSynchronousNumericStandardDeviation = <E>(mapper: Functional<E, number> = useToNumber): SynchronousCollector<number, StandardDeviationAccumulator, number> | SynchronousCollector<E, StandardDeviationAccumulator, number> => {
    return SynchronousCollector.full((): StandardDeviationAccumulator => {
        return {
            summate: 0,
            summateOfSquares: 0,
            count: 0
        };
    }, (accumulator: StandardDeviationAccumulator, element: number | E): StandardDeviationAccumulator => {
        let resolved: number = mapper(element as E);
        return {
            summate: accumulator.summate + (isNumber(resolved) ? resolved : 0),
            summateOfSquares: accumulator.summateOfSquares + (isNumber(resolved) ? Math.pow(resolved, 2) : 0),
            count: accumulator.count + 1
        };
    }, (result: StandardDeviationAccumulator): number => {
        if (result.count < 2) {
            return 0;
        }
        let mean: number = result.summate / result.count;
        let variance: number = (result.summateOfSquares / result.count) - Math.pow(mean, 2);
        let standardDeviation: number = Math.sqrt(variance);
        return standardDeviation;
    }) as SynchronousCollector<number, StandardDeviationAccumulator, number> | SynchronousCollector<E, StandardDeviationAccumulator, number>;
};
/**
 * Creates collectors that calculate integer-rounded population standard deviation of bigint elements.
 *
 * It reuses the baseline-centred accumulator of the bigint variance collector and
 * the finisher rounds the square root of the population variance back to bigint.
 * Fewer than two elements yield 0n.
 *
 * @template E - The source element type.
 */
interface UseSynchronousBigIntStandardDeviation {
    /**
     * Converts elements with the library useToBigInt conversion.
     *
     * The first converted value anchors the baseline so large bigints can be
     * compared and squared without losing exactness.
     *
     * @template E - The source element type.
     * @returns A collector that finishes with the rounded population standard deviation.
     */
    <E>(): SynchronousCollector<E, BigIntStandardDeviationAccumulator, bigint>;
    /**
     * Converts elements with a caller-supplied mapper before measuring dispersion.
     *
     * The mapper supplies the bigint values; baseline-centred accumulation and
     * rounding happen exactly as in the default conversion form.
     *
     * @template E - The source element type.
     * @param mapper - Converts an element to the bigint whose deviation is measured.
     * @returns A collector that finishes with the rounded population standard deviation.
     */
    <E>(mapper: Functional<E, bigint>): SynchronousCollector<E, BigIntStandardDeviationAccumulator, bigint>;
}
;
/**
 * Accumulator state for the synchronous bigint standard deviation collector.
 *
 * It keeps the baseline, a running mean relative to that baseline, the squared
 * deviations and the element count, the same state the variance factory uses.
 */
interface BigIntStandardDeviationAccumulator {
    baseline: bigint;
    mean: number;
    squaredDeviations: number;
    count: number;
}
;
/**
 * Creates a collector that calculates integer-rounded population standard deviation of mapped bigints.
 *
 * @template E - The source element type.
 * @param mapper - Converts an element to the required numeric type; defaults to the library conversion.
 * @returns A reusable collector configured for this operation.
 */
export let useSynchronousBigIntStandardDeviation: UseSynchronousBigIntStandardDeviation = <E>(mapper: Functional<E, bigint> = useToBigInt): SynchronousCollector<bigint, BigIntStandardDeviationAccumulator, bigint> | SynchronousCollector<E, BigIntStandardDeviationAccumulator, bigint> => {
    return SynchronousCollector.full((): BigIntStandardDeviationAccumulator => {
        return { baseline: 0n, mean: 0, squaredDeviations: 0, count: 0 };
    }, (accumulator: BigIntStandardDeviationAccumulator, element: bigint | E): BigIntStandardDeviationAccumulator => {
        let resolved: bigint = mapper(element as E);
        let value: bigint = isBigInt(resolved) ? resolved : 0n;
        let baseline: bigint = accumulator.count === 0 ? value : accumulator.baseline;
        let offset: number = Number(value - baseline);
        let count: number = accumulator.count + 1;
        let delta: number = offset - accumulator.mean;
        let mean: number = accumulator.mean + delta / count;
        return {
            baseline,
            mean,
            squaredDeviations: accumulator.squaredDeviations + delta * (offset - mean),
            count
        };
    }, (result: BigIntStandardDeviationAccumulator): bigint => {
        return result.count < 2 ? 0n : BigInt(Math.round(Math.sqrt(result.squaredDeviations / result.count)));
    }) as SynchronousCollector<bigint, BigIntStandardDeviationAccumulator, bigint> | SynchronousCollector<E, BigIntStandardDeviationAccumulator, bigint>;
};
/**
 * Creates collectors that select the median of numeric elements.
 *
 * All mapped numbers are buffered and sorted, then the middle value is returned;
 * for an even count the two middle values are averaged. An empty source yields
 * NaN. Unlike the sum-based statistics, the memory cost grows with the source.
 *
 * @template E - The source element type.
 */
interface UseSynchronousNumericMedian {
    /**
     * Converts elements with the library useToNumber conversion.
     *
     * Every converted number is appended to the buffer and the buffer is kept
     * sorted, so the finisher can index the middle without a second pass.
     *
     * @template E - The source element type.
     * @returns A collector that finishes with the numeric median.
     */
    <E>(): SynchronousCollector<E, number[], number>;
    /**
     * Converts elements with a caller-supplied mapper before selecting the median.
     *
     * The mapper output is buffered rather than accumulated, and the even-count
     * case averages the two middle values.
     *
     * @template E - The source element type.
     * @param mapper - Converts an element to the number placed in the buffer.
     * @returns A collector that finishes with the numeric median.
     */
    <E>(mapper: Functional<E, number>): SynchronousCollector<E, number[], number>;
}
;
/**
 * Creates a collector that sorts mapped numbers and selects the middle value or averages the two middle values. An empty source produces NaN.
 *
 * @template E - The source element type.
 * @param mapper - Converts an element to the required numeric type; defaults to the library conversion.
 * @returns A reusable collector configured for this operation.
 */
export let useSynchronousNumericMedian: UseSynchronousNumericMedian = <E>(mapper: Functional<E, number> = useToNumber): SynchronousCollector<number, number[], number> | SynchronousCollector<E, number[], number> => {
    return SynchronousCollector.full((): number[] => [], (array: number[], element: number | E): number[] => {
        let resolved: number = mapper(element as E);
        array.push(resolved);
        array.sort((a: number, b: number): number => a - b);
        return array;
    }, (array: number[]): number => {
        let length: number = array.length;
        if (length % 2 === 0) {
            let mid: number = length / 2;
            return (array[mid - 1] + array[mid]) / 2;
        }
        else {
            let mid: number = Math.floor(length / 2);
            return array[mid];
        }
    }) as SynchronousCollector<number, number[], number> | SynchronousCollector<E, number[], number>;
};
/**
 * Creates collectors that select the median of bigint elements.
 *
 * The structure matches useSynchronousNumericMedian, but the two middle values of
 * an even-sized buffer are averaged with truncating bigint division. An empty
 * source throws while finishing because there is no bigint NaN.
 *
 * @template E - The source element type.
 */
interface UseSynchronousBigIntMedian {
    /**
     * Converts elements with the library useToBigInt conversion.
     *
     * Converted bigints are buffered and sorted; the finisher indexes the middle
     * and, for an even count, divides the sum of the two middles by 2n.
     *
     * @template E - The source element type.
     * @returns A collector that finishes with the bigint median.
     */
    <E>(): SynchronousCollector<E, bigint[], bigint>;
    /**
     * Converts elements with a caller-supplied mapper before selecting the median.
     *
     * The mapper supplies the buffered bigints, and the even-count average stays
     * in bigint arithmetic with truncation towards zero.
     *
     * @template E - The source element type.
     * @param mapper - Converts an element to the bigint placed in the buffer.
     * @returns A collector that finishes with the bigint median.
     */
    <E>(mapper: Functional<E, bigint>): SynchronousCollector<E, bigint[], bigint>;
}
;
/**
 * Creates a collector that sorts mapped bigints and selects the middle value or averages the two middle values with truncating division. Finishing an empty source throws when averaging missing values.
 *
 * @template E - The source element type.
 * @param mapper - Converts an element to the required numeric type; defaults to the library conversion.
 * @returns A reusable collector configured for this operation.
 */
export let useSynchronousBigIntMedian: UseSynchronousBigIntMedian = <E>(mapper: Functional<E, bigint> = useToBigInt): SynchronousCollector<bigint, bigint[], bigint> | SynchronousCollector<E, bigint[], bigint> => {
    return SynchronousCollector.full((): bigint[] => [], (array: bigint[], element: bigint | E): bigint[] => {
        let resolved: bigint = mapper(element as E);
        array.push(resolved);
        array.sort((a: bigint, b: bigint): number => Number(a - b));
        return array;
    }, (array: bigint[]): bigint => {
        let length: number = array.length;
        if (length % 2 === 0) {
            let mid: number = length / 2;
            return (array[Number(mid - 1)] + array[mid]) / 2n;
        }
        else {
            let mid: number = Math.floor(length / 2);
            return array[mid];
        }
    }) as SynchronousCollector<bigint, bigint[], bigint> | SynchronousCollector<E, bigint[], bigint>;
};
