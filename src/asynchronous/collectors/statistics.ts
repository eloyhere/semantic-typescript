/**
 * Asynchronous collectors that fold the source into a numeric summary: totals,
 * averages, medians, modes, dispersion, frequency tables and grouping.
 */
import { isFunction, isNumber, isBigInt } from "#semantic/guard";
import { useToBigInt, useToNumber } from "#semantic/hook";
import { AsynchronousCollector } from "#semantic/asynchronous/collector";
import type { BiFunctional, Functional } from "#semantic/utility";

/**
 * Creates collectors that group elements into arrays under a computed key.
 *
 * The finished value is a Map from key to the elements that produced it, with
 * encounter order preserved inside each array. useAsynchronousGroupBy also
 * transforms the values and useAsynchronousPartitionBy uses bigint bucket numbers.
 *
 * @template E - The source element type.
 * @template K - The key type produced by the classifier.
 */
interface UseAsynchronousGroup {
    /**
     * Classifies each element with a function that only receives the element.
     *
     * The key is computed once per awaited element and the element is appended to
     * the matching array; a new array is created the first time a key appears.
     *
     * @template E - The source element type.
     * @template K - The key type produced by the classifier.
     * @param classifier - Computes the grouping key from the element.
     * @returns A collector that finishes with a Map of grouped elements.
     */
    <E, K>(classifier: Functional<E, K>): AsynchronousCollector<E, Map<K, E[]>, Map<K, E[]>>;
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
    <E, K>(classifier: BiFunctional<E, bigint, K>): AsynchronousCollector<E, Map<K, E[]>, Map<K, E[]>>;
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
export let useAsynchronousGroup: UseAsynchronousGroup = <E, K>(classifier: Functional<E, K> | BiFunctional<E, bigint, K>): AsynchronousCollector<E, Map<K, E[]>, Map<K, E[]>> => {
    if (isFunction(classifier)) {
        return AsynchronousCollector.full((): Map<K, E[]> => new Map<K, E[]>(), (accumulator: Map<K, E[]>, element: E, index: bigint): Map<K, E[]> => {
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
 * Unlike useAsynchronousGroup, the stored value may differ from the source
 * element: the key extractor and the value extractor are independent functions.
 * Order inside each array still follows encounter order.
 *
 * @template E - The source element type.
 * @template K - The key type produced by the extractor.
 * @template V - The value type stored under each key.
 */
interface UseAsynchronousGroupBy {
    /**
     * Extracts only the key and stores the source elements themselves.
     *
     * This is the degenerate form where the value extractor is the identity, so
     * it behaves like useAsynchronousGroup but with the same extractor naming.
     *
     * @template E - The source element type.
     * @template K - The key type produced by the extractor.
     * @param keyExtractor - Computes the grouping key from the element.
     * @returns A collector that finishes with a Map of grouped source elements.
     */
    <E, K>(keyExtractor: Functional<E, K>): AsynchronousCollector<E, Map<K, E[]>, Map<K, E[]>>;
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
    <E, K, V>(keyExtractor: Functional<E, K>, valueExtractor: Functional<E, V>): AsynchronousCollector<E, Map<K, V[]>, Map<K, V[]>>;
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
    <E, K, V>(keyExtractor: BiFunctional<E, bigint, K>, valueExtractor: BiFunctional<E, bigint, V>): AsynchronousCollector<E, Map<K, V[]>, Map<K, V[]>>;
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
export let useAsynchronousGroupBy: UseAsynchronousGroupBy = <E, K, V = E>(keyExtractor: Functional<E, K> | BiFunctional<E, bigint, K>, valueExtractor: Functional<E, V> | BiFunctional<E, bigint, V> = (element: E) => element as unknown as V): AsynchronousCollector<E, Map<K, V[]>, Map<K, V[]>> => {
    if (isFunction(keyExtractor) && isFunction(valueExtractor)) {
        return AsynchronousCollector.full((): Map<K, V[]> => new Map<K, V[]>(), (accumulator: Map<K, V[]>, element: E, index: bigint): Map<K, V[]> => {
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
export let useAsynchronousPartition: <E>(count: bigint) => AsynchronousCollector<E, Array<Array<E>>, Array<Array<E>>> = <E>(count: bigint): AsynchronousCollector<E, Array<Array<E>>, Array<Array<E>>> => {
    if (isBigInt(count)) {
        let limited = count > 1n ? count : 1n;
        return AsynchronousCollector.full((): Array<Array<E>> => {
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
 * whose length follows the highest bucket reached. useAsynchronousPartition is the
 * related factory that buckets by index modulo a fixed count.
 *
 * @template E - The source element type.
 */
interface UseAsynchronousPartitionBy {
    /**
     * Computes the bucket number from the element alone.
     *
     * A negative result is clamped to bucket zero, and the bucket array grows as
     * needed before the awaited element is appended.
     *
     * @template E - The source element type.
     * @param classifier - Produces the bigint bucket number for an element.
     * @returns A collector that finishes with the bucket arrays.
     */
    <E>(classifier: Functional<E, bigint>): AsynchronousCollector<E, Array<E[]>, Array<E[]>>;
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
    <E>(classifier: BiFunctional<E, bigint, bigint>): AsynchronousCollector<E, Array<E[]>, Array<E[]>>;
}
;
/**
 * Creates a collector that distributes elements into classifier-numbered buckets, treating negative bucket numbers as zero.
 *
 * @template E - The source element type.
 * @param classifier - Calculates the grouping key or bigint partition bucket.
 * @returns A reusable collector configured for this operation.
 */
export let useAsynchronousPartitionBy: UseAsynchronousPartitionBy = <E>(classifier: Functional<E, bigint> | BiFunctional<E, bigint, bigint>): AsynchronousCollector<E, Array<E[]>, Array<E[]>> => {
    if (isFunction(classifier)) {
        return AsynchronousCollector.full((): Array<Array<E>> => {
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
 * Every visited element advances the source, but only number results contribute
 * to the sum; non-number results count as zero. It is the number counterpart of
 * useAsynchronousBigIntSummate and the basic form of the numeric statistical
 * factories that follow.
 *
 * @template E - The source element type.
 */
interface UseAsynchronousNumericSummate {
    /**
     * Converts elements with the library useToNumber conversion.
     *
     * This is the convenient form for numeric sources: conversions that do not
     * produce a number contribute zero while still being visited.
     *
     * @template E - The source element type.
     * @returns A collector that finishes with the numeric sum.
     */
    <E>(): AsynchronousCollector<E, number, number>;
    /**
     * Converts elements with a caller-supplied mapper before summing.
     *
     * The mapper decides how each awaited element becomes a number; a non-number
     * result contributes zero and does not abort the collection.
     *
     * @template E - The source element type.
     * @param mapper - Converts an element to the number that is added.
     * @returns A collector that finishes with the numeric sum.
     */
    <E>(mapper: Functional<E, number>): AsynchronousCollector<number, number, number>;
}
;
/**
 * Creates a collector that adds mapped numbers, treating non-number results as zero.
 *
 * @template E - The source element type.
 * @param mapper - Converts an element to the required numeric type; defaults to the library conversion.
 * @returns A reusable collector configured for this operation.
 */
export let useAsynchronousNumericSummate: UseAsynchronousNumericSummate = <E>(mapper: Functional<E, number> = useToNumber): AsynchronousCollector<number, number, number> | AsynchronousCollector<E, number, number> => {
    return AsynchronousCollector.full((): number => 0, (accumulator: number, element: number | E): number => {
        let resolved: number = mapper(element as E);
        return accumulator + (isNumber(resolved) ? resolved : 0);
    }, (result: number): number => result) as AsynchronousCollector<number, number, number> | AsynchronousCollector<E, number, number>;
};
/**
 * Creates collectors that add bigint elements into one bigint.
 *
 * The structure matches useAsynchronousNumericSummate but keeps the accumulator
 * in bigint arithmetic; mapper results that are not bigint contribute zero.
 *
 * @template E - The source element type.
 */
interface UseAsynchronousBigIntSummate {
    /**
     * Converts elements with the library useToBigInt conversion.
     *
     * The default conversion covers bigint and values the library can widen;
     * anything else contributes zero without stopping the collection.
     *
     * @template E - The source element type.
     * @returns A collector that finishes with the bigint sum.
     */
    <E>(): AsynchronousCollector<E, bigint, bigint>;
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
    <E>(mapper: Functional<E, bigint>): AsynchronousCollector<bigint, bigint, bigint>;
}
;
/**
 * Creates a collector that adds mapped bigints, treating non-bigint results as zero.
 *
 * @template E - The source element type.
 * @param mapper - Converts an element to the required numeric type; defaults to the library conversion.
 * @returns A reusable collector configured for this operation.
 */
export let useAsynchronousBigIntSummate: UseAsynchronousBigIntSummate = <E>(mapper: Functional<E, bigint> = useToBigInt): AsynchronousCollector<bigint, bigint, bigint> | AsynchronousCollector<E, bigint, bigint> => {
    return AsynchronousCollector.full((): bigint => 0n, (accumulator: bigint, element: bigint | E): bigint => {
        let resolved: bigint = mapper(element as E);
        return accumulator + (isBigInt(resolved) ? resolved : 0n);
    }, (result: bigint): bigint => result) as AsynchronousCollector<bigint, bigint, bigint> | AsynchronousCollector<E, bigint, bigint>;
};
/**
 * Creates collectors that average numeric elements into one number.
 *
 * The accumulator keeps the running sum and the number of visited elements, so
 * the division happens once in the finisher. Every source element is counted,
 * even one whose mapper produced a non-number; an empty source yields zero.
 * useAsynchronousNumericSummate only adds and does not count.
 *
 * @template E - The source element type.
 */
interface UseAsynchronousNumericAverage {
    /**
     * Converts elements with the library useToNumber conversion.
     *
     * The denominator is the number of visited source elements, so a failed
     * conversion contributes zero to the sum but still counts towards the average.
     *
     * @template E - The source element type.
     * @returns A collector that finishes with the numeric average.
     */
    <E>(): AsynchronousCollector<E, NumericAverageAccumulator, number>;
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
    <E>(mapper: Functional<E, number>): AsynchronousCollector<number, NumericAverageAccumulator, number>;
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
export let useAsynchronousNumericAverage: UseAsynchronousNumericAverage = <E>(mapper: Functional<E, number> = useToNumber): AsynchronousCollector<number, NumericAverageAccumulator, number> | AsynchronousCollector<E, NumericAverageAccumulator, number> => {
    return AsynchronousCollector.full((): NumericAverageAccumulator => {
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
    }) as AsynchronousCollector<number, NumericAverageAccumulator, number> | AsynchronousCollector<E, NumericAverageAccumulator, number>;
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
interface UseAsynchronousBigIntAverage {
    /**
     * Converts elements with the library useToBigInt conversion.
     *
     * The conversion provides the bigint values for the sum, while the divisor is
     * the number of visited elements rather than the number of conversions.
     *
     * @template E - The source element type.
     * @returns A collector that finishes with the bigint average.
     */
    <E>(): AsynchronousCollector<E, BigIntAverageAccumulator, bigint>;
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
    <E>(mapper: Functional<E, bigint>): AsynchronousCollector<E, BigIntAverageAccumulator, bigint>;
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
export let useAsynchronousBigIntAverage: UseAsynchronousBigIntAverage = <E>(mapper: Functional<E, bigint> = useToBigInt): AsynchronousCollector<bigint, BigIntAverageAccumulator, bigint> | AsynchronousCollector<E, BigIntAverageAccumulator, bigint> => {
    return AsynchronousCollector.full((): BigIntAverageAccumulator => {
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
    }) as AsynchronousCollector<bigint, BigIntAverageAccumulator, bigint> | AsynchronousCollector<E, BigIntAverageAccumulator, bigint>;
};
/**
 * Creates a collector that counts each distinct element with bigint frequencies.
 *
 * @template E - The source element type.
 * @returns A reusable collector configured for this operation.
 */
export let useAsynchronousFrequency: <E>() => AsynchronousCollector<E, Map<E, bigint>, Map<E, bigint>> = <E>(): AsynchronousCollector<E, Map<E, bigint>, Map<E, bigint>> => {
    return AsynchronousCollector.full((): Map<E, bigint> => new Map<E, bigint>(), (map: Map<E, bigint>, element: E): Map<E, bigint> => {
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
 * ties. An empty source yields zero. useAsynchronousNumericMedian instead sorts
 * all values, so this factory uses memory proportional to distinct values.
 *
 * @template E - The source element type.
 */
interface UseAsynchronousNumericMode {
    /**
     * Converts elements with the library useToNumber conversion.
     *
     * Each converted number increments its count in the frequency map; the
     * conversion itself never rejects an element from being visited.
     *
     * @template E - The source element type.
     * @returns A collector that finishes with the most frequent number.
     */
    <E>(): AsynchronousCollector<E, Map<number, bigint>, number>;
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
    <E>(mapper: Functional<E, number>): AsynchronousCollector<E, Map<number, bigint>, number>;
}
;
/**
 * Creates a collector that selects the most frequent mapped number, keeping the first encountered value on ties and returning zero when empty.
 *
 * @template E - The source element type.
 * @param mapper - Converts an element to the required numeric type; defaults to the library conversion.
 * @returns A reusable collector configured for this operation.
 */
export let useAsynchronousNumericMode: UseAsynchronousNumericMode = <E>(mapper: Functional<E, number> = useToNumber): AsynchronousCollector<number, Map<number, bigint>, number> | AsynchronousCollector<E, Map<number, bigint>, number> => {
    return AsynchronousCollector.full((): Map<number, bigint> => new Map<number, bigint>(), (map: Map<number, bigint>, element: number | E): Map<number, bigint> => {
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
    }) as AsynchronousCollector<number, Map<number, bigint>, number> | AsynchronousCollector<E, Map<number, bigint>, number>;
};
/**
 * Creates collectors that select the most frequent bigint value.
 *
 * The accumulator is a Map from bigint to bigint count, and the finisher keeps
 * the first value on ties. An empty source yields 0n. It mirrors
 * useAsynchronousNumericMode in bigint arithmetic.
 *
 * @template E - The source element type.
 */
interface UseAsynchronousBigIntMode {
    /**
     * Converts elements with the library useToBigInt conversion.
     *
     * Every visited element advances the source, while the map counts only the
     * bigint values the conversion produces.
     *
     * @template E - The source element type.
     * @returns A collector that finishes with the most frequent bigint.
     */
    <E>(): AsynchronousCollector<E, Map<bigint, bigint>, bigint>;
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
    <E>(mapper: Functional<E, bigint>): AsynchronousCollector<E, Map<bigint, bigint>, bigint>;
}
;
/**
 * Creates a collector that selects the most frequent mapped bigint, keeping the first encountered value on ties and returning zero when empty.
 *
 * @template E - The source element type.
 * @param mapper - Converts an element to the required numeric type; defaults to the library conversion.
 * @returns A reusable collector configured for this operation.
 */
export let useAsynchronousBigIntMode: UseAsynchronousBigIntMode = <E>(mapper: Functional<E, bigint> = useToBigInt): AsynchronousCollector<bigint, Map<bigint, bigint>, bigint> | AsynchronousCollector<E, Map<bigint, bigint>, bigint> => {
    return AsynchronousCollector.full((): Map<bigint, bigint> => new Map<bigint, bigint>(), (map: Map<bigint, bigint>, element: bigint | E): Map<bigint, bigint> => {
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
    }) as AsynchronousCollector<bigint, Map<bigint, bigint>, bigint> | AsynchronousCollector<E, Map<bigint, bigint>, bigint>;
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
interface UseAsynchronousNumericVariance {
    /**
     * Converts elements with the library useToNumber conversion.
     *
     * Non-number conversions add zero to both sums but still increment the count,
     * which keeps the population denominator equal to the visited element count.
     *
     * @template E - The source element type.
     * @returns A collector that finishes with the population variance.
     */
    <E>(): AsynchronousCollector<E, VarianceAccumulator, number>;
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
    <E>(mapper: Functional<E, number>): AsynchronousCollector<E, VarianceAccumulator, number>;
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
export let useAsynchronousNumericVariance: UseAsynchronousNumericVariance = <E>(mapper: Functional<E, number> = useToNumber): AsynchronousCollector<number, VarianceAccumulator, number> | AsynchronousCollector<E, VarianceAccumulator, number> => {
    return AsynchronousCollector.full((): VarianceAccumulator => {
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
    }) as AsynchronousCollector<number, VarianceAccumulator, number> | AsynchronousCollector<E, VarianceAccumulator, number>;
};
/**
 * Creates collectors that calculate integer-rounded population variance of bigint elements.
 *
 * The accumulator stores the sum, the sum of squares and the count in bigint, and
 * the finisher computes the exact population variance before rounding it back to
 * bigint. Fewer than two elements yield 0n.
 *
 * @template E - The source element type.
 */
interface UseAsynchronousBigIntVariance {
    /**
     * Converts elements with the library useToBigInt conversion.
     *
     * Converted bigints feed both the sum and the sum of squares, and the count
     * grows by one per visited element so the population denominator is exact.
     *
     * @template E - The source element type.
     * @returns A collector that finishes with the rounded population variance.
     */
    <E>(): AsynchronousCollector<E, BigIntVarianceAccumulator, bigint>;
    /**
     * Converts elements with a caller-supplied mapper before measuring variance.
     *
     * The mapper supplies the bigint values; the same exact sum, sum of squares
     * and count accumulation is used before the final rounding.
     *
     * @template E - The source element type.
     * @param mapper - Converts an element to the bigint whose variance is measured.
     * @returns A collector that finishes with the rounded population variance.
     */
    <E>(mapper: Functional<E, bigint>): AsynchronousCollector<E, BigIntVarianceAccumulator, bigint>;
}
;
/**
 * Accumulator state for the asynchronous bigint variance collector.
 *
 * It holds the running bigint sum, the running bigint sum of squares and the
 * element count, all exact, so the finisher can round the population variance
 * without intermediate number conversions.
 */
interface BigIntVarianceAccumulator {
    summate: bigint;
    summateOfSquares: bigint;
    count: bigint;
}
;
/**
 * Creates a collector that calculates integer-rounded population variance of mapped bigints, returning zero for fewer than two elements.
 *
 * @template E - The source element type.
 * @param mapper - Converts an element to the required numeric type; defaults to the library conversion.
 * @returns A reusable collector configured for this operation.
 */
export let useAsynchronousBigIntVariance: UseAsynchronousBigIntVariance = <E>(mapper: Functional<E, bigint> = useToBigInt): AsynchronousCollector<bigint, BigIntVarianceAccumulator, bigint> | AsynchronousCollector<E, BigIntVarianceAccumulator, bigint> => {
    return AsynchronousCollector.full((): BigIntVarianceAccumulator => {
        return {
            summate: 0n,
            summateOfSquares: 0n,
            count: 0n
        };
    }, (accumulator: BigIntVarianceAccumulator, element: bigint | E): BigIntVarianceAccumulator => {
        let resolved: bigint = mapper(element as E);
        return {
            summate: accumulator.summate + (isBigInt(resolved) ? resolved : 0n),
            summateOfSquares: accumulator.summateOfSquares + (isBigInt(resolved) ? resolved * resolved : 0n),
            count: accumulator.count + 1n
        };
    }, (result: BigIntVarianceAccumulator): bigint => {
        if (result.count < 2n) {
            return 0n;
        }
        let numerator: bigint = result.summateOfSquares * result.count - result.summate * result.summate;
        let denominator: bigint = result.count * result.count;
        return (2n * numerator + denominator) / (2n * denominator);
    }) as AsynchronousCollector<bigint, BigIntVarianceAccumulator, bigint> | AsynchronousCollector<E, BigIntVarianceAccumulator, bigint>;
};
/**
 * Creates collectors that calculate population standard deviation of numeric elements.
 *
 * It shares the sum, sum of squares and count accumulator with
 * useAsynchronousNumericVariance but finishes with the square root of the
 * variance. Fewer than two elements yield zero.
 *
 * @template E - The source element type.
 */
interface UseAsynchronousNumericStandardDeviation {
    /**
     * Converts elements with the library useToNumber conversion.
     *
     * Non-number conversions contribute zero to both sums yet still count towards
     * the population size used by the finisher.
     *
     * @template E - The source element type.
     * @returns A collector that finishes with the population standard deviation.
     */
    <E>(): AsynchronousCollector<E, StandardDeviationAccumulator, number>;
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
    <E>(mapper: Functional<E, number>): AsynchronousCollector<E, StandardDeviationAccumulator, number>;
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
export let useAsynchronousNumericStandardDeviation: UseAsynchronousNumericStandardDeviation = <E>(mapper: Functional<E, number> = useToNumber): AsynchronousCollector<number, StandardDeviationAccumulator, number> | AsynchronousCollector<E, StandardDeviationAccumulator, number> => {
    return AsynchronousCollector.full((): StandardDeviationAccumulator => {
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
    }) as AsynchronousCollector<number, StandardDeviationAccumulator, number> | AsynchronousCollector<E, StandardDeviationAccumulator, number>;
};
/**
 * Creates collectors that calculate integer-rounded population standard deviation of bigint elements.
 *
 * It reuses the exact bigint sum and sum-of-squares accumulator of the bigint
 * variance collector and rounds the square root of the population variance back
 * to bigint. Fewer than two elements yield 0n.
 *
 * @template E - The source element type.
 */
interface UseAsynchronousBigIntStandardDeviation {
    /**
     * Converts elements with the library useToBigInt conversion.
     *
     * Converted bigints feed the exact sums needed by the finisher, so large
     * magnitudes do not lose precision before the final rounding.
     *
     * @template E - The source element type.
     * @returns A collector that finishes with the rounded population standard deviation.
     */
    <E>(): AsynchronousCollector<E, BigIntStandardDeviationAccumulator, bigint>;
    /**
     * Converts elements with a caller-supplied mapper before measuring dispersion.
     *
     * The mapper supplies the bigint values, and the exact sum, sum of squares
     * and count accumulation is identical to the default conversion form.
     *
     * @template E - The source element type.
     * @param mapper - Converts an element to the bigint whose deviation is measured.
     * @returns A collector that finishes with the rounded population standard deviation.
     */
    <E>(mapper: Functional<E, bigint>): AsynchronousCollector<E, BigIntStandardDeviationAccumulator, bigint>;
}
;
/**
 * Accumulator state for the asynchronous bigint standard deviation collector.
 *
 * It keeps the bigint sum, the bigint sum of squares and the element count, the
 * same exact state the bigint variance factory uses before rounding.
 */
interface BigIntStandardDeviationAccumulator {
    summate: bigint;
    summateOfSquares: bigint;
    count: bigint;
}
;
/**
 * Creates a collector that calculates integer-rounded population standard deviation of mapped bigints.
 *
 * @template E - The source element type.
 * @param mapper - Converts an element to the required numeric type; defaults to the library conversion.
 * @returns A reusable collector configured for this operation.
 */
export let useAsynchronousBigIntStandardDeviation: UseAsynchronousBigIntStandardDeviation = <E>(mapper: Functional<E, bigint> = useToBigInt): AsynchronousCollector<bigint, BigIntStandardDeviationAccumulator, bigint> | AsynchronousCollector<E, BigIntStandardDeviationAccumulator, bigint> => {
    return AsynchronousCollector.full((): BigIntStandardDeviationAccumulator => {
        return {
            summate: 0n,
            summateOfSquares: 0n,
            count: 0n
        };
    }, (accumulator: BigIntStandardDeviationAccumulator, element: bigint | E): BigIntStandardDeviationAccumulator => {
        let resolved: bigint = mapper(element as E);
        return {
            summate: accumulator.summate + (isBigInt(resolved) ? resolved : 0n),
            summateOfSquares: accumulator.summateOfSquares + (isBigInt(resolved) ? resolved * resolved : 0n),
            count: accumulator.count + 1n
        };
    }, (result: BigIntStandardDeviationAccumulator): bigint => {
        if (result.count < 2n) {
            return 0n;
        }
        let numerator: bigint = result.summateOfSquares * result.count - result.summate * result.summate;
        let denominator: bigint = result.count * result.count;
        let variance: number = Number(numerator / denominator) + Number(numerator % denominator) / Number(denominator);
        let standardDeviation: bigint = BigInt(Math.round(Math.sqrt(variance)));
        return standardDeviation;
    }) as AsynchronousCollector<bigint, BigIntStandardDeviationAccumulator, bigint> | AsynchronousCollector<E, BigIntStandardDeviationAccumulator, bigint>;
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
interface UseAsynchronousNumericMedian {
    /**
     * Converts elements with the library useToNumber conversion.
     *
     * Every converted number is appended to the buffer and the buffer is kept
     * sorted, so the finisher can index the middle without a second pass.
     *
     * @template E - The source element type.
     * @returns A collector that finishes with the numeric median.
     */
    <E>(): AsynchronousCollector<E, number[], number>;
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
    <E>(mapper: Functional<E, number>): AsynchronousCollector<E, number[], number>;
}
;
/**
 * Creates a collector that sorts mapped numbers and selects the middle value or averages the two middle values. An empty source produces NaN.
 *
 * @template E - The source element type.
 * @param mapper - Converts an element to the required numeric type; defaults to the library conversion.
 * @returns A reusable collector configured for this operation.
 */
export let useAsynchronousNumericMedian: UseAsynchronousNumericMedian = <E>(mapper: Functional<E, number> = useToNumber): AsynchronousCollector<number, number[], number> | AsynchronousCollector<E, number[], number> => {
    return AsynchronousCollector.full((): number[] => [], (array: number[], element: number | E): number[] => {
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
    }) as AsynchronousCollector<number, number[], number> | AsynchronousCollector<E, number[], number>;
};
/**
 * Creates collectors that select the median of bigint elements.
 *
 * The structure matches useAsynchronousNumericMedian, but the two middle values
 * of an even-sized buffer are averaged with truncating bigint division. An empty
 * source throws while finishing because there is no bigint NaN.
 *
 * @template E - The source element type.
 */
interface UseAsynchronousBigIntMedian {
    /**
     * Converts elements with the library useToBigInt conversion.
     *
     * Converted bigints are buffered and sorted; the finisher indexes the middle
     * and, for an even count, divides the sum of the two middles by 2n.
     *
     * @template E - The source element type.
     * @returns A collector that finishes with the bigint median.
     */
    <E>(): AsynchronousCollector<E, bigint[], bigint>;
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
    <E>(mapper: Functional<E, bigint>): AsynchronousCollector<E, bigint[], bigint>;
}
;
/**
 * Creates a collector that sorts mapped bigints and selects the middle value or averages the two middle values with truncating division. Finishing an empty source throws when averaging missing values.
 *
 * @template E - The source element type.
 * @param mapper - Converts an element to the required numeric type; defaults to the library conversion.
 * @returns A reusable collector configured for this operation.
 */
export let useAsynchronousBigIntMedian: UseAsynchronousBigIntMedian = <E>(mapper: Functional<E, bigint> = useToBigInt): AsynchronousCollector<bigint, bigint[], bigint> | AsynchronousCollector<E, bigint[], bigint> => {
    return AsynchronousCollector.full((): bigint[] => [], (array: bigint[], element: bigint | E): bigint[] => {
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
    }) as AsynchronousCollector<bigint, bigint[], bigint> | AsynchronousCollector<E, bigint[], bigint>;
};
