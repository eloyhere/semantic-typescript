/**
 * Factory functions that create asynchronous collectors.
 *
 * Every `useAsynchronousXxx` helper returns a configured `AsynchronousCollector`;
 * the collector class itself lives in `collector.ts`. The dependency is one-way:
 * this module imports `collector.ts`, never the other way around.
 */
import { isFunction, isNumber, isBigInt, isBoolean, isString, isObject } from "#semantic/guard";
import { useCompare, useToBigInt, useToNumber } from "#semantic/hook";
import type { Optional } from "#semantic/optional";
import { AsynchronousCollector } from "#semantic/asynchronous/collector";
import { AsynchronousRing } from "#semantic/structure/ring";
import { AsynchronousRootedForest } from "#semantic/structure/forest/rootedForest";
import { AsynchronousList } from "#semantic/structure/list";
import { AsynchronousUnorderedLRUMap, AsynchronousUnorderedLRUSet } from "#semantic/structure/lru";
import { AsynchronousOrderedMap, AsynchronousUnorderedMap } from "#semantic/structure/map";
import { AsynchronousOrderedSet, AsynchronousUnorderedSet } from "#semantic/structure/set";
import { AsynchronousSkipMap, AsynchronousSkipSet } from "#semantic/structure/skip";
import { AsynchronousBinarySearchTree } from "#semantic/structure/tree/binarySearchTree";
import type { BiFunctional, BiPredicate, Functional, Predicate, Supplier, TriFunctional, TriPredicate, Consumer, BiConsumer, Comparator, MaybeInvalid, Indexed } from "#semantic/utility";
import { invalidate, validate } from "#semantic/utility";
import {
    DistributionAccumulator,
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
import type {
    DensityData,
    DensityOptions,
    DistributionEntropyOptions,
    HistogramData,
    HistogramOptions,
    KurtosisOptions,
    MomentData,
    QuantileOptions,
    RobustData,
    RobustOptions,
    SkewnessOptions
} from "#semantic/synchronous/distribution";
/**
 * Creates collectors that report whether at least one element matches a predicate.
 *
 * The collector short-circuits on the first accepted element and finishes with
 * true; an empty asynchronous source finishes with false. It is the existential
 * counterpart of useAsynchronousAllMatch and the inverse of useAsynchronousNoneMatch.
 *
 * @template E - The source element type.
 */
interface UseAsynchronousAnyMatch {
    /**
     * Tests each element with a predicate that only receives the element value.
     *
     * The accumulator starts as false, so an empty or fully rejected source
     * finishes with false, and a true answer interrupts the asynchronous source
     * after the element has been observed.
     *
     * @template E - The source element type.
     * @param predicate - Decides whether an element counts as a match.
     * @returns A collector that finishes with true when a match was seen.
     */
    <E>(predicate: Predicate<E>): AsynchronousCollector<E, boolean, boolean>;
    /**
     * Tests each element with a predicate that also receives its encounter index.
     *
     * The index is the bigint position of the element in encounter order, so the
     * predicate can match a value at a particular offset as well as by content.
     *
     * @template E - The source element type.
     * @param predicate - Receives the element and its bigint encounter index.
     * @returns A collector that finishes with true when a match was seen.
     */
    <E>(predicate: BiPredicate<E, bigint>): AsynchronousCollector<E, boolean, boolean>;
}
;
/**
 * Creates a collector that tests for a matching element and stops after a match.
 *
 * @template E - The source element type.
 * @param predicate - Tests each element and optional bigint index.
 * @returns A reusable collector configured for this operation.
 */
export let useAsynchronousAnyMatch: UseAsynchronousAnyMatch = <E>(predicate: Predicate<E> | BiPredicate<E, bigint>): AsynchronousCollector<E, boolean, boolean> => {
    if (isFunction(predicate)) {
        return AsynchronousCollector.shortable((): boolean => false, (_element: E, _index: bigint, accumulator: boolean): boolean => isBoolean(accumulator) && accumulator, (accumulator: boolean, element: E, index: bigint): boolean => accumulator || predicate(element, index), (accumulator: boolean): boolean => accumulator);
    }
    throw new TypeError("Predicate must be a function.");
};
/**
 * Creates collectors that report whether every element matches a predicate.
 *
 * The short-circuit is inverted compared with useAsynchronousAnyMatch: the
 * accumulator starts as true, an empty source finishes with true, and the first
 * rejected element stops further waiting on the asynchronous source.
 *
 * @template E - The source element type.
 */
interface UseAsynchronousAllMatch {
    /**
     * Tests each element with a predicate that only receives the element value.
     *
     * Accumulation stops before the first element the predicate rejects, so a
     * failing element near the front leaves the remaining asynchronous values
     * unobserved.
     *
     * @template E - The source element type.
     * @param predicate - Decides whether an element is acceptable.
     * @returns A collector that finishes with false only when some element failed.
     */
    <E>(predicate: Predicate<E>): AsynchronousCollector<E, boolean, boolean>;
    /**
     * Tests each element with a predicate that also receives its encounter index.
     *
     * The bigint index advances in encounter order and lets the predicate treat
     * positions differently, for example by validating only the first element.
     *
     * @template E - The source element type.
     * @param predicate - Receives the element and its bigint encounter index.
     * @returns A collector that finishes with false only when some element failed.
     */
    <E>(predicate: BiPredicate<E, bigint>): AsynchronousCollector<E, boolean, boolean>;
}
;
/**
 * Creates a collector that tests that every element matches, returning true when empty.
 *
 * @template E - The source element type.
 * @param predicate - Tests each element and optional bigint index.
 * @returns A reusable collector configured for this operation.
 */
export let useAsynchronousAllMatch: UseAsynchronousAllMatch = <E>(predicate: Predicate<E> | BiPredicate<E, bigint>): AsynchronousCollector<E, boolean, boolean> => {
    if (isFunction(predicate)) {
        return AsynchronousCollector.shortable((): boolean => true, (_element: E, _index: bigint, accumulator: boolean): boolean => isBoolean(accumulator) && !accumulator, (accumulator: boolean, element: E, index: bigint): boolean => accumulator && predicate(element, index), (accumulator: boolean): boolean => accumulator);
    }
    throw new TypeError("Predicate must be a function.");
};
/**
 * Creates collectors from a caller-supplied identity, accumulation and finishing triple.
 *
 * This is the general factory behind the specialised collectors in this module:
 * the resulting collector owns no behaviour beyond calling the supplied
 * functions. The overloads differ in whether an interruption predicate is
 * supplied and whether the predicate or the accumulator may read the bigint
 * encounter index.
 *
 * @template E - The source element type.
 * @template A - The accumulator type.
 * @template R - The finished result type.
 */
interface UseAsynchronousCollect {
    /**
     * Combines the three functions without any early interruption.
     *
     * The accumulator receives the current accumulator and the element only, and
     * the finisher is applied once every awaited element of the source was consumed.
     *
     * @template E - The source element type.
     * @template A - The accumulator type.
     * @template R - The finished result type.
     * @param identity - Supplies a fresh accumulator for each collection.
     * @param accumulator - Combines the accumulator with the next element.
     * @param finisher - Converts the completed accumulator into the result.
     * @returns A collector that always drains the whole source.
     */
    <E, A, R>(identity: Supplier<A>, accumulator: BiFunctional<A, E, A>, finisher: Functional<A, R>): AsynchronousCollector<E, A, R>;
    /**
     * Combines the three functions without interruption, with an index-aware accumulator.
     *
     * The accumulator additionally receives the bigint encounter index, which is
     * useful for position-dependent folds without a separate counter.
     *
     * @template E - The source element type.
     * @template A - The accumulator type.
     * @template R - The finished result type.
     * @param identity - Supplies a fresh accumulator for each collection.
     * @param accumulator - Combines the accumulator with the element and its index.
     * @param finisher - Converts the completed accumulator into the result.
     * @returns A collector that always drains the whole source.
     */
    <E, A, R>(identity: Supplier<A>, accumulator: TriFunctional<A, E, bigint, A>, finisher: Functional<A, R>): AsynchronousCollector<E, A, R>;
    /**
     * Implementation signature accepting either accumulator arity without interruption.
     *
     * It exists so callers holding a union of the two accumulator shapes can call
     * the factory; at runtime the supplied function simply receives whichever
     * arguments the collector passes.
     *
     * @template E - The source element type.
     * @template A - The accumulator type.
     * @template R - The finished result type.
     * @param identity - Supplies a fresh accumulator for each collection.
     * @param accumulator - Combines the accumulator with the element, with or without an index.
     * @param finisher - Converts the completed accumulator into the result.
     * @returns A collector that always drains the whole source.
     */
    <E, A, R>(identity: Supplier<A>, accumulator: BiFunctional<A, E, A> | TriFunctional<A, E, bigint, A>, finisher: Functional<A, R>): AsynchronousCollector<E, A, R>;
    /**
     * Adds an interruption predicate that only receives the element value.
     *
     * The predicate is asked before each accumulation; returning true stops the
     * source and the finisher runs on the accumulator collected so far, without
     * waiting for more values.
     *
     * @template E - The source element type.
     * @template A - The accumulator type.
     * @template R - The finished result type.
     * @param identity - Supplies a fresh accumulator for each collection.
     * @param interrupt - Returns true to stop before accumulating the element.
     * @param accumulator - Combines the accumulator with the next element.
     * @param finisher - Converts the completed accumulator into the result.
     * @returns A collector that stops as soon as the predicate accepts.
     */
    <E, A, R>(identity: Supplier<A>, interrupt: Predicate<E>, accumulator: BiFunctional<A, E, A>, finisher: Functional<A, R>): AsynchronousCollector<E, A, R>;
    /**
     * Combines an element-only interruption predicate with an index-aware accumulator.
     *
     * The predicate is checked before each accumulation, while the accumulator is
     * allowed to use the bigint encounter index.
     *
     * @template E - The source element type.
     * @template A - The accumulator type.
     * @template R - The finished result type.
     * @param identity - Supplies a fresh accumulator for each collection.
     * @param interrupt - Returns true to stop before accumulating the element.
     * @param accumulator - Combines the accumulator with the element and its index.
     * @param finisher - Converts the completed accumulator into the result.
     * @returns A collector that stops as soon as the predicate accepts.
     */
    <E, A, R>(identity: Supplier<A>, interrupt: Predicate<E>, accumulator: TriFunctional<A, E, bigint, A>, finisher: Functional<A, R>): AsynchronousCollector<E, A, R>;
    /**
     * Uses an interruption predicate that also receives the bigint encounter index.
     *
     * This lets the collector stop at a fixed position or combine position and
     * value in the stopping rule; the accumulator itself only sees the element.
     *
     * @template E - The source element type.
     * @template A - The accumulator type.
     * @template R - The finished result type.
     * @param identity - Supplies a fresh accumulator for each collection.
     * @param interrupt - Receives the element and its bigint index and returns true to stop.
     * @param accumulator - Combines the accumulator with the next element.
     * @param finisher - Converts the completed accumulator into the result.
     * @returns A collector that stops as soon as the predicate accepts.
     */
    <E, A, R>(identity: Supplier<A>, interrupt: BiPredicate<E, bigint>, accumulator: BiFunctional<A, E, A>, finisher: Functional<A, R>): AsynchronousCollector<E, A, R>;
    /**
     * Uses index-aware functions for both the interruption predicate and the accumulator.
     *
     * Both functions receive the same bigint encounter index for the element, so
     * a positional stop rule and a positional fold stay in step.
     *
     * @template E - The source element type.
     * @template A - The accumulator type.
     * @template R - The finished result type.
     * @param identity - Supplies a fresh accumulator for each collection.
     * @param interrupt - Receives the element and its bigint index and returns true to stop.
     * @param accumulator - Combines the accumulator with the element and its index.
     * @param finisher - Converts the completed accumulator into the result.
     * @returns A collector that stops as soon as the predicate accepts.
     */
    <E, A, R>(identity: Supplier<A>, interrupt: BiPredicate<E, bigint>, accumulator: TriFunctional<A, E, bigint, A>, finisher: Functional<A, R>): AsynchronousCollector<E, A, R>;
    /**
     * Uses a tri-predicate that can inspect the accumulator as well as the element.
     *
     * The predicate receives the element, its bigint index and the accumulator
     * built so far, enabling convergence-based stopping rules; accumulation
     * itself still happens through a two-argument function.
     *
     * @template E - The source element type.
     * @template A - The accumulator type.
     * @template R - The finished result type.
     * @param identity - Supplies a fresh accumulator for each collection.
     * @param interrupt - Receives the element, its index and the accumulator and returns true to stop.
     * @param accumulator - Combines the accumulator with the next element.
     * @param finisher - Converts the completed accumulator into the result.
     * @returns A collector that stops as soon as the predicate accepts.
     */
    <E, A, R>(identity: Supplier<A>, interrupt: TriPredicate<E, bigint, A>, accumulator: BiFunctional<A, E, A>, finisher: Functional<A, R>): AsynchronousCollector<E, A, R>;
    /**
     * Uses an accumulator-aware interruption predicate together with an index-aware accumulator.
     *
     * This is the most general form: the predicate sees the accumulator and the
     * bigint index, and the accumulator sees the index as well.
     *
     * @template E - The source element type.
     * @template A - The accumulator type.
     * @template R - The finished result type.
     * @param identity - Supplies a fresh accumulator for each collection.
     * @param interrupt - Receives the element, its index and the accumulator and returns true to stop.
     * @param accumulator - Combines the accumulator with the element and its index.
     * @param finisher - Converts the completed accumulator into the result.
     * @returns A collector that stops as soon as the predicate accepts.
     */
    <E, A, R>(identity: Supplier<A>, interrupt: TriPredicate<E, bigint, A>, accumulator: TriFunctional<A, E, bigint, A>, finisher: Functional<A, R>): AsynchronousCollector<E, A, R>;
}
;
/**
 * Creates a collector that combines identity, accumulation and finishing, with optional early interruption.
 *
 * @template E - The source element type.
 * @template A - The accumulator type.
 * @template R - The finished result type.
 * @param argument1 - Supplies a fresh initial accumulator.
 * @param argument2 - The accumulator, or interruption predicate in the four-argument overload.
 * @param argument3 - The finisher, or accumulator in the four-argument overload.
 * @param argument4 - The finisher in the four-argument overload.
 * @returns A reusable collector configured for this operation.
 */
export let useAsynchronousCollect: UseAsynchronousCollect = <E, A, R>(argument1: Supplier<A> | AsynchronousCollector<E, A, R>, argument2?: BiFunctional<A, E, A> | TriFunctional<A, E, bigint, A> | Predicate<E> | BiPredicate<E, bigint> | TriPredicate<E, bigint, A>, argument3?: BiFunctional<A, E, A> | TriFunctional<A, E, bigint, A> | Functional<A, R>, argument4?: Functional<A, R>): AsynchronousCollector<E, A, R> => {
    if (isFunction(argument1) && isFunction(argument2) && isFunction(argument3) && isFunction(argument4)) {
        let identity: Supplier<A> = argument1 as Supplier<A>;
        let interrupt: Predicate<E> & BiPredicate<E, bigint> & TriPredicate<E, bigint, A> = argument2 as Predicate<E> & BiPredicate<E, bigint> & TriPredicate<E, bigint, A>;
        let accumulator: BiFunctional<A, E, A> & TriFunctional<A, E, bigint, A> = argument3 as BiFunctional<A, E, A> & TriFunctional<A, E, bigint, A>;
        let finisher: Functional<A, R> = argument4 as Functional<A, R>;
        return AsynchronousCollector.shortable(identity, interrupt, accumulator, finisher);
    }
    if (isFunction(argument1) && isFunction(argument2) && isFunction(argument3)) {
        let identity: Supplier<A> = argument1 as Supplier<A>;
        let accumulator: BiFunctional<A, E, A> & TriFunctional<A, E, bigint, A> = argument2 as BiFunctional<A, E, A> & TriFunctional<A, E, bigint, A>;
        let finisher: Functional<A, R> = argument3 as Functional<A, R>;
        return AsynchronousCollector.full(identity, accumulator, finisher);
    }
    throw new TypeError("Identity, accumulator, and finisher must be functions.");
};
/**
 * Creates a collector that counts elements as a bigint.
 *
 * @template E - The source element type.
 * @returns A reusable collector configured for this operation.
 */
export let useAsynchronousCount: <E = unknown>() => AsynchronousCollector<E, bigint, bigint> = <E = unknown>(): AsynchronousCollector<E, bigint, bigint> => {
    return AsynchronousCollector.full((): bigint => 0n, (count: bigint): bigint => count + 1n, (count: bigint): bigint => count);
};
/**
 * Creates collectors that format elements into one text line, write it with
 * console.error and return the same text.
 *
 * The default form wraps the elements in square brackets and separates them with
 * commas. The other overloads replace the accumulator and optionally the
 * surrounding text. useAsynchronousLog prints with console.log instead, and
 * useAsynchronousJoin builds the same kind of text without writing it.
 *
 * @template E - The source element type.
 */
interface UseAsynchronousError {
    /**
     * Formats with the default square-bracket and comma notation.
     *
     * Awaited elements are stringified and joined, the trailing comma is trimmed,
     * the closing bracket appended and the finished line written with console.error.
     *
     * @template E - The source element type.
     * @returns A collector that finishes with the text it printed.
     */
    <E = unknown>(): AsynchronousCollector<E, string, string>;
    /**
     * Uses a custom two-argument accumulator inside the default brackets.
     *
     * The accumulator receives the text built so far and the next awaited element;
     * the prefix and suffix stay "[" and "]" and the finished text goes to console.error.
     *
     * @template E - The source element type.
     * @param accumulator - Combines the current text with the next element.
     * @returns A collector that finishes with the text it printed.
     */
    <E = unknown>(accumulator: BiFunctional<string, E, string>): AsynchronousCollector<E, string, string>;
    /**
     * Uses a custom index-aware accumulator inside the default brackets.
     *
     * The accumulator additionally receives the bigint encounter index, which
     * lets numbering or positional formatting happen while the text is built.
     *
     * @template E - The source element type.
     * @param accumulator - Combines the current text with the element and its index.
     * @returns A collector that finishes with the text it printed.
     */
    <E = unknown>(accumulator: TriFunctional<string, E, bigint, string>): AsynchronousCollector<E, string, string>;
    /**
     * Wraps a two-argument accumulator in caller-supplied opening and closing text.
     *
     * The identity is the prefix, the accumulator appends elements and the suffix
     * is appended before the complete text is written with console.error.
     *
     * @template E - The source element type.
     * @param prefix - Text the accumulator starts from.
     * @param accumulator - Combines the current text with the next element.
     * @param suffix - Text appended before the result is printed.
     * @returns A collector that finishes with the text it printed.
     */
    <E = unknown>(prefix: string, accumulator: BiFunctional<string, E, string>, suffix: string): AsynchronousCollector<E, string, string>;
    /**
     * Wraps an index-aware accumulator in caller-supplied opening and closing text.
     *
     * The accumulator can use the bigint encounter index; prefix and suffix frame
     * the accumulated text and the finished line is written with console.error.
     *
     * @template E - The source element type.
     * @param prefix - Text the accumulator starts from.
     * @param accumulator - Combines the current text with the element and its index.
     * @param suffix - Text appended before the result is printed.
     * @returns A collector that finishes with the text it printed.
     */
    <E = unknown>(prefix: string, accumulator: TriFunctional<string, E, bigint, string>, suffix: string): AsynchronousCollector<E, string, string>;
}
;
/**
 * Creates a collector that formats elements, writes text with console.error and returns the text.
 *
 * @template E - The source element type.
 * @param argument1 - The opening text or string accumulator; omit for default formatting.
 * @param argument2 - The custom string accumulator when opening and closing text are supplied.
 * @param argument3 - The closing text.
 * @returns A reusable collector configured for this operation.
 */
export let useAsynchronousError: UseAsynchronousError = <E = unknown>(argument1?: string | BiFunctional<string, E, string> | TriFunctional<string, E, bigint, string>, argument2?: BiFunctional<string, E, string> | TriFunctional<string, E, bigint, string>, argument3?: string): AsynchronousCollector<E, string, string> => {
    if (isString(argument1) && isFunction(argument2) && isString(argument3)) {
        let prefix: string = argument1;
        let accumulator: BiFunctional<string, E, string> & TriFunctional<string, E, bigint, string> = argument2 as BiFunctional<string, E, string> & TriFunctional<string, E, bigint, string>;
        let suffix: string = argument3;
        return AsynchronousCollector.full<E, string, string>((): string => prefix, accumulator, (text: string): string => {
            let result: string = text + suffix;
            console.error(result);
            return result;
        });
    }
    else if (isFunction(argument1)) {
        let prefix: string = "[";
        let accumulator: BiFunctional<string, E, string> & TriFunctional<string, E, bigint, string> = argument1 as BiFunctional<string, E, string> & TriFunctional<string, E, bigint, string>;
        let suffix: string = "]";
        return AsynchronousCollector.full<E, string, string>((): string => prefix, accumulator, (text: string): string => {
            let result: string = text + suffix;
            console.error(result);
            return result;
        });
    }
    else {
        return AsynchronousCollector.full<E, string, string>((): string => "[", (accumulator: string, element: E): string => {
            if (isString(accumulator) && isString(element)) {
                return accumulator + element + ",";
            }
            return String(accumulator) + String(element) + ",";
        }, (text: string): string => {
            let result: string = text.substring(0, Math.max(1, text.length - 1)) + "]";
            console.error(result);
            return result;
        });
    }
};
/**
 * Accumulator state for the non-negative find-at collectors.
 *
 * It remembers the requested bigint position and the element found there. The
 * element field stays MaybeInvalid until the encounter counter reaches the
 * position, which is how the finder distinguishes "not reached" from a value.
 *
 * @template E - The source element type.
 */
interface FindAtAccumulator<E> {
    position: bigint;
    element: MaybeInvalid<E>;
}
/**
 * Repeats the find-at accumulator contract for declaration merging.
 *
 * TypeScript merges this declaration with the one above, so both find-at
 * factories and their overloads share a single accumulator shape.
 *
 * @template E - The source element type.
 */
interface FindAtAccumulator<E> {
    position: bigint;
    element: MaybeInvalid<E>;
}
/**
 * Creates collectors that return the element at a non-negative encounter position.
 *
 * The collector counts from 0n and interrupts the source once the requested
 * position has been accumulated, so early positions avoid draining the whole
 * stream. The finished value is a promise that rejects when no element is
 * available. Negative positions belong to useAsynchronousFindNegativeAt instead.
 *
 * @template E - The source element type.
 */
interface UseAsynchronousFindAt {
    /**
     * Accepts the position as a number.
     *
     * The number is converted to the bigint encounter counter, which is convenient
     * for small literal positions but cannot express positions beyond the safe
     * integer range exactly. A missing element rejects the finished promise.
     *
     * @template E - The source element type.
     * @param index - The non-negative number position to select.
     * @returns A collector that finishes with a promise of the element at that position.
     */
    <E>(index: number): AsynchronousCollector<E, FindAtAccumulator<E>, Promise<E>>;
    /**
     * Accepts the position as a bigint.
     *
     * Keeping the position in bigint form avoids the range limits of number and
     * matches the bigint counter used internally, so very large positions remain
     * exact; a missing element rejects the finished promise.
     *
     * @template E - The source element type.
     * @param index - The non-negative bigint position to select.
     * @returns A collector that finishes with a promise of the element at that position.
     */
    <E>(index: bigint): AsynchronousCollector<E, FindAtAccumulator<E>, Promise<E>>;
}
/**
 * Creates a collector that selects a non-negative encounter position. The finished promise rejects when no element is available.
 *
 * @template E - The source element type.
 * @param index - The requested non-negative position, or a negative position for the negative-index factory.
 * @returns A reusable collector configured for this operation.
 */
export let useAsynchronousFindAt: UseAsynchronousFindAt = <E>(index: number | bigint): AsynchronousCollector<E, FindAtAccumulator<E>, Promise<E>> => {
    let target: bigint = useToBigInt(index);
    if (target < 0n) {
        throw new Error("Use \"useAsynchronousFindNegativeAt\" for negative index.");
    }
    return AsynchronousCollector.shortable(((): FindAtAccumulator<E> => {
        return {
            position: 0n,
            element: (void 0)
        };
    }), (_element: E, _index: bigint, accumulator: FindAtAccumulator<E>): boolean => {
        return accumulator.position > target;
    }, (accumulator: FindAtAccumulator<E>, element: E): FindAtAccumulator<E> => {
        if (accumulator.position === target) {
            accumulator.element = element;
        }
        return {
            position: accumulator.position + 1n,
            element: accumulator.element
        };
    }, (accumulator: FindAtAccumulator<E>): Promise<E> => {
        return new Promise<E>((resolve: Consumer<E>, reject: Consumer<any>): void => {
            let element: MaybeInvalid<E> = accumulator.element;
            if (validate(element)) {
                resolve(element);
            }
            else {
                reject(new Error("Element could not be found with given index."));
            }
        });
    });
};
/**
 * Creates collectors that return an element counted backwards from the end.
 *
 * Every element is buffered because the length is only known when the source
 * ends; the negative position is then reduced modulo that length. The finished
 * promise rejects when the position does not resolve to a stored element, unlike
 * the streaming useAsynchronousFindAt factory.
 *
 * @template E - The source element type.
 */
interface UseAsynchronousFindNegativeAt {
    /**
     * Accepts the negative position as a number.
     *
     * The position is resolved against the buffered length after the source
     * completes; number form is convenient for ordinary negative literals, and a
     * missing element rejects the finished promise.
     *
     * @template E - The source element type.
     * @param index - The negative number position to resolve from the end.
     * @returns A collector that finishes with a promise of the selected element.
     */
    <E>(index: number): AsynchronousCollector<E, Array<E>, Promise<E>>;
    /**
     * Accepts the negative position as a bigint.
     *
     * The whole calculation stays in bigint arithmetic, so positions near the
     * safe integer limits are reduced exactly against the collected length; a
     * missing element rejects the finished promise.
     *
     * @template E - The source element type.
     * @param index - The negative bigint position to resolve from the end.
     * @returns A collector that finishes with a promise of the selected element.
     */
    <E>(index: bigint): AsynchronousCollector<E, Array<E>, Promise<E>>;
}
;
/**
 * Creates a collector that buffers elements and resolves a negative position modulo the collected length. The finished promise rejects when no element is available.
 *
 * @template E - The source element type.
 * @param index - The requested non-negative position, or a negative position for the negative-index factory.
 * @returns A reusable collector configured for this operation.
 */
export let useAsynchronousFindNegativeAt: UseAsynchronousFindNegativeAt = <E>(index: number | bigint): AsynchronousCollector<E, Array<E>, Promise<E>> => {
    let target: bigint = useToBigInt(index);
    if (target > -1n) {
        throw new Error("Use \"useAsynchronousFindAt\" for none-negative index.");
    }
    return AsynchronousCollector.full(() => [], (accumulator: Array<E>, element: E): Array<E> => {
        accumulator.push(element);
        return accumulator;
    }, (accumulator: Array<E>): Promise<E> => {
        return new Promise<E>((resolve, reject): void => {
            if (accumulator.length > 0) {
                let count: bigint = BigInt(accumulator.length);
                let limit: bigint = (((target) % count) + count) % count;
                let element: MaybeInvalid<E> = accumulator.at(Number(limit));
                if (validate(element)) {
                    resolve(element);
                }
                else {
                    reject("Element could not be found with given index.");
                }
            }
            else {
                reject("Not element to be found.");
            }
        });
    });
};
/**
 * Creates a collector that selects the first available element. The finished promise rejects when no element is available.
 *
 * @template E - The source element type.
 * @returns A reusable collector configured for this operation.
 */
export let useAsynchronousFindFirst: <E>() => AsynchronousCollector<E, Array<E>, Promise<E>> = <E>(): AsynchronousCollector<E, Array<E>, Promise<E>> => {
    return AsynchronousCollector.shortable((): Array<E> => [], (_element: E, _index: bigint, accumulator: Array<E>): boolean => validate(accumulator) && accumulator.length === 1, (accumulator: Array<E>, element: E): Array<E> => {
        if (validate(accumulator) && accumulator.length === 0) {
            accumulator.push(element);
            return accumulator;
        }
        return accumulator;
    }, (accumulator: Array<E>): Promise<E> => {
        if (validate(accumulator) && accumulator.length > 0) {
            return Promise.resolve(accumulator[0]);
        }
        return Promise.reject(new Error("No element found."));
    });
};
/**
 * Creates a collector that accepts each element with probability one half until selected; it may finish with undefined.
 *
 * @template E - The source element type.
 * @returns A reusable collector configured for this operation.
 */
export let useAsynchronousFindAny: <E>() => AsynchronousCollector<E, Array<E>, Promise<E>> = <E>(): AsynchronousCollector<E, Array<E>, Promise<E>> => {
    return AsynchronousCollector.shortable((): Array<E> => [], (_element: E, _index: bigint, accumulator: Array<E>): boolean => validate(accumulator) && accumulator.length == 1, (accumulator: Array<E>, element: E): Array<E> => {
        if (validate(accumulator) && accumulator.length === 0 && Math.random() < 0.5) {
            accumulator.push(element);
            return accumulator;
        }
        return accumulator;
    }, (accumulator: Array<E>): Promise<E> => Promise.resolve(accumulator[0]));
};
/**
 * Creates a collector that selects the last available element. An empty source resolves to undefined.
 *
 * @template E - The source element type.
 * @returns A reusable collector configured for this operation.
 */
export let useAsynchronousFindLast: <E>() => AsynchronousCollector<E, Array<E>, Promise<E>> = <E>(): AsynchronousCollector<E, Array<E>, Promise<E>> => {
    return AsynchronousCollector.full((): Array<E> => [], (accumulator: Array<E>, element: E): Array<E> => {
        if (validate(accumulator)) {
            accumulator.push(element);
        }
        return accumulator;
    }, (accumulator: Array<E>): Promise<E> => Promise.resolve(accumulator[accumulator.length - 1]));
};
const uninitializedResults: WeakSet<Promise<unknown>> = new WeakSet<Promise<unknown>>();
function uninitializedResult<E>(): Promise<E> {
    let result: Promise<E> = Promise.resolve(undefined as E);
    uninitializedResults.add(result);
    return result;
}
function observeResult<E>(result: Promise<E>): Promise<E> {
    void result.catch((): void => {});
    return result;
}
function finishResult<E>(result: Promise<E>): Promise<E> {
    return uninitializedResults.has(result) ? Promise.reject(new Error("No element found.")) : result;
}
/**
 * Creates collectors that select the greatest element seen.
 *
 * The collector keeps one running value rather than buffering the source, and
 * nullish elements are skipped. The finished promise rejects when no comparable
 * element exists. useAsynchronousFindMinimum is the mirrored factory.
 *
 * @template E - The source element type.
 */
interface UseAsynchronousFindMaximum {
    /**
     * Compares with the library comparator from useCompare.
     *
     * The default comparator orders primitives and throws for values it cannot
     * order; callers with custom elements should pick the explicit overload.
     *
     * @template E - The source element type.
     * @returns A collector that finishes with a promise of the greatest element.
     */
    <E>(): AsynchronousCollector<E, Promise<E>, Promise<E>>;
    /**
     * Compares with a caller-supplied comparator.
     *
     * The comparator receives the running greatest value first and the next
     * element second, and a negative result means the new element wins.
     *
     * @template E - The source element type.
     * @param comparator - Orders the running greatest value against the next element.
     * @returns A collector that finishes with a promise of the greatest element.
     */
    <E>(comparator: Comparator<E>): AsynchronousCollector<E, Promise<E>, Promise<E>>;
}
/**
 * Creates a collector that selects the greatest element according to the comparator. The finished promise rejects when no element is available.
 *
 * @template E - The source element type.
 * @param comparator - The element comparison function; defaults to the library comparator.
 * @returns A reusable collector configured for this operation.
 */
export let useAsynchronousFindMaximum: UseAsynchronousFindMaximum = <E>(comparator: Comparator<E> = useCompare<E>): AsynchronousCollector<E, Promise<E>, Promise<E>> => {
    if (isFunction(comparator)) {
        return AsynchronousCollector.full(uninitializedResult<E>, (result: Promise<E>, element: E): Promise<E> => {
            if (uninitializedResults.has(result)) {
                return observeResult(Promise.resolve(element));
            }
            return observeResult(result.then((previous: E): E => comparator(previous, element) < 0 ? element : previous));
        }, finishResult<E>);
    }
    throw new TypeError("Invalid argument.");
};
/**
 * Creates collectors that select the least element seen.
 *
 * The mirror image of useAsynchronousFindMaximum: one running value is kept,
 * nullish elements are skipped, and the finished promise rejects when no
 * comparable element exists.
 *
 * @template E - The source element type.
 */
interface UseAsynchronousFindMinimum {
    /**
     * Compares with the library comparator from useCompare.
     *
     * This default is intended for primitive elements; custom element types
     * should supply their own ordering through the other overload.
     *
     * @template E - The source element type.
     * @returns A collector that finishes with a promise of the least element.
     */
    <E>(): AsynchronousCollector<E, Promise<E>, Promise<E>>;
    /**
     * Compares with a caller-supplied comparator.
     *
     * The comparator receives the running least value first and the next element
     * second, and a positive result means the new element wins.
     *
     * @template E - The source element type.
     * @param comparator - Orders the running least value against the next element.
     * @returns A collector that finishes with a promise of the least element.
     */
    <E>(comparator: Comparator<E>): AsynchronousCollector<E, Promise<E>, Promise<E>>;
}
/**
 * Creates a collector that selects the least element according to the comparator. The finished promise rejects when no element is available.
 *
 * @template E - The source element type.
 * @param comparator - The element comparison function; defaults to the library comparator.
 * @returns A reusable collector configured for this operation.
 */
export let useAsynchronousFindMinimum: UseAsynchronousFindMinimum = <E>(comparator: Comparator<E> = useCompare<E>): AsynchronousCollector<E, Promise<E>, Promise<E>> => {
    if (isFunction(comparator)) {
        return AsynchronousCollector.full(uninitializedResult<E>, (result: Promise<E>, element: E): Promise<E> => {
            if (uninitializedResults.has(result)) {
                return observeResult(Promise.resolve(element));
            }
            return observeResult(result.then((previous: E): E => comparator(previous, element) > 0 ? element : previous));
        }, finishResult<E>);
    }
    throw new TypeError("Invalid argument.");
};
/**
 * Creates collectors that invoke a side effect for every awaited element.
 *
 * No element is retained: the accumulator is only the bigint count, so the
 * finished value tells how many elements were processed. It differs from
 * useAsynchronousToArray and the statistical collectors, which keep state.
 *
 * @template E - The source element type.
 */
interface UseAsynchronousForEach {
    /**
     * Invokes an action that only receives the element value.
     *
     * The action runs during accumulation for every awaited element; interrupt
     * support comes from the collector machinery rather than the action itself.
     *
     * @template E - The source element type.
     * @param action - Consumes each element.
     * @returns A collector that finishes with the bigint number of elements visited.
     */
    <E>(action: Consumer<E>): AsynchronousCollector<E, bigint, bigint>;
    /**
     * Invokes an action that also receives the bigint encounter index.
     *
     * The index starts at 0n and increments once per visited element, letting the
     * side effect log or label positions in the asynchronous source.
     *
     * @template E - The source element type.
     * @param action - Consumes each element together with its index.
     * @returns A collector that finishes with the bigint number of elements visited.
     */
    <E>(action: BiConsumer<E, bigint>): AsynchronousCollector<E, bigint, bigint>;
}
;
/**
 * Creates a collector that invokes an action for every element and returns the bigint count processed.
 *
 * @template E - The source element type.
 * @param action - Receives each element and its optional bigint index.
 * @returns A reusable collector configured for this operation.
 */
export let useAsynchronousForEach: UseAsynchronousForEach = <E>(action: Consumer<E> | BiConsumer<E, bigint>): AsynchronousCollector<E, bigint, bigint> => {
    if (isFunction(action)) {
        return AsynchronousCollector.full((): bigint => 0n, (accumulator: bigint, element: E, index: bigint): bigint => {
            action(element, index);
            return accumulator + 1n;
        }, (accumulator: bigint): bigint => accumulator);
    }
    throw new TypeError("Action must be a function.");
};
/**
 * Creates collectors that report whether no element matches a predicate.
 *
 * The accumulator starts as true, an empty source finishes with true, and the
 * first accepted element interrupts the source and finishes with false. It is
 * the negation of useAsynchronousAnyMatch.
 *
 * @template E - The source element type.
 */
interface UseAsynchronousNonMatch {
    /**
     * Tests with a predicate that only receives the element value.
     *
     * The accumulator starts as true; a predicate that returns true for any
     * element interrupts the source and forces the final answer to false.
     *
     * @template E - The source element type.
     * @param predicate - Decides whether an element is a match.
     * @returns A collector that finishes with true when nothing matched.
     */
    <E>(predicate: Predicate<E>): AsynchronousCollector<E, boolean, boolean>;
    /**
     * Tests with a predicate that also receives the bigint encounter index.
     *
     * The index allows position-sensitive rules such as "no element after the
     * first may match" while keeping the same short-circuit behaviour.
     *
     * @template E - The source element type.
     * @param predicate - Receives the element and its bigint encounter index.
     * @returns A collector that finishes with true when nothing matched.
     */
    <E>(predicate: BiPredicate<E, bigint>): AsynchronousCollector<E, boolean, boolean>;
}
;
/**
 * Creates a collector that tests that no element matches, returning true when empty.
 *
 * @template E - The source element type.
 * @param predicate - Tests each element and optional bigint index.
 * @returns A reusable collector configured for this operation.
 */
export let useAsynchronousNoneMatch: UseAsynchronousNonMatch = <E>(predicate: Predicate<E> | BiPredicate<E, bigint>): AsynchronousCollector<E, boolean, boolean> => {
    if (isFunction(predicate)) {
        return AsynchronousCollector.shortable((): boolean => true, (_element: E, _index: bigint, accumulator: boolean): boolean => !accumulator, (accumulator: boolean, element: E, index: bigint): boolean => accumulator && !predicate(element, index), (accumulator: boolean): boolean => accumulator);
    }
    throw new TypeError("Predicate must be a function.");
};
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
 * Creates collectors that join elements into a single text value.
 *
 * The default form wraps the elements in square brackets with commas between
 * them. Other overloads change the delimiter, the surrounding text or the
 * accumulation function. Unlike useAsynchronousLog and useAsynchronousError, the
 * finished text is only returned and never written anywhere.
 *
 * @template E - The source element type.
 */
interface UseAsynchronousJoin {
    /**
     * Joins with the default square brackets and comma delimiter.
     *
     * The accumulator starts as "[" and appends element plus comma; the finisher
     * removes the final comma and appends "]", an empty source yielding "[]".
     *
     * @template E - The source element type.
     * @returns A collector that finishes with the bracketed text.
     */
    <E = unknown>(): AsynchronousCollector<E, string, string>;
    /**
     * Joins with square brackets but a caller-supplied delimiter.
     *
     * The opening bracket stays "[", the delimiter replaces the comma and the
     * finisher trims the delimiter before appending "]" so the framing is intact.
     *
     * @template E - The source element type.
     * @param delimiter - Text placed between consecutive elements.
     * @returns A collector that finishes with the bracketed text.
     */
    <E = unknown>(delimiter: string): AsynchronousCollector<E, string, string>;
    /**
     * Joins with caller-supplied opening text, delimiter and closing text.
     *
     * The prefix is the initial accumulator, elements and the delimiter are
     * appended in order, and the closing text is appended after trimming the
     * trailing delimiter.
     *
     * @template E - The source element type.
     * @param prefix - Text the accumulation starts with.
     * @param delimiter - Text placed between consecutive elements.
     * @param suffix - Text appended after the last element.
     * @returns A collector that finishes with the framed text.
     */
    <E = unknown>(prefix: string, delimiter: string, suffix: string): AsynchronousCollector<E, string, string>;
    /**
     * Joins with a custom two-argument accumulator framed by caller-supplied text.
     *
     * The accumulator decides how each awaited element changes the running text,
     * while prefix seeds it and suffix is appended unchanged by the finisher.
     *
     * @template E - The source element type.
     * @param prefix - Text the accumulator starts from.
     * @param accumulator - Combines the current text with the next element.
     * @param suffix - Text appended after the last element.
     * @returns A collector that finishes with the framed text.
     */
    <E = unknown>(prefiex: string, accumulator: BiFunctional<string, E, string>, suffix: string): AsynchronousCollector<E, string, string>;
    /**
     * Joins with an index-aware accumulator framed by caller-supplied text.
     *
     * The bigint encounter index is available to the accumulator, so the text can
     * include numbering or other positional formatting; suffix is appended as is.
     *
     * @template E - The source element type.
     * @param prefix - Text the accumulator starts from.
     * @param accumulator - Combines the current text with the element and its index.
     * @param suffix - Text appended after the last element.
     * @returns A collector that finishes with the framed text.
     */
    <E = unknown>(prefiex: string, accumulator: TriFunctional<string, E, bigint, string>, suffix: string): AsynchronousCollector<E, string, string>;
}
;
/**
 * Creates a collector that joins elements into text, using square brackets and commas by default.
 *
 * @template E - The source element type.
 * @param argument1 - The delimiter, or opening text in a three-argument overload.
 * @param argument2 - The delimiter or custom string accumulator.
 * @param argument3 - The closing text.
 * @returns A reusable collector configured for this operation.
 */
export let useAsynchronousJoin: UseAsynchronousJoin = <E = unknown>(argument1?: string, argument2?: string | BiFunctional<string, E, string> | TriFunctional<string, E, bigint, string>, argument3?: string): AsynchronousCollector<E, string, string> => {
    if (invalidate(argument1) && invalidate(argument2) && invalidate(argument3)) {
        return AsynchronousCollector.full<E, string, string>((): string => "[", (text: string, element: E): string => text + element + ",", (text: string): string => text.substring(0, Math.max(1, text.length - 1)) + "]");
    }
    if (isString(argument1) && invalidate(argument2) && invalidate(argument3)) {
        let delimiter: string = argument1;
        return AsynchronousCollector.full<E, string, string>((): string => "[", (text: string, element: E): string => text + element + delimiter, (text: string): string => text.substring(0, Math.max(1, text.length - delimiter.length)) + "]");
    }
    if (isString(argument1) && isFunction(argument2) && isString(argument3)) {
        let prefix: string = argument1;
        let accumulator: BiFunctional<string, E, string> & TriFunctional<string, E, bigint, string> = argument2 as BiFunctional<string, E, string> & TriFunctional<string, E, bigint, string>;
        let suffix: string = argument3;
        return AsynchronousCollector.full<E, string, string>((): string => prefix, accumulator, (text: string): string => text + suffix);
    }
    if (isString(argument1) && isString(argument2) && isString(argument3)) {
        let prefix: string = argument1;
        let delimiter: string = argument2;
        let suffix: string = argument3;
        return AsynchronousCollector.full<E, string, string>((): string => prefix, (text: string, element: E): string => text + element + delimiter, (text: string): string => text.substring(0, Math.max(prefix.length, text.length - delimiter.length)) + suffix);
    }
    throw new TypeError("Invalid arguments.");
};
/**
 * Creates collectors that format elements into one text line, write it with
 * console.log and return the same text.
 *
 * The overload set mirrors useAsynchronousError, which prints with console.error.
 * The default form uses square brackets and commas; other overloads replace the
 * accumulator or the surrounding text, while useAsynchronousJoin only returns text.
 *
 * @template E - The source element type.
 */
interface UseAsynchronousLog {
    /**
     * Formats with the default square-bracket and comma notation.
     *
     * Awaited elements are stringified and joined, the trailing comma is trimmed,
     * the closing bracket appended and the finished line written with console.log.
     *
     * @template E - The source element type.
     * @returns A collector that finishes with the text it printed.
     */
    <E = unknown>(): AsynchronousCollector<E, string, string>;
    /**
     * Uses a custom two-argument accumulator inside the default brackets.
     *
     * The accumulator receives the running text and the next awaited element; the
     * default "[" and "]" framing is kept and the finished text is written with console.log.
     *
     * @template E - The source element type.
     * @param accumulator - Combines the current text with the next element.
     * @returns A collector that finishes with the text it printed.
     */
    <E = unknown>(accumulator: BiFunctional<string, E, string>): AsynchronousCollector<E, string, string>;
    /**
     * Uses a custom index-aware accumulator inside the default brackets.
     *
     * The accumulator also receives the bigint encounter index, allowing numbered
     * lines while keeping the default bracket framing and console.log output.
     *
     * @template E - The source element type.
     * @param accumulator - Combines the current text with the element and its index.
     * @returns A collector that finishes with the text it printed.
     */
    <E = unknown>(accumulator: TriFunctional<string, E, bigint, string>): AsynchronousCollector<E, string, string>;
    /**
     * Wraps a two-argument accumulator in caller-supplied opening and closing text.
     *
     * The prefix seeds the accumulator, the suffix is appended by the finisher and
     * the complete line is written with console.log instead of console.error.
     *
     * @template E - The source element type.
     * @param prefix - Text the accumulator starts from.
     * @param accumulator - Combines the current text with the next element.
     * @param suffix - Text appended before the result is printed.
     * @returns A collector that finishes with the text it printed.
     */
    <E = unknown>(prefix: string, accumulator: BiFunctional<string, E, string>, suffix: string): AsynchronousCollector<E, string, string>;
    /**
     * Wraps an index-aware accumulator in caller-supplied opening and closing text.
     *
     * The accumulator may use the bigint encounter index, prefix and suffix frame
     * the result, and the finished line is written with console.log.
     *
     * @template E - The source element type.
     * @param prefix - Text the accumulator starts from.
     * @param accumulator - Combines the current text with the element and its index.
     * @param suffix - Text appended before the result is printed.
     * @returns A collector that finishes with the text it printed.
     */
    <E = unknown>(prefix: string, accumulator: TriFunctional<string, E, bigint, string>, suffix: string): AsynchronousCollector<E, string, string>;
}
;
/**
 * Creates a collector that formats elements, writes text with console.log and returns the text.
 *
 * @template E - The source element type.
 * @param argument1 - The opening text or string accumulator; omit for default formatting.
 * @param argument2 - The custom string accumulator when opening and closing text are supplied.
 * @param argument3 - The closing text.
 * @returns A reusable collector configured for this operation.
 */
export let useAsynchronousLog: UseAsynchronousLog = <E = unknown>(argument1?: string | BiFunctional<string, E, string> | TriFunctional<string, E, bigint, string>, argument2?: BiFunctional<string, E, string> | TriFunctional<string, E, bigint, string>, argument3?: string): AsynchronousCollector<E, string, string> => {
    if (isString(argument1) && isFunction(argument2) && isString(argument3)) {
        let prefix: string = argument1;
        let accumulator: BiFunctional<string, E, string> & TriFunctional<string, E, bigint, string> = argument2 as BiFunctional<string, E, string> & TriFunctional<string, E, bigint, string>;
        let suffix: string = argument3;
        return AsynchronousCollector.full<E, string, string>((): string => prefix, accumulator, (text: string): string => {
            let result: string = text + suffix;
            console.log(result);
            return result;
        });
    }
    else if (isFunction(argument1)) {
        let prefix: string = "[";
        let accumulator: BiFunctional<string, E, string> & TriFunctional<string, E, bigint, string> = argument1 as BiFunctional<string, E, string> & TriFunctional<string, E, bigint, string>;
        let suffix: string = "]";
        return AsynchronousCollector.full<E, string, string>((): string => prefix, accumulator, (text: string): string => {
            let result: string = text + suffix;
            console.log(result);
            return result;
        });
    }
    else {
        return AsynchronousCollector.full<E, string, string>((): string => "[", (accumulator: string, element: E): string => {
            if (isString(accumulator) && isString(element)) {
                return accumulator + element + ",";
            }
            return String(accumulator) + String(element) + ",";
        }, (text: string): string => {
            let result: string = text.substring(0, Math.max(1, text.length - 1)) + "]";
            console.log(result);
            return result;
        });
    }
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
 * Creates collectors that fold the source into one value.
 *
 * The overload set covers the three forms of reduction: a reducer alone (which
 * starts from an uninitialized promise and needs no initial value), a reducer
 * with an initial value, and a reducer with an initial value plus a finisher that
 * can change the result shape.
 *
 * @template E - The source element type.
 * @template R - The finished result type.
 */
interface UseAsynchronousReduce {
    /**
     * Reduces without an initial value, returning a promise.
     *
     * The accumulator stays uninitialized until the first element, which becomes
     * the seed; later elements are folded in through the promise chain. An empty
     * source rejects the finished promise instead of returning an empty value.
     *
     * @template E - The source element type.
     * @param accumulator - Combines the previous value with the next element.
     * @returns A collector that finishes with a promise of the reduced value.
     */
    <E>(accumulator: BiFunctional<E, E, E>): AsynchronousCollector<E, Promise<E>, Promise<E>>;
    /**
     * Reduces without an initial value using an index-aware reducer.
     *
     * The same seeding applies, but the reducer also receives the bigint
     * encounter index, which enables position-sensitive folds; an empty source
     * rejects the finished promise.
     *
     * @template E - The source element type.
     * @param accumulator - Combines the previous value with the element and its index.
     * @returns A collector that finishes with a promise of the reduced value.
     */
    <E>(accumulator: TriFunctional<E, E, bigint, E>): AsynchronousCollector<E, Promise<E>, Promise<E>>;
    /**
     * Reduces from an explicit initial value of the element type.
     *
     * The identity is used as-is for every collection, so the first element is
     * folded into it rather than becoming the seed. The result is E, never a
     * promise, and an empty source finishes with the identity unchanged.
     *
     * @template E - The source element type.
     * @param identity - Initial reduction value.
     * @param accumulator - Combines the previous value with the next element.
     * @returns A collector that finishes with the reduced value.
     */
    <E>(identity: E, accumulator: BiFunctional<E, E, E>): AsynchronousCollector<E, E, E>;
    /**
     * Reduces from an explicit initial value with an index-aware reducer.
     *
     * The reducer receives the bigint encounter index in addition to the running
     * value and the element, while the identity still seeds every collection.
     *
     * @template E - The source element type.
     * @param identity - Initial reduction value.
     * @param accumulator - Combines the previous value with the element and its index.
     * @returns A collector that finishes with the reduced value.
     */
    <E>(identity: E, accumulator: TriFunctional<E, E, bigint, E>): AsynchronousCollector<E, E, E>;
    /**
     * Reduces from an initial value of a different type and applies a finisher.
     *
     * The accumulator folds elements into R, and the finisher runs once on the
     * completed R before collection returns. This form is useful when the running
     * state is not the value the caller wants to receive.
     *
     * @template E - The source element type.
     * @template R - The accumulator and finished result type.
     * @param identity - Initial accumulator value.
     * @param accumulator - Combines the accumulator with the next element.
     * @param finisher - Transforms the completed accumulator into the result.
     * @returns A collector that finishes with the finished value.
     */
    <E, R>(identity: R, accumulator: BiFunctional<R, E, R>, finisher: Functional<R, R>): AsynchronousCollector<E, R, R>;
    /**
     * Reduces from a differently typed initial value with index-aware folding and a finisher.
     *
     * The accumulator receives the bigint encounter index; the finisher is applied
     * once after the asynchronous source is exhausted. As above, the R state may
     * differ from the element type.
     *
     * @template E - The source element type.
     * @template R - The accumulator and finished result type.
     * @param identity - Initial accumulator value.
     * @param accumulator - Combines the accumulator with the element and its index.
     * @param finisher - Transforms the completed accumulator into the result.
     * @returns A collector that finishes with the finished value.
     */
    <E, R>(identity: R, accumulator: TriFunctional<R, E, bigint, R>, finisher: Functional<R, R>): AsynchronousCollector<E, R, R>;
}
;
/**
 * Creates a collector that reduces elements with an optional initial value and finisher.
 *
 * @template E - The source element type.
 * @template R - The finished result type.
 * @param argument1 - The reducer when used alone, or the initial reduction value.
 * @param argument2 - The reducer when an initial value is supplied.
 * @param argument3 - The optional result finisher.
 * @returns A reusable collector configured for this operation.
 */
export let useAsynchronousReduce: UseAsynchronousReduce = <E, R>(argument1?: R | E | BiFunctional<E, E, E> | TriFunctional<E, E, bigint, E>, argument2?: BiFunctional<E, E, E> | TriFunctional<E, E, bigint, E> | BiFunctional<R, E, R> | TriFunctional<R, E, bigint, R>, argument3?: Functional<R, R>): AsynchronousCollector<E, Promise<E>, Promise<E>> | AsynchronousCollector<E, E, E> | AsynchronousCollector<E, R, R> => {
    if (isFunction(argument1) && invalidate(argument2) && invalidate(argument3)) {
        let accumulator: BiFunctional<E, E, E> & TriFunctional<E, E, bigint, E> = argument1 as BiFunctional<E, E, E> & TriFunctional<E, E, bigint, E>;
        return AsynchronousCollector.full<E, Promise<E>, Promise<E>>(uninitializedResult<E>, (result: Promise<E>, element: E, index: bigint): Promise<E> => {
            if (uninitializedResults.has(result)) {
                return observeResult(Promise.resolve(element));
            }
            return observeResult(result.then((previous: E): E => accumulator(previous, element, index)));
        }, finishResult<E>);
    }
    else if (validate(argument1) && isFunction(argument2) && invalidate(argument3)) {
        let identity = argument1 as E;
        let accumulator: BiFunctional<E, E, E> & TriFunctional<E, E, bigint, E> = argument2 as BiFunctional<E, E, E> & TriFunctional<E, E, bigint, E>;
        return AsynchronousCollector.full<E, E, E>(() => identity, accumulator, (result: E): E => result);
    }
    else if (validate(argument1) && isFunction(argument2) && isFunction(argument3)) {
        let identity = argument1 as R;
        let accumulator: BiFunctional<R, E, R> & TriFunctional<R, E, bigint, R> = argument2 as BiFunctional<R, E, R> & TriFunctional<R, E, bigint, R>;
        let finisher = argument3 as Functional<R, R>;
        return AsynchronousCollector.full<E, R, R>(() => identity, accumulator, finisher);
    }
    else {
        throw new TypeError("Invalid arguments.");
    }
};
/**
 * Creates a collector that collects elements in encounter order into a new array.
 *
 * @template E - The source element type.
 * @returns A reusable collector configured for this operation.
 */
export let useAsynchronousToArray: <E>() => AsynchronousCollector<E, E[], E[]> = <E>(): AsynchronousCollector<E, E[], E[]> => {
    return AsynchronousCollector.full<E, E[], E[]>((): E[] => [], (array: E[], element: E): E[] => {
        array.push(element);
        return array;
    }, (array: E[]): E[] => array);
};
/**
 * Creates a collector that collects each element with its original bigint index.
 *
 * @template E - The source element type.
 * @returns A reusable collector configured for this operation.
 */
export let useAsynchronousToIndexedArray: <E>() => AsynchronousCollector<E, Array<Indexed<E>>, Array<Indexed<E>>> = <E>(): AsynchronousCollector<E, Array<Indexed<E>>, Array<Indexed<E>>> => {
    return AsynchronousCollector.full<E, Array<Indexed<E>>, Array<Indexed<E>>>((): Array<Indexed<E>> => [], (array: Array<Indexed<E>>, element: E, index: bigint): Array<Indexed<E>> => {
        array.push({
            element: element,
            index: index
        });
        return array;
    }, (array: Array<Indexed<E>>): Array<Indexed<E>> => array);
};
/**
 * Creates collectors that build a Map from extracted keys and values.
 *
 * Later entries replace earlier ones for a duplicate key, and the finished value
 * is the Map itself. useAsynchronousGroupBy differs in that it accumulates an
 * array of values per key instead of keeping only the last one.
 *
 * @template E - The source element type.
 * @template K - The extracted key type.
 * @template V - The extracted or implied value type.
 */
interface UseAsynchronousToMap {
    /**
     * Extracts only the key and stores the source element as the value.
     *
     * This is the identity-value form of the factory; a duplicate key simply
     * replaces the previously stored element.
     *
     * @template E - The source element type.
     * @template K - The extracted key type.
     * @param keyExtractor - Computes the map key from the element.
     * @returns A collector that finishes with a Map of elements.
     */
    <E, K>(keyExtractor: Functional<E, K>): AsynchronousCollector<E, Map<K, E>, Map<K, E>>;
    /**
     * Combines an element-only key extractor with an element-only value extractor.
     *
     * Each awaited element is reduced to a key and a value before being stored,
     * and the last value wins when keys repeat.
     *
     * @template E - The source element type.
     * @template K - The extracted key type.
     * @template V - The extracted value type.
     * @param keyExtractor - Computes the map key from the element.
     * @param valueExtractor - Computes the stored value from the element.
     * @returns A collector that finishes with a Map of values.
     */
    <E, K, V>(keyExtractor: Functional<E, K>, valueExtractor: Functional<E, V>): AsynchronousCollector<E, Map<K, V>, Map<K, V>>;
    /**
     * Uses index-aware extractors for both the key and the stored value.
     *
     * Both functions receive the same bigint encounter index, so the key and the
     * value may depend consistently on the element position.
     *
     * @template E - The source element type.
     * @template K - The extracted key type.
     * @template V - The extracted value type.
     * @param keyExtractor - Computes the map key from the element and its index.
     * @param valueExtractor - Computes the stored value from the element and its index.
     * @returns A collector that finishes with a Map of values.
     */
    <E, K, V>(keyExtractor: BiFunctional<E, bigint, K>, valueExtractor: BiFunctional<E, bigint, V>): AsynchronousCollector<E, Map<K, V>, Map<K, V>>;
}
;
/**
 * Creates a collector that collects extracted keys and values, replacing earlier values for duplicate keys.
 *
 * @template E - The source element type.
 * @template K - The extracted key type.
 * @template V - The extracted value type.
 * @param keyExtractor - Extracts the grouping or map key.
 * @param valueExtractor - Extracts the value to store.
 * @returns A reusable collector configured for this operation.
 */
export let useAsynchronousToMap: UseAsynchronousToMap = <E, K, V>(keyExtractor: Functional<E, K> | BiFunctional<E, bigint, K>, valueExtractor: Functional<E, V> | BiFunctional<E, bigint, V> = (element: E): V => element as unknown as V): AsynchronousCollector<E, Map<K, V>, Map<K, V>> => {
    if (isFunction(keyExtractor) && isFunction(valueExtractor)) {
        return AsynchronousCollector.full<E, Map<K, V>, Map<K, V>>((): Map<K, V> => new Map<K, V>(), (map: Map<K, V>, element: E, index: bigint): Map<K, V> => {
            let key: K = keyExtractor(element, index);
            let value: V = valueExtractor(element, index);
            map.set(key, value);
            return map;
        }, (map: Map<K, V>): Map<K, V> => map);
    }
    throw new TypeError("Key extractor and value extractor must be functions.");
};
/**
 * Creates a collector that collects distinct elements into a Set.
 *
 * @template E - The source element type.
 * @returns A reusable collector configured for this operation.
 */
export let useAsynchronousToSet: <E>() => AsynchronousCollector<E, Set<E>, Set<E>> = <E>(): AsynchronousCollector<E, Set<E>, Set<E>> => {
    return AsynchronousCollector.full<E, Set<E>, Set<E>>((): Set<E> => new Set<E>(), (set: Set<E>, element: E): Set<E> => {
        set.add(element);
        return set;
    }, (set: Set<E>): Set<E> => set);
};
/**
 * Creates collectors that write elements to a WritableStream while collecting.
 *
 * The accumulator is a promise of the stream rather than the elements, so the
 * finished value resolves to the stream after all writes settle. The default
 * form writes each element stringified; explicit accumulators can write chunks
 * of another type or transform the stream between writes.
 *
 * @template E - The source element type.
 * @template S - The stream chunk type.
 */
interface UseAsynchronousWrite {
    /**
     * Writes each element stringified, using the stream writer directly.
     *
     * The identity is a promise of the supplied stream and each step obtains a
     * writer and calls write with String of the element, propagating writer errors.
     *
     * @template E - The source element type.
     * @template S - The stream chunk type.
     * @param stream - The WritableStream that receives the stringified elements.
     * @returns A collector that finishes with a promise of the completed stream.
     */
    <E, S = string>(stream: WritableStream<S>): AsynchronousCollector<E, Promise<WritableStream<S>>, Promise<WritableStream<S>>>;
    /**
     * Uses a custom two-argument accumulator that receives the stream and the element.
     *
     * The accumulation is chained through the promise of the stream, so an error
     * thrown by the accumulator rejects the finished promise instead of escaping.
     *
     * @template E - The source element type.
     * @template S - The stream chunk type.
     * @param stream - The WritableStream that receives the accumulated writes.
     * @param accumulator - Writes one element through the stream and returns the stream.
     * @returns A collector that finishes with a promise of the completed stream.
     */
    <E, S = string>(stream: WritableStream<S>, accumulator: BiFunctional<WritableStream<S>, E, WritableStream<S>>): AsynchronousCollector<E, Promise<WritableStream<S>>, Promise<WritableStream<S>>>;
    /**
     * Uses an index-aware accumulator that also receives the bigint encounter index.
     *
     * The promise chain is the same, but the accumulator can vary its writes by
     * position; a thrown error rejects the resulting promise.
     *
     * @template E - The source element type.
     * @template S - The stream chunk type.
     * @param stream - The WritableStream that receives the accumulated writes.
     * @param accumulator - Writes one indexed element through the stream and returns the stream.
     * @returns A collector that finishes with a promise of the completed stream.
     */
    <E, S = string>(stream: WritableStream<S>, accumulator: TriFunctional<WritableStream<S>, E, bigint, WritableStream<S>>): AsynchronousCollector<E, Promise<WritableStream<S>>, Promise<WritableStream<S>>>;
}
;
/**
 * Creates a collector that chains stream accumulation, writing stringified elements when no accumulator is supplied.
 *
 * @template E - The source element type.
 * @template S - The stream chunk type.
 * @param argument1 - The writable stream used by the collection.
 * @param argument2 - The optional stream accumulator; the default writes stringified elements.
 * @returns A reusable collector configured for this operation.
 */
export let useAsynchronousWrite: UseAsynchronousWrite = <E, S = string>(argument1: WritableStream<S>, argument2?: BiFunctional<WritableStream<S>, E, WritableStream<S>> | TriFunctional<WritableStream<S>, E, bigint, WritableStream<S>>): AsynchronousCollector<E, Promise<WritableStream<S>>, Promise<WritableStream<S>>> => {
    if (isObject(argument1)) {
        if (isFunction(argument2)) {
            let stream: WritableStream<S> = argument1 as WritableStream<S>;
            let accumulator: BiFunctional<WritableStream<S>, E, WritableStream<S>> & TriFunctional<WritableStream<S>, E, bigint, WritableStream<S>> = argument2 as BiFunctional<WritableStream<S>, E, WritableStream<S>> & TriFunctional<WritableStream<S>, E, bigint, WritableStream<S>>;
            return AsynchronousCollector.full<E, Promise<WritableStream<S>>, Promise<WritableStream<S>>>((): Promise<WritableStream<S>> => Promise.resolve(stream), (promise: Promise<WritableStream<S>>, element: E, index: bigint): Promise<WritableStream<S>> => {
                return new Promise<WritableStream<S>>((resolve, reject) => {
                    promise.then((stream: WritableStream<S>): void => {
                        try {
                            resolve(accumulator(stream, element, index));
                        }
                        catch (error) {
                            reject(error);
                        }
                    }).catch(reject);
                });
            }, (promise: Promise<WritableStream<S>>): Promise<WritableStream<S>> => promise);
        }
        else {
            let stream: WritableStream<S> = argument1 as WritableStream<S>;
            return AsynchronousCollector.full<E, Promise<WritableStream<S>>, Promise<WritableStream<S>>>((): Promise<WritableStream<S>> => Promise.resolve(stream), (promise: Promise<WritableStream<S>>, element: E): Promise<WritableStream<S>> => {
                return new Promise<WritableStream<S>>((resolve, reject) => {
                    promise.then((stream: WritableStream<S>): void => {
                        try {
                            let writer: WritableStreamDefaultWriter<S> = stream.getWriter();
                            writer.write(String(element) as S);
                            resolve(stream);
                        }
                        catch (error) {
                            reject(error);
                        }
                    }).catch(reject);
                });
            }, (promise: Promise<WritableStream<S>>): Promise<WritableStream<S>> => promise);
        }
    }
    throw new TypeError("Invalid arguments.");
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
/**
 * Creates a collector that buffers elements and finishes with a synchronous generator object over the buffer.
 *
 * @template E - The source element type.
 * @returns A reusable collector configured for this operation.
 */
export let useAsynchronousToGeneratorFunction: <E>() => AsynchronousCollector<E, Array<E>, globalThis.Generator<E, void, undefined>> = <E>(): AsynchronousCollector<E, Array<E>, globalThis.Generator<E, void, undefined>> => {
    return AsynchronousCollector.full((): Array<E> => [], (array: Array<E>, element: E): Array<E> => {
        array.push(element);
        return array;
    }, (array: Array<E>): globalThis.Generator<E, void, undefined> => {
        return (function* () {
            for (let element of array) {
                yield element;
            }
        })();
    });
};
/**
 * Creates a collector that buffers elements and finishes with an asynchronous generator object over the buffer.
 *
 * @template E - The source element type.
 * @returns A reusable collector configured for this operation.
 */
export let useAsynchronousToAsyncGeneratorFunction: <E>() => AsynchronousCollector<E, Array<E>, globalThis.AsyncGenerator<E, void, undefined>> = <E>(): AsynchronousCollector<E, Array<E>, globalThis.AsyncGenerator<E, void, undefined>> => {
    return AsynchronousCollector.full((): Array<E> => [], (array: Array<E>, element: E): Array<E> => {
        array.push(element);
        return array;
    }, (array: Array<E>): globalThis.AsyncGenerator<E, void, undefined> => {
        return (async function* () {
            for (let element of array) {
                yield element;
            }
        })();
    });
};
/**
 * Creates a collector that finishes with a new asynchronous ordered set.
 *
 * Buffered elements are inserted into an `AsynchronousOrderedSet`, so elements
 * the comparator considers equal collapse to the first representative seen, and
 * the finished set iterates in comparator-ascending order instead of encounter
 * order. The structure's collection queries return promises that wait for source
 * initialisation, while iteration stays synchronous. Supplying a comparator
 * makes membership, removal and iteration use comparator equality; without one
 * the ordered-set default order applies.
 *
 * Complexity: collecting is O(n) in the source. Building the set locates each
 * insertion in O(log n) and splices it into a sorted node array in O(n), so the
 * build is O(n^2) worst case, while a read sorts a snapshot in O(n log n).
 *
 * @template E - The source element type.
 * @param comparator - Total element order; defaults to the ordered-set default order.
 * @returns A reusable collector configured for this operation.
 * @throws {TypeError} If the comparator returns a non-finite number or does not compare a value equal to itself.
 */
export let useAsynchronousToOrderedSet: <E>(comparator?: Comparator<E>) => AsynchronousCollector<E, Array<E>, AsynchronousOrderedSet<E>> = <E>(comparator?: Comparator<E>): AsynchronousCollector<E, Array<E>, AsynchronousOrderedSet<E>> => {
    return AsynchronousCollector.full<E, Array<E>, AsynchronousOrderedSet<E>>((): Array<E> => [], (array: Array<E>, element: E): Array<E> => {
        array.push(element);
        return array;
    }, (array: Array<E>): AsynchronousOrderedSet<E> => {
        return new AsynchronousOrderedSet<E>(array, { comparator: comparator });
    });
};
/**
 * Creates a collector that finishes with a new asynchronous unordered set.
 *
 * Buffered elements are inserted into an `AsynchronousUnorderedSet`, which keeps
 * elements distinct under SameValueZero (objects by identity, `NaN` equal to
 * itself). Iteration follows hash buckets, so no order is guaranteed and the
 * encounter order of the source is not preserved.
 *
 * Complexity: collecting is O(n) in the source and each insertion is O(1)
 * expected because membership is hash-bucketed.
 *
 * @template E - The source element type.
 * @returns A reusable collector configured for this operation.
 */
export let useAsynchronousToUnorderedSet: <E>() => AsynchronousCollector<E, Array<E>, AsynchronousUnorderedSet<E>> = <E>(): AsynchronousCollector<E, Array<E>, AsynchronousUnorderedSet<E>> => {
    return AsynchronousCollector.full<E, Array<E>, AsynchronousUnorderedSet<E>>((): Array<E> => [], (array: Array<E>, element: E): Array<E> => {
        array.push(element);
        return array;
    }, (array: Array<E>): AsynchronousUnorderedSet<E> => {
        return new AsynchronousUnorderedSet<E>(array);
    });
};
/**
 * Creates collectors that build an insertion-ordered map from extracted keys and values.
 *
 * Every element contributes one pair. A duplicate key replaces the earlier value
 * without moving it, so the first occurrence fixes the iteration position, and
 * the finished value is an `AsynchronousOrderedMap` whose collection views
 * iterate in that insertion order and settle through promises. Stored values
 * must be non-null, so a value extractor that yields `null` or `undefined` makes
 * the finished collection throw.
 *
 * @template E - The source element type.
 * @template K - The extracted key type.
 * @template V - The extracted or implied value type.
 */
interface UseAsynchronousToOrderedMap {
    /**
     * Extracts only the key and stores the source element as the value.
     *
     * @template E - The source element type.
     * @template K - The extracted key type.
     * @param keyExtractor - Computes the map key from the element.
     * @returns A collector that finishes with an insertion-ordered map of elements.
     */
    <E, K>(keyExtractor: Functional<E, K>): AsynchronousCollector<E, Array<[K, E]>, AsynchronousOrderedMap<K, E>>;
    /**
     * Combines an element-only key extractor with an element-only value extractor.
     *
     * @template E - The source element type.
     * @template K - The extracted key type.
     * @template V - The extracted value type.
     * @param keyExtractor - Computes the map key from the element.
     * @param valueExtractor - Computes the stored value from the element.
     * @returns A collector that finishes with an insertion-ordered map of values.
     */
    <E, K, V>(keyExtractor: Functional<E, K>, valueExtractor: Functional<E, V>): AsynchronousCollector<E, Array<[K, V]>, AsynchronousOrderedMap<K, V>>;
    /**
     * Uses index-aware extractors for both the key and the stored value.
     *
     * @template E - The source element type.
     * @template K - The extracted key type.
     * @template V - The extracted value type.
     * @param keyExtractor - Computes the map key from the element and its index.
     * @param valueExtractor - Computes the stored value from the element and its index.
     * @returns A collector that finishes with an insertion-ordered map of values.
     */
    <E, K, V>(keyExtractor: BiFunctional<E, bigint, K>, valueExtractor: BiFunctional<E, bigint, V>): AsynchronousCollector<E, Array<[K, V]>, AsynchronousOrderedMap<K, V>>;
}
;
/**
 * Creates a collector that collects extracted pairs into an insertion-ordered map.
 *
 * @template E - The source element type.
 * @template K - The extracted key type.
 * @template V - The extracted value type.
 * @param keyExtractor - Extracts the map key from the element and optional bigint index.
 * @param valueExtractor - Extracts the stored value from the element and optional bigint index.
 * @returns A reusable collector configured for this operation.
 * @throws {TypeError} If an extractor is not a function or a completed pair holds a nullish value.
 */
export let useAsynchronousToOrderedMap: UseAsynchronousToOrderedMap = <E, K, V>(keyExtractor: Functional<E, K> | BiFunctional<E, bigint, K>, valueExtractor: Functional<E, V> | BiFunctional<E, bigint, V> = (element: E): V => element as unknown as V): AsynchronousCollector<E, Array<[K, V]>, AsynchronousOrderedMap<K, V>> => {
    if (isFunction(keyExtractor) && isFunction(valueExtractor)) {
        return AsynchronousCollector.full<E, Array<[K, V]>, AsynchronousOrderedMap<K, V>>((): Array<[K, V]> => [], (pairs: Array<[K, V]>, element: E, index: bigint): Array<[K, V]> => {
            pairs.push([keyExtractor(element, index), valueExtractor(element, index)]);
            return pairs;
        }, (pairs: Array<[K, V]>): AsynchronousOrderedMap<K, V> => {
            return new AsynchronousOrderedMap<K, V>(pairs);
        });
    }
    throw new TypeError("Key extractor and value extractor must be functions.");
};
/**
 * Creates collectors that build an unordered map from extracted keys and values.
 *
 * Every element contributes one pair. A duplicate key replaces the earlier value,
 * and the finished value is an `AsynchronousUnorderedMap`, whose collection views
 * iterate in hash-bucket order, so neither insertion nor result order is
 * observable. Stored values must be non-null, so a value extractor that yields
 * `null` or `undefined` makes the finished collection throw.
 *
 * @template E - The source element type.
 * @template K - The extracted key type.
 * @template V - The extracted or implied value type.
 */
interface UseAsynchronousToUnorderedMap {
    /**
     * Extracts only the key and stores the source element as the value.
     *
     * @template E - The source element type.
     * @template K - The extracted key type.
     * @param keyExtractor - Computes the map key from the element.
     * @returns A collector that finishes with an unordered map of elements.
     */
    <E, K>(keyExtractor: Functional<E, K>): AsynchronousCollector<E, Array<[K, E]>, AsynchronousUnorderedMap<K, E>>;
    /**
     * Combines an element-only key extractor with an element-only value extractor.
     *
     * @template E - The source element type.
     * @template K - The extracted key type.
     * @template V - The extracted value type.
     * @param keyExtractor - Computes the map key from the element.
     * @param valueExtractor - Computes the stored value from the element.
     * @returns A collector that finishes with an unordered map of values.
     */
    <E, K, V>(keyExtractor: Functional<E, K>, valueExtractor: Functional<E, V>): AsynchronousCollector<E, Array<[K, V]>, AsynchronousUnorderedMap<K, V>>;
    /**
     * Uses index-aware extractors for both the key and the stored value.
     *
     * @template E - The source element type.
     * @template K - The extracted key type.
     * @template V - The extracted value type.
     * @param keyExtractor - Computes the map key from the element and its index.
     * @param valueExtractor - Computes the stored value from the element and its index.
     * @returns A collector that finishes with an unordered map of values.
     */
    <E, K, V>(keyExtractor: BiFunctional<E, bigint, K>, valueExtractor: BiFunctional<E, bigint, V>): AsynchronousCollector<E, Array<[K, V]>, AsynchronousUnorderedMap<K, V>>;
}
;
/**
 * Creates a collector that collects extracted pairs into an unordered map.
 *
 * @template E - The source element type.
 * @template K - The extracted key type.
 * @template V - The extracted value type.
 * @param keyExtractor - Extracts the map key from the element and optional bigint index.
 * @param valueExtractor - Extracts the stored value from the element and optional bigint index.
 * @returns A reusable collector configured for this operation.
 * @throws {TypeError} If an extractor is not a function or a completed pair holds a nullish value.
 */
export let useAsynchronousToUnorderedMap: UseAsynchronousToUnorderedMap = <E, K, V>(keyExtractor: Functional<E, K> | BiFunctional<E, bigint, K>, valueExtractor: Functional<E, V> | BiFunctional<E, bigint, V> = (element: E): V => element as unknown as V): AsynchronousCollector<E, Array<[K, V]>, AsynchronousUnorderedMap<K, V>> => {
    if (isFunction(keyExtractor) && isFunction(valueExtractor)) {
        return AsynchronousCollector.full<E, Array<[K, V]>, AsynchronousUnorderedMap<K, V>>((): Array<[K, V]> => [], (pairs: Array<[K, V]>, element: E, index: bigint): Array<[K, V]> => {
            pairs.push([keyExtractor(element, index), valueExtractor(element, index)]);
            return pairs;
        }, (pairs: Array<[K, V]>): AsynchronousUnorderedMap<K, V> => {
            return new AsynchronousUnorderedMap<K, V>(pairs);
        });
    }
    throw new TypeError("Key extractor and value extractor must be functions.");
};
/**
 * Creates a collector that finishes with a new asynchronous positional list.
 *
 * Buffered elements are appended to an `AsynchronousList` in encounter order, so
 * duplicates are retained and positions match the traversal order of the source.
 * Positional queries return promises while iteration stays synchronous. Null and
 * undefined elements are rejected by the list, so they make the finished
 * collection throw.
 *
 * Complexity: collecting is O(n) and appending at the end of the list is O(1),
 * so the completed list is built in O(n).
 *
 * @template E - The source element type.
 * @returns A reusable collector configured for this operation.
 * @throws {TypeError} If the source contains `null` or `undefined`.
 */
export let useAsynchronousToList: <E>() => AsynchronousCollector<E, Array<E>, AsynchronousList<E>> = <E>(): AsynchronousCollector<E, Array<E>, AsynchronousList<E>> => {
    return AsynchronousCollector.full<E, Array<E>, AsynchronousList<E>>((): Array<E> => [], (array: Array<E>, element: E): Array<E> => {
        array.push(element);
        return array;
    }, (array: Array<E>): AsynchronousList<E> => {
        return new AsynchronousList<E>(array);
    });
};
/**
 * Creates a collector that finishes with a new asynchronous ring.
 *
 * Buffered elements become the positions of an `AsynchronousRing`, a positional
 * list whose head and tail are joined into a ring. Encounter order fixes the
 * position of every element, and a negative position traverses the ring
 * backwards. The span is the number of turns the ring occupies; a span that
 * shares a factor with the element count collapses positions onto a shorter
 * orbit. Null and undefined elements are rejected by the ring.
 *
 * Complexity: collecting is O(n) and the ring is spliced once per element, so
 * the completed ring is built in O(n).
 *
 * @template E - The source element type.
 * @param span - Turns occupied by the ring, a positive finite number; defaults to one.
 * @returns A reusable collector configured for this operation.
 * @throws {RangeError} If the span is not positive.
 * @throws {TypeError} If the span is not a finite number or the source contains `null` or `undefined`.
 */
export let useAsynchronousToRing: <E>(span?: number) => AsynchronousCollector<E, Array<E>, AsynchronousRing<E>> = <E>(span?: number): AsynchronousCollector<E, Array<E>, AsynchronousRing<E>> => {
    return AsynchronousCollector.full<E, Array<E>, AsynchronousRing<E>>((): Array<E> => [], (array: Array<E>, element: E): Array<E> => {
        array.push(element);
        return array;
    }, (array: Array<E>): AsynchronousRing<E> => {
        return new AsynchronousRing<E>(array, { span: span });
    });
};
/**
 * Creates a collector that finishes with a new bounded asynchronous LRU set.
 *
 * Buffered elements are inserted into an `AsynchronousUnorderedLRUSet` in
 * encounter order, and each insertion marks the element as most recently used.
 * The capacity bounds the set, so capacity pressure evicts the least recently
 * used elements while the surviving elements remain distinct under
 * SameValueZero. A non-positive capacity is rejected by the set.
 *
 * Complexity: collecting is O(n) and each non-evicting insertion is O(1)
 * expected, while an eviction scans for the least recently used element, so a
 * build that evicts repeatedly is O(n^2) worst case.
 *
 * @template E - The source element type.
 * @param capacity - The positive maximum number of elements to retain.
 * @returns A reusable collector configured for this operation.
 * @throws {RangeError} If the capacity is not a positive bigint.
 * @throws {TypeError} If the source contains `null` or `undefined`.
 */
export let useAsynchronousToLRUSet: <E>(capacity: bigint) => AsynchronousCollector<E, Array<E>, AsynchronousUnorderedLRUSet<E>> = <E>(capacity: bigint): AsynchronousCollector<E, Array<E>, AsynchronousUnorderedLRUSet<E>> => {
    return AsynchronousCollector.full<E, Array<E>, AsynchronousUnorderedLRUSet<E>>((): Array<E> => [], (array: Array<E>, element: E): Array<E> => {
        array.push(element);
        return array;
    }, (array: Array<E>): AsynchronousUnorderedLRUSet<E> => {
        return new AsynchronousUnorderedLRUSet<E>(array, { capacity: capacity });
    });
};
/**
 * Creates collectors that build a bounded asynchronous LRU map from extracted keys and values.
 *
 * Every element contributes one pair. A duplicate key replaces the earlier value
 * and marks the mapping most recently used, and capacity pressure evicts the
 * least recently used mapping. The finished value is an
 * `AsynchronousUnorderedLRUMap`, whose collection views promise no iteration
 * order. Stored values must be non-null, so a value extractor that yields `null`
 * or `undefined` makes the finished collection throw.
 *
 * @template E - The source element type.
 * @template K - The extracted key type.
 * @template V - The extracted or implied value type.
 */
interface UseAsynchronousToLRUMap {
    /**
     * Extracts only the key and stores the source element as the value.
     *
     * @template E - The source element type.
     * @template K - The extracted key type.
     * @param capacity - The positive maximum number of mappings to retain.
     * @param keyExtractor - Computes the map key from the element.
     * @returns A collector that finishes with a bounded LRU map of elements.
     */
    <E, K>(capacity: bigint, keyExtractor: Functional<E, K>): AsynchronousCollector<E, Array<[K, E]>, AsynchronousUnorderedLRUMap<K, E>>;
    /**
     * Combines an element-only key extractor with an element-only value extractor.
     *
     * @template E - The source element type.
     * @template K - The extracted key type.
     * @template V - The extracted value type.
     * @param capacity - The positive maximum number of mappings to retain.
     * @param keyExtractor - Computes the map key from the element.
     * @param valueExtractor - Computes the stored value from the element.
     * @returns A collector that finishes with a bounded LRU map of values.
     */
    <E, K, V>(capacity: bigint, keyExtractor: Functional<E, K>, valueExtractor: Functional<E, V>): AsynchronousCollector<E, Array<[K, V]>, AsynchronousUnorderedLRUMap<K, V>>;
    /**
     * Uses index-aware extractors for both the key and the stored value.
     *
     * @template E - The source element type.
     * @template K - The extracted key type.
     * @template V - The extracted value type.
     * @param capacity - The positive maximum number of mappings to retain.
     * @param keyExtractor - Computes the map key from the element and its index.
     * @param valueExtractor - Computes the stored value from the element and its index.
     * @returns A collector that finishes with a bounded LRU map of values.
     */
    <E, K, V>(capacity: bigint, keyExtractor: BiFunctional<E, bigint, K>, valueExtractor: BiFunctional<E, bigint, V>): AsynchronousCollector<E, Array<[K, V]>, AsynchronousUnorderedLRUMap<K, V>>;
}
;
/**
 * Creates a collector that collects extracted pairs into a bounded LRU map.
 *
 * @template E - The source element type.
 * @template K - The extracted key type.
 * @template V - The extracted value type.
 * @param capacity - The positive maximum number of mappings to retain.
 * @param keyExtractor - Extracts the map key from the element and optional bigint index.
 * @param valueExtractor - Extracts the stored value from the element and optional bigint index.
 * @returns A reusable collector configured for this operation.
 * @throws {RangeError} If the capacity is not a positive bigint.
 * @throws {TypeError} If an extractor is not a function or a completed pair holds a nullish value.
 */
export let useAsynchronousToLRUMap: UseAsynchronousToLRUMap = <E, K, V>(capacity: bigint, keyExtractor: Functional<E, K> | BiFunctional<E, bigint, K>, valueExtractor: Functional<E, V> | BiFunctional<E, bigint, V> = (element: E): V => element as unknown as V): AsynchronousCollector<E, Array<[K, V]>, AsynchronousUnorderedLRUMap<K, V>> => {
    if (isFunction(keyExtractor) && isFunction(valueExtractor)) {
        return AsynchronousCollector.full<E, Array<[K, V]>, AsynchronousUnorderedLRUMap<K, V>>((): Array<[K, V]> => [], (pairs: Array<[K, V]>, element: E, index: bigint): Array<[K, V]> => {
            pairs.push([keyExtractor(element, index), valueExtractor(element, index)]);
            return pairs;
        }, (pairs: Array<[K, V]>): AsynchronousUnorderedLRUMap<K, V> => {
            return new AsynchronousUnorderedLRUMap<K, V>(pairs, { capacity: capacity });
        });
    }
    throw new TypeError("Key extractor and value extractor must be functions.");
};
/**
 * Creates a collector that finishes with a new navigable asynchronous skip set.
 *
 * Buffered elements are inserted into an `AsynchronousSkipSet`, a navigable set
 * whose comparisons use the supplied total order. Membership stays SameValueZero
 * while navigation, range views and iteration use the comparator, so a
 * comparator that disagrees with element equality is rejected. Navigation results
 * arrive through promises; iteration stays synchronous. Null and undefined
 * elements are rejected by the set.
 *
 * Complexity: collecting is O(n) in the source. The runtime scans the element
 * array for duplicate detection, so a build is O(n^2) worst case, and reading a
 * snapshot sorts it in O(n log n).
 *
 * @template E - The source element type.
 * @param comparator - Total element order consistent with SameValueZero equality; defaults to the skip-set default order.
 * @returns A reusable collector configured for this operation.
 * @throws {TypeError} If the comparator disagrees with element equality or the source contains `null` or `undefined`.
 */
export let useAsynchronousToSkipSet: <E>(comparator?: Comparator<E>) => AsynchronousCollector<E, Array<E>, AsynchronousSkipSet<E>> = <E>(comparator?: Comparator<E>): AsynchronousCollector<E, Array<E>, AsynchronousSkipSet<E>> => {
    return AsynchronousCollector.full<E, Array<E>, AsynchronousSkipSet<E>>((): Array<E> => [], (array: Array<E>, element: E): Array<E> => {
        array.push(element);
        return array;
    }, (array: Array<E>): AsynchronousSkipSet<E> => {
        return new AsynchronousSkipSet<E>(array, { comparator: comparator });
    });
};
/**
 * Creates collectors that build a navigable asynchronous skip map from extracted keys and values.
 *
 * Every element contributes one pair. A duplicate key replaces the earlier value,
 * and the finished value is an `AsynchronousSkipMap` whose navigation, range
 * views and iteration follow the total key order supplied for its keys. Nullish
 * keys and nullish stored values are rejected, and a comparator that disagrees
 * with SameValueZero key equality is rejected.
 *
 * @template E - The source element type.
 * @template K - The extracted key type.
 * @template V - The extracted or implied value type.
 */
interface UseAsynchronousToSkipMap {
    /**
     * Extracts only the key, stores the source element as the value and uses the default key order.
     *
     * @template E - The source element type.
     * @template K - The extracted key type.
     * @param keyExtractor - Computes the map key from the element.
     * @returns A collector that finishes with a navigable skip map of elements.
     */
    <E, K>(keyExtractor: Functional<E, K>): AsynchronousCollector<E, Array<[K, E]>, AsynchronousSkipMap<K, E>>;
    /**
     * Combines element-only key and value extractors and uses the default key order.
     *
     * @template E - The source element type.
     * @template K - The extracted key type.
     * @template V - The extracted value type.
     * @param keyExtractor - Computes the map key from the element.
     * @param valueExtractor - Computes the stored value from the element.
     * @returns A collector that finishes with a navigable skip map of values.
     */
    <E, K, V>(keyExtractor: Functional<E, K>, valueExtractor: Functional<E, V>): AsynchronousCollector<E, Array<[K, V]>, AsynchronousSkipMap<K, V>>;
    /**
     * Supplies an explicit comparator together with both extractors.
     *
     * The comparator orders keys for navigation, range views and iteration, and
     * must compare equal exactly for SameValueZero-equal keys. A comparator form
     * always carries the value extractor, so the three-argument shape is never
     * mistakable for the extractor-only shapes.
     *
     * @template E - The source element type.
     * @template K - The extracted key type.
     * @template V - The extracted value type.
     * @param comparator - Total key order consistent with SameValueZero key equality.
     * @param keyExtractor - Computes the map key from the element.
     * @param valueExtractor - Computes the stored value from the element.
     * @returns A collector that finishes with a navigable skip map of values.
     */
    <E, K, V>(comparator: Comparator<K>, keyExtractor: Functional<E, K>, valueExtractor: Functional<E, V>): AsynchronousCollector<E, Array<[K, V]>, AsynchronousSkipMap<K, V>>;
}
;
/**
 * Creates a collector that collects extracted pairs into a navigable skip map.
 *
 * @template E - The source element type.
 * @template K - The extracted key type.
 * @template V - The extracted value type.
 * @param argument1 - The key extractor when used alone or with a value extractor, otherwise the comparator.
 * @param argument2 - The value extractor, or the key extractor when a comparator leads.
 * @param argument3 - The value extractor when a comparator and key extractor lead.
 * @returns A reusable collector configured for this operation.
 * @throws {TypeError} If the comparator disagrees with key equality, a key or value is nullish, or an argument is not a function.
 */
export let useAsynchronousToSkipMap: UseAsynchronousToSkipMap = <E, K, V>(argument1: Comparator<K> | Functional<E, K>, argument2?: Functional<E, K> | Functional<E, V>, argument3?: Functional<E, V>): AsynchronousCollector<E, Array<[K, V]>, AsynchronousSkipMap<K, V>> => {
    if (isFunction(argument1) && isFunction(argument2) && isFunction(argument3)) {
        let comparator: Comparator<K> = argument1 as Comparator<K>;
        let keyExtractor: Functional<E, K> = argument2 as Functional<E, K>;
        let valueExtractor: Functional<E, V> = argument3;
        return AsynchronousCollector.full<E, Array<[K, V]>, AsynchronousSkipMap<K, V>>((): Array<[K, V]> => [], (pairs: Array<[K, V]>, element: E): Array<[K, V]> => {
            pairs.push([keyExtractor(element), valueExtractor(element)]);
            return pairs;
        }, (pairs: Array<[K, V]>): AsynchronousSkipMap<K, V> => {
            return new AsynchronousSkipMap<K, V>(pairs, { comparator: comparator });
        });
    }
    else if (isFunction(argument1) && isFunction(argument2)) {
        let keyExtractor: Functional<E, K> = argument1 as Functional<E, K>;
        let valueExtractor: Functional<E, V> = argument2 as Functional<E, V>;
        return AsynchronousCollector.full<E, Array<[K, V]>, AsynchronousSkipMap<K, V>>((): Array<[K, V]> => [], (pairs: Array<[K, V]>, element: E): Array<[K, V]> => {
            pairs.push([keyExtractor(element), valueExtractor(element)]);
            return pairs;
        }, (pairs: Array<[K, V]>): AsynchronousSkipMap<K, V> => {
            return new AsynchronousSkipMap<K, V>(pairs);
        });
    }
    else if (isFunction(argument1)) {
        let keyExtractor: Functional<E, K> = argument1 as Functional<E, K>;
        return AsynchronousCollector.full<E, Array<[K, V]>, AsynchronousSkipMap<K, V>>((): Array<[K, V]> => [], (pairs: Array<[K, V]>, element: E): Array<[K, V]> => {
            pairs.push([keyExtractor(element), element as unknown as V]);
            return pairs;
        }, (pairs: Array<[K, V]>): AsynchronousSkipMap<K, V> => {
            return new AsynchronousSkipMap<K, V>(pairs);
        });
    }
    throw new TypeError("Key extractor and value extractor must be functions.");
};
/**
 * Creates a collector that finishes with a new asynchronous binary search tree.
 *
 * Buffered elements are sorted by the comparator and split at the midpoint
 * recursively by the search-tree builder, which yields a height-balanced binary
 * search tree whose in-order traversal is comparator-ascending. Equal elements
 * keep their stable input order, so duplicates are retained. The search order is
 * materialised during construction; traversal and node navigation stay
 * synchronous, while collection queries return promises. The default comparator
 * orders homogeneous numbers, strings, bigints and booleans and rejects `NaN`;
 * any other element type needs a comparator.
 *
 * Complexity: collecting is O(n), sorting is O(n log n) and the midpoint split
 * is O(n), so the tree is built in O(n log n).
 *
 * @template E - The source element type.
 * @param comparator - Total element order; defaults to the scalar order of the tree builder.
 * @returns A reusable collector configured for this operation.
 * @throws {TypeError} If the comparator returns a non-finite number or an element cannot be ordered.
 * @throws {TypeError} If the source contains `null` or `undefined`.
 */
export let useAsynchronousToBinarySearchTree: <E>(comparator?: Comparator<E>) => AsynchronousCollector<E, Array<E>, AsynchronousBinarySearchTree<E>> = <E>(comparator?: Comparator<E>): AsynchronousCollector<E, Array<E>, AsynchronousBinarySearchTree<E>> => {
    return AsynchronousCollector.full<E, Array<E>, AsynchronousBinarySearchTree<E>>((): Array<E> => [], (array: Array<E>, element: E): Array<E> => {
        array.push(element);
        return array;
    }, (array: Array<E>): AsynchronousBinarySearchTree<E> => {
        return new AsynchronousBinarySearchTree(array, { comparator: comparator });
    });
};
/**
 * Creates a collector that finishes with a new asynchronous rooted forest.
 *
 * Buffered elements are laid out by the forest builder as one rooted component
 * in encounter order, so the default layout keeps source order as structure
 * order rather than sorting it. The result exposes its roots through
 * `getRoots()`, which returns a promise, and collection queries count every
 * element across the components. Null and undefined elements are rejected, and a
 * source that should become several roots requires a builder supplied to the
 * constructor.
 *
 * Complexity: collecting is O(n) and assembling the default layout, including
 * its depth, height and subtree-size metadata, is O(n).
 *
 * @template E - The source element type.
 * @returns A reusable collector configured for this operation.
 * @throws {TypeError} If the source contains `null` or `undefined`.
 */
export let useAsynchronousToRootedForest: <E>() => AsynchronousCollector<E, Array<E>, AsynchronousRootedForest<E>> = <E>(): AsynchronousCollector<E, Array<E>, AsynchronousRootedForest<E>> => {
    return AsynchronousCollector.full<E, Array<E>, AsynchronousRootedForest<E>>((): Array<E> => [], (array: Array<E>, element: E): Array<E> => {
        array.push(element);
        return array;
    }, (array: Array<E>): AsynchronousRootedForest<E> => {
        return new AsynchronousRootedForest(array);
    });
};

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
