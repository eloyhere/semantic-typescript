/**
 * Synchronous collectors that materialise the source into a concrete value: arrays,
 * maps, sets, lists, rings, trees and other containers, plus the general-purpose
 * collect, reduce, join and write terminals.
 */
import { isFunction, isString, isObject } from "#semantic/guard";
import { Optional } from "#semantic/optional";
import { SynchronousCollector } from "#semantic/synchronous/collector";
import { SynchronousRing } from "#semantic/structure/ring";
import { SynchronousRootedForest } from "#semantic/structure/forest/rootedForest";
import { SynchronousList } from "#semantic/structure/list";
import { SynchronousUnorderedLRUMap, SynchronousUnorderedLRUSet } from "#semantic/structure/lru";
import { SynchronousOrderedMap, SynchronousUnorderedMap } from "#semantic/structure/map";
import { SynchronousOrderedSet, SynchronousUnorderedSet } from "#semantic/structure/set";
import { SynchronousSkipMap, SynchronousSkipSet } from "#semantic/structure/skip";
import { SynchronousBinarySearchTree } from "#semantic/structure/tree/binarySearchTree";
import type { BiFunctional, BiPredicate, Functional, Predicate, Supplier, TriFunctional, TriPredicate, Comparator, Indexed } from "#semantic/utility";
import { invalidate, validate } from "#semantic/utility";

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
 * Creates a collector that finishes with a new synchronous ring.
 *
 * Buffered elements become the positions of a `SynchronousRing`, a positional
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
export let useSynchronousToRing: <E>(span?: number) => SynchronousCollector<E, Array<E>, SynchronousRing<E>> = <E>(span?: number): SynchronousCollector<E, Array<E>, SynchronousRing<E>> => {
    return SynchronousCollector.full<E, Array<E>, SynchronousRing<E>>((): Array<E> => [], (array: Array<E>, element: E): Array<E> => {
        array.push(element);
        return array;
    }, (array: Array<E>): SynchronousRing<E> => {
        return new SynchronousRing<E>(array, { span: span });
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
