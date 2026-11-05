/**
 * Factory functions that create synchronous collectors.
 *
 * Every `useSynchronousXxx` helper returns a configured `SynchronousCollector`;
 * the collector class itself lives in `collector.ts`. The dependency is one-way:
 * this module imports `collector.ts`, never the other way around.
 */
import { isFunction, isNumber, isBigInt, isBoolean, isString, isObject } from "#semantic/guard";
import { useCompare, useToBigInt, useToNumber } from "#semantic/hook";
import { Optional } from "#semantic/optional";
import { SynchronousCollector } from "#semantic/synchronous/collector";
import { SynchronousCycle } from "#semantic/structure/cycle";
import { SynchronousRootedForest } from "#semantic/structure/forest/rootedForest";
import { SynchronousList } from "#semantic/structure/list";
import { SynchronousUnorderedLRUMap, SynchronousUnorderedLRUSet } from "#semantic/structure/lru";
import { SynchronousOrderedMap, SynchronousUnorderedMap } from "#semantic/structure/map";
import { SynchronousOrderedSet, SynchronousUnorderedSet } from "#semantic/structure/set";
import { SynchronousSkipMap, SynchronousSkipSet } from "#semantic/structure/skip";
import { SynchronousBinarySearchTree } from "#semantic/structure/tree/binarySearchTree";
import type { BiFunctional, BiPredicate, Functional, Predicate, Supplier, TriFunctional, TriPredicate, Consumer, BiConsumer, Comparator, MaybeInvalid, Indexed } from "#semantic/utility";
import { invalidate, validate } from "#semantic/utility";
import { isKurtosisEstimator, isQuantileMethod, isSkewnessEstimator, quantileOfSorted } from "#semantic/mathematics/quantile";
import type { KurtosisEstimator, KurtosisOptions, QuantileMethod, QuantileOptions, SkewnessEstimator, SkewnessOptions } from "#semantic/mathematics/quantile";
import type {
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
    MomentData,
    RobustData,
    RobustOptions,
    TrimPolicy
} from "#semantic/synchronous/distribution";
/**
 * Creates collectors that report whether at least one element matches a predicate.
 *
 * The collector short-circuits on the first accepted element and finishes with
 * true; an empty source finishes with false. It is the existential counterpart of
 * useSynchronousAllMatch and the inverse of useSynchronousNoneMatch.
 *
 * @template E - The source element type.
 */
interface UseSynchronousAnyMatch {
    /**
     * Tests each element with a predicate that only receives the element value.
     *
     * The accumulator starts as false, so an empty or fully rejected source
     * finishes with false, and a true answer interrupts the source immediately.
     *
     * @template E - The source element type.
     * @param predicate - Decides whether an element counts as a match.
     * @returns A collector that finishes with true when a match was seen.
     */
    <E>(predicate: Predicate<E>): SynchronousCollector<E, boolean, boolean>;
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
    <E>(predicate: BiPredicate<E, bigint>): SynchronousCollector<E, boolean, boolean>;
}
;
/**
 * Creates a collector that tests for a matching element and stops after a match.
 *
 * @template E - The source element type.
 * @param predicate - Tests each element and optional bigint index.
 * @returns A reusable collector configured for this operation.
 */
export let useSynchronousAnyMatch: UseSynchronousAnyMatch = <E>(predicate: Predicate<E> | BiPredicate<E, bigint>): SynchronousCollector<E, boolean, boolean> => {
    if (isFunction(predicate)) {
        return SynchronousCollector.shortable((): boolean => false, (_element: E, _index: bigint, accumulator: boolean): boolean => isBoolean(accumulator) && accumulator, (accumulator: boolean, element: E, index: bigint): boolean => accumulator || predicate(element, index), (accumulator: boolean): boolean => accumulator);
    }
    throw new TypeError("Predicate must be a function.");
};
/**
 * Creates collectors that report whether every element matches a predicate.
 *
 * The short-circuit is inverted compared with useSynchronousAnyMatch: the
 * accumulator starts as true, an empty source finishes with true, and the first
 * rejected element interrupts the source and finishes with false.
 *
 * @template E - The source element type.
 */
interface UseSynchronousAllMatch {
    /**
     * Tests each element with a predicate that only receives the element value.
     *
     * Accumulation stops before the first element the predicate rejects, so a
     * failing element near the front leaves the rest of the stream unconsumed.
     *
     * @template E - The source element type.
     * @param predicate - Decides whether an element is acceptable.
     * @returns A collector that finishes with false only when some element failed.
     */
    <E>(predicate: Predicate<E>): SynchronousCollector<E, boolean, boolean>;
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
    <E>(predicate: BiPredicate<E, bigint>): SynchronousCollector<E, boolean, boolean>;
}
;
/**
 * Creates a collector that tests that every element matches, returning true when empty.
 *
 * @template E - The source element type.
 * @param predicate - Tests each element and optional bigint index.
 * @returns A reusable collector configured for this operation.
 */
export let useSynchronousAllMatch: UseSynchronousAllMatch = <E>(predicate: Predicate<E> | BiPredicate<E, bigint>): SynchronousCollector<E, boolean, boolean> => {
    if (isFunction(predicate)) {
        return SynchronousCollector.shortable((): boolean => true, (_element: E, _index: bigint, accumulator: boolean): boolean => isBoolean(accumulator) && !accumulator, (accumulator: boolean, element: E, index: bigint): boolean => accumulator && predicate(element, index), (accumulator: boolean): boolean => accumulator);
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
interface UseSynchronousCollect {
    /**
     * Combines the three functions without any early interruption.
     *
     * The accumulator receives the current accumulator and the element only, and
     * the finisher is applied once every element of the source was consumed.
     *
     * @template E - The source element type.
     * @template A - The accumulator type.
     * @template R - The finished result type.
     * @param identity - Supplies a fresh accumulator for each collection.
     * @param accumulator - Combines the accumulator with the next element.
     * @param finisher - Converts the completed accumulator into the result.
     * @returns A collector that always drains the whole source.
     */
    <E, A, R>(identity: Supplier<A>, accumulator: BiFunctional<A, E, A>, finisher: Functional<A, R>): SynchronousCollector<E, A, R>;
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
    <E, A, R>(identity: Supplier<A>, accumulator: TriFunctional<A, E, bigint, A>, finisher: Functional<A, R>): SynchronousCollector<E, A, R>;
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
    <E, A, R>(identity: Supplier<A>, accumulator: BiFunctional<A, E, A> | TriFunctional<A, E, bigint, A>, finisher: Functional<A, R>): SynchronousCollector<E, A, R>;
    /**
     * Adds an interruption predicate that only receives the element value.
     *
     * The predicate is asked before each accumulation; returning true stops the
     * source and the finisher runs on the accumulator collected so far.
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
    <E, A, R>(identity: Supplier<A>, interrupt: Predicate<E>, accumulator: BiFunctional<A, E, A>, finisher: Functional<A, R>): SynchronousCollector<E, A, R>;
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
    <E, A, R>(identity: Supplier<A>, interrupt: Predicate<E>, accumulator: TriFunctional<A, E, bigint, A>, finisher: Functional<A, R>): SynchronousCollector<E, A, R>;
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
    <E, A, R>(identity: Supplier<A>, interrupt: BiPredicate<E, bigint>, accumulator: BiFunctional<A, E, A>, finisher: Functional<A, R>): SynchronousCollector<E, A, R>;
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
    <E, A, R>(identity: Supplier<A>, interrupt: BiPredicate<E, bigint>, accumulator: TriFunctional<A, E, bigint, A>, finisher: Functional<A, R>): SynchronousCollector<E, A, R>;
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
    <E, A, R>(identity: Supplier<A>, interrupt: TriPredicate<E, bigint, A>, accumulator: BiFunctional<A, E, A>, finisher: Functional<A, R>): SynchronousCollector<E, A, R>;
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
    <E, A, R>(identity: Supplier<A>, interrupt: TriPredicate<E, bigint, A>, accumulator: TriFunctional<A, E, bigint, A>, finisher: Functional<A, R>): SynchronousCollector<E, A, R>;
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
export let useSynchronousCollect: UseSynchronousCollect = <E, A, R>(argument1: Supplier<A> | SynchronousCollector<E, A, R>, argument2?: BiFunctional<A, E, A> | TriFunctional<A, E, bigint, A> | Predicate<E> | BiPredicate<E, bigint> | TriPredicate<E, bigint, A>, argument3?: BiFunctional<A, E, A> | TriFunctional<A, E, bigint, A> | Functional<A, R>, argument4?: Functional<A, R>): SynchronousCollector<E, A, R> => {
    if (isFunction(argument1) && isFunction(argument2) && isFunction(argument3) && isFunction(argument4)) {
        let identity: Supplier<A> = argument1 as Supplier<A>;
        let interrupt: Predicate<E> & BiPredicate<E, bigint> & TriPredicate<E, bigint, A> = argument2 as Predicate<E> & BiPredicate<E, bigint> & TriPredicate<E, bigint, A>;
        let accumulator: BiFunctional<A, E, A> & TriFunctional<A, E, bigint, A> = argument3 as BiFunctional<A, E, A> & TriFunctional<A, E, bigint, A>;
        let finisher: Functional<A, R> = argument4 as Functional<A, R>;
        return SynchronousCollector.shortable(identity, interrupt, accumulator, finisher);
    }
    if (isFunction(argument1) && isFunction(argument2) && isFunction(argument3)) {
        let identity: Supplier<A> = argument1 as Supplier<A>;
        let accumulator: BiFunctional<A, E, A> & TriFunctional<A, E, bigint, A> = argument2 as BiFunctional<A, E, A> & TriFunctional<A, E, bigint, A>;
        let finisher: Functional<A, R> = argument3 as Functional<A, R>;
        return SynchronousCollector.full(identity, accumulator, finisher);
    }
    throw new TypeError("Identity, accumulator, and finisher must be functions.");
};
/**
 * Creates a collector that counts elements as a bigint.
 *
 * @template E - The source element type.
 * @returns A reusable collector configured for this operation.
 */
export let useSynchronousCount: <E = unknown>() => SynchronousCollector<E, bigint, bigint> = <E = unknown>(): SynchronousCollector<E, bigint, bigint> => {
    return SynchronousCollector.full((): bigint => 0n, (count: bigint): bigint => isBigInt(count) ? (count + 1n) : 1n, (count: bigint): bigint => isBigInt(count) ? count : 0n);
};
/**
 * Creates collectors that format elements into one text line, write it with
 * console.error and return the same text.
 *
 * The default form wraps the elements in square brackets and separates them with
 * commas. The other overloads replace the accumulator and optionally the
 * surrounding text. useSynchronousLog prints with console.log instead, and
 * useSynchronousJoin builds the same kind of text without writing it.
 *
 * @template E - The source element type.
 */
interface UseSynchronousError {
    /**
     * Formats with the default square-bracket and comma notation.
     *
     * Elements are stringified and joined, a trailing comma is trimmed, the
     * closing bracket is appended and the resulting line goes to console.error.
     *
     * @template E - The source element type.
     * @returns A collector that finishes with the text it printed.
     */
    <E = unknown>(): SynchronousCollector<E, string, string>;
    /**
     * Uses a custom two-argument accumulator inside the default brackets.
     *
     * The accumulator receives the text built so far and the next element; the
     * prefix and suffix stay "[" and "]" and the finished text is sent to console.error.
     *
     * @template E - The source element type.
     * @param accumulator - Combines the current text with the next element.
     * @returns A collector that finishes with the text it printed.
     */
    <E = unknown>(accumulator: BiFunctional<string, E, string>): SynchronousCollector<E, string, string>;
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
    <E = unknown>(accumulator: TriFunctional<string, E, bigint, string>): SynchronousCollector<E, string, string>;
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
    <E = unknown>(prefix: string, accumulator: BiFunctional<string, E, string>, suffix: string): SynchronousCollector<E, string, string>;
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
    <E = unknown>(prefix: string, accumulator: TriFunctional<string, E, bigint, string>, suffix: string): SynchronousCollector<E, string, string>;
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
export let useSynchronousError: UseSynchronousError = <E = unknown>(argument1?: string | BiFunctional<string, E, string> | TriFunctional<string, E, bigint, string>, argument2?: BiFunctional<string, E, string> | TriFunctional<string, E, bigint, string>, argument3?: string): SynchronousCollector<E, string, string> => {
    if (isString(argument1) && isFunction(argument2) && isString(argument3)) {
        let prefix: string = argument1;
        let accumulator: BiFunctional<string, E, string> & TriFunctional<string, E, bigint, string> = argument2 as BiFunctional<string, E, string> & TriFunctional<string, E, bigint, string>;
        let suffix: string = argument3;
        return SynchronousCollector.full<E, string, string>((): string => prefix, accumulator, (text: string): string => {
            let result: string = text + suffix;
            console.error(result);
            return result;
        });
    }
    else if (isFunction(argument1)) {
        let prefix: string = "[";
        let accumulator: BiFunctional<string, E, string> & TriFunctional<string, E, bigint, string> = argument1 as BiFunctional<string, E, string> & TriFunctional<string, E, bigint, string>;
        let suffix: string = "]";
        return SynchronousCollector.full<E, string, string>((): string => prefix, accumulator, (text: string): string => {
            let result: string = text + suffix;
            console.error(result);
            return result;
        });
    }
    else {
        return SynchronousCollector.full<E, string, string>((): string => "[", (accumulator: string, element: E): string => {
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
 * stream. Missing or nullish matches finish as an empty Optional. Negative
 * positions belong to useSynchronousFindNegativeAt instead.
 *
 * @template E - The source element type.
 */
interface UseSynchronousFindAt {
    /**
     * Accepts the position as a number.
     *
     * The number is converted to the bigint encounter counter, which is convenient
     * for small literal positions but cannot express positions beyond the safe
     * integer range exactly.
     *
     * @template E - The source element type.
     * @param index - The non-negative number position to select.
     * @returns A collector that finishes with the element at that position, if any.
     */
    <E>(index: number): SynchronousCollector<E, FindAtAccumulator<E>, Optional<E>>;
    /**
     * Accepts the position as a bigint.
     *
     * Keeping the position in bigint form avoids the range limits of number and
     * matches the bigint counter used internally, so very large positions remain exact.
     *
     * @template E - The source element type.
     * @param index - The non-negative bigint position to select.
     * @returns A collector that finishes with the element at that position, if any.
     */
    <E>(index: bigint): SynchronousCollector<E, FindAtAccumulator<E>, Optional<E>>;
}
/**
 * Creates a collector that selects a non-negative encounter position. Missing or nullish results are represented by an empty Optional.
 *
 * @template E - The source element type.
 * @param index - The requested non-negative position, or a negative position for the negative-index factory.
 * @returns A reusable collector configured for this operation.
 */
export let useSynchronousFindAt: UseSynchronousFindAt = <E>(index: number | bigint): SynchronousCollector<E, FindAtAccumulator<E>, Optional<E>> => {
    let target: bigint = useToBigInt(index);
    if (target < 0n) {
        throw new Error("use \"useSynchronousFindNegativeAt\" for negative index.");
    }
    return SynchronousCollector.shortable(((): FindAtAccumulator<E> => {
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
    }, (accumulator: FindAtAccumulator<E>): Optional<E> => {
        return Optional.of(accumulator.element);
    });
};
/**
 * Creates collectors that return an element counted backwards from the end.
 *
 * Every element is buffered because the length is only known when the source
 * ends; the negative position is then reduced modulo that length. A position that
 * does not resolve to a stored element finishes as an empty Optional, unlike the
 * streaming useSynchronousFindAt factory.
 *
 * @template E - The source element type.
 */
interface UseSynchronousFindNegativeAt {
    /**
     * Accepts the negative position as a number.
     *
     * The position is resolved against the buffered length after the source
     * completes; number form is convenient for ordinary negative literals.
     *
     * @template E - The source element type.
     * @param index - The negative number position to resolve from the end.
     * @returns A collector that finishes with the selected element, if any.
     */
    <E>(index: number): SynchronousCollector<E, Array<E>, Optional<E>>;
    /**
     * Accepts the negative position as a bigint.
     *
     * The whole calculation stays in bigint arithmetic, so positions near the
     * safe integer limits are reduced exactly against the collected length.
     *
     * @template E - The source element type.
     * @param index - The negative bigint position to resolve from the end.
     * @returns A collector that finishes with the selected element, if any.
     */
    <E>(index: bigint): SynchronousCollector<E, Array<E>, Optional<E>>;
}
;
/**
 * Creates a collector that buffers elements and resolves a negative position modulo the collected length. Missing or nullish results are represented by an empty Optional.
 *
 * @template E - The source element type.
 * @param index - The requested non-negative position, or a negative position for the negative-index factory.
 * @returns A reusable collector configured for this operation.
 */
export let useSynchronousFindNegativeAt: UseSynchronousFindNegativeAt = <E>(index: number | bigint): SynchronousCollector<E, Array<E>, Optional<E>> => {
    let target: bigint = useToBigInt(index);
    if (target > -1n) {
        throw new Error("use \"useSynchronousFindAt\" for none-negative index.");
    }
    return SynchronousCollector.full(() => [], (accumulator: Array<E>, element: E): Array<E> => {
        accumulator.push(element);
        return accumulator;
    }, (accumulator: Array<E>): Optional<E> => {
        if (accumulator.length > 0) {
            let count: bigint = BigInt(accumulator.length);
            let limit: bigint = ((target % count) + count) % count;
            let element: MaybeInvalid<E> = accumulator.at(Number(limit));
            return Optional.of(element);
        }
        return Optional.empty();
    });
};
/**
 * Creates a collector that selects the first non-nullish element, stopping once it is present.
 *
 * @template E - The source element type.
 * @returns A reusable collector configured for this operation.
 */
export let useSynchronousFindFirst: <E>() => SynchronousCollector<E, Optional<E>, Optional<E>> = <E>(): SynchronousCollector<E, Optional<E>, Optional<E>> => {
    return SynchronousCollector.shortable((): Optional<E> => Optional.empty<E>(), (_element: E, _index: bigint, accumulator: Optional<E>): boolean => accumulator.isPresent(), (accumulator: Optional<E>, element: E): Optional<E> => {
        if (accumulator.isPresent() || invalidate(element)) {
            return accumulator;
        }
        return Optional.of(element);
    }, (result: Optional<E>): Optional<E> => result);
};
/**
 * Creates a collector that selects the first non-nullish element, stopping once it is present.
 *
 * @template E - The source element type.
 * @returns A reusable collector configured for this operation.
 */
export let useSynchronousFindAny: <E>() => SynchronousCollector<E, Optional<E>, Optional<E>> = <E>(): SynchronousCollector<E, Optional<E>, Optional<E>> => {
    return SynchronousCollector.shortable((): Optional<E> => Optional.empty<E>(), (_element: E, _index: bigint, accumulator: Optional<E>): boolean => accumulator.isPresent(), (accumulator: Optional<E>, element: E): Optional<E> => {
        if (accumulator.isPresent() || invalidate(element)) {
            return accumulator;
        }
        return Optional.of(element);
    }, (result: Optional<E>): Optional<E> => result);
};
/**
 * Creates a collector that selects the last available element. Missing or nullish results are represented by an empty Optional.
 *
 * @template E - The source element type.
 * @returns A reusable collector configured for this operation.
 */
export let useSynchronousFindLast: <E>() => SynchronousCollector<E, Optional<E>, Optional<E>> = <E>(): SynchronousCollector<E, Optional<E>, Optional<E>> => {
    return SynchronousCollector.full((): Optional<E> => Optional.empty<E>(), (accumulator: Optional<E>, element: E): Optional<E> => {
        if (invalidate(element)) {
            return accumulator;
        }
        return Optional.of(element);
    }, (result: Optional<E>): Optional<E> => result);
};
/**
 * Creates collectors that select the greatest element seen.
 *
 * The collector keeps one running value rather than buffering the source, and
 * nullish elements are skipped. An empty or entirely nullish source finishes as
 * an empty Optional. useSynchronousFindMinimum is the mirrored factory.
 *
 * @template E - The source element type.
 */
interface UseSynchronousFindMaximum {
    /**
     * Compares with the library comparator from useCompare.
     *
     * The default comparator orders primitives and throws for values it cannot
     * order, so callers with custom elements should pick the explicit overload.
     *
     * @template E - The source element type.
     * @returns A collector that finishes with the greatest element, if any.
     */
    <E>(): SynchronousCollector<E, Optional<E>, Optional<E>>;
    /**
     * Compares with a caller-supplied comparator.
     *
     * The comparator receives the running greatest value first and the next
     * element second, and a negative result means the new element wins.
     *
     * @template E - The source element type.
     * @param comparator - Orders the running greatest value against the next element.
     * @returns A collector that finishes with the greatest element, if any.
     */
    <E>(comparator: Comparator<E>): SynchronousCollector<E, Optional<E>, Optional<E>>;
}
/**
 * Creates a collector that selects the greatest element according to the comparator. Missing or nullish results are represented by an empty Optional.
 *
 * @template E - The source element type.
 * @param comparator - The element comparison function; defaults to the library comparator.
 * @returns A reusable collector configured for this operation.
 */
export let useSynchronousFindMaximum: UseSynchronousFindMaximum = <E>(comparator: Comparator<E> = useCompare<E>): SynchronousCollector<E, Optional<E>, Optional<E>> => {
    if (isFunction(comparator)) {
        return SynchronousCollector.full((): Optional<E> => Optional.empty<E>(), (accumulator: Optional<E>, element: E): Optional<E> => {
            if (invalidate(element)) {
                return accumulator;
            }
            if (!accumulator.isPresent()) {
                return Optional.of(element);
            }
            return accumulator.map((previous: E): E => {
                return comparator(previous, element) >= 0 ? previous : element;
            });
        }, (result: Optional<E>): Optional<E> => result);
    }
    throw new TypeError("Invalid argument.");
};
/**
 * Creates collectors that select the least element seen.
 *
 * The mirror image of useSynchronousFindMaximum: one running value is kept,
 * nullish elements are skipped, and an empty source finishes as an empty Optional.
 *
 * @template E - The source element type.
 */
interface UseSynchronousFindMinimum {
    /**
     * Compares with the library comparator from useCompare.
     *
     * This default is intended for primitive elements; custom element types
     * should supply their own ordering through the other overload.
     *
     * @template E - The source element type.
     * @returns A collector that finishes with the least element, if any.
     */
    <E>(): SynchronousCollector<E, Optional<E>, Optional<E>>;
    /**
     * Compares with a caller-supplied comparator.
     *
     * The comparator receives the running least value first and the next element
     * second, and a positive result means the new element wins.
     *
     * @template E - The source element type.
     * @param comparator - Orders the running least value against the next element.
     * @returns A collector that finishes with the least element, if any.
     */
    <E>(comparator: Comparator<E>): SynchronousCollector<E, Optional<E>, Optional<E>>;
}
/**
 * Creates a collector that selects the least element according to the comparator. Missing or nullish results are represented by an empty Optional.
 *
 * @template E - The source element type.
 * @param comparator - The element comparison function; defaults to the library comparator.
 * @returns A reusable collector configured for this operation.
 */
export let useSynchronousFindMinimum: UseSynchronousFindMinimum = <E>(comparator: Comparator<E> = useCompare<E>): SynchronousCollector<E, Optional<E>, Optional<E>> => {
    if (isFunction(comparator)) {
        return SynchronousCollector.full((): Optional<E> => Optional.empty<E>(), (accumulator: Optional<E>, element: E): Optional<E> => {
            if (invalidate(element)) {
                return accumulator;
            }
            if (!accumulator.isPresent()) {
                return Optional.of(element);
            }
            return accumulator.map((previous: E): E => {
                return comparator(previous, element) <= 0 ? previous : element;
            });
        }, (result: Optional<E>): Optional<E> => result);
    }
    throw new TypeError("Invalid argument.");
};
/**
 * Creates collectors that invoke a side effect for every element.
 *
 * No element is retained: the accumulator is only the bigint count, so the
 * finished value tells how many elements were processed. It differs from
 * useSynchronousToArray and the statistical collectors, which keep state.
 *
 * @template E - The source element type.
 */
interface UseSynchronousForEach {
    /**
     * Invokes an action that only receives the element value.
     *
     * The action runs during accumulation for every visited element; interrupt
     * support comes from the collector machinery rather than the action itself.
     *
     * @template E - The source element type.
     * @param action - Consumes each element.
     * @returns A collector that finishes with the bigint number of elements visited.
     */
    <E>(action: Consumer<E>): SynchronousCollector<E, bigint, bigint>;
    /**
     * Invokes an action that also receives the bigint encounter index.
     *
     * The index starts at 0n and increments once per visited element, letting the
     * side effect log or label positions in the source.
     *
     * @template E - The source element type.
     * @param action - Consumes each element together with its index.
     * @returns A collector that finishes with the bigint number of elements visited.
     */
    <E>(action: BiConsumer<E, bigint>): SynchronousCollector<E, bigint, bigint>;
}
;
/**
 * Creates a collector that invokes an action for every element and returns the bigint count processed.
 *
 * @template E - The source element type.
 * @param action - Receives each element and its optional bigint index.
 * @returns A reusable collector configured for this operation.
 */
export let useSynchronousForEach: UseSynchronousForEach = <E>(action: Consumer<E> | BiConsumer<E, bigint>): SynchronousCollector<E, bigint, bigint> => {
    if (isFunction(action)) {
        return SynchronousCollector.full((): bigint => 0n, (accumulator: bigint, element: E, index: bigint): bigint => {
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
 * the negation of useSynchronousAnyMatch.
 *
 * @template E - The source element type.
 */
interface UseSynchronousNonMatch {
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
    <E>(predicate: Predicate<E>): SynchronousCollector<E, boolean, boolean>;
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
    <E>(predicate: BiPredicate<E, bigint>): SynchronousCollector<E, boolean, boolean>;
}
;
/**
 * Creates a collector that tests that no element matches, returning true when empty.
 *
 * @template E - The source element type.
 * @param predicate - Tests each element and optional bigint index.
 * @returns A reusable collector configured for this operation.
 */
export let useSynchronousNoneMatch: UseSynchronousNonMatch = <E>(predicate: Predicate<E> | BiPredicate<E, bigint>): SynchronousCollector<E, boolean, boolean> => {
    if (isFunction(predicate)) {
        return SynchronousCollector.shortable((): boolean => true, (_element: E, _index: bigint, accumulator: boolean): boolean => !accumulator, (accumulator: boolean, element: E, index: bigint): boolean => accumulator && !predicate(element, index), (accumulator: boolean): boolean => accumulator);
    }
    throw new TypeError("Predicate must be a function.");
};
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
 * Creates collectors that join elements into a single text value.
 *
 * The default form wraps the elements in square brackets with commas between
 * them. Other overloads change the delimiter, the surrounding text or the
 * accumulation function. Unlike useSynchronousLog and useSynchronousError, the
 * finished text is only returned and never written anywhere.
 *
 * @template E - The source element type.
 */
interface UseSynchronousJoin {
    /**
     * Joins with the default square brackets and comma delimiter.
     *
     * The accumulator starts as "[" and appends element plus comma; the finisher
     * removes the final comma and appends "]", an empty source yielding "[]".
     *
     * @template E - The source element type.
     * @returns A collector that finishes with the bracketed text.
     */
    <E = unknown>(): SynchronousCollector<E, string, string>;
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
    <E = unknown>(delimiter: string): SynchronousCollector<E, string, string>;
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
    <E = unknown>(prefix: string, delimiter: string, suffix: string): SynchronousCollector<E, string, string>;
    /**
     * Joins with a custom two-argument accumulator framed by caller-supplied text.
     *
     * The accumulator decides how each element changes the running text, while
     * prefix seeds it and suffix is appended unchanged by the finisher.
     *
     * @template E - The source element type.
     * @param prefix - Text the accumulator starts from.
     * @param accumulator - Combines the current text with the next element.
     * @param suffix - Text appended after the last element.
     * @returns A collector that finishes with the framed text.
     */
    <E = unknown>(prefiex: string, accumulator: BiFunctional<string, E, string>, suffix: string): SynchronousCollector<E, string, string>;
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
    <E = unknown>(prefiex: string, accumulator: TriFunctional<string, E, bigint, string>, suffix: string): SynchronousCollector<E, string, string>;
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
export let useSynchronousJoin: UseSynchronousJoin = <E = unknown>(argument1?: string, argument2?: string | BiFunctional<string, E, string> | TriFunctional<string, E, bigint, string>, argument3?: string): SynchronousCollector<E, string, string> => {
    if (invalidate(argument1) && invalidate(argument2) && invalidate(argument3)) {
        return SynchronousCollector.full<E, string, string>((): string => "[", (text: string, element: E): string => text + element + ",", (text: string): string => text.substring(0, Math.max(1, text.length - 1)) + "]");
    }
    if (isString(argument1) && invalidate(argument2) && invalidate(argument3)) {
        let delimiter: string = argument1;
        return SynchronousCollector.full<E, string, string>((): string => "[", (text: string, element: E): string => text + element + delimiter, (text: string): string => text.substring(0, Math.max(1, text.length - delimiter.length)) + "]");
    }
    if (isString(argument1) && isFunction(argument2) && isString(argument3)) {
        let prefix: string = argument1;
        let accumulator: BiFunctional<string, E, string> & TriFunctional<string, E, bigint, string> = argument2 as BiFunctional<string, E, string> & TriFunctional<string, E, bigint, string>;
        let suffix: string = argument3;
        return SynchronousCollector.full<E, string, string>((): string => prefix, accumulator, (text: string): string => text + suffix);
    }
    if (isString(argument1) && isString(argument2) && isString(argument3)) {
        let prefix: string = argument1;
        let delimiter: string = argument2;
        let suffix: string = argument3;
        return SynchronousCollector.full<E, string, string>((): string => prefix, (text: string, element: E): string => text + element + delimiter, (text: string): string => text.substring(0, Math.max(prefix.length, text.length - delimiter.length)) + suffix);
    }
    throw new TypeError("Invalid arguments.");
};
/**
 * Creates collectors that format elements into one text line, write it with
 * console.log and return the same text.
 *
 * The overload set mirrors useSynchronousError, which prints with console.error.
 * The default form uses square brackets and commas; other overloads replace the
 * accumulator or the surrounding text, while useSynchronousJoin only returns text.
 *
 * @template E - The source element type.
 */
interface UseSynchronousLog {
    /**
     * Formats with the default square-bracket and comma notation.
     *
     * Elements are stringified and joined, the trailing comma is trimmed, the
     * closing bracket appended and the finished line written with console.log.
     *
     * @template E - The source element type.
     * @returns A collector that finishes with the text it printed.
     */
    <E = unknown>(): SynchronousCollector<E, string, string>;
    /**
     * Uses a custom two-argument accumulator inside the default brackets.
     *
     * The accumulator receives the running text and the next element; the default
     * "[" and "]" framing is kept and the finished text is written with console.log.
     *
     * @template E - The source element type.
     * @param accumulator - Combines the current text with the next element.
     * @returns A collector that finishes with the text it printed.
     */
    <E = unknown>(accumulator: BiFunctional<string, E, string>): SynchronousCollector<E, string, string>;
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
    <E = unknown>(accumulator: TriFunctional<string, E, bigint, string>): SynchronousCollector<E, string, string>;
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
    <E = unknown>(prefix: string, accumulator: BiFunctional<string, E, string>, suffix: string): SynchronousCollector<E, string, string>;
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
    <E = unknown>(prefix: string, accumulator: TriFunctional<string, E, bigint, string>, suffix: string): SynchronousCollector<E, string, string>;
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
export let useSynchronousLog: UseSynchronousLog = <E = unknown>(argument1?: string | BiFunctional<string, E, string> | TriFunctional<string, E, bigint, string>, argument2?: BiFunctional<string, E, string> | TriFunctional<string, E, bigint, string>, argument3?: string): SynchronousCollector<E, string, string> => {
    if (isString(argument1) && isFunction(argument2) && isString(argument3)) {
        let prefix: string = argument1;
        let accumulator: BiFunctional<string, E, string> & TriFunctional<string, E, bigint, string> = argument2 as BiFunctional<string, E, string> & TriFunctional<string, E, bigint, string>;
        let suffix: string = argument3;
        return SynchronousCollector.full<E, string, string>((): string => prefix, accumulator, (text: string): string => {
            let result: string = text + suffix;
            console.log(result);
            return result;
        });
    }
    else if (isFunction(argument1)) {
        let prefix: string = "[";
        let accumulator: BiFunctional<string, E, string> & TriFunctional<string, E, bigint, string> = argument1 as BiFunctional<string, E, string> & TriFunctional<string, E, bigint, string>;
        let suffix: string = "]";
        return SynchronousCollector.full<E, string, string>((): string => prefix, accumulator, (text: string): string => {
            let result: string = text + suffix;
            console.log(result);
            return result;
        });
    }
    else {
        return SynchronousCollector.full<E, string, string>((): string => "[", (accumulator: string, element: E): string => {
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
 * Creates collectors that fold the source into one value.
 *
 * The overload set covers the three forms of reduction: a reducer alone (which
 * starts from an empty Optional and needs no initial value), a reducer with an
 * initial value, and a reducer with an initial value plus a finisher that can
 * change the result shape. It is more flexible than the summing and averaging
 * factories, which only expose their fixed accumulator logic.
 *
 * @template E - The source element type.
 * @template R - The finished result type.
 */
interface UseSynchronousReduce {
    /**
     * Reduces without an initial value, returning an Optional.
     *
     * The accumulator stays empty until the first valid element, which becomes
     * the seed; later elements are folded in. Nullish elements encountered while
     * still empty are skipped, and an empty source finishes as an empty Optional.
     *
     * @template E - The source element type.
     * @param accumulator - Combines the previous value with the next element.
     * @returns A collector that finishes with the reduced value, if any.
     */
    <E>(accumulator: BiFunctional<E, E, E>): SynchronousCollector<E, Optional<E>, Optional<E>>;
    /**
     * Reduces without an initial value using an index-aware reducer.
     *
     * The same Optional seeding applies, but the reducer also receives the bigint
     * encounter index, which enables position-sensitive folds.
     *
     * @template E - The source element type.
     * @param accumulator - Combines the previous value with the element and its index.
     * @returns A collector that finishes with the reduced value, if any.
     */
    <E>(accumulator: TriFunctional<E, E, bigint, E>): SynchronousCollector<E, Optional<E>, Optional<E>>;
    /**
     * Reduces from an explicit initial value of the element type.
     *
     * The identity is used as-is for every collection, so the first element is
     * folded into it rather than becoming the seed. The result is E, never Optional.
     *
     * @template E - The source element type.
     * @param identity - Initial reduction value.
     * @param accumulator - Combines the previous value with the next element.
     * @returns A collector that finishes with the reduced value.
     */
    <E>(identity: E, accumulator: BiFunctional<E, E, E>): SynchronousCollector<E, E, E>;
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
    <E>(identity: E, accumulator: TriFunctional<E, E, bigint, E>): SynchronousCollector<E, E, E>;
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
    <E, R>(identity: R, accumulator: BiFunctional<R, E, R>, finisher: Functional<R, R>): SynchronousCollector<E, R, R>;
    /**
     * Reduces from a differently typed initial value with index-aware folding and a finisher.
     *
     * The accumulator receives the bigint encounter index; the finisher is applied
     * once after the source is exhausted. As above, the R state may differ from
     * the element type.
     *
     * @template E - The source element type.
     * @template R - The accumulator and finished result type.
     * @param identity - Initial accumulator value.
     * @param accumulator - Combines the accumulator with the element and its index.
     * @param finisher - Transforms the completed accumulator into the result.
     * @returns A collector that finishes with the finished value.
     */
    <E, R>(identity: R, accumulator: TriFunctional<R, E, bigint, R>, finisher: Functional<R, R>): SynchronousCollector<E, R, R>;
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
export let useSynchronousReduce: UseSynchronousReduce = <E, R>(argument1?: R | E | BiFunctional<E, E, E> | TriFunctional<E, E, bigint, E>, argument2?: BiFunctional<E, E, E> | TriFunctional<E, E, bigint, E> | BiFunctional<R, E, R> | TriFunctional<R, E, bigint, R>, argument3?: Functional<R, R>): SynchronousCollector<E, Optional<E>, Optional<E>> | SynchronousCollector<E, E, E> | SynchronousCollector<E, R, R> => {
    if (isFunction(argument1) && invalidate(argument2) && invalidate(argument3)) {
        let accumulator: BiFunctional<E, E, E> & TriFunctional<E, E, bigint, E> = argument1 as BiFunctional<E, E, E> & TriFunctional<E, E, bigint, E>;
        return SynchronousCollector.full<E, Optional<E>, Optional<E>>((): Optional<E> => Optional.empty<E>(), (result: Optional<E>, element: E, index: bigint): Optional<E> => {
            if (result.isPresent()) {
                return result.map((previous: E): E => accumulator(previous, element, index));
            }
            if (invalidate(element)) {
                return result;
            }
            return Optional.of(element);
        }, (result: Optional<E>): Optional<E> => result);
    }
    else if (validate(argument1) && isFunction(argument2) && invalidate(argument3)) {
        let identity = argument1 as E;
        let accumulator: BiFunctional<E, E, E> & TriFunctional<E, E, bigint, E> = argument2 as BiFunctional<E, E, E> & TriFunctional<E, E, bigint, E>;
        return SynchronousCollector.full<E, E, E>(() => identity, accumulator, (result: E): E => result);
    }
    else if (validate(argument1) && isFunction(argument2) && isFunction(argument3)) {
        let identity = argument1 as R;
        let accumulator: BiFunctional<R, E, R> & TriFunctional<R, E, bigint, R> = argument2 as BiFunctional<R, E, R> & TriFunctional<R, E, bigint, R>;
        let finisher = argument3 as Functional<R, R>;
        return SynchronousCollector.full<E, R, R>(() => identity, accumulator, finisher);
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
export let useSynchronousToArray: <E>() => SynchronousCollector<E, E[], E[]> = <E>(): SynchronousCollector<E, E[], E[]> => {
    return SynchronousCollector.full<E, E[], E[]>((): E[] => [], (array: E[], element: E): E[] => {
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
export let useSynchronousToIndexedArray: <E>() => SynchronousCollector<E, Array<Indexed<E>>, Array<Indexed<E>>> = <E>(): SynchronousCollector<E, Array<Indexed<E>>, Array<Indexed<E>>> => {
    return SynchronousCollector.full<E, Array<Indexed<E>>, Array<Indexed<E>>>((): Array<Indexed<E>> => [], (array: Array<Indexed<E>>, element: E, index: bigint): Array<Indexed<E>> => {
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
 * is the Map itself. useSynchronousGroupBy differs in that it accumulates an
 * array of values per key instead of keeping only the last one.
 *
 * @template E - The source element type.
 * @template K - The extracted key type.
 * @template V - The extracted or implied value type.
 */
interface UseSynchronousToMap {
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
    <E, K>(keyExtractor: Functional<E, K>): SynchronousCollector<E, Map<K, E>, Map<K, E>>;
    /**
     * Combines an element-only key extractor with an element-only value extractor.
     *
     * Each element is reduced to a key and a value before being stored, and the
     * last value wins when keys repeat.
     *
     * @template E - The source element type.
     * @template K - The extracted key type.
     * @template V - The extracted value type.
     * @param keyExtractor - Computes the map key from the element.
     * @param valueExtractor - Computes the stored value from the element.
     * @returns A collector that finishes with a Map of values.
     */
    <E, K, V>(keyExtractor: Functional<E, K>, valueExtractor: Functional<E, V>): SynchronousCollector<E, Map<K, V>, Map<K, V>>;
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
    <E, K, V>(keyExtractor: BiFunctional<E, bigint, K>, valueExtractor: BiFunctional<E, bigint, V>): SynchronousCollector<E, Map<K, V>, Map<K, V>>;
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
export let useSynchronousToMap: UseSynchronousToMap = <E, K, V>(keyExtractor: Functional<E, K> | BiFunctional<E, bigint, K>, valueExtractor: Functional<E, V> | BiFunctional<E, bigint, V> = (element: E): V => element as unknown as V): SynchronousCollector<E, Map<K, V>, Map<K, V>> => {
    if (isFunction(keyExtractor) && isFunction(valueExtractor)) {
        return SynchronousCollector.full<E, Map<K, V>, Map<K, V>>((): Map<K, V> => new Map<K, V>(), (map: Map<K, V>, element: E, index: bigint): Map<K, V> => {
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
export let useSynchronousToSet: <E>() => SynchronousCollector<E, Set<E>, Set<E>> = <E>(): SynchronousCollector<E, Set<E>, Set<E>> => {
    return SynchronousCollector.full<E, Set<E>, Set<E>>((): Set<E> => new Set<E>(), (set: Set<E>, element: E): Set<E> => {
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
interface UseSynchronousWrite {
    /**
     * Writes each element stringified, using the stream writer directly.
     *
     * The identity is a promise of the supplied stream and each step obtains a
     * writer and calls write with String of the element, propagating writer errors.
     *
     * @template E - The source element type.
     * @template S - The stream chunk type.
     * @param stream - The WritableStream that receives the stringified elements.
     * @returns A collector that finishes with the stream once writing is done.
     */
    <E, S = string>(stream: WritableStream<S>): SynchronousCollector<E, Promise<WritableStream<S>>, Promise<WritableStream<S>>>;
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
     * @returns A collector that finishes with the stream once writing is done.
     */
    <E, S = string>(stream: WritableStream<S>, accumulator: BiFunctional<WritableStream<S>, E, WritableStream<S>>): SynchronousCollector<E, Promise<WritableStream<S>>, Promise<WritableStream<S>>>;
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
     * @returns A collector that finishes with the stream once writing is done.
     */
    <E, S = string>(stream: WritableStream<S>, accumulator: TriFunctional<WritableStream<S>, E, bigint, WritableStream<S>>): SynchronousCollector<E, Promise<WritableStream<S>>, Promise<WritableStream<S>>>;
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
export let useSynchronousWrite: UseSynchronousWrite = <E, S = string>(argument1: WritableStream<S>, argument2?: BiFunctional<WritableStream<S>, E, WritableStream<S>> | TriFunctional<WritableStream<S>, E, bigint, WritableStream<S>>): SynchronousCollector<E, Promise<WritableStream<S>>, Promise<WritableStream<S>>> => {
    if (isObject(argument1)) {
        if (isFunction(argument2)) {
            let stream: WritableStream<S> = argument1 as WritableStream<S>;
            let accumulator: BiFunctional<WritableStream<S>, E, WritableStream<S>> & TriFunctional<WritableStream<S>, E, bigint, WritableStream<S>> = argument2 as BiFunctional<WritableStream<S>, E, WritableStream<S>> & TriFunctional<WritableStream<S>, E, bigint, WritableStream<S>>;
            return SynchronousCollector.full<E, Promise<WritableStream<S>>, Promise<WritableStream<S>>>((): Promise<WritableStream<S>> => Promise.resolve(stream), (promise: Promise<WritableStream<S>>, element: E, index: bigint): Promise<WritableStream<S>> => {
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
            return SynchronousCollector.full<E, Promise<WritableStream<S>>, Promise<WritableStream<S>>>((): Promise<WritableStream<S>> => Promise.resolve(stream), (promise: Promise<WritableStream<S>>, element: E): Promise<WritableStream<S>> => {
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
/**
 * Creates a collector that buffers elements and finishes with a synchronous generator object over the buffer.
 *
 * @template E - The source element type.
 * @returns A reusable collector configured for this operation.
 */
export let useSynchronousToGeneratorFunction: <E>() => SynchronousCollector<E, Array<E>, globalThis.Generator<E, void, undefined>> = <E>(): SynchronousCollector<E, Array<E>, globalThis.Generator<E, void, undefined>> => {
    return SynchronousCollector.full((): Array<E> => [], (array: Array<E>, element: E): Array<E> => {
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
export let useSynchronousToAsyncGeneratorFunction: <E>() => SynchronousCollector<E, Array<E>, globalThis.AsyncGenerator<E, void, undefined>> = <E>(): SynchronousCollector<E, Array<E>, globalThis.AsyncGenerator<E, void, undefined>> => {
    return SynchronousCollector.full((): Array<E> => [], (array: Array<E>, element: E): Array<E> => {
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
 * Creates a collector that finishes with a new synchronous ordered set.
 *
 * Buffered elements are inserted into a `SynchronousOrderedSet`, so elements the
 * comparator considers equal collapse to the first representative seen, and the
 * finished set iterates in comparator-ascending order instead of encounter
 * order. Supplying a comparator makes membership, removal and iteration use
 * comparator equality; without one the ordered-set default order applies.
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
export let useSynchronousToOrderedSet: <E>(comparator?: Comparator<E>) => SynchronousCollector<E, Array<E>, SynchronousOrderedSet<E>> = <E>(comparator?: Comparator<E>): SynchronousCollector<E, Array<E>, SynchronousOrderedSet<E>> => {
    return SynchronousCollector.full<E, Array<E>, SynchronousOrderedSet<E>>((): Array<E> => [], (array: Array<E>, element: E): Array<E> => {
        array.push(element);
        return array;
    }, (array: Array<E>): SynchronousOrderedSet<E> => {
        return new SynchronousOrderedSet<E>(array, { comparator: comparator });
    });
};
/**
 * Creates a collector that finishes with a new synchronous unordered set.
 *
 * Buffered elements are inserted into a `SynchronousUnorderedSet`, which keeps
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
export let useSynchronousToUnorderedSet: <E>() => SynchronousCollector<E, Array<E>, SynchronousUnorderedSet<E>> = <E>(): SynchronousCollector<E, Array<E>, SynchronousUnorderedSet<E>> => {
    return SynchronousCollector.full<E, Array<E>, SynchronousUnorderedSet<E>>((): Array<E> => [], (array: Array<E>, element: E): Array<E> => {
        array.push(element);
        return array;
    }, (array: Array<E>): SynchronousUnorderedSet<E> => {
        return new SynchronousUnorderedSet<E>(array);
    });
};
/**
 * Creates collectors that build an insertion-ordered map from extracted keys and values.
 *
 * Every element contributes one pair. A duplicate key replaces the earlier value
 * without moving it, so the first occurrence fixes the iteration position, and
 * the finished value is a `SynchronousOrderedMap` whose collection views iterate
 * in that insertion order. Stored values must be non-null, so a value extractor
 * that yields `null` or `undefined` makes the finished collection throw.
 *
 * @template E - The source element type.
 * @template K - The extracted key type.
 * @template V - The extracted or implied value type.
 */
interface UseSynchronousToOrderedMap {
    /**
     * Extracts only the key and stores the source element as the value.
     *
     * The finished map maps each distinct key to the first element seen with
     * that key, because a later duplicate replaces the stored element.
     *
     * @template E - The source element type.
     * @template K - The extracted key type.
     * @param keyExtractor - Computes the map key from the element.
     * @returns A collector that finishes with an insertion-ordered map of elements.
     */
    <E, K>(keyExtractor: Functional<E, K>): SynchronousCollector<E, Array<[K, E]>, SynchronousOrderedMap<K, E>>;
    /**
     * Combines an element-only key extractor with an element-only value extractor.
     *
     * Each element is reduced to a key and a value before being stored, and the
     * last value wins when keys repeat.
     *
     * @template E - The source element type.
     * @template K - The extracted key type.
     * @template V - The extracted value type.
     * @param keyExtractor - Computes the map key from the element.
     * @param valueExtractor - Computes the stored value from the element.
     * @returns A collector that finishes with an insertion-ordered map of values.
     */
    <E, K, V>(keyExtractor: Functional<E, K>, valueExtractor: Functional<E, V>): SynchronousCollector<E, Array<[K, V]>, SynchronousOrderedMap<K, V>>;
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
     * @returns A collector that finishes with an insertion-ordered map of values.
     */
    <E, K, V>(keyExtractor: BiFunctional<E, bigint, K>, valueExtractor: BiFunctional<E, bigint, V>): SynchronousCollector<E, Array<[K, V]>, SynchronousOrderedMap<K, V>>;
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
export let useSynchronousToOrderedMap: UseSynchronousToOrderedMap = <E, K, V>(keyExtractor: Functional<E, K> | BiFunctional<E, bigint, K>, valueExtractor: Functional<E, V> | BiFunctional<E, bigint, V> = (element: E): V => element as unknown as V): SynchronousCollector<E, Array<[K, V]>, SynchronousOrderedMap<K, V>> => {
    if (isFunction(keyExtractor) && isFunction(valueExtractor)) {
        return SynchronousCollector.full<E, Array<[K, V]>, SynchronousOrderedMap<K, V>>((): Array<[K, V]> => [], (pairs: Array<[K, V]>, element: E, index: bigint): Array<[K, V]> => {
            pairs.push([keyExtractor(element, index), valueExtractor(element, index)]);
            return pairs;
        }, (pairs: Array<[K, V]>): SynchronousOrderedMap<K, V> => {
            return new SynchronousOrderedMap<K, V>(pairs);
        });
    }
    throw new TypeError("Key extractor and value extractor must be functions.");
};
/**
 * Creates collectors that build an unordered map from extracted keys and values.
 *
 * Every element contributes one pair. A duplicate key replaces the earlier value,
 * and the finished value is a `SynchronousUnorderedMap`, whose collection views
 * iterate in hash-bucket order, so neither insertion nor result order is
 * observable. Stored values must be non-null, so a value extractor that yields
 * `null` or `undefined` makes the finished collection throw.
 *
 * @template E - The source element type.
 * @template K - The extracted key type.
 * @template V - The extracted or implied value type.
 */
interface UseSynchronousToUnorderedMap {
    /**
     * Extracts only the key and stores the source element as the value.
     *
     * @template E - The source element type.
     * @template K - The extracted key type.
     * @param keyExtractor - Computes the map key from the element.
     * @returns A collector that finishes with an unordered map of elements.
     */
    <E, K>(keyExtractor: Functional<E, K>): SynchronousCollector<E, Array<[K, E]>, SynchronousUnorderedMap<K, E>>;
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
    <E, K, V>(keyExtractor: Functional<E, K>, valueExtractor: Functional<E, V>): SynchronousCollector<E, Array<[K, V]>, SynchronousUnorderedMap<K, V>>;
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
    <E, K, V>(keyExtractor: BiFunctional<E, bigint, K>, valueExtractor: BiFunctional<E, bigint, V>): SynchronousCollector<E, Array<[K, V]>, SynchronousUnorderedMap<K, V>>;
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
export let useSynchronousToUnorderedMap: UseSynchronousToUnorderedMap = <E, K, V>(keyExtractor: Functional<E, K> | BiFunctional<E, bigint, K>, valueExtractor: Functional<E, V> | BiFunctional<E, bigint, V> = (element: E): V => element as unknown as V): SynchronousCollector<E, Array<[K, V]>, SynchronousUnorderedMap<K, V>> => {
    if (isFunction(keyExtractor) && isFunction(valueExtractor)) {
        return SynchronousCollector.full<E, Array<[K, V]>, SynchronousUnorderedMap<K, V>>((): Array<[K, V]> => [], (pairs: Array<[K, V]>, element: E, index: bigint): Array<[K, V]> => {
            pairs.push([keyExtractor(element, index), valueExtractor(element, index)]);
            return pairs;
        }, (pairs: Array<[K, V]>): SynchronousUnorderedMap<K, V> => {
            return new SynchronousUnorderedMap<K, V>(pairs);
        });
    }
    throw new TypeError("Key extractor and value extractor must be functions.");
};
/**
 * Creates a collector that finishes with a new synchronous positional list.
 *
 * Buffered elements are appended to a `SynchronousList` in encounter order, so
 * duplicates are retained and positions match the traversal order of the source.
 * Null and undefined elements are rejected by the list, so they make the
 * finished collection throw.
 *
 * Complexity: collecting is O(n) and appending at the end of the list is O(1),
 * so the completed list is built in O(n).
 *
 * @template E - The source element type.
 * @returns A reusable collector configured for this operation.
 * @throws {TypeError} If the source contains `null` or `undefined`.
 */
export let useSynchronousToList: <E>() => SynchronousCollector<E, Array<E>, SynchronousList<E>> = <E>(): SynchronousCollector<E, Array<E>, SynchronousList<E>> => {
    return SynchronousCollector.full<E, Array<E>, SynchronousList<E>>((): Array<E> => [], (array: Array<E>, element: E): Array<E> => {
        array.push(element);
        return array;
    }, (array: Array<E>): SynchronousList<E> => {
        return new SynchronousList<E>(array);
    });
};
/**
 * Creates a collector that finishes with a new synchronous cycle.
 *
 * Buffered elements become the positions of a `SynchronousCycle`, a positional
 * list whose head and tail are joined into a ring. Encounter order fixes the
 * position of every element, and a negative position traverses the ring
 * backwards. The span is the number of turns the ring occupies; a span that
 * shares a factor with the element count collapses positions onto a shorter
 * orbit. Null and undefined elements are rejected by the cycle.
 *
 * Complexity: collecting is O(n) and the ring is spliced once per element, so
 * the completed cycle is built in O(n).
 *
 * @template E - The source element type.
 * @param span - Turns occupied by the ring, a positive finite number; defaults to one.
 * @returns A reusable collector configured for this operation.
 * @throws {RangeError} If the span is not positive.
 * @throws {TypeError} If the span is not a finite number or the source contains `null` or `undefined`.
 */
export let useSynchronousToCycle: <E>(span?: number) => SynchronousCollector<E, Array<E>, SynchronousCycle<E>> = <E>(span?: number): SynchronousCollector<E, Array<E>, SynchronousCycle<E>> => {
    return SynchronousCollector.full<E, Array<E>, SynchronousCycle<E>>((): Array<E> => [], (array: Array<E>, element: E): Array<E> => {
        array.push(element);
        return array;
    }, (array: Array<E>): SynchronousCycle<E> => {
        return new SynchronousCycle<E>(array, { span: span });
    });
};
/**
 * Creates a collector that finishes with a new bounded synchronous LRU set.
 *
 * Buffered elements are inserted into a `SynchronousUnorderedLRUSet` in
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
export let useSynchronousToLRUSet: <E>(capacity: bigint) => SynchronousCollector<E, Array<E>, SynchronousUnorderedLRUSet<E>> = <E>(capacity: bigint): SynchronousCollector<E, Array<E>, SynchronousUnorderedLRUSet<E>> => {
    return SynchronousCollector.full<E, Array<E>, SynchronousUnorderedLRUSet<E>>((): Array<E> => [], (array: Array<E>, element: E): Array<E> => {
        array.push(element);
        return array;
    }, (array: Array<E>): SynchronousUnorderedLRUSet<E> => {
        return new SynchronousUnorderedLRUSet<E>(array, { capacity: capacity });
    });
};
/**
 * Creates collectors that build a bounded synchronous LRU map from extracted keys and values.
 *
 * Every element contributes one pair. A duplicate key replaces the earlier value
 * and marks the mapping most recently used, and capacity pressure evicts the
 * least recently used mapping. The finished value is a
 * `SynchronousUnorderedLRUMap`, whose collection views promise no iteration
 * order. Stored values must be non-null, so a value extractor that yields
 * `null` or `undefined` makes the finished collection throw.
 *
 * @template E - The source element type.
 * @template K - The extracted key type.
 * @template V - The extracted or implied value type.
 */
interface UseSynchronousToLRUMap {
    /**
     * Extracts only the key and stores the source element as the value.
     *
     * @template E - The source element type.
     * @template K - The extracted key type.
     * @param capacity - The positive maximum number of mappings to retain.
     * @param keyExtractor - Computes the map key from the element.
     * @returns A collector that finishes with a bounded LRU map of elements.
     */
    <E, K>(capacity: bigint, keyExtractor: Functional<E, K>): SynchronousCollector<E, Array<[K, E]>, SynchronousUnorderedLRUMap<K, E>>;
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
    <E, K, V>(capacity: bigint, keyExtractor: Functional<E, K>, valueExtractor: Functional<E, V>): SynchronousCollector<E, Array<[K, V]>, SynchronousUnorderedLRUMap<K, V>>;
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
    <E, K, V>(capacity: bigint, keyExtractor: BiFunctional<E, bigint, K>, valueExtractor: BiFunctional<E, bigint, V>): SynchronousCollector<E, Array<[K, V]>, SynchronousUnorderedLRUMap<K, V>>;
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
export let useSynchronousToLRUMap: UseSynchronousToLRUMap = <E, K, V>(capacity: bigint, keyExtractor: Functional<E, K> | BiFunctional<E, bigint, K>, valueExtractor: Functional<E, V> | BiFunctional<E, bigint, V> = (element: E): V => element as unknown as V): SynchronousCollector<E, Array<[K, V]>, SynchronousUnorderedLRUMap<K, V>> => {
    if (isFunction(keyExtractor) && isFunction(valueExtractor)) {
        return SynchronousCollector.full<E, Array<[K, V]>, SynchronousUnorderedLRUMap<K, V>>((): Array<[K, V]> => [], (pairs: Array<[K, V]>, element: E, index: bigint): Array<[K, V]> => {
            pairs.push([keyExtractor(element, index), valueExtractor(element, index)]);
            return pairs;
        }, (pairs: Array<[K, V]>): SynchronousUnorderedLRUMap<K, V> => {
            return new SynchronousUnorderedLRUMap<K, V>(pairs, { capacity: capacity });
        });
    }
    throw new TypeError("Key extractor and value extractor must be functions.");
};
/**
 * Creates a collector that finishes with a new navigable synchronous skip set.
 *
 * Buffered elements are inserted into a `SynchronousSkipSet`, a navigable set
 * whose comparisons use the supplied total order. Membership stays SameValueZero
 * while navigation, range views and iteration use the comparator, so a
 * comparator that disagrees with element equality is rejected. Null and
 * undefined elements are rejected by the set.
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
export let useSynchronousToSkipSet: <E>(comparator?: Comparator<E>) => SynchronousCollector<E, Array<E>, SynchronousSkipSet<E>> = <E>(comparator?: Comparator<E>): SynchronousCollector<E, Array<E>, SynchronousSkipSet<E>> => {
    return SynchronousCollector.full<E, Array<E>, SynchronousSkipSet<E>>((): Array<E> => [], (array: Array<E>, element: E): Array<E> => {
        array.push(element);
        return array;
    }, (array: Array<E>): SynchronousSkipSet<E> => {
        return new SynchronousSkipSet<E>(array, { comparator: comparator });
    });
};
/**
 * Creates collectors that build a navigable synchronous skip map from extracted keys and values.
 *
 * Every element contributes one pair. A duplicate key replaces the earlier value,
 * and the finished value is a `SynchronousSkipMap` whose navigation, range views
 * and iteration follow the total key order supplied for its keys. Nullish keys
 * and nullish stored values are rejected, and a comparator that disagrees with
 * SameValueZero key equality is rejected.
 *
 * @template E - The source element type.
 * @template K - The extracted key type.
 * @template V - The extracted or implied value type.
 */
interface UseSynchronousToSkipMap {
    /**
     * Extracts only the key, stores the source element as the value and uses the default key order.
     *
     * @template E - The source element type.
     * @template K - The extracted key type.
     * @param keyExtractor - Computes the map key from the element.
     * @returns A collector that finishes with a navigable skip map of elements.
     */
    <E, K>(keyExtractor: Functional<E, K>): SynchronousCollector<E, Array<[K, E]>, SynchronousSkipMap<K, E>>;
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
    <E, K, V>(keyExtractor: Functional<E, K>, valueExtractor: Functional<E, V>): SynchronousCollector<E, Array<[K, V]>, SynchronousSkipMap<K, V>>;
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
    <E, K, V>(comparator: Comparator<K>, keyExtractor: Functional<E, K>, valueExtractor: Functional<E, V>): SynchronousCollector<E, Array<[K, V]>, SynchronousSkipMap<K, V>>;
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
export let useSynchronousToSkipMap: UseSynchronousToSkipMap = <E, K, V>(argument1: Comparator<K> | Functional<E, K>, argument2?: Functional<E, K> | Functional<E, V>, argument3?: Functional<E, V>): SynchronousCollector<E, Array<[K, V]>, SynchronousSkipMap<K, V>> => {
    if (isFunction(argument1) && isFunction(argument2) && isFunction(argument3)) {
        let comparator: Comparator<K> = argument1 as Comparator<K>;
        let keyExtractor: Functional<E, K> = argument2 as Functional<E, K>;
        let valueExtractor: Functional<E, V> = argument3;
        return SynchronousCollector.full<E, Array<[K, V]>, SynchronousSkipMap<K, V>>((): Array<[K, V]> => [], (pairs: Array<[K, V]>, element: E): Array<[K, V]> => {
            pairs.push([keyExtractor(element), valueExtractor(element)]);
            return pairs;
        }, (pairs: Array<[K, V]>): SynchronousSkipMap<K, V> => {
            return new SynchronousSkipMap<K, V>(pairs, { comparator: comparator });
        });
    }
    else if (isFunction(argument1) && isFunction(argument2)) {
        let keyExtractor: Functional<E, K> = argument1 as Functional<E, K>;
        let valueExtractor: Functional<E, V> = argument2 as Functional<E, V>;
        return SynchronousCollector.full<E, Array<[K, V]>, SynchronousSkipMap<K, V>>((): Array<[K, V]> => [], (pairs: Array<[K, V]>, element: E): Array<[K, V]> => {
            pairs.push([keyExtractor(element), valueExtractor(element)]);
            return pairs;
        }, (pairs: Array<[K, V]>): SynchronousSkipMap<K, V> => {
            return new SynchronousSkipMap<K, V>(pairs);
        });
    }
    else if (isFunction(argument1)) {
        let keyExtractor: Functional<E, K> = argument1 as Functional<E, K>;
        return SynchronousCollector.full<E, Array<[K, V]>, SynchronousSkipMap<K, V>>((): Array<[K, V]> => [], (pairs: Array<[K, V]>, element: E): Array<[K, V]> => {
            pairs.push([keyExtractor(element), element as unknown as V]);
            return pairs;
        }, (pairs: Array<[K, V]>): SynchronousSkipMap<K, V> => {
            return new SynchronousSkipMap<K, V>(pairs);
        });
    }
    throw new TypeError("Key extractor and value extractor must be functions.");
};
/**
 * Creates a collector that finishes with a new synchronous binary search tree.
 *
 * Buffered elements are sorted by the comparator and split at the midpoint
 * recursively by the search-tree builder, which yields a height-balanced binary
 * search tree whose in-order traversal is comparator-ascending. Equal elements
 * keep their stable input order, so duplicates are retained. The default
 * comparator orders homogeneous numbers, strings, bigints and booleans and
 * rejects `NaN`; any other element type needs a comparator.
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
export let useSynchronousToBinarySearchTree: <E>(comparator?: Comparator<E>) => SynchronousCollector<E, Array<E>, SynchronousBinarySearchTree<E>> = <E>(comparator?: Comparator<E>): SynchronousCollector<E, Array<E>, SynchronousBinarySearchTree<E>> => {
    return SynchronousCollector.full<E, Array<E>, SynchronousBinarySearchTree<E>>((): Array<E> => [], (array: Array<E>, element: E): Array<E> => {
        array.push(element);
        return array;
    }, (array: Array<E>): SynchronousBinarySearchTree<E> => {
        return new SynchronousBinarySearchTree(array, { comparator: comparator });
    });
};
/**
 * Creates a collector that finishes with a new synchronous rooted forest.
 *
 * Buffered elements are laid out by the forest builder as one rooted component
 * in encounter order, so the default layout keeps source order as structure
 * order rather than sorting it. The result exposes its roots through
 * `getRoots()`, and collection queries count every element across the
 * components. Null and undefined elements are rejected, and a source that should
 * become several roots requires a builder supplied to the constructor.
 *
 * Complexity: collecting is O(n) and assembling the default layout, including
 * its depth, height and subtree-size metadata, is O(n).
 *
 * @template E - The source element type.
 * @returns A reusable collector configured for this operation.
 * @throws {TypeError} If the source contains `null` or `undefined`.
 */
export let useSynchronousToRootedForest: <E>() => SynchronousCollector<E, Array<E>, SynchronousRootedForest<E>> = <E>(): SynchronousCollector<E, Array<E>, SynchronousRootedForest<E>> => {
    return SynchronousCollector.full<E, Array<E>, SynchronousRootedForest<E>>((): Array<E> => [], (array: Array<E>, element: E): Array<E> => {
        array.push(element);
        return array;
    }, (array: Array<E>): SynchronousRootedForest<E> => {
        return new SynchronousRootedForest(array);
    });
};

/*
 * ---------------------------------------------------------------------------
 * Signal analysis collectors
 * ---------------------------------------------------------------------------
 *
 * The factories below are the strategies of `#semantic/synchronous/signal`. Each
 * one buffers the samples of the source and hands them to exactly one numeric
 * helper from that module, so the one-method-one-factory rule holds by
 * construction: `useSynchronous<Method>` is the only strategy `Method` uses, no
 * two methods share a factory, and no method inlines one.
 *
 * The section keeps its own import declarations so that the preceding content of
 * this module is untouched. Import declarations are hoisted, so their position at
 * the end of the file has no effect on evaluation order.
 */

import { Sample } from "#semantic/mathematics/sample";
import { windowed } from "#semantic/mathematics/window";
import { SignalCollectable } from "#semantic/synchronous/signal";
import {
    signalAmplitude,
    signalAnalyticSignal,
    signalAutocorrelation,
    signalDecibel,
    signalDetrend,
    signalEnvelope,
    signalInstantaneousFrequency,
    signalInstantaneousPhase,
    signalOneSided,
    signalPower,
    signalPowerDecibel,
    signalPowerSpectralDensity,
    signalShortTimeFourierTransform,
    signalSignalToNoiseRatio,
    signalSpectralBandwidth,
    signalSpectralCentroid,
    signalSpectralFlatness,
    signalSpectralFlux,
    signalSpectralRolloff,
    signalSpectrogram,
    signalSpectrum,
    signalZeroCrossingRate
} from "#semantic/synchronous/signal";
import type {
    CorrelationNormalization,
    DetrendMode,
    SpectralDensity
} from "#semantic/synchronous/signal";
import type { Angle } from "#semantic/mathematics/angle";
import type { Bin } from "#semantic/mathematics/bin";
import type { Complex } from "#semantic/mathematics/complex";
import type { Frequency } from "#semantic/mathematics/frequency";
import type { Spectrogram } from "#semantic/mathematics/spectrogram";
import type { Spectrum } from "#semantic/mathematics/spectrum";
import type { SpectralWindow } from "#semantic/mathematics/window";

/**
 * Creates a collector that finishes with the signal after trend removal.
 *
 * The collector buffers the source and replaces it with the detrended sequence,
 * keeping the plan and the window, so the result is the same signal with
 * different samples. The default mode removes the mean, which is what a density
 * estimate wants; a linear mode removes a drift as well.
 *
 * @template E - The source element type, which must be a number.
 * @param plan - The sampling plan the samples belong to.
 * @param window - The analysis window retained for the result.
 * @param mode - The trend to remove.
 * @returns A reusable collector configured for this operation.
 * @throws {TypeError} If the source holds a non-finite sample or the mode is not
 *         a supported name.
 * @throws {RangeError} If the source is empty or the window sums to zero.
 */
export let useSynchronousDetrended: <E extends number>(plan: Sample, window: SpectralWindow, mode: DetrendMode) => SynchronousCollector<E, Array<E>, SignalCollectable<number>> = <E extends number>(plan: Sample, window: SpectralWindow, mode: DetrendMode): SynchronousCollector<E, Array<E>, SignalCollectable<number>> => {
    return SynchronousCollector.full<E, Array<E>, SignalCollectable<number>>((): Array<E> => [], (array: Array<E>, element: E): Array<E> => {
        array.push(element);
        return array;
    }, (array: Array<E>): SignalCollectable<number> => {
        return new SignalCollectable<number>(plan, signalDetrend(array, mode), window);
    });
};

/**
 * Creates a collector that finishes with the signal re-weighted by a window.
 *
 * The buffered samples are multiplied by the supplied taper and the result keeps
 * the plan and adopts the taper as its own analysis window, so a later spectral
 * call does not apply it a second time.
 *
 * @template E - The source element type, which must be a number.
 * @param plan - The sampling plan the samples belong to.
 * @param window - The taper to apply and to retain.
 * @returns A reusable collector configured for this operation.
 * @throws {TypeError} If the source holds a non-finite sample or the window is
 *         not callable.
 * @throws {RangeError} If the source is empty or a window weight is not finite.
 */
export let useSynchronousWindowed: <E extends number>(plan: Sample, window: SpectralWindow) => SynchronousCollector<E, Array<E>, SignalCollectable<number>> = <E extends number>(plan: Sample, window: SpectralWindow): SynchronousCollector<E, Array<E>, SignalCollectable<number>> => {
    return SynchronousCollector.full<E, Array<E>, SignalCollectable<number>>((): Array<E> => [], (array: Array<E>, element: E): Array<E> => {
        array.push(element);
        return array;
    }, (array: Array<E>): SignalCollectable<number> => {
        return new SignalCollectable<number>(plan, windowed(array, window), window);
    });
};

/**
 * Creates a collector that finishes with the windowed complex transform.
 *
 * The transform length may exceed the sample count, which zero-pads after the
 * taper has been applied. Padding interpolates the DTFT and never resolves two
 * components that the window length merges.
 *
 * @template E - The source element type, which must be a number.
 * @param plan - The sampling plan the samples belong to.
 * @param size - The transform length in samples.
 * @param window - The analysis window.
 * @returns A reusable collector configured for this operation.
 * @throws {TypeError} If the length or the window is invalid, or a sample is not
 *         finite.
 * @throws {RangeError} If the length would truncate the signal.
 */
export let useSynchronousSpectrum: <E extends number>(plan: Sample, size: number, window: SpectralWindow) => SynchronousCollector<E, Array<E>, Spectrum> = <E extends number>(plan: Sample, size: number, window: SpectralWindow): SynchronousCollector<E, Array<E>, Spectrum> => {
    return SynchronousCollector.full<E, Array<E>, Spectrum>((): Array<E> => [], (array: Array<E>, element: E): Array<E> => {
        array.push(element);
        return array;
    }, (array: Array<E>): Spectrum => {
        return signalSpectrum(plan, array, size, window);
    });
};

/**
 * Creates a collector that finishes with the one-sided bins of the signal.
 *
 * Every interior bin is doubled to fold its conjugate mirror, while DC and, for
 * an even length, Nyquist keep the value the transform produced. Doubling those
 * two self-conjugate bins would invent 6.02 decibels of energy.
 *
 * @template E - The source element type, which must be a number.
 * @param plan - The sampling plan the samples belong to.
 * @param size - The transform length in samples.
 * @param window - The analysis window.
 * @returns A reusable collector configured for this operation.
 * @throws {TypeError} If the length or the window is invalid, or a sample is not
 *         finite.
 * @throws {RangeError} If the length would truncate the signal.
 */
export let useSynchronousOneSided: <E extends number>(plan: Sample, size: number, window: SpectralWindow) => SynchronousCollector<E, Array<E>, Array<Bin>> = <E extends number>(plan: Sample, size: number, window: SpectralWindow): SynchronousCollector<E, Array<E>, Array<Bin>> => {
    return SynchronousCollector.full<E, Array<E>, Array<Bin>>((): Array<E> => [], (array: Array<E>, element: E): Array<E> => {
        array.push(element);
        return array;
    }, (array: Array<E>): Array<Bin> => {
        return signalOneSided(plan, array, size, window);
    });
};

/**
 * Creates a collector that finishes with the calibrated one-sided amplitudes.
 *
 * The estimate divides by `count * coherentGain(window, count)` and doubles the
 * interior bins, so a unit sinusoid reads one at its own bin. The gain is taken
 * from the actual window vector rather than assumed to be one half.
 *
 * @template E - The source element type, which must be a number.
 * @param plan - The sampling plan the samples belong to.
 * @param window - The analysis window.
 * @returns A reusable collector configured for this operation.
 * @throws {TypeError} If the window is not callable or a sample is not finite.
 * @throws {RangeError} If the window weights sum to zero.
 */
export let useSynchronousAmplitude: <E extends number>(plan: Sample, window: SpectralWindow) => SynchronousCollector<E, Array<E>, Array<number>> = <E extends number>(plan: Sample, window: SpectralWindow): SynchronousCollector<E, Array<E>, Array<number>> => {
    return SynchronousCollector.full<E, Array<E>, Array<number>>((): Array<E> => [], (array: Array<E>, element: E): Array<E> => {
        array.push(element);
        return array;
    }, (array: Array<E>): Array<number> => {
        return signalAmplitude(plan, array, window);
    });
};

/**
 * Creates a collector that finishes with the one-sided powers.
 *
 * An interior bin reports `A[k]^2 / 2` and a self-conjugate bin reports
 * `A[k]^2`, so the sum over every bin is the mean square times the equivalent
 * noise bandwidth rather than the mean square itself.
 *
 * @template E - The source element type, which must be a number.
 * @param plan - The sampling plan the samples belong to.
 * @param window - The analysis window.
 * @returns A reusable collector configured for this operation.
 * @throws {TypeError} If the window is not callable or a sample is not finite.
 * @throws {RangeError} If the window weights sum to zero.
 */
export let useSynchronousPower: <E extends number>(plan: Sample, window: SpectralWindow) => SynchronousCollector<E, Array<E>, Array<number>> = <E extends number>(plan: Sample, window: SpectralWindow): SynchronousCollector<E, Array<E>, Array<number>> => {
    return SynchronousCollector.full<E, Array<E>, Array<number>>((): Array<E> => [], (array: Array<E>, element: E): Array<E> => {
        array.push(element);
        return array;
    }, (array: Array<E>): Array<number> => {
        return signalPower(plan, array, window);
    });
};

/**
 * Creates a collector that finishes with the amplitude levels in decibels.
 *
 * The conversion is `20 * log10`, the amplitude convention. It is wrong for a
 * power or a density, which must go through `useSynchronousPowerDecibel`.
 *
 * @template E - The source element type, which must be a number.
 * @param plan - The sampling plan the samples belong to.
 * @param window - The analysis window.
 * @returns A reusable collector configured for this operation.
 * @throws {TypeError} If the window is not callable or a sample is not finite.
 * @throws {RangeError} If the window weights sum to zero.
 */
export let useSynchronousDecibel: <E extends number>(plan: Sample, window: SpectralWindow) => SynchronousCollector<E, Array<E>, Array<number>> = <E extends number>(plan: Sample, window: SpectralWindow): SynchronousCollector<E, Array<E>, Array<number>> => {
    return SynchronousCollector.full<E, Array<E>, Array<number>>((): Array<E> => [], (array: Array<E>, element: E): Array<E> => {
        array.push(element);
        return array;
    }, (array: Array<E>): Array<number> => {
        return signalDecibel(plan, array, window);
    });
};

/**
 * Creates a collector that finishes with the power levels in decibels.
 *
 * The conversion is `10 * log10`, the power convention, which is the only correct
 * one for a power, an energy, a mean square or a density.
 *
 * @template E - The source element type, which must be a number.
 * @param plan - The sampling plan the samples belong to.
 * @param window - The analysis window.
 * @returns A reusable collector configured for this operation.
 * @throws {TypeError} If the window is not callable or a sample is not finite.
 * @throws {RangeError} If the window weights sum to zero.
 */
export let useSynchronousPowerDecibel: <E extends number>(plan: Sample, window: SpectralWindow) => SynchronousCollector<E, Array<E>, Array<number>> = <E extends number>(plan: Sample, window: SpectralWindow): SynchronousCollector<E, Array<E>, Array<number>> => {
    return SynchronousCollector.full<E, Array<E>, Array<number>>((): Array<E> => [], (array: Array<E>, element: E): Array<E> => {
        array.push(element);
        return array;
    }, (array: Array<E>): Array<number> => {
        return signalPowerDecibel(plan, array, window);
    });
};

/**
 * Creates a collector that finishes with a Welch power spectral density.
 *
 * The record is cut into overlapping segments, each one is detrended, weighted and
 * transformed, and the periodograms are averaged. The divisor is
 * `rate * sum(w^2)`, which is the only one that keeps a white-noise floor
 * unbiased.
 *
 * @template E - The source element type, which must be a number.
 * @param plan - The sampling plan the samples belong to.
 * @param frameSize - The segment length in samples.
 * @param hopSize - The samples between segment starts.
 * @param window - The analysis window.
 * @returns A reusable collector configured for this operation.
 * @throws {TypeError} If a length or the window is invalid, or a sample is not
 *         finite.
 * @throws {RangeError} If the framing is impossible or the window weights are all
 *         zero.
 */
export let useSynchronousPowerSpectralDensity: <E extends number>(plan: Sample, frameSize: number, hopSize: number, window: SpectralWindow) => SynchronousCollector<E, Array<E>, SpectralDensity> = <E extends number>(plan: Sample, frameSize: number, hopSize: number, window: SpectralWindow): SynchronousCollector<E, Array<E>, SpectralDensity> => {
    return SynchronousCollector.full<E, Array<E>, SpectralDensity>((): Array<E> => [], (array: Array<E>, element: E): Array<E> => {
        array.push(element);
        return array;
    }, (array: Array<E>): SpectralDensity => {
        return signalPowerSpectralDensity(plan, array, frameSize, hopSize, window);
    });
};

/**
 * Creates a collector that finishes with the short-time Fourier transform.
 *
 * The signal is extended by half a frame at each end and the tail is padded, so
 * the first frame is centred on the first sample and no sample is dropped. Frame
 * centres are reported at multiples of the hop on the original axis.
 *
 * @template E - The source element type, which must be a number.
 * @param plan - The sampling plan the samples belong to.
 * @param frameSize - The frame length in samples.
 * @param hopSize - The samples between frame starts.
 * @param window - The analysis window.
 * @returns A reusable collector configured for this operation.
 * @throws {TypeError} If a length or the window is invalid, or a sample is not
 *         finite.
 * @throws {RangeError} If the frame exceeds the signal, the hop exceeds the frame,
 *         or the framing yields no frame.
 */
export let useSynchronousShortTimeFourierTransform: <E extends number>(plan: Sample, frameSize: number, hopSize: number, window: SpectralWindow) => SynchronousCollector<E, Array<E>, Array<Spectrum>> = <E extends number>(plan: Sample, frameSize: number, hopSize: number, window: SpectralWindow): SynchronousCollector<E, Array<E>, Array<Spectrum>> => {
    return SynchronousCollector.full<E, Array<E>, Array<Spectrum>>((): Array<E> => [], (array: Array<E>, element: E): Array<E> => {
        array.push(element);
        return array;
    }, (array: Array<E>): Array<Spectrum> => {
        return signalShortTimeFourierTransform(plan, array, frameSize, hopSize, window);
    });
};

/**
 * Creates a collector that finishes with the time-frequency view.
 *
 * The columns are the spectra of `useSynchronousShortTimeFourierTransform` with
 * the same framing, and the view retains the hop, the taper and the zero boundary
 * so that it reports frame centre times on the original axis.
 *
 * @template E - The source element type, which must be a number.
 * @param plan - The sampling plan the samples belong to.
 * @param frameSize - The frame length in samples.
 * @param hopSize - The samples between frame starts.
 * @param window - The analysis window.
 * @returns A reusable collector configured for this operation.
 * @throws {TypeError} If a length or the window is invalid, or a sample is not
 *         finite.
 * @throws {RangeError} If the framed columns cannot be built.
 */
export let useSynchronousSpectrogram: <E extends number>(plan: Sample, frameSize: number, hopSize: number, window: SpectralWindow) => SynchronousCollector<E, Array<E>, Spectrogram> = <E extends number>(plan: Sample, frameSize: number, hopSize: number, window: SpectralWindow): SynchronousCollector<E, Array<E>, Spectrogram> => {
    return SynchronousCollector.full<E, Array<E>, Spectrogram>((): Array<E> => [], (array: Array<E>, element: E): Array<E> => {
        array.push(element);
        return array;
    }, (array: Array<E>): Spectrogram => {
        return signalSpectrogram(plan, array, frameSize, hopSize, window);
    });
};

/**
 * Creates a collector that finishes with the analytic signal.
 *
 * The negative-frequency half of the transform is cleared and the positive half is
 * doubled, so each sample becomes `x[n] + i * H(x)[n]` with the envelope as its
 * modulus. The transform is circular, so the two ends of a non-integer-periodic
 * record are contaminated.
 *
 * @template E - The source element type, which must be a number.
 * @param plan - The sampling plan the samples belong to.
 * @returns A reusable collector configured for this operation.
 * @throws {TypeError} If a sample is not finite.
 * @throws {RangeError} If the source is empty or the plan does not match it.
 */
export let useSynchronousAnalyticSignal: <E extends number>(plan: Sample) => SynchronousCollector<E, Array<E>, Array<Complex>> = <E extends number>(plan: Sample): SynchronousCollector<E, Array<E>, Array<Complex>> => {
    return SynchronousCollector.full<E, Array<E>, Array<Complex>>((): Array<E> => [], (array: Array<E>, element: E): Array<E> => {
        array.push(element);
        return array;
    }, (array: Array<E>): Array<Complex> => {
        return signalAnalyticSignal(plan, array);
    });
};

/**
 * Creates a collector that finishes with the instantaneous phases.
 *
 * Each analytic sample becomes its argument in radians, normalised into one turn,
 * so the sequence jumps by a full turn once per cycle.
 *
 * @template E - The source element type, which must be a number.
 * @param plan - The sampling plan the samples belong to.
 * @returns A reusable collector configured for this operation.
 * @throws {TypeError} If a sample is not finite.
 * @throws {RangeError} If the source is empty or the plan does not match it.
 */
export let useSynchronousInstantaneousPhase: <E extends number>(plan: Sample) => SynchronousCollector<E, Array<E>, Array<Angle>> = <E extends number>(plan: Sample): SynchronousCollector<E, Array<E>, Array<Angle>> => {
    return SynchronousCollector.full<E, Array<E>, Array<Angle>>((): Array<E> => [], (array: Array<E>, element: E): Array<E> => {
        array.push(element);
        return array;
    }, (array: Array<E>): Array<Angle> => {
        return signalInstantaneousPhase(plan, array);
    });
};

/**
 * Creates a collector that finishes with the instantaneous envelope.
 *
 * The envelope is the modulus of the analytic signal, which is constant for an
 * unmodulated sinusoid, and it carries the units of the samples.
 *
 * @template E - The source element type, which must be a number.
 * @param plan - The sampling plan the samples belong to.
 * @returns A reusable collector configured for this operation.
 * @throws {TypeError} If a sample is not finite.
 * @throws {RangeError} If the source is empty or the plan does not match it.
 */
export let useSynchronousEnvelope: <E extends number>(plan: Sample) => SynchronousCollector<E, Array<E>, Array<number>> = <E extends number>(plan: Sample): SynchronousCollector<E, Array<E>, Array<number>> => {
    return SynchronousCollector.full<E, Array<E>, Array<number>>((): Array<E> => [], (array: Array<E>, element: E): Array<E> => {
        array.push(element);
        return array;
    }, (array: Array<E>): Array<number> => {
        return signalEnvelope(plan, array);
    });
};

/**
 * Creates a collector that finishes with the instantaneous frequencies.
 *
 * The unwrapped analytic phase is differentiated and scaled by `rate / (2 * PI)`.
 * Samples whose envelope, or whose predecessor's envelope, falls below the gate
 * report zero instead of the phase noise that a vanishing envelope produces.
 *
 * @template E - The source element type, which must be a number.
 * @param plan - The sampling plan the samples belong to.
 * @param rate - The sampling rate used to scale the phase step.
 * @param gate - The envelope threshold as a fraction of the peak envelope.
 * @returns A reusable collector configured for this operation.
 * @throws {TypeError} If the rate or the gate is not a finite number, or a sample
 *         is not finite.
 * @throws {RangeError} If the rate is not positive, the gate lies outside
 *         `[0, 1]`, or the source is empty.
 */
export let useSynchronousInstantaneousFrequency: <E extends number>(plan: Sample, rate: number, gate: number) => SynchronousCollector<E, Array<E>, Array<number>> = <E extends number>(plan: Sample, rate: number, gate: number): SynchronousCollector<E, Array<E>, Array<number>> => {
    return SynchronousCollector.full<E, Array<E>, Array<number>>((): Array<E> => [], (array: Array<E>, element: E): Array<E> => {
        array.push(element);
        return array;
    }, (array: Array<E>): Array<number> => {
        return signalInstantaneousFrequency(plan, array, rate, gate);
    });
};

/**
 * Creates a collector that finishes with the zero-crossing rate.
 *
 * The rate is the crossing count divided by `count - 1`, so a sine of `f` hertz
 * sampled at `rate` hertz reads `2 * f / rate` and an alternating signal reads
 * one. The optional flag converts it to crossings per second.
 *
 * @template E - The source element type, which must be a number.
 * @param plan - The sampling plan the samples belong to.
 * @param perSecond - Whether to report crossings per second rather than per
 *        sample.
 * @returns A reusable collector configured for this operation.
 * @throws {TypeError} If a sample is not finite or the flag is not a boolean.
 * @throws {RangeError} If the source is empty or the plan does not match it.
 */
export let useSynchronousZeroCrossingRate: <E extends number>(plan: Sample, perSecond: boolean) => SynchronousCollector<E, Array<E>, number> = <E extends number>(plan: Sample, perSecond: boolean): SynchronousCollector<E, Array<E>, number> => {
    return SynchronousCollector.full<E, Array<E>, number>((): Array<E> => [], (array: Array<E>, element: E): Array<E> => {
        array.push(element);
        return array;
    }, (array: Array<E>): number => {
        return signalZeroCrossingRate(plan, array, perSecond);
    });
};

/**
 * Creates a collector that finishes with the spectral flux sequence.
 *
 * Each frame's one-sided magnitude spectrum is scaled to unit norm and compared
 * with the previous frame, so the value measures spectral shape change rather
 * than loudness. The result holds one value per adjacent frame pair.
 *
 * @template E - The source element type, which must be a number.
 * @param plan - The sampling plan the samples belong to.
 * @param frameSize - The frame length in samples.
 * @param hopSize - The samples between frame starts.
 * @param window - The analysis window.
 * @returns A reusable collector configured for this operation.
 * @throws {TypeError} If a length or the window is invalid, or a sample is not
 *         finite.
 * @throws {RangeError} If the framed columns cannot be built.
 */
export let useSynchronousSpectralFlux: <E extends number>(plan: Sample, frameSize: number, hopSize: number, window: SpectralWindow) => SynchronousCollector<E, Array<E>, Array<number>> = <E extends number>(plan: Sample, frameSize: number, hopSize: number, window: SpectralWindow): SynchronousCollector<E, Array<E>, Array<number>> => {
    return SynchronousCollector.full<E, Array<E>, Array<number>>((): Array<E> => [], (array: Array<E>, element: E): Array<E> => {
        array.push(element);
        return array;
    }, (array: Array<E>): Array<number> => {
        return signalSpectralFlux(plan, array, frameSize, hopSize, window);
    });
};

/**
 * Creates a collector that finishes with the auto-correlation profile.
 *
 * The default normalisation divides by the zero-lag sum, so the first value is
 * exactly one and the profile is comparable across signal lengths. The raw sum and
 * the unbiased sum are available as alternatives.
 *
 * @template E - The source element type, which must be a number.
 * @param plan - The sampling plan the samples belong to.
 * @param maximumLag - The largest lag to report.
 * @param normalization - The normalisation rule.
 * @returns A reusable collector configured for this operation.
 * @throws {TypeError} If the lag is not an integer, the rule is not supported, or
 *         a sample is not finite.
 * @throws {RangeError} If the lag is negative or not below the source length.
 */
export let useSynchronousAutocorrelation: <E extends number>(plan: Sample, maximumLag: number, normalization: CorrelationNormalization) => SynchronousCollector<E, Array<E>, Array<number>> = <E extends number>(plan: Sample, maximumLag: number, normalization: CorrelationNormalization): SynchronousCollector<E, Array<E>, Array<number>> => {
    return SynchronousCollector.full<E, Array<E>, Array<number>>((): Array<E> => [], (array: Array<E>, element: E): Array<E> => {
        array.push(element);
        return array;
    }, (array: Array<E>): Array<number> => {
        return signalAutocorrelation(plan, array, maximumLag, normalization);
    });
};

/**
 * Creates a collector that finishes with the spectral centroid.
 *
 * The centroid is the power-weighted mean of the one-sided bin frequencies, so a
 * pure tone reports its own frequency. A silent source has no centre of mass and
 * finishes with an empty `Optional`.
 *
 * @template E - The source element type, which must be a number.
 * @param plan - The sampling plan the samples belong to.
 * @param window - The analysis window.
 * @returns A reusable collector configured for this operation.
 * @throws {TypeError} If the window is not callable or a sample is not finite.
 * @throws {RangeError} If the source is empty or the plan does not match it.
 */
export let useSynchronousSpectralCentroid: <E extends number>(plan: Sample, window: SpectralWindow) => SynchronousCollector<E, Array<E>, Optional<Frequency>> = <E extends number>(plan: Sample, window: SpectralWindow): SynchronousCollector<E, Array<E>, Optional<Frequency>> => {
    return SynchronousCollector.full<E, Array<E>, Optional<Frequency>>((): Array<E> => [], (array: Array<E>, element: E): Array<E> => {
        array.push(element);
        return array;
    }, (array: Array<E>): Optional<Frequency> => {
        return signalSpectralCentroid(plan, array, window);
    });
};

/**
 * Creates a collector that finishes with the spectral bandwidth.
 *
 * The bandwidth is the power-weighted standard deviation of the one-sided bin
 * frequencies around the centroid, so a pure tone reports approximately zero. A
 * silent source finishes with an empty `Optional`.
 *
 * @template E - The source element type, which must be a number.
 * @param plan - The sampling plan the samples belong to.
 * @param window - The analysis window.
 * @returns A reusable collector configured for this operation.
 * @throws {TypeError} If the window is not callable or a sample is not finite.
 * @throws {RangeError} If the source is empty or the plan does not match it.
 */
export let useSynchronousSpectralBandwidth: <E extends number>(plan: Sample, window: SpectralWindow) => SynchronousCollector<E, Array<E>, Optional<Frequency>> = <E extends number>(plan: Sample, window: SpectralWindow): SynchronousCollector<E, Array<E>, Optional<Frequency>> => {
    return SynchronousCollector.full<E, Array<E>, Optional<Frequency>>((): Array<E> => [], (array: Array<E>, element: E): Array<E> => {
        array.push(element);
        return array;
    }, (array: Array<E>): Optional<Frequency> => {
        return signalSpectralBandwidth(plan, array, window);
    });
};

/**
 * Creates a collector that finishes with the spectral rolloff frequency.
 *
 * The cumulative power over the one-sided half is accumulated in increasing
 * frequency order and the first bin that reaches the requested fraction is
 * reported. A silent source finishes with an empty `Optional`.
 *
 * @template E - The source element type, which must be a number.
 * @param plan - The sampling plan the samples belong to.
 * @param window - The analysis window.
 * @param ratio - The cumulative fraction, within `(0, 1]`.
 * @returns A reusable collector configured for this operation.
 * @throws {TypeError} If the ratio or the window is invalid, or a sample is not
 *         finite.
 * @throws {RangeError} If the ratio lies outside `(0, 1]` or the source is empty.
 */
export let useSynchronousSpectralRolloff: <E extends number>(plan: Sample, window: SpectralWindow, ratio: number) => SynchronousCollector<E, Array<E>, Optional<Frequency>> = <E extends number>(plan: Sample, window: SpectralWindow, ratio: number): SynchronousCollector<E, Array<E>, Optional<Frequency>> => {
    return SynchronousCollector.full<E, Array<E>, Optional<Frequency>>((): Array<E> => [], (array: Array<E>, element: E): Array<E> => {
        array.push(element);
        return array;
    }, (array: Array<E>): Optional<Frequency> => {
        return signalSpectralRolloff(plan, array, window, ratio);
    });
};

/**
 * Creates a collector that finishes with the spectral flatness.
 *
 * The ratio of the geometric mean to the arithmetic mean of the one-sided power
 * spectrum approaches one for noise and zero for a tone. The definition is over
 * power and over the one-sided half, never over the conjugate mirror.
 *
 * @template E - The source element type, which must be a number.
 * @param plan - The sampling plan the samples belong to.
 * @param window - The analysis window.
 * @returns A reusable collector configured for this operation.
 * @throws {TypeError} If the window is not callable or a sample is not finite.
 * @throws {RangeError} If the source is empty or the plan does not match it.
 */
export let useSynchronousSpectralFlatness: <E extends number>(plan: Sample, window: SpectralWindow) => SynchronousCollector<E, Array<E>, number> = <E extends number>(plan: Sample, window: SpectralWindow): SynchronousCollector<E, Array<E>, number> => {
    return SynchronousCollector.full<E, Array<E>, number>((): Array<E> => [], (array: Array<E>, element: E): Array<E> => {
        array.push(element);
        return array;
    }, (array: Array<E>): number => {
        return signalSpectralFlatness(plan, array, window);
    });
};

/**
 * Creates a collector that finishes with the signal-to-noise ratio estimate.
 *
 * The noise floor is a quantile of the Welch density, the in-band power is its
 * integral and the result is `10 * log10((band - noise) / noise)`. A band that
 * holds no power above the floor finishes with an empty `Optional`.
 *
 * @template E - The source element type, which must be a number.
 * @param plan - The sampling plan the samples belong to.
 * @param frameSize - The segment length in samples.
 * @param hopSize - The samples between segment starts.
 * @param window - The analysis window.
 * @param floorQuantile - The quantile used as the noise floor, within `(0, 1)`.
 * @returns A reusable collector configured for this operation.
 * @throws {TypeError} If a length, the window or the quantile is invalid, or a
 *         sample is not finite.
 * @throws {RangeError} If the framing is impossible or the quantile lies outside
 *         `(0, 1)`.
 */
export let useSynchronousSignalToNoiseRatio: <E extends number>(plan: Sample, frameSize: number, hopSize: number, window: SpectralWindow, floorQuantile: number) => SynchronousCollector<E, Array<E>, Optional<number>> = <E extends number>(plan: Sample, frameSize: number, hopSize: number, window: SpectralWindow, floorQuantile: number): SynchronousCollector<E, Array<E>, Optional<number>> => {
    return SynchronousCollector.full<E, Array<E>, Optional<number>>((): Array<E> => [], (array: Array<E>, element: E): Array<E> => {
        array.push(element);
        return array;
    }, (array: Array<E>): Optional<number> => {
        return signalSignalToNoiseRatio(plan, array, frameSize, hopSize, window, floorQuantile);
    });
};

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
